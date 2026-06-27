'use strict'

const { getTargets } = require('../lib/group')
const { emoji } = require('../ui/theme')

module.exports = {
  name: 'ban',
  aliases: ['kick', 'remover', 'banir'],
  groupOnly: true,
  adminOnly: true,
  botAdmin: true,
  desc: 'Remove o(s) membro(s) mencionado(s) ou citado(s).',
  async run ({ sock, from, msg, reply }) {
    const targets = getTargets(msg)
    if (!targets.length) {
      await reply('Mencione ou responda quem deseja remover.')
      return
    }
    await sock.groupParticipantsUpdate(from, targets, 'remove')
    await reply(`${emoji.check} Removido(s).`)
  }
}
