'use strict'

const leveling = require('../lib/leveling')
const { h2k } = require('../lib/text')
const { emoji } = require('../ui/theme')

const MEDALS = ['🥇', '🥈', '🥉']

module.exports = {
  name: 'rank',
  aliases: ['ranking', 'top'],
  desc: 'Ranking dos usuários com mais XP.',
  async run ({ sock, from, msg }) {
    const top = leveling.top(10)
    if (!top.length) {
      await sock.sendMessage(from, { text: 'Ainda não há XP registrado.' }, { quoted: msg })
      return
    }

    const lines = top.map((u, i) => {
      const pos = MEDALS[i] || `${i + 1}.`
      return `${pos} @${u.id.split('@')[0]} — nível ${u.level} (${h2k(u.xp)} XP)`
    })

    await sock.sendMessage(
      from,
      {
        text: `${emoji.crown} *Ranking de XP*\n\n${lines.join('\n')}`,
        mentions: top.map((u) => u.id)
      },
      { quoted: msg }
    )
  }
}
