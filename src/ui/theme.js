'use strict'

/**
 * Identidade visual do Corvus — elegância, mistério e autoridade em
 * tons de vermelho e preto, com a taça de vinho como símbolo central.
 * Fonte ÚNICA de estilo. Comandos e mensagens do sistema consomem daqui.
 */

const emoji = {
  raven: '🐦‍⬛', // marca/mascote (Corvus = corvo)
  wine: '🍷', // símbolo principal — destaque, identidade
  crystal: '🍷', // destaque de conteúdo (resultado, perfil, tradução...)
  toast: '🥂', // conquista/level up
  feather: '🪶', // dica/instrução
  moon: '🌑', // processamento/aguardando
  lock: '🔒', // acesso restrito
  check: '✓', // sucesso
  cross: '✗', // erro
  crown: '👑', // autoridade/dono
  skull: '💀', // ação severa (banimento etc.)
  dagger: '⚔️', // ação administrativa
  bullet: '▸' // item de lista
}

const palette = {
  primary: '#7f1d1d', // vermelho vinho escuro
  accent: '#dc2626', // vermelho vivo
  dark: '#0a0a0a', // preto quase absoluto
  cfonts: ['#dc2626', '#0a0a0a']
}

const line = '─'.repeat(24)

/** Rótulo de destaque no estilo 「 🍷 」 TÍTULO 「 🍷 」 (menus interativos). */
function tag (title) {
  return `「 ${emoji.wine} 」 ${title} 「 ${emoji.wine} 」`
}

/** Cabeçalho padrão: título em negrito + taça de vinho + divisor fino. */
function header (title) {
  return `${emoji.wine} *${title}*\n${line}`
}

/** Divisor fino, para separar seções dentro de uma mesma mensagem. */
function divider () {
  return line
}

function success (text) {
  return `${emoji.check} ${text}`
}

function error (text) {
  return `${emoji.cross} ${text}`
}

function loading (text) {
  return `${emoji.moon} ${text}`
}

function info (text) {
  return `${emoji.feather} ${text}`
}

/**
 * Monta um bloco de menu formatado (usado no fallback em texto,
 * quando o cliente não suporta listMessage).
 * @param {string} title
 * @param {Array<{ section?: string, items?: string[] }>} groups
 */
function box (title, groups) {
  const lines = [header(title)]
  for (const group of groups) {
    if (group.section) {
      lines.push('')
      lines.push(`*${group.section}*`)
    }
    for (const item of group.items || []) {
      lines.push(`${emoji.bullet} ${item}`)
    }
  }
  lines.push(line)
  return lines.join('\n')
}

module.exports = { emoji, palette, tag, header, divider, success, error, loading, info, box }
