'use strict'

const { jidNormalizedUser } = require('@whiskeysockets/baileys')
const config = require('../config')
const db = require('./supabase')

/**
 * Quem é a pessoa do WhatsApp no Portal MSY (pelo número em member_whatsapp).
 * Usado por /perfil e /presença.
 */

/** Número (só dígitos) de um JID — @lid vira número pelos participantes do grupo. */
function phoneOf (jid, groupMetadata) {
  if (!jid) return null
  if (jid.endsWith('@s.whatsapp.net')) return jid.split('@')[0].split(':')[0]
  const norm = jidNormalizedUser(jid)
  const p = (groupMetadata?.participants || []).find(x => [x.id, x.lid, x.jid].filter(Boolean).map(jidNormalizedUser).includes(norm))
  const pn = p?.phoneNumber || (p?.jid?.endsWith('@s.whatsapp.net') ? p.jid : null)
  return pn ? pn.split('@')[0].split(':')[0] : null
}

/**
 * Perfil do portal de um número (com e sem o 9 — o WhatsApp manda alguns
 * números BR sem ele). `select` = colunas de profiles. null se não achar.
 */
async function profileByPhone (phone, select = 'id,name') {
  if (!phone) return null
  const variants = config.phoneVariants(phone).filter(v => /^\d+$/.test(v))
  const rows = await db.select(`member_whatsapp?select=profiles(${select})&whatsapp=in.(${variants.join(',')})`)
  return rows[0]?.profiles || null
}

/** Atalho: perfil de quem mandou a mensagem (ou de `jid`, se vier). */
async function profileOf ({ msg, sender, groupMetadata, jid = null, select }) {
  const phone = jid ? phoneOf(jid, groupMetadata) : phoneOf(msg.key.participantPn || sender, groupMetadata)
  return { phone, profile: await profileByPhone(phone, select) }
}

module.exports = { phoneOf, profileByPhone, profileOf }
