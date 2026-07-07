'use strict'

const { emoji, divider } = require('../ui/theme')
const { categoryOf } = require('./categories')

/** Comandos visíveis de uma categoria, ordenados por nome. */
function commandsOfCategory (cat, commands, isOwner) {
  const all = [...new Set(commands.values())]
  return all
    .filter(c => categoryOf(c) === cat && (!c.ownerOnly || isOwner))
    .sort((a, b) => a.name.localeCompare(b.name))
}

/** Lista em texto com todos os comandos de uma categoria. */
function categoryToText (cat, cmds, config) {
  const lines = cmds.map(c => `${emoji.bullet} *${config.prefix}${c.name}*${c.desc ? ` — ${c.desc}` : ''}`)
  return `${emoji.wine} *${cat}*\n${divider()}\n${lines.join('\n')}`
}

/** Cartão de detalhe de um comando (nome, aliases, permissões, cooldown). */
function commandCard (cmd, config) {
  const lines = [`${emoji.wine} *${config.prefix}${cmd.name}*`, divider()]

  if (cmd.aliases?.length) {
    lines.push(`${emoji.bullet} Também: ${cmd.aliases.map(a => `${config.prefix}${a}`).join(', ')}`)
  }
  lines.push(`${emoji.bullet} Categoria: ${categoryOf(cmd)}`)

  const perms = []
  if (cmd.ownerOnly) perms.push('apenas dono')
  if (cmd.adminOnly) perms.push('apenas administradores')
  if (cmd.groupOnly) perms.push('somente em grupos')
  if (cmd.botAdmin) perms.push('bot precisa ser admin')
  if (perms.length) lines.push(`${emoji.lock} Requer: ${perms.join(', ')}`)

  if (cmd.cooldown) lines.push(`${emoji.moon} Intervalo: ${cmd.cooldown}s entre usos`)

  lines.push('')
  lines.push(cmd.desc || 'Sem descrição.')

  return lines.join('\n')
}

module.exports = { commandsOfCategory, categoryToText, commandCard }
