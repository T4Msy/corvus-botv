'use strict'

const { box, emoji } = require('../ui/theme')

module.exports = {
  name: 'menu',
  aliases: ['help', 'ajuda', 'comandos'],
  desc: 'Lista os comandos disponíveis.',
  async run ({ reply, config, commands, sender }) {
    // Comandos canônicos únicos (o Map indexa por aliases também).
    const unique = [...new Set(commands.values())]
    const isOwner = config.isOwner(sender)

    const visible = unique.filter((c) => !c.ownerOnly || isOwner)
    const general = visible.filter((c) => !c.ownerOnly)
    const owner = visible.filter((c) => c.ownerOnly)

    const toItem = (c) => `${config.prefix}${c.name}${c.desc ? ` — ${c.desc}` : ''}`

    const groups = [{ section: 'Geral', items: general.map(toItem) }]
    if (owner.length) {
      groups.push({ section: 'Dono', items: owner.map(toItem) })
    }

    const header = `${config.botName} ${emoji.raven}`
    const intro = `${emoji.moon} Agente de *${config.iaName}*\n\n`

    await reply(intro + box(header, groups))
  }
}
