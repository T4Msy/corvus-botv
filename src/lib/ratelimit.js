'use strict'

// Cooldown simples em memória por (comando, usuário).
const buckets = new Map()

/**
 * Verifica/registra o cooldown. Retorna 0 se liberado, ou os segundos
 * restantes se ainda em cooldown.
 */
function check (command, user, seconds) {
  const key = `${command}:${user}`
  const now = Date.now()
  const until = buckets.get(key) || 0
  if (now < until) return Math.ceil((until - now) / 1000)
  buckets.set(key, now + seconds * 1000)
  return 0
}

module.exports = { check }
