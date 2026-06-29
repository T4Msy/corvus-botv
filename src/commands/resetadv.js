'use strict'

const { store } = require('../lib/store')
const { getTargets } = require('../lib/group')
const { emoji } = require('../ui/theme')

const warns = store('warns')

module.exports = {
  name: 'resetadv',
  aliases: ['tiraradv', 'limparadv'],
  category: 'Admin',
  groupOnly: true,
  adminOnly: true,
  desc: 'Zera as advertências de um membro.',
  async run ({ from, msg, reply }) {
    const target = getTargets(msg)[0]
    if (!target) {
      await reply('Mencione ou responda quem deseja zerar as advertências.')
      return
    }
    const groupWarns = warns.get(from, {})
    delete groupWarns[target]
    await warns.set(from, groupWarns)
    await reply(`${emoji.check} Advertências de @${target.split('@')[0]} zeradas.`)
  }
}
