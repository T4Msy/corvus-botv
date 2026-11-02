'use strict'

const db = require('./supabase')
const { store } = require('./store')
const { validate: validarJustificativa } = require('./justificativa')
const { emoji } = require('../ui/theme')

/**
 * Presença nos eventos do Portal MSY pelo WhatsApp, com as mesmas regras
 * do portal (js/app.js → eventos). Usado pelo /presença e pela resposta à
 * cobrança no privado ("sim" / "não <motivo>"):
 *  - "sim": confirma (status confirmado / response_status participar)
 *  - "não <motivo>" (ou "justificar <motivo>"): ausência justificada, vai para a Diretoria aprovar
 *  - já tinha confirmado e agora justifica: vira pedido de cancelamento
 *    (event_cancel_requests), também para a Diretoria
 * "Não" sem motivo não vale: o bot pede o motivo.
 */

const WEEKDAYS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']
const SIM = /^(sim|s|vou|confirmo|confirmar|presente)$/i
const NAO = /^(n[aã]o|n|ausente|faltar)$/i
const JUSTIFICAR = /^(justificar|justifica|justificativa|justifico)$/i

// Última cobrança de presença mandada no privado: membro → { eventId, at }.
const cobrancas = store('cobrancas')
const COBRANCA_VALIDA_MS = 3 * 86400e3

/** Próximos eventos ativos e públicos que ainda não começaram. */
async function upcoming () {
  const now = Date.now()
  const today = new Date(now - 3 * 3600e3).toISOString().slice(0, 10)
  const evs = await db.select(
    'events?select=id,title,event_date,event_time,mandatory' +
    `&status=eq.ativo&is_private=eq.false&event_date=gte.${today}&order=event_date.asc,event_time.asc&limit=10`
  )
  return evs.filter(e => {
    const hhmm = /^\d{1,2}:\d{2}/.test(e.event_time || '') ? e.event_time.slice(0, 5).padStart(5, '0') : '23:59'
    return new Date(`${e.event_date}T${hhmm}:00-03:00`).getTime() > now
  })
}

function quando (e) {
  const [, m, d] = e.event_date.split('-')
  const wd = WEEKDAYS[new Date(`${e.event_date}T12:00:00-03:00`).getUTCDay()]
  return `${wd}, ${d}/${m}${e.event_time ? ` às ${e.event_time.slice(0, 5)}` : ''}`
}

/** Resposta atual do membro ao evento (mesma leitura do portal). */
function statusOf (rows, cancels, ev) {
  const r = rows.find(x => x.event_id === ev.id)
  if (cancels.some(c => c.event_id === ev.id)) return '⏳ cancelamento em análise'
  const s = r?.response_status || r?.status
  if (s === 'participar' || s === 'confirmado') return '✅ confirmado'
  if (r?.justificativa_status === 'pendente') return '⏳ ausência em análise'
  if (s === 'nao_participar' || s === 'ausente' || s === 'justificado') return '❌ não vai'
  return '❔ ainda não respondeu'
}

async function myRows (userId, events) {
  if (!events.length) return { rows: [], cancels: [] }
  const ids = events.map(e => e.id).join(',')
  const [rows, cancels] = await Promise.all([
    db.select(`event_presencas?select=event_id,status,response_status,justificativa_status&event_id=in.(${ids})&or=(user_id.eq.${userId},membro_id.eq.${userId})`),
    db.select(`event_cancel_requests?select=event_id&status=eq.pendente&user_id=eq.${userId}&event_id=in.(${ids})`)
  ])
  return { rows, cancels }
}

/** Atualiza a linha do membro no evento ou cria uma nova. */
async function savePresence (ev, userId, row) {
  const filter = `event_presencas?event_id=eq.${ev.id}&or=(user_id.eq.${userId},membro_id.eq.${userId})`
  const updated = await db.update(filter, row)
  if (updated?.length) return
  await db.insert('event_presencas', [{ event_id: ev.id, user_id: userId, membro_id: userId, ...row }])
}

async function confirmar (ev, profile) {
  const now = new Date().toISOString()
  await savePresence(ev, profile.id, { status: 'confirmado', response_status: 'participar', response_at: now })
  // Confirmar de novo derruba um pedido de cancelamento pendente (igual ao portal).
  await db.update(
    `event_cancel_requests?event_id=eq.${ev.id}&user_id=eq.${profile.id}&status=eq.pendente`,
    { status: 'recusado', reviewed_at: now }
  ).catch(() => {})
}

