'use strict'

const { emoji, header } = require('../ui/theme')

module.exports = {
  name: 'dono',
  aliases: ['owner', 'criador'],
  desc: 'Mostra quem é o dono do bot.',
  async run ({ reply, config }) {
    await reply(
      `${header(config.botName)}\n` +
      `${emoji.crown} *Dono:* ${config.owner.nick}\n` +
      `${emoji.bullet} *IA:* ${config.iaName}\n` +
      `${emoji.bullet} *Bot:* ${config.botName}`
    )
  }
}
