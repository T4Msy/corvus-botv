'use strict'

/**
 * Avisos automáticos do Portal MSY pelo WhatsApp.
 *
 * A cada minuto lê o banco do portal (lib/supabase.js) e manda o que estiver
 * na hora: evento publicado, cobrança de presença, 1h/30min/início do evento,
 * atividade nova, prazo (no dia e 1h antes), reunião marcada/lembrete e
 * comunicado novo. Cada aviso, seus destinos (grupo padrão e/ou privado),
 * antecedência e texto vêm da tabela bot_automations, editável na Central do
 * Bot (portal/bot.html).
 *
 * Nunca manda duas vezes: antes de enviar, "reserva" (key, ref) em
 * bot_auto_log. Nunca manda atrasado: só dentro de GRACE_MS do horário.
 * Só liga com SUPABASE_URL e SUPABASE_SERVICE_KEY no .env.
 */

const db = require('./lib/supabase')
const { sendDm, sendGroup } = require('./lib/outbox')

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
async function deliver (ctx, auto, { vars, people = [], groupText = null }) {
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
      }).trim()
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

  const events = await db.select(
    `events?select=id,title,description,event_date,event_time,created_at&status=eq.ativo&is_private=eq.false` +
    `&event_date=gte.${todayLocal(-1)}&event_date=lte.${todayLocal(60)}`
  )
  if (!events.length) return

  let presencas = null
  const pendingOf = async (ev) => {
    if (!presencas) {
      presencas = await db.select(`event_presencas?select=event_id,membro_id,user_id,status,response_status&event_id=in.(${events.map(e => e.id).join(',')})`)
    }
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

    for (const key of ['evento_cobranca_1', 'evento_cobranca_2']) {
      const auto = autos[key]
      if (!auto || !due(start, auto.offset_minutes ?? 0, now)) continue
      if (!await claim(key, ev.id)) continue
      const pending = await pendingOf(ev)
      if (pending.length) await deliver(ctx, auto, { vars, people: pending })
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

  const since = new Date(now - NEW_WINDOW_MS).toISOString()
  const acts = await db.select(
    `activities?select=id,title,assigned_to,assigned_by,deadline,deadline_time,extended_deadline,extended_deadline_time,status,created_at` +
    `&or=(created_at.gte.${since},deadline.gte.${todayLocal(-1)},extended_deadline.gte.${todayLocal(-1)})`
  )
  const open = acts.filter(a => !FINISHED.includes(a.status))
  if (!open.length) return

  const ids = open.map(a => a.id).join(',')
  const [collabs, responses] = await Promise.all([
    db.select(`activity_collaborators?select=activity_id,user_id&activity_id=in.(${ids})`),
    db.select(`activity_responses?select=activity_id,user_id&activity_id=in.(${ids})`)
  ])
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

  const since = new Date(now - NEW_WINDOW_MS).toISOString()
  const meetings = await db.select(
    `scheduled_meetings?select=id,title,meeting_date,meeting_time,created_at,status&status=eq.agendada` +
    `&or=(created_at.gte.${since},meeting_date.gte.${todayLocal(-1)})`
  )
  if (!meetings.length) return
  const parts = await db.select(`scheduled_meeting_participants?select=meeting_id,user_id&meeting_id=in.(${meetings.map(m => m.id).join(',')})`)

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
  const since = new Date(ctx.now - NEW_WINDOW_MS).toISOString()
  const rows = await db.select(`comunicados?select=id,title,content,category,created_at&created_at=gte.${since}`)
  for (const c of rows) {
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

/* ── Loop ──────────────────────────────────────────────── */

let running = false

async function tick (getSocket) {
  const sock = getSocket()
  if (running || !sock) return
  running = true
  try {
    const [autoRows, settingsRows, members, contacts] = await Promise.all([
      db.select('bot_automations?select=*&enabled=eq.true'),
      db.select('bot_settings?select=default_group,default_group_name&id=eq.1'),
      db.select('profiles?select=id,name&status=eq.ativo'),
      db.select('member_whatsapp?select=user_id,whatsapp&receive=eq.true')
    ])
    const ctx = {
      sock,
      now: Date.now(),
      autos: Object.fromEntries(autoRows.map(a => [a.key, a])),
      settings: settingsRows[0] || {},
      memberIds: members.map(m => m.id),
      names: new Map(members.map(m => [m.id, m.name])),
      phones: new Map(contacts.map(c => [c.user_id, c.whatsapp]))
    }
    for (const rule of [eventos, atividades, reunioes, comunicados]) {
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

module.exports = { startAutomations, _test: { localDate, todayLocal, due, render, deadlineOf } }
