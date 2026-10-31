'use strict'

/**
 * API HTTP para sistemas externos (ex.: o portal) mandarem mensagens pelo bot.
 * Só liga se API_TOKEN estiver no .env. Todas as rotas exigem o cabeçalho
 *   Authorization: Bearer <API_TOKEN>
 *
 *   GET  /status   → { conectado }
 *   GET  /grupos   → grupos em que o bot está (para descobrir o id)
 *   GET  /membros  → números que podem receber no privado
 *   POST /enviar   → { grupo?, mensagem }  (grupo padrão: API_DEFAULT_GROUP)
 *                    { numero, mensagem }  (privado)
 *
 * Privado só para quem é membro do grupo API_DM_GROUP (conferido na hora,
 * então quem entra/sai do grupo entra/sai da lista) e um envio por vez:
 * disparar no privado de muita gente é o que mais faz o WhatsApp banir
 * números de bots não oficiais.
 */

const http = require('http')
const crypto = require('crypto')
const { jidNormalizedUser } = require('@whiskeysockets/baileys')
const { getSocket } = require('./connection')
const config = require('./config')

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
    return send(200, { conectado: Boolean(getSocket()) })
  }

  const sock = getSocket()
  if (!sock) return send(503, { erro: 'Bot desconectado do WhatsApp. Tente de novo em instantes.' })

  if (req.method === 'GET' && url.pathname === '/grupos') {
    const groups = Object.values(await sock.groupFetchAllParticipating())
    return send(200, {
      grupos: groups.map(g => ({ id: g.id, nome: g.subject, participantes: g.participants.length }))
    })
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
        headers['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS'
      }
      res.writeHead(status, headers)
      res.end(data === undefined ? '' : JSON.stringify(data))
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
