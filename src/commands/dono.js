'use strict'

const { emoji } = require('../ui/theme')

module.exports = {
  name: 'dono',
  aliases: ['owner', 'criador'],
  desc: 'Mostra quem é o dono do bot.',
  async run ({ reply, config }) {
    await reply(
      `${emoji.crown} *Dono:* ${config.owner.nick}\n` +
      `${emoji.crystal} *IA:* ${config.iaName}\n` +
      `${emoji.raven} *Bot:* ${config.botName}`
    )
  }
}
