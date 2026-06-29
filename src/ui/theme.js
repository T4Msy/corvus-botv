'use strict'

/**
 * Tema visual do Corvus — corvo sombrio / Masayoshi.
 * Fonte ÚNICA de estilo. Menus e mensagens consomem daqui.
 */

const emoji = {
  raven: '🐦‍⬛',
  feather: '🪶',
  moon: '🌑',
  dark: '🖤',
  crystal: '🔮',
  star: '✦',
  bullet: '▸',
  spark: '✧',
  skull: '💀',
  crown: '👑',
  lock: '🔒',
  check: '✓',
  cross: '✗',
  wine: '🍷',
  candle: '🕯️',
  dagger: '⚔️'
}

const palette = {
  primary: '#3b0764',
  accent: '#7c3aed',
  dark: '#09090b',
  cfonts: ['#3b0764', '#7c3aed']
}

const border = {
  top: '╭━━━〔 %s 〕━━━',
  item: '│ ',
  section: '├─〔 %s 〕',
  bottom: '╰━━━━━━━━━━━━━━━━━━━'
}

/**
 * Monta um bloco de menu formatado.
 * @param {string} title
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
