'use strict'

const fs = require('fs')
const path = require('path')
const { box, divider, emoji, error } = require('../ui/theme')
const { groupByCategory } = require('../lib/categories')
const { commandsOfCategory, categoryToText, commandCard } = require('../lib/menuview')

const MENU_IMAGE = path.resolve(__dirname, '..', '..', 'assets', 'images', 'menu.jpg')

/** Normaliza para comparação: minúsculas e sem acentos. */
function normalize (s) {
  return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

/** Rótulo digitável de cada categoria (Administração vira "admin"). */
function shortcutOf (cat) {
  return cat === 'Administração' ? 'admin' : cat.toLowerCase()
}

/** Menu completo (todas as categorias) em texto. */
function fullMenu (cats, byCat, config) {
  const toItem = (c) => `${config.prefix}${c.name}${c.desc ? ` — ${c.desc}` : ''}`
  const groups = cats.map(cat => ({
    section: cat,
    items: (byCat[cat] || []).sort((a, b) => a.name.localeCompare(b.name)).map(toItem)
  }))
  return box(config.botName, groups)
}

module.exports = {
  name: 'menu',
  aliases: ['help', 'ajuda', 'comandos'],
  category: 'Geral',
  desc: 'Menu de comandos: use sem argumento, com <categoria>, <comando> ou "geral".',
  async run ({ sock, from, msg, args, config, commands, isOwner, reply }) {
    const unique = [...new Set(commands.values())]
    const visible = unique.filter(c => !c.ownerOnly || isOwner)
    const { byCat, cats } = groupByCategory(visible)

    const query = normalize(args.join(' ').trim())

    if (query) {
      // /menu geral — todos os comandos juntos.
      if (query === 'geral') {
        await reply(fullMenu(cats, byCat, config))
        return
      }

      // /menu <categoria> — aceita o atalho (admin) e o nome completo.
      const cat = cats.find(c => normalize(shortcutOf(c)) === query || normalize(c) === query)
      if (cat) {
        await reply(categoryToText(cat, commandsOfCategory(cat, commands, isOwner), config))
        return
      }

      // /menu <comando> — cartão de detalhe.
      const cmd = commands.get(query)
      if (cmd && (!cmd.ownerOnly || isOwner)) {
        await reply(commandCard(cmd, config))
        return
      }

      await reply(error(`Não encontrei *${args.join(' ')}*. Use *${config.prefix}menu* para ver as categorias.`))
      return
    }

    // /menu — foto com as categorias na legenda.
    const shortcuts = cats.map(cat => `${emoji.bullet} *${config.prefix}menu ${shortcutOf(cat)}*`)
    shortcuts.push(`${emoji.bullet} *${config.prefix}menu geral* — todos os comandos`)

    const caption =
      `*${config.botName} Bot* ${emoji.wine}\n` +
      `${divider()}\n` +
      `${shortcuts.join('\n')}\n\n` +
      `${emoji.wine} _Erga a taça e escolha o seu caminho._`

    try {
      const image = fs.readFileSync(MENU_IMAGE)
      await sock.sendMessage(from, { image, caption }, { quoted: msg })
    } catch (err) {
      console.error('[menu] falha ao enviar a arte:', err.message)
      await reply(caption)
    }
  }
}
