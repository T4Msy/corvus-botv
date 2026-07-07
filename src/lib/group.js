'use strict'

const { jidNormalizedUser } = require('@whiskeysockets/baileys')

/**
 * Retorna TODAS as identidades normalizadas dos administradores do grupo.
 * Grupos novos usam o formato @lid além do JID de telefone; cada
 * participante pode expor id (lid), jid e phoneNumber — coletamos todos
 * para a comparação nunca falhar por diferença de formato.
 */
function getAdmins (metadata) {
  const out = new Set()
  for (const p of metadata.participants || []) {
    if (p.admin === 'admin' || p.admin === 'superadmin') {
      for (const v of [p.id, p.jid, p.phoneNumber]) {
        if (v) out.add(jidNormalizedUser(v))
      }
    }
  }
  return [...out]
}

/** JID normalizado do próprio bot (sem o sufixo de device). */
function botJid (sock) {
  return sock.user?.id ? jidNormalizedUser(sock.user.id) : null
}

/** Todas as identidades do bot (JID de telefone e LID, quando houver). */
function botJids (sock) {
  return [sock.user?.id, sock.user?.lid]
    .filter(Boolean)
    .map(jidNormalizedUser)
}

/**
 * Alvos de um comando admin: usuários mencionados ou, na ausência,
 * o autor da mensagem citada.
 */
function getTargets (msg) {
  const ctx = msg.message?.extendedTextMessage?.contextInfo
  const mentioned = ctx?.mentionedJid || []
  if (mentioned.length) return mentioned
  return ctx?.participant ? [ctx.participant] : []
}

module.exports = { getAdmins, botJid, botJids, getTargets }