/** Ausência justificada (ou pedido de cancelamento, se já tinha confirmado). */
async function justificar (ev, profile, motivo, jaConfirmado) {
  const now = new Date().toISOString()
  if (jaConfirmado) {
    await db.insert('event_cancel_requests', [{ user_id: profile.id, event_id: ev.id, justificativa: motivo, status: 'pendente' }])
  } else {
    await savePresence(ev, profile.id, {
      status: 'ausente', response_status: 'nao_participar', response_at: now, // 'ausente' é o que o banco já usa
      justificativa: motivo, justificativa_status: 'pendente'
    })
  }
  await db.rpc('notify_diretoria', {
    p_message: jaConfirmado
      ? `${profile.name} pediu para cancelar a presença em "${ev.title}" (pelo WhatsApp).`
      : `${profile.name} enviou uma justificativa de ausencia para evento (pelo WhatsApp).`,
    p_type: 'event',
    p_icon: '🗓️'
  }).catch(() => {})
}

/**
 * Aplica a resposta ("sim" / "não <motivo>") a um evento já escolhido e
 * devolve o texto para o membro. `como` = como escrever de novo (ex.:
 * "/presença 2" no grupo, "" no privado).
 */
async function responder ({ profile, ev, atual, resposta, motivo, como }) {
  const cmd = como ? `${como} ` : ''
  if (SIM.test(resposta)) {
    if (atual.startsWith('✅')) return `${emoji.check} Você já está confirmado em *${ev.title}*. 🍷`
    await confirmar(ev, profile)
    return `${emoji.check} Presença confirmada em *${ev.title}* (${quando(ev)})! Te esperamos. 🍷`
  }

  if (atual.startsWith('⏳')) return `${emoji.moon} Você já tem um pedido em análise para *${ev.title}*.`
  // Para faltar é sempre com motivo (vai para a Diretoria).
  if (!motivo) return `${emoji.feather} Para faltar, diga o motivo (vai para a Diretoria):\n*${cmd}não <motivo>*`
  // "não vou ir", "preguiça", "kkkk"… não passam.
  const check = validarJustificativa(motivo)
  if (!check.ok) {
    return `${emoji.cross} *Justificativa inválida, favor melhorar a justificativa.*\n\n${check.dica}\n` +
      `_Ex.: ${cmd}não vou viajar com a família_`
  }
  const jaConfirmado = atual.startsWith('✅')
  await justificar(ev, profile, motivo, jaConfirmado)
  return jaConfirmado
    ? `${emoji.check} Pedido de cancelamento enviado para a Diretoria: *${ev.title}*.\n_Motivo: ${motivo}_`
    : `${emoji.check} Ausência em *${ev.title}* enviada para a Diretoria aprovar.\n_Motivo: ${motivo}_`
}

/* ── Resposta à cobrança no privado ─────────────────────── */

/** Guarda que o membro foi cobrado no privado sobre o evento. */
function marcarCobranca (userId, eventId) {
  cobrancas.set(userId, { eventId, at: Date.now() })
}

/** "sim …" / "não …" no privado? Devolve { resposta, motivo } ou null. */
function parseResposta (text) {
  const [first = '', ...rest] = String(text || '').trim().split(/\s+/)
  const resposta = first.toLowerCase().replace(/[!.,]+$/, '')
  if (!SIM.test(resposta) && !NAO.test(resposta) && !JUSTIFICAR.test(resposta)) return null
  return { resposta, motivo: rest.join(' ').trim() }
}

/**
 * Resposta no privado a uma cobrança recente. Devolve o texto a mandar, ou
 * null quando não há cobrança válida (aí a mensagem segue o fluxo normal).
 */
async function responderCobranca (profile, text) {
  const parsed = parseResposta(text)
  const c = parsed && cobrancas.get(profile.id)
  if (!c || Date.now() - c.at > COBRANCA_VALIDA_MS) return null
  const ev = (await upcoming()).find(e => e.id === c.eventId)
  if (!ev) { cobrancas.delete(profile.id); return null }
  const { rows, cancels } = await myRows(profile.id, [ev])
  const atual = statusOf(rows, cancels, ev)
  // Só esquece a cobrança quando resolveu: "sim", motivo aceito ou pedido já em análise.
  // "não" sem motivo ou com motivo fraco: a pessoa tenta de novo no privado.
  const resolve = SIM.test(parsed.resposta) || atual.startsWith('⏳') ||
    (parsed.motivo && validarJustificativa(parsed.motivo).ok)
  const out = await responder({ profile, ev, atual, ...parsed, como: '' })
  if (resolve) cobrancas.delete(profile.id)
  return out
}

module.exports = {
  SIM, NAO, JUSTIFICAR, upcoming, quando, statusOf, myRows, responder,
  marcarCobranca, parseResposta, responderCobranca
}
