'use strict'

/**
 * Chaves de dia e de semana dos contadores de mensagens, no horário de
 * Brasília (o servidor roda em UTC: sem isto o "hoje" virava às 21h).
 * A semana começa no domingo — mesmo formato de antes ("2026-W45").
 */

const OFFSET_MS = 3 * 3600 * 1000 // UTC-3, sem horário de verão

function brasilia (now = Date.now()) {
  return new Date(now - OFFSET_MS) // ler com getUTC*
}

function dayKey (now) {
  return brasilia(now).toISOString().slice(0, 10)
}

function weekKey (now) {
  const d = brasilia(now)
  const year = d.getUTCFullYear()
  const jan1 = Date.UTC(year, 0, 1)
  const dayOfYear = Math.floor((d.getTime() - jan1) / 86400000)
  const week = Math.floor((dayOfYear + new Date(jan1).getUTCDay()) / 7) + 1
  return `${year}-W${String(week).padStart(2, '0')}`
}

module.exports = { dayKey, weekKey }
