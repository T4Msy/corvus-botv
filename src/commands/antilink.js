'use strict'

const { groups } = require('../events/groupParticipants')
const { emoji } = require('../ui/theme')

module.exports = {
  name: 'antilink',
  aliases: ['antilinkgp'],
  groupOnly: true,
  adminOnly: true,
  desc: 'Ativa ou desativa o antilink: antilink on | off. Apaga convites de outros grupos e adverte.',
  async run ({ from, args, reply, config }) {
    const opt = (args[0] || '').toLowerCase()
    if (opt !== 'on' && opt !== 'off') {
      const state = groups.get(from, {}).antilink ? 'ativado' : 'desativado'
      await reply(
        `Antilink está *${state}*.\n` +
        `Use *${config.prefix}antilink on* ou *${config.prefix}antilink off*.`
      )
      return
    }
    await groups.update(from, (c) => ({ ...c, antilink: opt === 'on' }), {})
    await reply(
      opt === 'on'
        ? `${emoji.check} Antilink ativado — convites de outros grupos serão apagados e advertidos.`
        : `${emoji.cross} Antilink desativado.`
    )
  }
}
