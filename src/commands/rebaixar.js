'use strict'

const { getTargets } = require('../lib/group')
const { emoji } = require('../ui/theme')

module.exports = {
  name: 'rebaixar',
  aliases: ['demote'],
  groupOnly: true,
  adminOnly: true,
  botAdmin: true,
  desc: 'Remove o cargo de administrador do(s) membro(s).',
  async run ({ sock, from, msg, reply }) {
    const targets = getTargets(msg)
    if (!targets.length) {
      await reply('Mencione ou responda quem deseja rebaixar.')
      return
    }
    await sock.groupParticipantsUpdate(from, targets, 'demote')
    await reply(`${emoji.feather} Rebaixado(s).`)
  }
}
