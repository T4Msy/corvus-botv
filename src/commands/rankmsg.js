'use strict'

const { store } = require('../lib/store')
const periods = require('../lib/periods')
const { emoji, header, loading } = require('../ui/theme')

const counters = store('counters')
const timecounters = store('timecounters')

const MEDALS = ['🥇', '🥈', '🥉']


function purgeOldData (tc) {
  if (!tc) return {}
  if (tc.daily) {
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - 7)
    for (const key of Object.keys(tc.daily)) {
      if (new Date(key) < cutoff) delete tc.daily[key]
    }
  }
  if (tc.weekly) {
    const keys = Object.keys(tc.weekly).sort()
    while (keys.length > 4) delete tc.weekly[keys.shift()]
  }
  return tc
}

module.exports = {
  name: 'rankmsg',
  aliases: ['rankmsgs', 'topmsg'],
  category: 'Admin',
  groupOnly: true,
  desc: 'Ranking de mensagens do grupo.',
  async run ({ sock, from, msg }) {
    const data = counters.get(from, {})
    let tc = timecounters.get(from, {})
    tc = purgeOldData(tc)
    timecounters.set(from, tc)

    const top = Object.entries(data)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)

    if (!top.length) {
      await sock.sendMessage(from, { text: loading('Ainda não contei mensagens neste grupo.') }, { quoted: msg })
      return
    }

    const dayKey = periods.dayKey()
    const weekKey = periods.weekKey()
    const dayTotal = Object.values(tc.daily?.[dayKey] || {}).reduce((a, b) => a + b, 0)
    const weekTotal = Object.values(tc.weekly?.[weekKey] || {}).reduce((a, b) => a + b, 0)

    const lines = top.map(([id, n], i) => {
      const pos = MEDALS[i] || `${i + 1}.`
      return `${pos} @${id.split('@')[0]} — ${n} msgs`
    })

    const footer = `\n${emoji.bullet} Hoje: *${dayTotal}* msgs  ${emoji.bullet} Esta semana: *${weekTotal}* msgs`

    await sock.sendMessage(
      from,
      {
        text: `${header('Ranking de mensagens')}\n\n${lines.join('\n')}${footer}`,
        mentions: top.map(([id]) => id)
      },
      { quoted: msg }
    )
  }
}
