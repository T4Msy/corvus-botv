'use strict'

const { store } = require('./store')
const periods = require('./periods')
const { pick } = require('./meter')

/**
 * Resposta automática ao "bom dia": uma vez por pessoa por dia em cada
 * grupo. O tom depende de como a pessoa pediu para ser chamada (/eusou);
 * sem escolha, o bot tenta pelo primeiro nome (estatística do IBGE) e,
 * na dúvida, vai a versão que serve para todo mundo.
 */

const genero = store('genero') // id do participante → 'ela' | 'ele'

// "bom dia", "bomdia", "bom diaaa", "bdia", "bundia"… no começo da mensagem.
const BOM_DIA_RE = /^\s*(bo[mn]\s*dia+|b\s*dia+|bu[mn]\s*dia+)\b/i

const ELA = {
  // Tom de um cara dando bom dia pra uma mulher: galanteio leve, sem forçar.
  saudacoes: ['Bom dia, linda! ☀️', 'Bom dia, gata! 😏', 'Bom dia, princesa! 👑', 'Bom dia, moça bonita! 😊', 'Bom dia, linda! Acordou mais bonita hoje? 😉'],
  extras: [
    'Seu bom dia já melhorou o meu. 😌',
    'Dormiu bem? Aposto que sonhou comigo. 😂',
    'Já tomou seu café ou quer que eu pague um? ☕',
    'Com esse bom dia o grupo até ficou mais bonito. ✨',
    'E aí, quais os planos pra hoje? 👀',
    'Avisa quando sorrir que o sol fica com inveja. 🌞'
  ]
}

const ELE = {
  saudacoes: ['Bom dia, irmão! Suave? 🤜🤛', 'Bom dia, mano! Tranquilo? 😎', 'Bom dia, parceiro! Firmeza? 💪', 'Bom dia, chefe! Como é que tá? 🍷'],
  extras: [
    'Bora que hoje o dia é nosso. 🔥',
    'Já tomou o café pra ligar o sistema? ☕',
    'E aí, qual é a boa de hoje?',
    'Viu o jogo ontem? ⚽',
    'Hoje é dia de fazer acontecer. 🚀',
    'Dormiu ou só piscou? 😂'
  ]
}

const TODOS = {
  saudacoes: ['Bom dia! ☀️', 'Bom diaaa! 🌤️', 'Bom dia, bom dia! 🍷', 'Bom dia, luz do grupo! ✨'],
  extras: [
    'Já tomou café? ☕',
    'Dormiu bem? 😴',
    'Qual o plano pra hoje?',
    'Que hoje seja leve e cheio de coisa boa. 🌱',
    'Bora que o dia tá só começando! 🚀',
    'Qual música tá na sua cabeça hoje? 🎶'
  ]
}

// Donos do Corvus (config.owner): bom dia de chefe.
const CHEFE = {
  saudacoes: ['Bom dia, chefe! 👑', 'Bom dia, patrão! 🍷', 'Bom dia, meu chefe! 🫡', 'Bom dia, chefia! Tudo nos conformes? 😎', 'O chefe chegou! Bom dia! 👑'],
  extras: [
    'O império Masayoshi não para, e o senhor sabe disso. 🏛️',
    'Ordens do dia? Tô aqui pra cumprir. 🫡',
    'Café servido, grupo em ordem e o Corvus de prontidão. ☕🐦‍⬛',
    'Com o chefe acordado, o grupo já tá em outro nível. 🔥',
    'Grande líder, a Masayoshi agradece a presença. 🍷',
    'Diga o que precisa, chefe. O Corvus resolve. 💼'
  ]
}

const greeted = new Map() // "grupo|pessoa" → dia da última resposta

function isGoodMorning (text) {
  return BOM_DIA_RE.test(text || '')
}

/** true se ainda não respondeu essa pessoa hoje nesse grupo (e já marca). */
function firstToday (chat, sender) {
  const key = `${chat}|${sender}`
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
    const rows = await supabase.select(`member_whatsapp?select=profiles(name)&whatsapp=eq.${phone}`)
    return rows[0]?.profiles?.name || null
  } catch {
    return null
  }
}

/**
 * Texto do bom dia. Donos recebem o de chefe. Para os demais: o que a pessoa escolheu (/eusou) → nome no
 * portal → nome do WhatsApp → versão que serve para todos.
 */
async function reply (ids, { phoneJid, pushName, isOwner = false } = {}) {
  if (isOwner) return `${pick(CHEFE.saudacoes)} ${pick(CHEFE.extras)}`
  let g = ids.map(id => genero.get(id)).find(Boolean)
  if (!g) g = await guessByName(await portalName(phoneJid))
  if (!g) g = await guessByName(pushName)
  const set = g === 'ela' ? ELA : g === 'ele' ? ELE : TODOS
  return `${pick(set.saudacoes)} ${pick(set.extras)}`
}

/** Guarda como a pessoa quer ser chamada em todas as suas identidades. */
function setGenero (ids, value) {
  for (const id of ids) {
    if (value) genero.set(id, value)
    else genero.delete(id)
  }
}

module.exports = { isGoodMorning, firstToday, reply, setGenero }
