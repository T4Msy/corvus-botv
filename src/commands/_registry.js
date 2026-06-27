'use strict'

const fs = require('fs')
const path = require('path')

/**
 * Carrega todos os comandos de src/commands (exceto arquivos iniciados por "_").
 * Cada módulo deve exportar:
 *   { name, aliases?, ownerOnly?, groupOnly?, desc?, run(ctx) }
 *
 * Retorna um Map de nome/alias -> comando (cada comando aparece sob todos
 * os seus nomes, mas a propriedade `name` permanece a canônica).
 */
function loadCommands () {
  const dir = __dirname
  const commands = new Map()

  const files = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.js') && !f.startsWith('_'))

  for (const file of files) {
    const mod = require(path.join(dir, file))
    if (!mod || !mod.name || typeof mod.run !== 'function') {
      console.warn(`[registry] Ignorando ${file}: faltam "name" ou "run".`)
      continue
    }
    const names = [mod.name, ...(mod.aliases || [])]
    for (const n of names) {
      commands.set(n.toLowerCase(), mod)
    }
  }

  return commands
}

module.exports = { loadCommands }
