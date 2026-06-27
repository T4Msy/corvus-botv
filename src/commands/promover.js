'use strict'

const { getTargets } = require('../lib/group')
const { emoji } = require('../ui/theme')

module.exports = {
  name: 'promover',
  aliases: ['promote', 'admin'],
  groupOnly: true,
  adminOnly: true,
  botAdmin: true,
  desc: 'Promove o(s) membro(s) a administrador.',
  async run ({ sock, from, msg, reply }) {
    const targets = getTargets(msg)
    if (!targets.length) {
      await reply('Mencione ou responda quem deseja promover.')
      return
    }
    await sock.groupParticipantsUpdate(from, targets, 'promote')
    await reply(`${emoji.crown} Promovido(s) a admin.`)
  }
}
