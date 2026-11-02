'use strict'

const crypto = require('crypto')
const { store } = require('./store')

/**
 * Lembretes pessoais (/lembrar): guardados em store('lembretes') e
 * disparados no privado de quem pediu. Horários no fuso de Brasília.
 */

const lembretes = store('lembretes') // id → { jid, text, at, createdAt }
const OFFSET_MS = 3 * 3600 * 1000 // UTC-3
const MAX_DIAS = 60
const MAX_POR_PESSOA = 10
const ATRASO_MAX = 12 * 3600 * 1000 // bot fora do ar: ainda manda se atrasou até 12h
const TICK_MS = 20 * 1000

/** "Agora" com os campos UTC lendo o relógio de Brasília. */
const brNow = (now = Date.now()) => new Date(now - OFFSET_MS)
/** Timestamp real de uma data/hora de Brasília. */
const fromBr = (y, mo, d, h, mi) => Date.UTC(y, mo, d, h, mi) + OFFSET_MS

/**
 * Lê o quando + o texto. Aceita:
 *   "em 30 min …", "em 2h …", "em 1 hora …"
 *   "20h …", "20h30 …", "20:30 …", "às 8h …"
 *   "amanhã 8h …", "05/11 15h …", "dia 5/11 às 15:30 …"
 * Retorna { at, text } ou null.
 */
function parse (input, now = Date.now()) {
  let s = String(input || '').trim()

  const rel = s.match(/^em\s+(\d+)\s*(min(?:uto)?s?|m|h(?:ora)?s?)\b\s*/i)
  if (rel) {
    const n = Number(rel[1])
    const ms = /^h/i.test(rel[2]) ? n * 3600e3 : n * 60e3
    return { at: now + ms, text: s.slice(rel[0].length).trim() }
  }

  const br = brNow(now)
  let y = br.getUTCFullYear()
  let mo = br.getUTCMonth()
  let d = br.getUTCDate()
  let dateGiven = false

  s = s.replace(/^hoje\s+/i, '')
  const amanha = s.match(/^amanh[ãa]\s+/i)
  const data = s.match(/^(?:dia\s+)?(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\s+/i)
  if (amanha) {
    const t = new Date(Date.UTC(y, mo, d + 1))
    ;[y, mo, d] = [t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate()]
    s = s.slice(amanha[0].length)
    dateGiven = true
  } else if (data) {
    d = Number(data[1])
    mo = Number(data[2]) - 1
    if (data[3]) y = Number(data[3].length === 2 ? `20${data[3]}` : data[3])
    s = s.slice(data[0].length)
    dateGiven = true
  }

  const hora = s.match(/^(?:[àa]s?\s+)?(\d{1,2})(?:h(\d{2})?|:(\d{2}))(?:\s*h)?\b\s*/i)
  if (!hora) return null
  const h = Number(hora[1])
  const mi = Number(hora[2] || hora[3] || 0)
  if (h > 23 || mi > 59) return null

  let at = fromBr(y, mo, d, h, mi)
  // Só a hora e ela já passou hoje → amanhã. Data sem ano que já passou → ano que vem.
  if (at <= now && !dateGiven) at += 86400e3
  else if (at <= now && data && !data[3]) at = fromBr(y + 1, mo, d, h, mi)
  return { at, text: s.slice(hora[0].length).trim() }
}

/** "hoje às 20:00" / "amanhã às 08:00" / "05/11 às 15:30". */
function when (at, now = Date.now()) {
  const a = brNow(at)
  const b = brNow(now)
  const hhmm = `${String(a.getUTCHours()).padStart(2, '0')}:${String(a.getUTCMinutes()).padStart(2, '0')}`
  const day = x => x.toISOString().slice(0, 10)
  if (day(a) === day(b)) return `hoje às ${hhmm}`
  if (day(a) === day(new Date(b.getTime() + 86400e3))) return `amanhã às ${hhmm}`
  return `${String(a.getUTCDate()).padStart(2, '0')}/${String(a.getUTCMonth() + 1).padStart(2, '0')} às ${hhmm}`
}

/** Lembretes de uma pessoa, do mais próximo ao mais distante. */
function listOf (jid) {
  return Object.entries(lembretes.all())
    .filter(([, l]) => l.jid === jid)
    .map(([id, l]) => ({ id, ...l }))
    .sort((a, b) => a.at - b.at)
}

/** Cria o lembrete; devolve o lembrete ou { error }. */
function add (jid, at, text, now = Date.now()) {
  if (at - now > MAX_DIAS * 86400e3) return { error: `Dá pra marcar até ${MAX_DIAS} dias pra frente.` }
  if (at <= now) return { error: 'Esse horário já passou.' }
  if (listOf(jid).length >= MAX_POR_PESSOA) return { error: `Você já tem ${MAX_POR_PESSOA} lembretes. Apague algum com /lembretes apagar <número>.` }
  const id = crypto.randomBytes(5).toString('hex')
  const item = { jid, text, at, createdAt: now }
  lembretes.set(id, item)
  return { id, ...item }
}

function remove (id) {
  lembretes.delete(id)
}

async function fire (sock, now = Date.now()) {
  for (const [id, l] of Object.entries(lembretes.all())) {
    if (l.at > now) continue
    lembretes.delete(id) // tira antes: nunca manda duas vezes
    if (now - l.at > ATRASO_MAX) continue
    const late = now - l.at > 5 * 60e3 ? `\n\n_(Desculpa o atraso: era pra ${when(l.at, now)}.)_` : ''
    try {
      await sock.sendMessage(l.jid, { text: `⏰ *Lembrete!*\n\n${l.text}${late}` })
    } catch (err) {
      console.error('[lembretes] falha ao enviar:', err.message)
    }
  }
}

/** Liga o disparo (a cada 20 s). */
function startReminders (getSocket) {
  setInterval(() => {
    const sock = getSocket()
    if (sock) fire(sock).catch(err => console.error('[lembretes]', err.message))
  }, TICK_MS)
}

module.exports = { parse, when, add, remove, listOf, fire, startReminders, MAX_POR_PESSOA }
