'use strict'

/**
 * Avisos automáticos do Portal MSY pelo WhatsApp.
 *
 * A cada minuto lê o banco do portal numa chamada só (função bot_tick_data,
 * migration 20261107_bot_tick_data.sql no repositório do portal) e manda o que
 * estiver na hora: evento publicado, cobrança de presença, 1h/30min/início do evento,
 * atividade nova, prazo (no dia e 1h antes), reunião marcada/lembrete,
 * comunicado novo, aniversário (às 6h: card com a foto, nome do grupo trocado no dia) e
 * aniversário de entrada na Masayoshi (às 10h). Cada aviso, seus destinos (grupo padrão e/ou privado),
 * antecedência e texto vêm da tabela bot_automations, editável na Central do
 * Bot (portal/bot.html).
 *
 * Nunca manda duas vezes: antes de enviar, "reserva" (key, ref) em
 * bot_auto_log. Nunca manda atrasado: só dentro de GRACE_MS do horário.
 * Só liga com SUPABASE_URL e SUPABASE_SERVICE_KEY no .env.
 *
 * Campo novo numa regra = mudar a função bot_tick_data no banco E este arquivo.
 * As regras só leem `ctx.data`; o banco só é chamado de novo para gravar
 * (claim em bot_auto_log e histórico em bot_messages) quando um aviso sai.
 */

const db = require('./lib/supabase')
const { sendDm, sendGroup } = require('./lib/outbox')
const { store } = require('./lib/store')
const { pick } = require('./lib/meter')
const saudacao = require('./lib/saudacao')
const presenca = require('./lib/presenca')
const { birthdayCard } = require('./lib/cards')
const FRASES_ANIVERSARIO = require('./data/aniversario')
const FRASES_ORDEM = require('./data/aniversario-ordem')

const TICK_MS = 60 * 1000
const GRACE_MS = 15 * 60 * 1000 // passou disso do horário, o aviso é descartado
const NEW_WINDOW_MS = 30 * 60 * 1000 // "novo" = criado nos últimos 30 min
const TZ = '-03:00' // horário de Brasília (sem horário de verão)
const PORTAL = 'https://www.portalmsy.site'
const FINISHED = ['Concluída', 'Incompleta', 'Cancelada']

/* ── Datas ─────────────────────────────────────────────── */

/** Date de uma data (YYYY-MM-DD) + hora (HH:MM[:SS]) no horário de Brasília. */
function localDate (date, time) {
  const hhmm = /^\d{1,2}:\d{2}/.test(String(time || '')) ? String(time).slice(0, 5).padStart(5, '0') : '23:59'
  return new Date(`${date}T${hhmm}:00${TZ}`)
}

/** YYYY-MM-DD de hoje em Brasília. */
function todayLocal (offsetDays = 0) {
  const d = new Date(Date.now() - 3 * 3600 * 1000 + offsetDays * 86400000)
  return d.toISOString().slice(0, 10)
}

const fmtDate = date => {
  const [y, m, d] = String(date).split('-')
  return `${d}/${m}/${y}`
}
const fmtTime = time => String(time || '').slice(0, 5)

/** Está na hora de um aviso `offsetMin` minutos antes de `when`? */
function due (when, offsetMin = 0, now = Date.now()) {
  const fireAt = when.getTime() - offsetMin * 60000
  return now >= fireAt && now < fireAt + GRACE_MS
}

function render (template, vars) {
  return template.replace(/\{(\w+)\}/g, (all, key) => (key in vars ? String(vars[key] ?? '') : all))
}

/* ── Envio + registro ──────────────────────────────────── */

/** Reserva o aviso; false se ele já tinha saído. */
async function claim (key, ref) {
  const rows = await db.insert('bot_auto_log', [{ key, ref_id: String(ref) }], { ignoreDuplicates: true })
  return Array.isArray(rows) && rows.length > 0
}

async function logMessage (row) {
  try {
    await db.insert('bot_messages', [row])
  } catch (err) {
    console.error('[avisos] Falha ao gravar histórico:', err.message)
  }
}

/**
 * Entrega um aviso conforme a configuração (`auto`):
 *  - grupo padrão: marca todo mundo; {pessoas}/{pendentes} viram menções de `people`
 *  - privado: cada um de `people` com WhatsApp; {pessoas}/{pendentes} viram texto pessoal
 */
