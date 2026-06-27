'use strict'

const { jidNormalizedUser } = require('@whiskeysockets/baileys')

/** Retorna os JIDs dos administradores a partir do groupMetadata. */
function getAdmins (metadata) {
  return (metadata.participants || [])
    .filter((p) => p.admin === 'admin' || p.admin === 'superadmin')
    .map((p) => p.id)
}

/** JID normalizado do próprio bot (sem o sufixo de device). */
function botJid (sock) {
  return sock.user?.id ? jidNormalizedUser(sock.user.id) : null
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

module.exports = { getAdmins, botJid, getTargets }
