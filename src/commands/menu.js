'use strict'

const { box, emoji } = require('../ui/theme')

// Ordem de exibição das categorias no menu.
const ORDER = ['Geral', 'Mídia', 'Áudio', 'Jogos', 'Downloads', 'Admin', 'Dono']

function categoryOf (cmd) {
  if (cmd.ownerOnly) return 'Dono'
  if (cmd.category) return cmd.category
  if (cmd.adminOnly) return 'Admin'
  return 'Geral'
}

module.exports = {
  name: 'menu',
  aliases: ['help', 'ajuda', 'comandos'],
  category: 'Geral',
  desc: 'Lista os comandos disponíveis.',
  async run ({ reply, config, commands, sender }) {
    const unique = [...new Set(commands.values())]
    const isOwner = config.isOwner(sender)
    const visible = unique.filter((c) => !c.ownerOnly || isOwner)

    const byCat = {}
    for (const c of visible) {
      const cat = categoryOf(c)
      ;(byCat[cat] = byCat[cat] || []).push(c)
    }

    const toItem = (c) => `${config.prefix}${c.name}${c.desc ? ` — ${c.desc}` : ''}`
    const cats = [
      ...ORDER.filter((c) => byCat[c]),
      ...Object.keys(byCat).filter((c) => !ORDER.includes(c))
    ]

    const groups = cats.map((cat) => ({
      section: cat,
      items: byCat[cat].sort((a, b) => a.name.localeCompare(b.name)).map(toItem)
    }))

    const header = `${config.botName} ${emoji.raven}`
    const intro = `${emoji.moon} Agente de *${config.iaName}*\n\n`
    await reply(intro + box(header, groups))
  }
}
