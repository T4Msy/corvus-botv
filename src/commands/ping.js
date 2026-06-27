'use strict'

const { formatUptime } = require('../lib/text')
const { emoji } = require('../ui/theme')

module.exports = {
  name: 'ping',
  aliases: ['status'],
  desc: 'Verifica se o bot está ativo e mostra o uptime.',
  async run ({ reply, msg }) {
    const sentAt = (msg.messageTimestamp ? Number(msg.messageTimestamp) * 1000 : Date.now())
    const latency = Date.now() - sentAt
    await reply(
      `${emoji.raven} *Corvus ativo*\n` +
      `${emoji.bullet} Latência: ${latency >= 0 ? latency : 0} ms\n` +
      `${emoji.bullet} Uptime: ${formatUptime(process.uptime())}`
    )
  }
}
