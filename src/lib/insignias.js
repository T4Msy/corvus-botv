'use strict'

const db = require('./supabase')

/**
 * Insígnias de um membro, calculadas igual ao portal (js/badges_unificado.js):
 *  1. Recordes      — 1º lugar no Trono dos Recordes (msy_recordes_top3)
 *  2. Constância    — 1º em N relatórios de ranking seguidos (weekly_rankings)
 *  3. Premiações    — RPC get_member_badges (premiacao_vencedores)
 *  4. ICM           — espectros e tier do teste ICM (filtrados por selected_badges)
 * Ao mudar as regras no portal, mude aqui também.
 */

const ICM_META = {
  corvus: { label: 'Corvus', icon: '🐦‍⬛' },
  fenrir: { label: 'Fenrir', icon: '🐺' },
  aegis: { label: 'Aegis', icon: '⬡' },
  vortex: { label: 'Vortex', icon: '◉' },
  titan: { label: 'Titan', icon: '▲' },
  cipher: { label: 'Cipher', icon: '🎯' },
  specter: { label: 'Specter', icon: '◬' },
  elite: { label: 'Elite da Ordem', icon: '👑' },
  agente: { label: 'Agente da Ordem', icon: '🔵' },
  operador: { label: 'Operador Estratégico', icon: '🔰' }
}

const RECORDE_META = {
  semanal: { icon: '⚡', label: 'Soberania Semanal' },
  mensal: { icon: '🩸', label: 'Domínio Mensal' },
  diario: { icon: '🔱', label: 'Marca Perpétua' }
}

const CONSTANCIA_META = {
  semanal: [
    { threshold: 5, label: 'Chama da Constância' },
    { threshold: 10, label: 'Estandarte da Soberania' },
    { threshold: 20, label: 'Coroa da Supremacia Semanal' }
  ],
  mensal: [
    { threshold: 3, label: 'Pilar da Constância' },
    { threshold: 6, label: 'Trono da Persistência' },
    { threshold: 12, label: 'Dinastia Sangrenta' }
  ]
}

// Peso para escolher as "mais importantes" (maior primeiro).
const PESO_PREMIACAO = { Especial: 60, Anual: 50, Mensal: 30, Semanal: 20 }

/** Mesmo normalizador de nomes do ranking do portal (_tronNormalize). */
function normalizeName (name) {
  const raw = String(name || '')
  const base = raw.normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .replace(/[​-‍︎️﻿]/g, '').toLowerCase()
    .replace(/\p{Extended_Pictographic}/gu, '').replace(/[^\p{L}\p{N}]+/gu, '')
  return base || raw.toLowerCase().trim().replace(/\s+/g, ' ')
}

async function recordes (profile) {
  const rows = await db.select('msy_recordes_top3?select=tipo,posicao,nome&posicao=eq.1')
  const me = normalizeName(profile.name)
  return rows
    .filter(r => RECORDE_META[r.tipo] && normalizeName(r.nome) === me)
    .map(r => ({ ...RECORDE_META[r.tipo], peso: 90 }))
}

/** Maior sequência de 1º lugares seguidos do membro em cada tipo de ranking. */
async function constancia (profile) {
  const [rankings, profiles] = await Promise.all([
    db.select('weekly_rankings?select=id,tipo,week_start,week_end,created_at,entries&order=week_start.asc'),
    db.select('profiles?select=id,name')
  ])
  const byName = new Map()
  for (const p of profiles) {
    const n = normalizeName(p.name)
    if (n && !byName.has(n)) byName.set(n, p.id)
  }
  const keyOf = e => {
    const id = e?.user_id || e?.userId || e?.profile_id || byName.get(normalizeName(e?.name || e?.nome))
    return id ? `id:${id}` : `name:${normalizeName(e?.name || e?.nome)}`
  }
  const me = `id:${profile.id}`
  const out = []

  for (const tipo of ['semanal', 'mensal']) {
    const ordered = rankings
      .filter(r => ((!r.tipo || r.tipo === 'semanal') ? 'semanal' : 'mensal') === tipo)
      .sort((a, b) => String(a.week_start || a.created_at || a.week_end || '').localeCompare(String(b.week_start || b.created_at || b.week_end || '')) ||
        String(a.id).localeCompare(String(b.id)))
    let current = 0
    let best = 0
    for (const row of ordered) {
      const best1 = new Map()
      for (const e of row.entries || []) {
        const msgs = parseInt(e?.messages ?? e?.mensagens, 10) || 0
        if (msgs <= 0) continue
        const k = keyOf(e)
        best1.set(k, Math.max(best1.get(k) || 0, msgs))
      }
      const max = Math.max(0, ...best1.values())
      if (!max) continue
      const winners = [...best1].filter(([, m]) => m === max).map(([k]) => k)
      current = winners.includes(me) ? current + 1 : 0
      best = Math.max(best, current)
    }
    for (const m of CONSTANCIA_META[tipo]) {
      if (best >= m.threshold) out.push({ icon: '◆', label: m.label, peso: 70 + m.threshold })
    }
  }
  return out
}

async function premiacoes (profile) {
  const rows = await db.rpc('get_member_badges', { p_user_id: profile.id })
  return (rows || []).map(b => ({
    icon: b.icone || '🏆',
    label: b.titulo,
    vezes: b.quantidade,
    peso: (PESO_PREMIACAO[b.importancia] || 10) + Math.min(b.quantidade || 0, 9)
  }))
}

function icm (profile) {
  const data = profile.icm
  if (!data?.score) return []
  const keys = []
  if (data.dominante) keys.push(data.dominante.toLowerCase())
  if (data.secundario && data.secundario.toLowerCase() !== data.dominante?.toLowerCase()) keys.push(data.secundario.toLowerCase())
  const tier = data.score >= 80 ? 'elite' : data.score >= 70 ? 'agente' : data.score >= 60 ? 'operador' : null
  if (tier) keys.push(tier)

  const sel = profile.selected_badges
  const shown = !Array.isArray(sel) ? keys : keys.filter(k => sel.includes(k))
  return shown.filter(k => ICM_META[k]).map(k => ({ ...ICM_META[k], peso: k === tier ? 40 : 15 }))
}

/** Todas as insígnias do membro (sem repetir), da mais importante para a menos. */
async function insigniasOf (profile) {
  const parts = await Promise.all([
    recordes(profile).catch(() => []),
    constancia(profile).catch(() => []),
    premiacoes(profile).catch(() => []),
    icm(profile)
  ])
  const seen = new Set()
  return parts.flat()
    .filter(b => !seen.has(b.label) && seen.add(b.label))
    .sort((a, b) => b.peso - a.peso)
}

module.exports = { insigniasOf, normalizeName }