async function deliver (ctx, auto, { vars, people = [], groupText = null, dmFooter = '' }) {
  const { sock, settings, phones, names } = ctx

  if (auto.to_group && settings.default_group) {
    const text = render(groupText || auto.template, { ...vars, pessoas: '{marcados}', pendentes: '{marcados}' })
    const mentionPhones = people.map(id => phones.get(id)).filter(Boolean)
    // Quem não tem WhatsApp cadastrado aparece pelo nome.
    const unnamed = people.filter(id => !phones.get(id)).map(id => names.get(id)).filter(Boolean)
    const finalText = unnamed.length ? text.replace('{marcados}', `{marcados} ${unnamed.join(', ')}`) : text
    let error = null
    try {
      // Todo aviso no grupo notifica todo mundo; {marcados}/{todos} seguem visíveis.
      await sendGroup(sock, settings.default_group, finalText, { mentionPhones, notifyAll: true })
    } catch (err) {
      error = err.message
      console.error(`[avisos] ${auto.key} no grupo:`, err.message)
    }
    await logMessage({
      target_type: 'grupo', target: settings.default_group, target_name: settings.default_group_name,
      message: finalText.replace(/\{marcados\}/g, mentionPhones.length ? '@…' : '').trim(),
      ok: !error, error, source: auto.key
    })
  }

  if (auto.to_private) {
    for (const userId of people) {
      const phone = phones.get(userId)
      if (!phone) continue
      const text = render(auto.template, {
        ...vars,
        nome: names.get(userId) || '',
        pessoas: 'você',
        pendentes: 'Você ainda não marcou a sua presença.',
        todos: ''
      }).trim() + dmFooter
      let error = null
      try {
        await sendDm(sock, phone, text)
      } catch (err) {
        error = err.message
        console.error(`[avisos] ${auto.key} para ${names.get(userId)}:`, err.message)
      }
      await logMessage({
        target_type: 'membro', target: userId, target_name: names.get(userId),
        message: text, ok: !error, error, source: auto.key
      })
    }
  }
}

/* ── Regras ────────────────────────────────────────────── */

async function eventos (ctx) {
  const { autos, now } = ctx
  const keys = ['evento_publicado', 'evento_cobranca_1', 'evento_cobranca_2', 'evento_1h', 'evento_30min', 'evento_inicio']
  if (!keys.some(k => autos[k])) return

  // Eventos públicos ativos de ontem até daqui a 60 dias (filtrados no banco).
  const events = ctx.data.events
  if (!events.length) return

  const presencas = ctx.data.event_presencas
  const pendingOf = (ev) => {
    const answered = new Set(presencas
      .filter(p => p.event_id === ev.id && (p.response_status || ['participar', 'confirmado', 'nao_participar', 'justificado', 'ausente'].includes(p.status)))
      .map(p => p.user_id || p.membro_id))
    return ctx.memberIds.filter(id => !answered.has(id))
  }

  for (const ev of events) {
    const start = localDate(ev.event_date, ev.event_time)
    if (Number.isNaN(start.getTime())) continue
    const vars = {
      titulo: ev.title, data: fmtDate(ev.event_date), hora: fmtTime(ev.event_time) || '—',
      descricao: ev.description || '', link: `${PORTAL}/eventos.html`
    }

    const pub = autos.evento_publicado
    if (pub && start > now && now - new Date(ev.created_at) < NEW_WINDOW_MS && await claim(pub.key, ev.id)) {
      await deliver(ctx, pub, { vars })
    }

    // Evento criado depois do horário de todas as cobranças (em cima da hora):
    // cobra uma vez, já, com a última cobrança configurada.
    const cobrancas = ['evento_cobranca_1', 'evento_cobranca_2'].map(k => autos[k]).filter(Boolean)
    const fireAt = a => start.getTime() - (a.offset_minutes ?? 0) * 60000
    const created = new Date(ev.created_at).getTime()
    const late = start.getTime() > now && cobrancas.length > 0 && cobrancas.every(a => created >= fireAt(a))
    const ultima = late ? cobrancas.reduce((a, b) => (fireAt(b) > fireAt(a) ? b : a)) : null

    for (const key of ['evento_cobranca_1', 'evento_cobranca_2']) {
      const auto = autos[key]
      if (!auto || !(auto === ultima || due(start, auto.offset_minutes ?? 0, now))) continue
      if (!await claim(key, ev.id)) continue
      const pending = pendingOf(ev)
      if (!pending.length) continue
      // No privado dá para responder ali mesmo ("sim" / "não <motivo>"): lib/presenca.js.
      if (auto.to_private) pending.forEach(id => presenca.marcarCobranca(id, ev.id))
      await deliver(ctx, auto, {
        vars,
        people: pending,
        dmFooter: '\n\n_Responda aqui mesmo: *sim* para confirmar ou *não* + o motivo para justificar._'
      })
    }

    for (const key of ['evento_1h', 'evento_30min', 'evento_inicio']) {
      const auto = autos[key]
      if (auto && due(start, auto.offset_minutes ?? 0, now) && await claim(key, ev.id)) {
        await deliver(ctx, auto, { vars })
      }
    }
  }
}

