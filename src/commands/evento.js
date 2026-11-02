'use strict'

const supabase = require('../lib/supabase')
const { statusOf } = require('../lib/presenca')
const { emoji, header, error, loading } = require('../ui/theme')

// Os eventos vêm do Portal MSY (tabela events): só os ativos e públicos,
// de hoje em diante. Criar/editar evento é pelo portal.
const PORTAL = 'https://www.portalmsy.site/eventos.html'
const WEEKDAYS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado']
const MAX = 5

/** YYYY-MM-DD de hoje em Brasília. */
function today () {
  return new Date(Date.now() - 3 * 3600 * 1000).toISOString().slice(0, 10)
}

function formatDate (date) {
  const [y, m, d] = date.split('-')
  const weekday = WEEKDAYS[new Date(`${date}T12:00:00-03:00`).getUTCDay()]
  return `${weekday}, ${d}/${m}/${y}`
}

function shorten (text, max = 160) {
  const clean = String(text || '').replace(/\s+/g, ' ').trim()
  return clean.length > max ? `${clean.slice(0, max - 1).trimEnd()}…` : clean
}

function formatEvento (ev, idx) {
  const lines = [
    `${emoji.dagger} *${idx + 1}. ${ev.title}*${ev.mandatory ? ' _(obrigatório)_' : ''}`,
    `   ${emoji.bullet} ${formatDate(ev.event_date)}${ev.event_time ? ` às ${String(ev.event_time).slice(0, 5)}` : ''}`
  ]
  if (ev.type) lines.push(`   ${emoji.bullet} ${ev.type}`)
  if (ev.description) lines.push(`   ${emoji.feather} ${shorten(ev.description)}`)
  return lines.join('\n')
}

/**
 * "/evento confirmados [n]" (admins): quem confirmou, quem não vai, quem
 * está em análise e quem ainda não respondeu no evento n (padrão: o próximo).
 */
async function confirmados (list, n) {
  const ev = list[n - 1]
  if (!ev) return `${emoji.cross} Não tem evento ${n}. Use */evento* para ver a lista.`

  const [members, rows, cancels] = await Promise.all([
    supabase.select('profiles?select=id,name&status=eq.ativo&order=name.asc'),
    supabase.select(`event_presencas?select=user_id,membro_id,event_id,status,response_status,justificativa_status&event_id=eq.${ev.id}`),
    supabase.select(`event_cancel_requests?select=user_id,event_id&status=eq.pendente&event_id=eq.${ev.id}`)
  ])
  const grupos = { '✅': [], '⏳': [], '❌': [], '❔': [] }
  for (const m of members) {
    const mine = rows.filter(r => (r.user_id || r.membro_id) === m.id)
    const status = statusOf(mine, cancels.filter(c => c.user_id === m.id), ev)
    ;(grupos[status.slice(0, 1)] || grupos['❔']).push(m.name)
  }

  const bloco = (icon, titulo, nomes) => nomes.length
    ? `${icon} *${titulo} (${nomes.length})*\n${nomes.map(x => `   ${emoji.bullet} ${x}`).join('\n')}`
    : `${icon} *${titulo} (0)*`
  return [
    `${header(ev.title)}`,
    `${formatDate(ev.event_date)}${ev.event_time ? ` às ${String(ev.event_time).slice(0, 5)}` : ''}${ev.mandatory ? ' · _obrigatório_' : ''}`,
    '',
    bloco('✅', 'Confirmados', grupos['✅']),
    '',
    bloco('⏳', 'Justificativa em análise', grupos['⏳']),
    '',
    bloco('❌', 'Não vão', grupos['❌']),
    '',
    bloco('❔', 'Ainda não responderam', grupos['❔']),
    '',
    `${emoji.feather} Quem falta pode marcar com */presença*`
  ].join('\n')
}

module.exports = {
  name: 'evento',
  aliases: ['eventos', 'event'],
  category: 'Geral',
  fetchMeta: true, // isAdmin para "/evento confirmados"
  cooldown: 5,
  desc: 'Próximos eventos do portal. Admins: evento confirmados [número].',
  async run ({ args, isAdmin, isOwner, reply }) {
    if (!supabase.enabled()) { await reply(error('O portal não está conectado ao bot.')); return }

    const list = await supabase.select(
      'events?select=id,title,description,event_date,event_time,type,mandatory' +
      `&status=eq.ativo&is_private=eq.false&event_date=gte.${today()}` +
      `&order=event_date.asc,event_time.asc&limit=${MAX}`
    )

    if (/^(confirmados|presen[cç]as?|lista)$/i.test(args[0] || '')) {
      if (!isAdmin && !isOwner) { await reply(`${emoji.lock} Só os administradores do grupo podem ver a lista de presença.`); return }
      if (!list.length) { await reply(loading('Nenhum evento agendado no portal.')); return }
      await reply(await confirmados(list, parseInt(args[1], 10) || 1))
      return
    }

    if (!list.length) {
      await reply(`${loading('Nenhum evento agendado no portal.')}\n\n${emoji.feather} ${PORTAL}`)
      return
    }

    await reply(
      `${header('Próximos eventos')}\n\n${list.map(formatEvento).join('\n\n')}\n\n` +
      `${emoji.feather} Marque sua presença: */presença* ou ${PORTAL}`
    )
  }
}
