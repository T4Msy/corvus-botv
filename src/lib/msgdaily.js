'use strict'

/**
 * Envia ao portal as mensagens por membro por dia do grupo padrão (aba
 * "Mensagens" do Ranking, tabela group_message_daily — migration
 * 20261121_group_message_daily.sql no repositório do portal).
 *
 * A contagem é a do handler (data/timecounters.json, por dia em Brasília).
 * A partir da 1h, os dias fechados que ainda não subiram vão num único upsert:
 * cada membro do portal que está no grupo ganha uma linha por dia, com 0 se
 * não falou. Na primeira vez sobem todos os dias guardados. Se falhar, tenta
 * de novo na hora seguinte. Só usa o que o tick já leu (data.contacts).
 */

const config = require('../config')
const db = require('./supabase')
const periods = require('./periods')
const { store } = require('./store')
const { phoneOf } = require('./portal')

const SYNC_HOUR = 1 // 1h da manhã em Brasília
const RETRY_MS = 60 * 60 * 1000

const timecounters = store('timecounters')
const state = store('msgdaily') // grupo → { lastDay }
let lastAttempt = 0

/** Hora atual em Brasília (0–23). */
function hourLocal (now = Date.now()) {
  return new Date(now - 3 * 3600 * 1000).getUTCHours()
}

/** número (todas as variantes BR) → user_id do portal. */
function userByPhone (contacts) {
  const map = new Map()
  for (const c of contacts || []) {
    for (const v of config.phoneVariants(c.whatsapp)) map.set(v, c.user_id)
  }
  return map
}

/** Linhas de group_message_daily dos dias fechados ainda não enviados. */
function buildRows (group, meta, contacts, today) {
  const daily = timecounters.get(group, {}).daily || {}
  const lastDay = state.get(group, {}).lastDay || ''
  const days = Object.keys(daily).filter(d => d > lastDay && d < today).sort()
  if (!days.length) return { days, rows: [] }

  const users = userByPhone(contacts)
  const userOf = jid => users.get(phoneOf(jid, meta)) || null
  const inGroup = new Set((meta.participants || []).map(p => userOf(p.id)).filter(Boolean))

  const rows = []
  for (const day of days) {
    const counts = new Map([...inGroup].map(id => [id, 0]))
    for (const [jid, n] of Object.entries(daily[day])) {
      const id = userOf(jid)
      if (id) counts.set(id, (counts.get(id) || 0) + n)
    }
    for (const [userId, messages] of counts) {
      rows.push({ group_id: group, day, user_id: userId, messages })
    }
  }
  return { days, rows }
}

/** Regra do tick de automations.js. */
async function syncMessageDaily (ctx) {
  const group = ctx.settings.default_group
  if (!group || hourLocal(ctx.now) < SYNC_HOUR) return
  if (ctx.now - lastAttempt < RETRY_MS) return

  const today = periods.dayKey(ctx.now)
  const lastDay = state.get(group, {}).lastDay || ''
  const pending = Object.keys(timecounters.get(group, {}).daily || {}).some(d => d > lastDay && d < today)
  if (!pending) return

  lastAttempt = ctx.now
  const meta = await ctx.sock.groupMetadata(group)
  const { days, rows } = buildRows(group, meta, ctx.data.contacts, today)
  if (rows.length) await db.upsert('group_message_daily', rows, 'group_id,day,user_id')
  state.set(group, { lastDay: days.at(-1) })
  console.log(`[mensagens] ${days.length} dia(s) enviados ao portal (${rows.length} linhas).`)
}

module.exports = { syncMessageDaily, _test: { buildRows, hourLocal } }