/** Prazo efetivo da atividade (estendido, se houver). */
function deadlineOf (act) {
  return act.extended_deadline
    ? { date: act.extended_deadline, time: act.extended_deadline_time }
    : { date: act.deadline, time: act.deadline_time }
}

async function atividades (ctx) {
  const { autos, now } = ctx
  if (!autos.atividade_nova && !autos.atividade_prazo_dia && !autos.atividade_prazo_1h) return

  // Atividades criadas nos últimos 30 min ou com prazo de ontem em diante (filtradas no banco).
  const open = ctx.data.activities.filter(a => !FINISHED.includes(a.status))
  if (!open.length) return

  const collabs = ctx.data.activity_collaborators
  const responses = ctx.data.activity_responses
  const peopleOf = a => [...new Set([a.assigned_to, ...collabs.filter(c => c.activity_id === a.id).map(c => c.user_id)].filter(Boolean))]
  const delivered = a => new Set(responses.filter(r => r.activity_id === a.id).map(r => r.user_id))

  // Atividade nova: as cópias da mesma atividade criadas juntas (uma por membro)
  // viram uma mensagem só no grupo.
  const nova = autos.atividade_nova
  if (nova) {
    const fresh = open.filter(a => now - new Date(a.created_at) < NEW_WINDOW_MS)
    const batches = new Map()
    for (const a of fresh) {
      if (!await claim(nova.key, a.id)) continue
      const dl = deadlineOf(a)
      const k = `${a.title}|${a.assigned_by}|${dl.date}|${dl.time}`
      if (!batches.has(k)) batches.set(k, { act: a, people: [] })
      batches.get(k).people.push(...peopleOf(a))
    }
    for (const { act, people } of batches.values()) {
      const dl = deadlineOf(act)
      await deliver(ctx, nova, {
        people: [...new Set(people)],
        vars: { titulo: act.title, prazo: `${fmtDate(dl.date)} às ${fmtTime(dl.time) || '23:59'}`, link: `${PORTAL}/atividades.html` }
      })
    }
  }

  for (const a of open) {
    const dl = deadlineOf(a)
    if (!dl.date) continue
    const end = localDate(dl.date, dl.time)
    const pending = peopleOf(a).filter(id => !delivered(a).has(id))
    if (!pending.length) continue
    const vars = { titulo: a.title, data: fmtDate(dl.date), hora: fmtTime(dl.time) || '23:59', prazo: `${fmtDate(dl.date)} às ${fmtTime(dl.time) || '23:59'}`, link: `${PORTAL}/atividades.html` }
    const ref = `${a.id}:${dl.date}:${dl.time || ''}` // prazo estendido = novo lembrete

    const dia = autos.atividade_prazo_dia
    if (dia && end > now && due(localDate(dl.date, '08:00'), 0, now) && await claim(dia.key, ref)) {
      await deliver(ctx, dia, { vars, people: pending })
    }
    const hora = autos.atividade_prazo_1h
    if (hora && due(end, hora.offset_minutes ?? 60, now) && await claim(hora.key, ref)) {
      await deliver(ctx, hora, { vars, people: pending })
    }
  }
}

