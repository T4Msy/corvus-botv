'use strict'

/**
 * Tema visual do Corvus — corvo dark/elegante.
 *
 * Fonte ÚNICA de estilo do bot. Menus e mensagens devem consumir daqui
 * em vez de espalhar emojis/bordas pelo código (era o problema do legado).
 */

// Emojis temáticos (corvo / noite / místico)
const emoji = {
  raven: '🐦‍⬛',
  feather: '🪶',
  moon: '🌙',
  dark: '⚫',
  crystal: '🔮',
  star: '✦',
  bullet: '▸',
  spark: '✧',
  skull: '💀',
  crown: '👑',
  lock: '🔒',
  check: '✓',
  cross: '✗'
}

// Paleta para o terminal (cfonts/chalk usam nomes destes).
const palette = {
  primary: '#6d28d9', // roxo
  accent: '#a78bfa', // roxo claro
  dark: '#111111',
  cfonts: ['#6d28d9', '#a78bfa'] // gradiente do banner
}

// Estilo de borda dos menus.
const border = {
  top: '╭─────────〔 %s 〕',
  item: '│ ',
  section: '├─〔 %s 〕',
  bottom: '╰───────────────────'
}

/**
 * Monta um bloco de menu já formatado com o tema.
 * @param {string} title  título do topo
 * @param {Array<{ section?: string, items?: string[] }>} groups
 */
function box (title, groups) {
  const lines = [border.top.replace('%s', title)]
  for (const group of groups) {
    if (group.section) {
      lines.push(border.item.trimEnd())
      lines.push(border.section.replace('%s', group.section))
    }
    for (const item of group.items || []) {
      lines.push(`${border.item}${emoji.bullet} ${item}`)
    }
  }
  lines.push(border.bottom)
  return lines.join('\n')
}

module.exports = { emoji, palette, border, box }
