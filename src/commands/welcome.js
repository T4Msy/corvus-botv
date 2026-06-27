'use strict'

const { groups } = require('../events/groupParticipants')
const { emoji } = require('../ui/theme')

module.exports = {
  name: 'welcome',
  aliases: ['bemvindo', 'boasvindas'],
  groupOnly: true,
  adminOnly: true,
  desc: 'Ativa/desativa as boas-vindas: !welcome on | off.',
  async run ({ from, args, reply, config }) {
    const opt = (args[0] || '').toLowerCase()
    if (opt !== 'on' && opt !== 'off') {
      const state = groups.get(from, {}).welcome ? 'ativadas' : 'desativadas'
      await reply(
        `Boas-vindas estão *${state}*.\n` +
        `Use *${config.prefix}welcome on* ou *${config.prefix}welcome off*.`
      )
      return
    }
    await groups.update(from, (c) => ({ ...c, welcome: opt === 'on' }), {})
    await reply(
      opt === 'on'
        ? `${emoji.check} Boas-vindas ativadas.`
        : `${emoji.cross} Boas-vindas desativadas.`
    )
  }
}
