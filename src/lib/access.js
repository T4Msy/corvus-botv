'use strict'

const { jidNormalizedUser } = require('@whiskeysockets/baileys')
const config = require('../config')
const db = require('./supabase')
const { phoneOf } = require('./portal')

/**
 * Quem pode usar o bot:
 * - owner:   donos e o próprio aparelho do bot.
 * - member:  está no grupo da Masayoshi (API_DM_GROUP). Saiu do grupo, perdeu.
 * - guest:   de fora, dentro do grupo aberto (BOT_PUBLIC_GROUP) ou liberado pelo
 *            portal (tabela bot_guests). Usa o bot, mas nada da Masayoshi:
 *            comandos `membersOnly` e respostas automáticas.
 * - none:    de fora e sem liberação.
 * - unknown: não deu para consultar o grupo (o bot acabou de ligar, por exemplo).
 */

const MEMBERS_TTL = 5 * 60 * 1000
const GUESTS_TTL = 60 * 1000

const members = { ids: null, at: 0, loading: null }
const guests = { phones: new Set(), at: 0, loading: null }

/** Todas as identidades de um participante, com e sem o 9º dígito. */
function idsOfParticipant (p) {
  const out = []
  for (const v of [p.id, p.lid, p.jid, p.phoneNumber]) {
    if (!v) continue
    const jid = jidNormalizedUser(v)
    out.push(jid)
    if (jid.endsWith('@s.whatsapp.net')) {
      for (const n of config.phoneVariants(jid.split('@')[0])) out.push(`${n}@s.whatsapp.net`)
    }
  }
  return out
}

/** Consulta só uma vez por vez; se falhar, continua com o que já tinha. */
function refresh (cache, load) {
  if (!cache.loading) {
    cache.loading = load()
      .catch(err => console.error('[access] erro:', err.message))
      .finally(() => { cache.loading = null })
  }
  return cache.loading
}

/** Identidades de quem está no grupo da Masayoshi; null se nunca deu para ler. */
async function memberIds (sock) {
  if (!members.ids || Date.now() - members.at > MEMBERS_TTL) {
    await refresh(members, async () => {
      const meta = await sock.groupMetadata(process.env.API_DM_GROUP)
      members.ids = new Set((meta.participants || []).flatMap(idsOfParticipant))
      members.at = Date.now()
    })
  }
  return members.ids
}

/** Variantes de todos os números liberados no portal. */
async function guestPhones () {
  if (db.enabled() && Date.now() - guests.at > GUESTS_TTL) {
    await refresh(guests, async () => {
      const rows = await db.select('bot_guests?select=phone')
      guests.phones = new Set(rows.flatMap(r => config.phoneVariants(r.phone)))
      guests.at = Date.now()
    })
  }
  return guests.phones
}

/** Alguém entrou ou saiu do grupo: a próxima consulta lê de novo. */
function invalidateMembers (groupId) {
  if (groupId === process.env.API_DM_GROUP) members.at = 0
}

/**
 * Nível de acesso. `ids` = identidades conhecidas de quem mandou;
 * `chat` = conversa atual; `getMeta` = metadados do grupo atual, para achar
 * o número de um @lid.
 */
async function levelOf (sock, { ids, chat = null, isOwner = false, getMeta = null }) {
  if (isOwner) return 'owner'
  // Sem grupo configurado não há como separar membros: fica tudo liberado.
  if (!process.env.API_DM_GROUP) return 'member'

  const all = await memberIds(sock)
  if (!all) return 'unknown'
  if (ids.some(id => all.has(id))) return 'member'
  if (chat && chat === process.env.BOT_PUBLIC_GROUP) return 'guest'

  const phones = await guestPhones()
  if (!phones.size) return 'none'

  let phone = ids.find(id => id.endsWith('@s.whatsapp.net'))?.split('@')[0]
  if (!phone && getMeta) {
    const meta = await getMeta().catch(() => null)
    phone = ids.map(id => phoneOf(id, meta)).find(Boolean)
  }
  return phone && config.phoneVariants(phone).some(v => phones.has(v)) ? 'guest' : 'none'
}

/** true se todo mundo do grupo (fora o bot) é da Masayoshi. */
async function onlyMembers (sock, meta) {
  const all = await memberIds(sock)
  if (!all) return false
  const bot = [sock.user?.id, sock.user?.lid].filter(Boolean).map(jidNormalizedUser)
  return (meta.participants || []).every(p => {
    const ids = idsOfParticipant(p)
    return ids.some(id => bot.includes(id)) || ids.some(id => all.has(id))
  })
}

/** Cartão de contato de quem libera o acesso (BOT_CONTACT_NUMBER no .env). */
async function contactCard (sock) {
  const number = String(process.env.BOT_CONTACT_NUMBER || config.owner.numbers[0] || '').replace(/\D/g, '')
  if (!number) return null
  const name = process.env.BOT_CONTACT_NAME || config.owner.nick
  // O waid precisa ser o número como o WhatsApp conhece (com ou sem o 9).
  const found = await sock.onWhatsApp(number).catch(() => [])
  const waid = found?.[0]?.jid?.split('@')[0] || number
  const vcard = `BEGIN:VCARD\nVERSION:3.0\nFN:${name}\nTEL;type=CELL;type=VOICE;waid=${waid}:+${number}\nEND:VCARD`
  return { contacts: { displayName: name, contacts: [{ vcard }] } }
}

module.exports = { levelOf, onlyMembers, invalidateMembers, contactCard }
