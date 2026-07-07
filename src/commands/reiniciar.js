'use strict'

const { emoji } = require('../ui/theme')

module.exports = {
  name: 'reiniciar',
  aliases: ['restart'],
  ownerOnly: true,
  desc: 'Reinicia o processo do bot (requer pm2/loop no host para religar).',
  async run ({ reply }) {
    await reply(`${emoji.wine} Reiniciando... até já.`)
    // Dá tempo de a mensagem sair antes de derrubar o processo.
    setTimeout(() => process.exit(0), 1500)
  }
}
