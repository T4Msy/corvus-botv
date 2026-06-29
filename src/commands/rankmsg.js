'use strict'

const { store } = require('../lib/store')
const { emoji } = require('../ui/theme')

const counters = store('counters')
const MEDALS = ['🥇', '🥈', '🥉']

module.exports = {
  name: 'rankmsg',
  aliases: ['rankmsgs', 'topmsg'],
  category: 'Admin',
  groupOnly: true,
  desc: 'Ranking de mensagens do grupo.',
  async run ({ sock, from, msg }) {
    const data = counters.get(from, {})
    const top = Object.entries(data)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)

    if (!top.length) {
      await sock.sendMessage(from, { text: 'Ainda não contei mensagens neste grupo.' }, { quoted: msg })
      return
    }

    const lines = top.map(([id, n], i) => {
      const pos = MEDALS[i] || `${i + 1}.`
      return `${pos} @${id.split('@')[0]} — ${n} msgs`
    })

    await sock.sendMessage(
      from,
      {
        text: `${emoji.crown} *Ranking de mensagens*\n\n${lines.join('\n')}`,
        mentions: top.map(([id]) => id)
      },
      { quoted: msg }
    )
  }
}
