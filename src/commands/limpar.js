'use strict'

const { emoji } = require('../ui/theme')

module.exports = {
  name: 'limpar',
  aliases: ['clear', 'cls'],
  category: 'Admin',
  groupOnly: true,
  adminOnly: true,
  desc: 'Limpa a tela do chat (visualmente).',
  async run ({ sock, from }) {
    // O WhatsApp não permite apagar o histórico de terceiros via API;
    // isto apenas empurra as mensagens para cima na tela.
    const blank = '⠀\n'.repeat(30)
    await sock.sendMessage(from, { text: `${blank}${emoji.raven} Tela limpa.` })
  }
}
