'use strict'

/**
 * API HTTP para sistemas externos (ex.: o portal) mandarem mensagens pelo bot.
 * Só liga se API_TOKEN estiver no .env. Todas as rotas exigem o cabeçalho
 *   Authorization: Bearer <API_TOKEN>
 *
 *   GET   /status               → saúde: conectado, desde quando, reconexões, falhas
 *   GET   /grupos               → grupos do bot com ativo/boas-vindas/antilink/admin
 *   PATCH /grupos/:id           → { ativo?, boasVindas?, antilink? } (= /corvus, /welcome, /antilink)
 *   GET   /grupos/:id/ranking   → top 10 de XP e de mensagens do grupo
 *   GET   /membros              → números que podem receber no privado
 *   POST  /enviar               → { grupo?, mensagem }  (grupo padrão: API_DEFAULT_GROUP)
 *                                 { numero, mensagem }  (privado)
 *
 * Privado só para quem é membro do grupo API_DM_GROUP (conferido na hora,
 * então quem entra/sai do grupo entra/sai da lista) e um envio por vez:
 * disparar no privado de muita gente é o que mais faz o WhatsApp banir
 * números de bots não oficiais.
 */

const http = require('http')
const crypto = require('crypto')
const { jidNormalizedUser } = require('@whiskeysockets/baileys')
const { getSocket, getHealth } = require('./connection')
const config = require('./config')
const { store } = require('./lib/store')
const { getAdmins, botJids } = require('./lib/group')
const leveling = require('./lib/leveling')

const groupsConf = store('groups')
const counters = store('counters')
const STARTED_AT = new Date().toISOString()
// Últimas falhas de envio, para o painel de saúde do portal.
const recentFailures = []

function recordFailure (target, message) {
  recentFailures.unshift({ target, erro: message, quando: new Date().toISOString() })
  recentFailures.length = Math.min(recentFailures.length, 10)
}

/** Mapa id do participante (lid/jid) → número de telefone, quando o grupo informa. */
function phoneById (meta) {
  const out = new Map()
  for (const p of meta.participants || []) {
    const ids = [p.id, p.jid, p.phoneNumber].filter(Boolean).map(jidNormalizedUser)
    const phone = ids.find(id => id.endsWith('@s.whatsapp.net'))?.split('@')[0] || null
    for (const id of ids) out.set(id, phone)
  }
  return out
}

const MAX_BODY_BYTES = 16 * 1024
const MAX_MESSAGE_CHARS = 4000
// Limite global de envios, para um bug no portal não virar spam.
const RATE_WINDOW_MS = 60 * 1000
const RATE_MAX = 20
let sentTimes = []
// Intervalo mínimo entre mensagens no privado.
const DM_GAP_MS = 5 * 1000
let lastDmAt = 0

/**
 * Membros do grupo de privado que têm número de telefone visível:
 * Map(variante do número → { phone, jid }).
 *
 * `jid` é o @lid do membro quando o grupo informa: o grupo já conversa com
 * ele pelo LID, e mandar o privado pelo número de telefone cria uma segunda
 * sessão de criptografia para o mesmo aparelho — as duas se atropelam e a
 * pessoa recebe "Aguardando mensagem".
 */
async function dmMembers (sock) {
  const groupId = process.env.API_DM_GROUP
  if (!groupId) return null
  const meta = await sock.groupMetadata(groupId)
  const bot = new Set([sock.user?.id, sock.user?.lid].filter(Boolean).map(jidNormalizedUser))
  const out = new Map()
  for (const p of meta.participants || []) {
    const ids = [p.id, p.jid, p.phoneNumber].filter(Boolean).map(jidNormalizedUser)
    if (ids.some(id => bot.has(id))) continue
    const phoneJid = ids.find(id => id.endsWith('@s.whatsapp.net'))
    if (!phoneJid) continue
    const phone = phoneJid.split('@')[0]
    const member = { phone, jid: ids.find(id => id.endsWith('@lid')) || phoneJid }
    for (const v of config.phoneVariants(phone)) out.set(v, member)
  }
  return out
}