async function reunioes (ctx) {
  const { autos, now } = ctx
  if (!autos.reuniao_marcada && !autos.reuniao_lembrete) return

  // Reuniões agendadas, novas ou de ontem em diante (filtradas no banco).
  const meetings = ctx.data.meetings
  if (!meetings.length) return
  const parts = ctx.data.meeting_participants

  for (const m of meetings) {
    const start = localDate(m.meeting_date, m.meeting_time)
    const people = parts.filter(p => p.meeting_id === m.id).map(p => p.user_id)
    const vars = { titulo: m.title || 'Reunião', data: fmtDate(m.meeting_date), hora: fmtTime(m.meeting_time), link: `${PORTAL}/reunioes.html` }

    const marcada = autos.reuniao_marcada
    if (marcada && start > now && now - new Date(m.created_at) < NEW_WINDOW_MS && await claim(marcada.key, m.id)) {
      await deliver(ctx, marcada, { vars, people })
    }
    const lembrete = autos.reuniao_lembrete
    if (lembrete && due(start, lembrete.offset_minutes ?? 60, now) && await claim(lembrete.key, m.id)) {
      await deliver(ctx, lembrete, { vars, people })
    }
  }
}

async function comunicados (ctx) {
  const auto = ctx.autos.comunicado_novo
  if (!auto) return
  // Comunicados dos últimos 30 minutos (filtrados no banco).
  for (const c of ctx.data.comunicados) {
    if (!await claim(auto.key, c.id)) continue
    const conteudo = String(c.content || '').replace(/<[^>]+>/g, '').trim()
    await deliver(ctx, auto, {
      people: auto.to_private ? ctx.memberIds : [],
      vars: {
        titulo: c.title, categoria: c.category || 'Geral', link: `${PORTAL}/comunicados.html`,
        conteudo: conteudo.length > 500 ? `${conteudo.slice(0, 500)}…` : conteudo
      }
    })
  }
}

/* ── Aniversário ───────────────────────────────────────── */

const BIRTHDAY_TIME = '06:00'
const ORDEM_TIME = '10:00' // aniversário de entrada na Masayoshi
const SUBJECT_MAX = 100 // limite do WhatsApp para o nome do grupo
const renamed = store('aniversario') // grupo → { original, subject, date }

/** Aniversariantes de hoje (29/02 entra no dia 28 nos anos que não são bissextos). */
function birthdaysToday (profiles, today) {
  const md = today.slice(5)
  const year = Number(today.slice(0, 4))
  const leap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0
  return profiles.filter(p => {
    const bd = String(p.birth_date || '').slice(5, 10)
    return bd === md || (!leap && md === '02-28' && bd === '02-29')
  })
}

/** "do"/"da"/"de" de cada pessoa; com mais de uma, só "de" se misturar. */
async function articleOf (people) {
  const gs = await Promise.all(people.map(p => saudacao.generoOf({ name: p.name })))
  if (gs.every(g => g === 'ela')) return 'da'
  if (gs.every(g => g === 'ele')) return 'do'
  return 'de'
}

const joinNames = names => names.length > 1 ? `${names.slice(0, -1).join(', ')} e ${names.at(-1)}` : names[0]

/**
 * Às 6h: troca o nome do grupo padrão para "ANIVERSÁRIO DO/DA FULANO 🎂🥳"
 * e manda a mensagem marcando todos. No dia seguinte o nome volta ao original.
 */
async function aniversario (ctx) {
  const { autos, now, sock, settings } = ctx
  await restoreSubjects(sock)

  const auto = autos.aniversario
  const today = todayLocal()
  if (!auto || !due(localDate(today, BIRTHDAY_TIME), 0, now)) return

  const people = birthdaysToday(ctx.data.members.filter(p => p.birth_date), today)
  if (!people.length || !await claim(auto.key, today)) return

  const art = await articleOf(people)
  const nome = joinNames(people.map(p => p.name))

  const group = settings.default_group
  if (auto.to_group && group) {
    try {
      const meta = await sock.groupMetadata(group)
      const subject = `ANIVERSÁRIO ${art.toUpperCase()} ${nome.toUpperCase()}`.slice(0, SUBJECT_MAX - 5).trim() + ' 🎂🥳'
      await sock.groupUpdateSubject(group, subject)
      if (!renamed.get(group)) renamed.set(group, { original: meta.subject, subject, date: today })
    } catch (err) {
      // Sem permissão (grupo só deixa admin mudar o nome): manda a mensagem mesmo assim.
      console.error('[avisos] aniversário: não consegui mudar o nome do grupo:', err.message)
    }
    // Um card por aniversariante (foto do portal), antes da mensagem.
    for (const p of people) {
      try {
        const image = await birthdayCard({ name: p.name, avatarUrl: p.avatar_url, initials: p.initials, color: p.color })
        await sock.sendMessage(group, { image })
      } catch (err) {
        console.error(`[avisos] aniversário: card de ${p.name}:`, err.message)
      }
    }
  }

  await deliver(ctx, auto, {
    people: people.map(p => p.id),
    vars: { nome, do: art, frase: pick(FRASES_ANIVERSARIO) }
  })
}

