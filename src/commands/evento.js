'use strict'

const supabase = require('../lib/supabase')
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

module.exports = {
  name: 'evento',
  aliases: ['eventos', 'event'],
  category: 'Geral',
  cooldown: 5,
  desc: 'Próximos eventos da Masayoshi (direto do portal).',
  async run ({ reply }) {
    if (!supabase.enabled()) { await reply(error('O portal não está conectado ao bot.')); return }

    const list = await supabase.select(
      'events?select=title,description,event_date,event_time,type,mandatory' +
      `&status=eq.ativo&is_private=eq.false&event_date=gte.${today()}` +
      `&order=event_date.asc,event_time.asc&limit=${MAX}`
    )

    if (!list.length) {
      await reply(`${loading('Nenhum evento agendado no portal.')}\n\n${emoji.feather} ${PORTAL}`)
      return
    }

    await reply(
      `${header('Próximos eventos')}\n\n${list.map(formatEvento).join('\n\n')}\n\n` +
      `${emoji.feather} Marque sua presença: ${PORTAL}`
    )
  }
}
