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
    // Um arquivo pode exportar um comando ou um array de comandos.
    const list = Array.isArray(mod) ? mod : [mod]
    for (const cmd of list) {
      if (!cmd || !cmd.name || typeof cmd.run !== 'function') {
        console.warn(`[registry] Ignorando ${file}: faltam "name" ou "run".`)
        continue
      }
      for (const n of [cmd.name, ...(cmd.aliases || [])]) {
        const key = n.toLowerCase()
        // Nome repetido: o primeiro fica (o /fig novo já foi engolido pelo alias do /sticker).
        if (commands.has(key) && commands.get(key) !== cmd) {
          console.warn(`[registry] "${key}" já é de /${commands.get(key).name}; ignorado em /${cmd.name} (${file}).`)
          continue
        }
        commands.set(key, cmd)
      }
    }
  }

  return commands
}

module.exports = { loadCommands }
