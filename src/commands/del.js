'use strict'

const { emoji } = require('../ui/theme')

module.exports = {
  name: 'del',
  aliases: ['apagar', 'delete'],
  category: 'Admin',
  groupOnly: true,
  adminOnly: true,
  botAdmin: true,
  desc: 'Apaga a mensagem citada.',
  async run ({ sock, from, msg, reply }) {
    const ctx = msg.message?.extendedTextMessage?.contextInfo
    if (!ctx?.stanzaId) {
      await reply('Responda à mensagem que deseja apagar.')
      return
    }
    const key = {
      remoteJid: from,
      fromMe: false,
      id: ctx.stanzaId,
      participant: ctx.participant
    }
    await sock.sendMessage(from, { delete: key })
  }
}
