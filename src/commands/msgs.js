'use strict'

const { store } = require('../lib/store')
const { getTargets } = require('../lib/group')
const periods = require('../lib/periods')
const { emoji, header } = require('../ui/theme')

const counters = store('counters')
const timecounters = store('timecounters')

const sum = obj => Object.values(obj || {}).reduce((a, b) => a + b, 0)

module.exports = {
  name: 'msgs',
  category: 'Admin',
  groupOnly: true,
  desc: 'Mensagens de alguém (hoje, na semana e no total) e do grupo.',
  async run ({ sock, from, sender, msg }) {
    const target = getTargets(msg)[0] || sender
    const total = counters.get(from, {})
    const tc = timecounters.get(from, {})
    const day = tc.daily?.[periods.dayKey()] || {}
    const week = tc.weekly?.[periods.weekKey()] || {}

    const text = [
      header('Mensagens'),
      '',
      `${emoji.feather} @${target.split('@')[0]}`,
      `${emoji.bullet} Hoje: *${day[target] || 0}*`,
      `${emoji.bullet} Esta semana: *${week[target] || 0}*`,
      `${emoji.bullet} Total: *${total[target] || 0}*`,
      '',
      `${emoji.raven} Grupo todo`,
      `${emoji.bullet} Hoje: *${sum(day)}*`,
      `${emoji.bullet} Esta semana: *${sum(week)}*`,
      `${emoji.bullet} Total: *${sum(total)}*`
    ].join('\n')

    await sock.sendMessage(from, { text, mentions: [target] }, { quoted: msg })
  }
}
