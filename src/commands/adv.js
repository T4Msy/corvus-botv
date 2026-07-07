'use strict'

const { getTargets } = require('../lib/group')
const { applyWarn } = require('../lib/warns')

module.exports = {
  name: 'adv',
  aliases: ['advertir', 'warn'],
  category: 'Admin',
  groupOnly: true,
  adminOnly: true,
  botAdmin: true,
  desc: 'Adverte um membro; remove ao atingir 3 advertências.',
  async run ({ sock, from, msg, args, reply }) {
    const targets = getTargets(msg)
    if (!targets.length) {
      await reply('Mencione ou responda quem deseja advertir.')
      return
    }
    const motivo = args.filter((a) => !a.startsWith('@')).join(' ') || 'sem motivo'
    await applyWarn(sock, from, targets[0], motivo)
  }
}
