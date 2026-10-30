'use strict'

/**
 * API HTTP para sistemas externos (ex.: o portal) mandarem mensagens pelo bot.
 * Só liga se API_TOKEN estiver no .env. Todas as rotas exigem o cabeçalho
 *   Authorization: Bearer <API_TOKEN>
 *
 *   GET  /status   → { conectado }
 *   GET  /grupos   → grupos em que o bot está (para descobrir o id)
 *   POST /enviar   → { grupo?, mensagem }  (grupo padrão: API_DEFAULT_GROUP)
 *
 * Só envia para GRUPOS: disparar no privado de várias pessoas é o que mais
 * faz o WhatsApp banir números de bots não oficiais.
 */

const http = require('http')
const crypto = require('crypto')
const { getSocket } = require('./connection')

const MAX_BODY_BYTES = 16 * 1024
const MAX_MESSAGE_CHARS = 4000
// Limite global de envios, para um bug no portal não virar spam.
const RATE_WINDOW_MS = 60 * 1000
const RATE_MAX = 20
let sentTimes = []

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

  if (req.method === 'POST' && url.pathname === '/enviar') {
    const body = await readJson(req)
    const grupo = String(body.grupo || process.env.API_DEFAULT_GROUP || '').trim()
    const mensagem = String(body.mensagem || '').trim()

    if (!grupo.endsWith('@g.us')) {
      return send(400, { erro: 'Informe "grupo" com o id do grupo (termina em @g.us). Veja GET /grupos.' })
    }
    if (!mensagem) return send(400, { erro: 'Informe "mensagem".' })
    if (mensagem.length > MAX_MESSAGE_CHARS) {
      return send(400, { erro: `Mensagem muito longa (máx. ${MAX_MESSAGE_CHARS} caracteres).` })
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
