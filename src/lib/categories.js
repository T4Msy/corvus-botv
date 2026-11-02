'use strict'

/**
 * Categorização de comandos para o menu. Fonte única — usada tanto pelo
 * comando !menu (nível 1 da navegação) quanto pelo handler (níveis 2 e 3).
 */

// Ordem de exibição no menu (rótulos já traduzidos para exibição).
const ORDER = ['Utilidades', 'Mídia', 'Áudio', 'Downloads', 'Diversão', 'Administração', 'Dono']

// Nomes internos (cmd.category nos arquivos de comando) -> rótulo exibido.
const LABELS = {
  Geral: 'Utilidades',
  Jogos: 'Diversão',
  Admin: 'Administração'
}

/** Retorna o rótulo de categoria (já traduzido) de um comando. */
function categoryOf (cmd) {
  if (cmd.ownerOnly) return 'Dono'
  const raw = cmd.category || (cmd.adminOnly ? 'Admin' : 'Geral')
  return LABELS[raw] || raw
}

/** Agrupa comandos visíveis por categoria, respeitando ORDER. */
function groupByCategory (commandList) {
  const byCat = {}
  for (const cmd of commandList) {
    const cat = categoryOf(cmd)
    ;(byCat[cat] = byCat[cat] || []).push(cmd)
  }
  const cats = [
    ...ORDER.filter(c => byCat[c]),
    ...Object.keys(byCat).filter(c => !ORDER.includes(c))
  ]
  return { byCat, cats }
}

module.exports = { ORDER, LABELS, categoryOf, groupByCategory }
