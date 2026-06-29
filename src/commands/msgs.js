'use strict'

const { store } = require('../lib/store')
const { getTargets } = require('../lib/group')
const { emoji } = require('../ui/theme')

const counters = store('counters')

module.exports = {
  name: 'msgs',
  category: 'Admin',
  groupOnly: true,
  desc: 'Mostra quantas mensagens você (ou alguém marcado) enviou.',
  async run ({ sock, from, sender, msg }) {
    const data = counters.get(from, {})
    const targets = getTargets(msg)
    const target = targets[0] || sender
    const count = data[target] || 0
    await sock.sendMessage(
      from,
      {
        text: `${emoji.feather} @${target.split('@')[0]} enviou *${count}* mensagens neste grupo.`,
        mentions: [target]
      },
      { quoted: msg }
    )
  }
}
