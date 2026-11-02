'use strict'

/**
 * Saída de mensagens "de sistema" (API do portal e avisos automáticos).
 *
 * - Privado só para quem está no grupo API_DM_GROUP e sempre pelo @lid do
 *   membro (o grupo já fala com ele pelo LID; mandar pelo número cria uma
 *   segunda sessão Signal e a pessoa recebe "Aguardando mensagem").
 * - Privados saem em fila, com DM_GAP_MS entre um e outro: disparar no
 *   privado de muita gente é o que mais faz o WhatsApp banir bots.
 * - Menções no grupo: por número de telefone ou todos os participantes.
 */

const { jidNormalizedUser } = require('@whiskeysockets/baileys')
const config = require('../config')

const DM_GAP_MS = 5 * 1000
let dmQueue = Promise.resolve()
let lastDmAt = 0

function botIds (sock) {
  return new Set([sock.user?.id, sock.user?.lid].filter(Boolean).map(jidNormalizedUser))
}

/** Todas as identidades de um participante (lid, jid, número). */
function participantIds (p) {
  return [p.id, p.jid, p.phoneNumber].filter(Boolean).map(jidNormalizedUser)
}

/**
 * Membros do grupo do privado que têm número visível:
 * Map(variante do número → { phone, jid }), jid = @lid quando houver.
 */
async function dmMembers (sock) {
  const groupId = process.env.API_DM_GROUP
  if (!groupId) return null
  const meta = await sock.groupMetadata(groupId)
  const bot = botIds(sock)
  const out = new Map()
  for (const p of meta.participants || []) {
    const ids = participantIds(p)
    if (ids.some(id => bot.has(id))) continue
    const phoneJid = ids.find(id => id.endsWith('@s.whatsapp.net'))
    if (!phoneJid) continue
    const phone = phoneJid.split('@')[0]
    const member = { phone, jid: ids.find(id => id.endsWith('@lid')) || phoneJid }
    for (const v of config.phoneVariants(phone)) out.set(v, member)
  }
  return out
}

/** JID (de preferência @lid) de um número no grupo do privado, ou null. */
async function dmJid (sock, phone) {
  const members = await dmMembers(sock)
  if (!members) throw Object.assign(new Error('Envio no privado desligado (API_DM_GROUP não definido).'), { status: 400 })
  return config.phoneVariants(phone).map(v => members.get(v)?.jid).find(Boolean) || null
}

/**
 * Manda no privado respeitando a fila; rejeita se o número não estiver liberado.
 * `content` é o texto ou uma mensagem pronta do Baileys (ex.: { image, caption }).
 */
function sendDm (sock, phone, content) {
  const job = dmQueue.then(async () => {
    const jid = await dmJid(sock, phone)
    if (!jid) throw Object.assign(new Error('Esse número não está no grupo liberado para o privado.'), { status: 403 })
    const wait = DM_GAP_MS - (Date.now() - lastDmAt)
    if (wait > 0) await new Promise(resolve => setTimeout(resolve, wait))
    try {
      return await sock.sendMessage(jid, typeof content === 'string' ? { text: content } : content)
    } finally {
      lastDmAt = Date.now()
    }
  })
  dmQueue = job.catch(() => {})
  return job
}

/**
 * Menções para um grupo: `phones` (números) e/ou `all` (todos menos o bot).
 * Retorna { jids, tags } — `tags` é o texto "@123 @456" que vai na mensagem.
 */
function groupMentions (sock, meta, { phones = [], all = false } = {}) {
  const bot = botIds(sock)
  const wanted = new Set(phones.flatMap(p => config.phoneVariants(String(p))))
  const jids = []
  for (const p of meta.participants || []) {
    const ids = participantIds(p)
    if (ids.some(id => bot.has(id))) continue
    const phone = ids.find(id => id.endsWith('@s.whatsapp.net'))?.split('@')[0]
    if (!all && !(phone && wanted.has(phone))) continue
    jids.push(ids.find(id => id.endsWith('@lid')) || ids[0])
  }
  return { jids, tags: jids.map(j => `@${j.split('@')[0]}`).join(' ') }
}

/**
 * Manda no grupo. Em `text`, {todos} vira a marcação de todos e
 * {marcados} a marcação de `mentionPhones`. `notifyAll` marca todos sem
 * escrever os @ no texto (todo mundo é notificado).
 */
async function sendGroup (sock, groupId, text, { mentionPhones = [], mentionAll = false, notifyAll = false } = {}) {
  const meta = await sock.groupMetadata(groupId).catch(() => {
    throw Object.assign(new Error('O bot não está nesse grupo.'), { status: 404 })
  })
  const all = mentionAll || notifyAll || text.includes('{todos}')
    ? groupMentions(sock, meta, { all: true })
    : { jids: [], tags: '' }
  const some = mentionPhones.length ? groupMentions(sock, meta, { phones: mentionPhones }) : { jids: [], tags: '' }
  let body = text.replace(/\{todos\}/g, all.tags).replace(/\{marcados\}/g, some.tags).trim()
  if (mentionAll && !text.includes('{todos}') && all.tags) body += `\n\n${all.tags}`
  const mentions = [...new Set([...all.jids, ...some.jids])]
  return sock.sendMessage(groupId, mentions.length ? { text: body, mentions } : { text: body })
}

module.exports = { dmMembers, sendDm, sendGroup }