function tokenMatches (header, token) {
  const given = Buffer.from(String(header || '').replace(/^Bearer\s+/i, ''))
  const expected = Buffer.from(token)
  return given.length === expected.length && crypto.timingSafeEqual(given, expected)
}

function readJson (req) {
  return new Promise((resolve, reject) => {
    let size = 0
    const chunks = []
    req.on('data', (chunk) => {
      size += chunk.length
      if (size > MAX_BODY_BYTES) {
        reject(Object.assign(new Error('Corpo muito grande.'), { status: 413 }))
        req.destroy()
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => {
      try {
        resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf-8')) : {})
      } catch {
        reject(Object.assign(new Error('JSON inválido.'), { status: 400 }))
      }
    })
    req.on('error', reject)
  })
}

function rateLimited () {
  const now = Date.now()
  sentTimes = sentTimes.filter(t => now - t < RATE_WINDOW_MS)
  if (sentTimes.length >= RATE_MAX) return true
  sentTimes.push(now)
  return false
}

async function route (req, res, send) {
  const url = new URL(req.url, 'http://localhost')

  if (req.method === 'GET' && url.pathname === '/status') {
    const h = getHealth()
    return send(200, {
      conectado: h.connected,
      conectadoDesde: h.connectedAt,
      processoDesde: STARTED_AT,
      reconexoes: h.reconnects,
      ultimaQueda: h.lastClose,
      falhasRecentes: recentFailures
    })
  }

  const sock = getSocket()
  if (!sock) return send(503, { erro: 'Bot desconectado do WhatsApp. Tente de novo em instantes.' })

  if (req.method === 'GET' && url.pathname === '/grupos') {
    const groups = Object.values(await sock.groupFetchAllParticipating())
    const mine = new Set(botJids(sock))
    return send(200, {
      grupos: groups.map(g => {
        const conf = groupsConf.get(g.id, {})
        return {
          id: g.id,
          nome: g.subject,
          participantes: g.participants.length,
          ativo: conf.active === true,
          boasVindas: conf.welcome === true,
          antilink: conf.antilink === true,
          botAdmin: getAdmins(g).some(id => mine.has(id))
        }
      })
    })
  }

  const groupRoute = url.pathname.match(/^\/grupos\/([^/]+@g\.us)(\/ranking)?$/)
  if (groupRoute) {
    const groupId = decodeURIComponent(groupRoute[1])
    const meta = await sock.groupMetadata(groupId).catch(() => {
      throw Object.assign(new Error('O bot não está nesse grupo.'), { status: 404 })
    })

    if (req.method === 'PATCH' && !groupRoute[2]) {
      const body = await readJson(req)
      const FIELDS = { ativo: 'active', boasVindas: 'welcome', antilink: 'antilink' }
      const patch = {}
      for (const [field, key] of Object.entries(FIELDS)) {
        if (typeof body[field] === 'boolean') patch[key] = body[field]
      }
      if (!Object.keys(patch).length) return send(400, { erro: 'Nada para alterar.' })
      await groupsConf.update(groupId, (current) => ({ ...current, ...patch }), {})
      const conf = groupsConf.get(groupId, {})
      return send(200, { ok: true, ativo: conf.active === true, boasVindas: conf.welcome === true, antilink: conf.antilink === true })
    }

    if (req.method === 'GET' && groupRoute[2]) {
      const phones = phoneById(meta)
      const inGroup = (id) => phones.has(jidNormalizedUser(id))
      const xp = leveling.top(10, inGroup).map(u => ({
        id: u.id, telefone: phones.get(jidNormalizedUser(u.id)) || null, nivel: u.level, xp: u.xp
      }))
      const mensagens = Object.entries(counters.get(groupId, {}))
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([id, total]) => ({ id, telefone: phones.get(jidNormalizedUser(id)) || null, total }))
      return send(200, { xp, mensagens })
    }
  }

  if (req.method === 'GET' && url.pathname === '/membros') {
    const members = await dmMembers(sock)
    if (!members) return send(400, { erro: 'Envio no privado desligado (API_DM_GROUP não definido).' })
    const numeros = [...new Set([...members.values()].map(m => m.phone))]
    return send(200, { numeros })
  }

  if (req.method === 'POST' && url.pathname === '/enviar') {
    const body = await readJson(req)
    const mensagem = String(body.mensagem || '').trim()
    if (!mensagem) return send(400, { erro: 'Informe "mensagem".' })
    if (mensagem.length > MAX_MESSAGE_CHARS) {
      return send(400, { erro: `Mensagem muito longa (máx. ${MAX_MESSAGE_CHARS} caracteres).` })
    }

    if (body.numero) {
      const members = await dmMembers(sock)
      if (!members) return send(400, { erro: 'Envio no privado desligado (API_DM_GROUP não definido).' })
      const jid = config.phoneVariants(body.numero).map(v => members.get(v)?.jid).find(Boolean)
      if (!jid) return send(403, { erro: 'Esse número não está no grupo liberado para o privado.' })
      const wait = DM_GAP_MS - (Date.now() - lastDmAt)
      if (wait > 0) {
        return send(429, { erro: `Aguarde ${Math.ceil(wait / 1000)}s entre mensagens no privado.` })
      }
      if (rateLimited()) return send(429, { erro: 'Muitos envios seguidos. Aguarde um minuto.' })
      lastDmAt = Date.now()
      const sent = await sock.sendMessage(jid, { text: mensagem })
      return send(200, { ok: true, id: sent?.key?.id })
    }

    const grupo = String(body.grupo || process.env.API_DEFAULT_GROUP || '').trim()
    if (!grupo.endsWith('@g.us')) {
      return send(400, { erro: 'Informe "grupo" (id terminado em @g.us, veja GET /grupos) ou "numero".' })
    }
    if (rateLimited()) return send(429, { erro: 'Muitos envios seguidos. Aguarde um minuto.' })

    // Falha aqui se o bot não estiver no grupo.
    await sock.groupMetadata(grupo).catch(() => {
      throw Object.assign(new Error('O bot não está nesse grupo.'), { status: 404 })
    })
    const sent = await sock.sendMessage(grupo, { text: mensagem })
    return send(200, { ok: true, id: sent?.key?.id })
  }

  return send(404, { erro: 'Rota não encontrada.' })
}

/** Sobe a API se API_TOKEN estiver definido; senão não faz nada. */
function startApi () {
  const token = process.env.API_TOKEN
  if (!token) return null
  if (token.length < 16) {
    console.warn('[api] API_TOKEN muito curto (mín. 16 caracteres). API não iniciada.')
    return null
  }

  const port = Number(process.env.API_PORT) || 3000
  const corsOrigin = process.env.API_CORS_ORIGIN

  const server = http.createServer((req, res) => {
    const send = (status, data) => {
      if (res.headersSent) return
      const headers = { 'Content-Type': 'application/json; charset=utf-8' }
      if (corsOrigin) {
        headers['Access-Control-Allow-Origin'] = corsOrigin
        headers['Access-Control-Allow-Headers'] = 'Authorization, Content-Type'
        headers['Access-Control-Allow-Methods'] = 'GET, POST, PATCH, OPTIONS'
      }
      res.writeHead(status, headers)
      res.end(data === undefined ? '' : JSON.stringify(data))
      if (status >= 400 && req.url.startsWith('/enviar')) recordFailure('enviar', data?.erro)
    }

    if (req.method === 'OPTIONS') return send(204)
    if (!tokenMatches(req.headers.authorization, token)) return send(401, { erro: 'Token inválido.' })

    route(req, res, send).catch((err) => {
      if (!err.status) console.error('[api] Erro:', err.message)
      send(err.status || 500, { erro: err.status ? err.message : 'Erro interno ao enviar.' })
    })
  })

  server.listen(port, () => console.log(`🔌 API do portal ouvindo na porta ${port}.`))
  server.on('error', (err) => console.error('[api] Falha ao abrir a porta:', err.message))
  return server
}

module.exports = { startApi }
