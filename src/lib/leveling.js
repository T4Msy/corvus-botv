'use strict'

const { store } = require('./store')

const levels = store('levels')

// Anti-farm: só concede XP a cada COOLDOWN ms por usuário.
const COOLDOWN = 30 * 1000
const lastGrant = new Map()

/** Nível derivado do XP acumulado (curva suave por raiz quadrada). */
function levelFromXp (xp) {
  return Math.floor(Math.sqrt(xp / 100))
}

/** XP total necessário para alcançar um nível. */
function xpForLevel (level) {
  return level * level * 100
}

function stats (userId) {
  const data = levels.get(userId, { xp: 0 })
  const level = levelFromXp(data.xp)
  return {
    xp: data.xp,
    level,
    next: xpForLevel(level + 1),
    remaining: xpForLevel(level + 1) - data.xp
  }
}

/**
 * Concede XP por atividade (respeitando o cooldown). Retorna
 * { leveledUp, level, xp } ou null se em cooldown.
 */
function grant (userId, min = 5, max = 15) {
  const now = Date.now()
  if (now - (lastGrant.get(userId) || 0) < COOLDOWN) return null
  lastGrant.set(userId, now)

  const data = levels.get(userId, { xp: 0 })
  const before = levelFromXp(data.xp)
  data.xp += Math.floor(Math.random() * (max - min + 1)) + min
  const after = levelFromXp(data.xp)
  levels.set(userId, data)

  return { xp: data.xp, level: after, leveledUp: after > before }
}

/** Top N usuários por XP: [{ id, xp, level }]. */
function top (n = 10) {
  const all = levels.all()
  return Object.entries(all)
    .map(([id, d]) => ({ id, xp: d.xp || 0, level: levelFromXp(d.xp || 0) }))
    .sort((a, b) => b.xp - a.xp)
    .slice(0, n)
}

module.exports = { grant, stats, top, levelFromXp, xpForLevel }
