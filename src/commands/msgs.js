'use strict'

const { store } = require('../lib/store')
const { getTargets } = require('../lib/group')
const { emoji } = require('../ui/theme')

const counters = store('counters')
const timecounters = store('timecounters')

function getDateKey () { return new Date().toISOString().slice(0, 10) }
function getWeekKey () {
  const d = new Date()
  const jan1 = new Date(d.getFullYear(), 0, 1)
  const week = Math.ceil(((d - jan1) / 86400000 + jan1.getDay() + 1) / 7)
  return `${d.getFullYear()}-W${String(week).padStart(2, '0')}`
}

module.exports = {
  name: 'msgs',
  category: 'Admin',
  groupOnly: true,
  desc: 'Contagem de mensagens (pessoal, grupo/dia, grupo/semana).',
  async run ({ sock, from, sender, msg }) {
    const data = counters.get(from, {})
    const targets = getTargets(msg)
    const target = targets[0] || sender
    const total = data[target] || 0

    const tc = timecounters.get(from, {})
    const dayKey = getDateKey()
    const weekKey = getWeekKey()
    const dayTotal = Object.values(tc.daily?.[dayKey] || {}).reduce((a, b) => a + b, 0)
    const weekTotal = Object.values(tc.weekly?.[weekKey] || {}).reduce((a, b) => a + b, 0)

    const text = [
      `${emoji.feather} @${target.split('@')[0]}: *${total}* msgs (total)`,
      `${emoji.moon} Hoje no grupo: *${dayTotal}* msgs`,
      `${emoji.raven} Esta semana: *${weekTotal}* msgs`
    ].join('\n')

    await sock.sendMessage(from, { text, mentions: [target] }, { quoted: msg })
  }
}
