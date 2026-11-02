'use strict'

const db = require('../lib/supabase')
const { profileOf } = require('../lib/portal')
const { validate: validarJustificativa } = require('../lib/justificativa')
const { emoji, header, error } = require('../ui/theme')

/**
 * Presença nos eventos do Portal MSY pelo WhatsApp, com as mesmas regras
 * do portal (js/app.js → eventos):
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
  const [y, m, d] = e.event_date.split('-')
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

module.exports = {
  name: 'presenca',
  aliases: ['presença', 'presencas', 'presenças', 'pres'],
  category: 'Geral',
  fetchMeta: true,
  cooldown: 5,
  desc: 'Presença nos eventos do portal: presença sim | presença não <motivo> (com vários eventos: presença 2 sim).',
  async run ({ msg, sender, groupMetadata, args, reply, config }) {
    if (!db.enabled()) { await reply(error('O portal não está conectado ao bot.')); return }
    const p = `${config.prefix}presença`

    const { profile } = await profileOf({ msg, sender, groupMetadata, select: 'id,name' })
    if (!profile) { await reply(error('Seu WhatsApp não está cadastrado no Portal MSY. Cadastre em *Meu Perfil* no portal.')); return }

    const events = await upcoming()
    if (!events.length) { await reply(`${emoji.moon} Não tem nenhum evento marcado no portal agora.`); return }
    const { rows, cancels } = await myRows(profile.id, events)

    // "/presença 2 sim" → evento 2. Com um evento só, o número é opcional.
    const rest = [...args]
    const idx = /^\d+$/.test(rest[0] || '') ? Number(rest.shift()) - 1 : (events.length === 1 ? 0 : -1)
    const resposta = (rest[0] || '').toLowerCase()
    const motivo = rest.slice(1).join(' ').trim()

    const lista = () => events.map((e, i) =>
      `*${i + 1}.* ${e.title}${e.mandatory ? ' _(obrigatório)_' : ''}\n   ${emoji.bullet} ${quando(e)} · ${statusOf(rows, cancels, e)}`
    ).join('\n\n')

    const n = events.length > 1 ? ' 1' : ''
    const comandos =
      `${emoji.feather} Vou: *${p}${n} sim*\n` +
      `${emoji.feather} Não posso ir: *${p}${n} não <motivo>*`

    if (!resposta) {
      await reply(`${header(events.length > 1 ? 'Próximos eventos' : 'Próximo evento')}\n\n${lista()}\n\n${comandos}`)
      return
    }
    if (!SIM.test(resposta) && !NAO.test(resposta) && !JUSTIFICAR.test(resposta)) {
      await reply(`${emoji.cross} Não entendi. Use assim:\n\n${comandos}`)
      return
    }
    if (idx < 0) {
      await reply(`${emoji.feather} Tem ${events.length} eventos chegando. Diga qual pelo número:\n\n${lista()}\n\nEx.: *${p} 1 ${resposta}*`)
      return
    }
    const ev = events[idx]
    if (!ev) { await reply(`${emoji.cross} Não tem evento ${idx + 1}. Use *${p}* para ver a lista.`); return }

    const atual = statusOf(rows, cancels, ev)
    if (SIM.test(resposta)) {
      if (atual.startsWith('✅')) { await reply(`${emoji.check} Você já está confirmado em *${ev.title}*. 🍷`); return }
      await confirmar(ev, profile)
      await reply(`${emoji.check} Presença confirmada em *${ev.title}* (${quando(ev)})! Te esperamos. 🍷`)
      return
    }

    const num = events.length > 1 ? ` ${idx + 1}` : ''
    if (atual.startsWith('⏳')) { await reply(`${emoji.moon} Você já tem um pedido em análise para *${ev.title}*.`); return }
    const jaConfirmado = atual.startsWith('✅')

    // Para faltar é sempre com motivo (vai para a Diretoria).
    if (!motivo) {
      await reply(`${emoji.feather} Para faltar, diga o motivo (vai para a Diretoria):\n*${p}${num} não <motivo>*`)
      return
    }
    // "não vou ir", "preguiça", "kkkk"… não passam.
    const check = validarJustificativa(motivo)
    if (!check.ok) {
      await reply(
        `${emoji.cross} *Justificativa inválida, favor melhorar a justificativa.*\n\n${check.dica}\n` +
        `_Ex.: ${p}${num} não vou viajar com a família_`
      )
      return
    }
    await justificar(ev, profile, motivo, jaConfirmado)
    await reply(jaConfirmado
      ? `${emoji.check} Pedido de cancelamento enviado para a Diretoria: *${ev.title}*.\n_Motivo: ${motivo}_`
      : `${emoji.check} Ausência em *${ev.title}* enviada para a Diretoria aprovar.\n_Motivo: ${motivo}_`)
  }
}

