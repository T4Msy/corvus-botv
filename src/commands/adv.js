'use strict'

const { store } = require('../lib/store')
const { getTargets } = require('../lib/group')
const { emoji } = require('../ui/theme')

const warns = store('warns')
const LIMIT = 3

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
    const target = targets[0]
    const motivo = args.filter((a) => !a.startsWith('@')).join(' ') || 'sem motivo'

    const groupWarns = warns.get(from, {})
    const count = (groupWarns[target] || 0) + 1
    groupWarns[target] = count
    await warns.set(from, groupWarns)

    if (count >= LIMIT) {
      await sock.sendMessage(from, {
        text: `${emoji.skull} @${target.split('@')[0]} atingiu ${LIMIT} advertências e foi removido.`,
        mentions: [target]
      })
      await sock.groupParticipantsUpdate(from, [target], 'remove')
      delete groupWarns[target]
      await warns.set(from, groupWarns)
      return
    }

    await sock.sendMessage(from, {
      text: `${emoji.cross} @${target.split('@')[0]} advertido (${count}/${LIMIT}).\nMotivo: ${motivo}`,
      mentions: [target]
    })
  }
}
