'use strict'

const { store } = require('./store')
const periods = require('./periods')
const { pick } = require('./meter')
const config = require('../config')
const FRASES = require('../data/saudacoes')

/** Grafias do número com e sem o 9 (o WhatsApp manda alguns números BR sem ele). */
const variantsOf = phone => config.phoneVariants(String(phone || '')).filter(v => /^\d+$/.test(v))

/**
 * Resposta automática a "bom dia", "boa tarde" e "boa noite": uma vez por
 * pessoa, por período, por dia em cada grupo. Donos recebem a de chefe; os
 * demais, o tom pelo primeiro nome (estatística do IBGE); na dúvida, a
 * versão que serve para todo mundo. As frases ficam em src/data/saudacoes.js.
 */

// No começo da mensagem: "bom dia", "bomdia", "bom diaaa", "bdia", "bundia",
// "boa tarde", "boatarde", "btarde", "boa noite", "boanoite", "bnoite"…
const PERIODOS = {
  dia: /^\s*(bo[mn]\s*dia+|b\s*dia+|bu[mn]\s*dia+)\b/i,
  tarde: /^\s*(bo+a\s*tarde+|b\s*tarde+)\b/i,
  noite: /^\s*(bo+a\s*noite+|b\s*noite+|boa\s*nt)\b/i
}

const greeted = new Map() // "grupo|pessoa|período" → dia da última resposta

/** 'dia' | 'tarde' | 'noite' quando a mensagem começa com a saudação; senão null. */
function detect (text) {
  return Object.keys(PERIODOS).find(p => PERIODOS[p].test(text || '')) || null
}

/** true se ainda não respondeu essa pessoa nesse período hoje (e já marca). */
function firstToday (chat, sender, periodo) {
  const key = `${chat}|${sender}|${periodo}`
  const today = periods.dayKey()
  if (greeted.get(key) === today) return false
  if (greeted.size > 2000) greeted.clear()
  greeted.set(key, today)
  return true
}

/* ── Palpite pelo nome (IBGE) ──────────────────────────── */

const nomes = store('nomes') // primeiro nome → 'ela' | 'ele' | '?'
const IBGE = 'https://servicodados.ibge.gov.br/api/v2/censos/nomes'
const SHARE = 0.9 // só decide quando ≥ 90% das pessoas com o nome são de um sexo

/** Primeiro nome, sem emoji/acento: "Mariana 🌸 Souza" → "mariana". */
function firstName (name) {
  const word = String(name || '').normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z\s]/g, ' ').trim().split(/\s+/)[0] || ''
  return word.length >= 2 ? word.toLowerCase() : ''
}

async function ibgeCount (name, sexo) {
  const res = await fetch(`${IBGE}/${encodeURIComponent(name)}?sexo=${sexo}`, { signal: AbortSignal.timeout(8000) })
  if (!res.ok) throw new Error(`IBGE ${res.status}`)
  const data = await res.json()
  return (data[0]?.res || []).reduce((sum, r) => sum + r.frequencia, 0)
}

async function guessByName (name) {
  const first = firstName(name)
  if (!first) return null
  if (!nomes.get(first)) {
    try {
      const [f, m] = await Promise.all([ibgeCount(first, 'F'), ibgeCount(first, 'M')])
      const total = f + m
      nomes.set(first, !total ? '?' : f / total >= SHARE ? 'ela' : m / total >= SHARE ? 'ele' : '?')
    } catch (err) {
      console.error('[bomdia] IBGE:', err.message)
      return null // sem cache: tenta de novo na próxima
    }
  }
  const g = nomes.get(first)
  return g === '?' ? null : g
}

/** Nome da pessoa no portal (pelo número do WhatsApp). */
async function portalName (phoneJid) {
  const supabase = require('./supabase')
  const phone = String(phoneJid || '').split('@')[0].split(':')[0]
  if (!supabase.enabled() || !/^\d{10,15}$/.test(phone)) return null
  try {
    const rows = await supabase.select(`member_whatsapp?select=profiles(name)&whatsapp=in.(${variantsOf(phone).join(',')})`)
    return rows[0]?.profiles?.name || null
  } catch {
    return null
  }
}

/** Saudação em negrito numa linha, o complemento embaixo. */
function format (set, { semMasayoshi = false } = {}) {
  const extras = semMasayoshi ? set.extras.filter(e => !/masayoshi/i.test(e)) : set.extras
  return `*${pick(set.saudacoes)}*\n\n${pick(extras)}`
}

/**
 * Tom da resposta para quem mandou a mensagem: 'chefe' (donos) | 'ela' |
 * 'ele' | 'todos'. Ordem: nome no portal → nome do WhatsApp → 'todos'
 * (serve para qualquer pessoa).
 */
async function toneOf (ids, { phoneJid, pushName, isOwner = false } = {}) {
  if (isOwner) return 'chefe'
  const g = await guessByName(await portalName(phoneJid)) || await guessByName(pushName)
  return g || 'todos'
}

/** Texto da saudação do `periodo` (opts: os de toneOf + semMasayoshi). */
async function reply (periodo, ids, opts) {
  return format(FRASES[periodo][await toneOf(ids, opts)], opts)
}

/** 'ela' | 'ele' | null de um membro do portal, pelo nome. Usado no aviso de aniversário. */
function generoOf ({ name }) {
  return guessByName(name)
}

module.exports = { detect, firstToday, reply, toneOf, format, generoOf }