/**
 * Às 10h: "Hoje faz N anos que Fulano entrou na Masayoshi" (pela join_date
 * do portal), uma mensagem por pessoa, marcando todos.
 */
async function aniversarioOrdem (ctx) {
  const auto = ctx.autos.aniversario_ordem
  const today = todayLocal()
  if (!auto || !due(localDate(today, ORDEM_TIME), 0, ctx.now)) return

  const profiles = ctx.data.members.filter(p => p.join_date)
  const year = Number(today.slice(0, 4))
  for (const p of birthdaysToday(profiles.map(x => ({ ...x, birth_date: x.join_date })), today)) {
    const anos = year - Number(String(p.join_date).slice(0, 4))
    if (anos < 1 || !await claim(auto.key, `${today}:${p.id}`)) continue
    await deliver(ctx, auto, {
      people: [p.id],
      vars: { nome: p.name, anos: `${anos} ${anos === 1 ? 'ano' : 'anos'}`, frase: pick(FRASES_ORDEM) }
    })
  }
}

/** Passado o dia, devolve o nome original (se ninguém mudou o nome no meio). */
async function restoreSubjects (sock) {
  const today = todayLocal()
  for (const [group, info] of Object.entries(renamed.all())) {
    if (info.date === today) continue
    try {
      const meta = await sock.groupMetadata(group)
      if (meta.subject === info.subject) await sock.groupUpdateSubject(group, info.original)
      renamed.delete(group)
    } catch (err) {
      console.error('[avisos] aniversário: não consegui voltar o nome do grupo:', err.message)
    }
  }
}

/* ── Loop ──────────────────────────────────────────────── */

let running = false

async function tick (getSocket) {
  const sock = getSocket()
  if (running || !sock) return
  running = true
  try {
    // Uma requisição só por minuto (antes eram de 8 a 12).
    const data = await db.rpc('bot_tick_data')
    // Parte que falhou no banco vem vazia e listada aqui; as outras seguem normalmente.
    if (data.errors?.length) console.error('[avisos] Partes sem dados nesta rodada:', data.errors.join(', '))
    const members = data.members
    const ctx = {
      sock,
      now: Date.now(),
      data,
      autos: Object.fromEntries(data.automations.map(a => [a.key, a])),
      settings: data.settings || {},
      memberIds: members.map(m => m.id),
      names: new Map(members.map(m => [m.id, m.name])),
      phones: new Map(data.contacts.map(c => [c.user_id, c.whatsapp]))
    }
    for (const rule of [eventos, atividades, reunioes, comunicados, aniversario, aniversarioOrdem]) {
      try {
        await rule(ctx)
      } catch (err) {
        console.error(`[avisos] Erro em ${rule.name}:`, err.message)
      }
    }
  } catch (err) {
    console.error('[avisos] Erro ao ler o portal:', err.message)
  } finally {
    running = false
  }
}

/** Liga o agendador (se o .env tiver as chaves do Supabase). */
function startAutomations (getSocket) {
  if (!db.enabled()) {
    console.log('ℹ️  Avisos automáticos desligados (falta SUPABASE_URL/SUPABASE_SERVICE_KEY no .env).')
    return
  }
  console.log('⏰ Avisos automáticos do portal ligados.')
  setTimeout(() => tick(getSocket), 30 * 1000)
  setInterval(() => tick(getSocket), TICK_MS)
}

module.exports = { startAutomations, _test: { localDate, todayLocal, due, render, deadlineOf, birthdaysToday, aniversario, aniversarioOrdem, eventos } }
