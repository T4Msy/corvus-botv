'use strict'

const { box, emoji } = require('../ui/theme')

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
  desc: 'Lista os comandos por categoria.',
  async run ({ sock, from, msg, config, commands, sender }) {
    const unique = [...new Set(commands.values())]
    const isOwner = config.isOwner(sender)
    const visible = unique.filter(c => !c.ownerOnly || isOwner)

    const byCat = {}
    for (const c of visible) {
      const cat = categoryOf(c)
      ;(byCat[cat] = byCat[cat] || []).push(c)
    }

    const cats = [
      ...ORDER.filter(c => byCat[c]),
      ...Object.keys(byCat).filter(c => !ORDER.includes(c))
    ]

    // Tenta enviar lista nativa do WhatsApp (interativa por categoria).
    const rows = cats.map(cat => {
      const cmdList = (byCat[cat] || [])
        .sort((a, b) => a.name.localeCompare(b.name))
        .slice(0, 6)
        .map(c => `${config.prefix}${c.name}`)
        .join('  ')
      return { title: cat, description: cmdList || '—', rowId: `menu_cat:${cat}` }
    })

    try {
      await sock.sendMessage(from, {
        listMessage: {
          title: `${emoji.raven} ${config.botName}`,
          description: `Agente de *${config.iaName}* — selecione uma categoria`,
          buttonText: 'Ver categorias',
          listType: 1,
          sections: [{ title: 'Categorias', rows }]
        }
      }, { quoted: msg })
    } catch {
      // Fallback: menu em texto caso listMessage não seja suportado.
      const toItem = (c) => `${config.prefix}${c.name}${c.desc ? ` — ${c.desc}` : ''}`
      const groups = cats.map(cat => ({
        section: cat,
        items: (byCat[cat] || []).sort((a, b) => a.name.localeCompare(b.name)).map(toItem)
      }))
      await sock.sendMessage(
        from,
        { text: `${emoji.moon} Agente de *${config.iaName}*\n\n` + box(`${config.botName} ${emoji.raven}`, groups) },
        { quoted: msg }
      )
    }
  }
}
