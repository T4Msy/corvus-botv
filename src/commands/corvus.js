'use strict'

const { store } = require('../lib/store')
const { emoji } = require('../ui/theme')

const groups = store('groups')

module.exports = {
  name: 'corvus',
  category: 'Admin',
  fetchMeta: true,
  desc: 'Ativa ou desativa o Corvus neste grupo: corvus ativar | desativar.',
  async run ({ from, args, isGroup, isAdmin, isOwner, reply, config }) {
    const opt = (args[0] || '').toLowerCase()

    if (opt !== 'ativar' && opt !== 'desativar') {
      const state = groups.get(from, {}).active === true ? 'ativo' : 'inativo'
      await reply(
        `Corvus está *${state}* aqui.\n` +
        `Use *${config.prefix}corvus ativar* ou *${config.prefix}corvus desativar*.`
      )
      return
    }

    if (isGroup && !isAdmin && !isOwner) {
      await reply(`${emoji.lock} Apenas administradores podem ${opt} o Corvus neste grupo.`)
      return
    }

    if (opt === 'desativar') {
      await groups.update(from, (current) => ({ ...current, active: false }), {})
      await reply(`${emoji.cross} Corvus desativado — leveling pausado.`)
      return
    }

    await groups.update(from, (current) => ({ ...current, active: true }), {})
    if (isGroup) {
      await reply(`${emoji.check} Oiii! Eu sou o Corvus, desenvolvido por Tales e Xitter.\nDê *${config.prefix}menu* para mais informações. 🐦‍⬛🍷`)
      return
    }
    await reply(`${emoji.check} Corvus ativado nesta conversa.`)
  }
}
