'use strict'

const { store } = require('../lib/store')
const { getTargets } = require('../lib/group')
const { emoji } = require('../ui/theme')

const warns = store('warns')

module.exports = {
  name: 'advs',
  aliases: ['advertencias'],
  category: 'Admin',
  groupOnly: true,
  desc: 'Mostra as advertências de um membro.',
  async run ({ sock, from, sender, msg }) {
    const groupWarns = warns.get(from, {})
    const target = getTargets(msg)[0] || sender
    const count = groupWarns[target] || 0
    await sock.sendMessage(
      from,
      {
        text: `${emoji.feather} @${target.split('@')[0]} tem *${count}/3* advertências.`,
        mentions: [target]
      },
      { quoted: msg }
    )
  }
}
