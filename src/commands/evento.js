'use strict'

const { store } = require('../lib/store')
const { emoji } = require('../ui/theme')

const eventos = store('eventos')

function parseDate (str) {
  const [d, m, y] = (str || '').split('/')
  if (!d || !m || !y) return null
  const date = new Date(Number(y), Number(m) - 1, Number(d))
  return isNaN(date.getTime()) ? null : date
}

function formatEvento (ev, idx) {
  return `${emoji.dagger} *${idx + 1}. ${ev.titulo}*\n` +
    `   ${emoji.bullet} ${ev.data} às ${ev.hora}\n` +
    `   ${emoji.feather} ${ev.desc}`
}

module.exports = {
  name: 'evento',
  aliases: ['eventos', 'event'],
  category: 'Geral',
  groupOnly: true,
  fetchMeta: true,
  desc: 'Agenda de eventos. Admins: !evento add / !evento del <n>.',
  async run ({ args, from, sender, isAdmin, isOwner, reply, config }) {
    const sub = args[0]?.toLowerCase()

    if (sub === 'add') {
      if (!isAdmin && !isOwner) { await reply(`${emoji.lock} Apenas administradores.`); return }
      const parts = args.slice(1).join(' ').split('|').map(s => s.trim())
      if (parts.length < 4) {
        await reply(`${emoji.feather} Use: *${config.prefix}evento add <título> | <desc> | <dd/mm/aaaa> | <hh:mm>*`)
        return
      }
      const [titulo, desc, dataStr, hora] = parts
      const date = parseDate(dataStr)
      if (!date) { await reply(`${emoji.cross} Data inválida. Use dd/mm/aaaa.`); return }

      eventos.update(from, (list) => [...(list || []), {
        titulo, desc, data: dataStr, hora, timestamp: date.getTime()
      }], [])
      await reply(`${emoji.check} Evento *${titulo}* adicionado para ${dataStr} às ${hora}.`)
      return
    }

    if (sub === 'del') {
      if (!isAdmin && !isOwner) { await reply(`${emoji.lock} Apenas administradores.`); return }
      const idx = parseInt(args[1]) - 1
      const list = eventos.get(from, [])
      if (isNaN(idx) || idx < 0 || idx >= list.length) {
        await reply(`${emoji.cross} Número inválido. Use *${config.prefix}evento* para ver a lista.`)
        return
      }
      const removed = list.splice(idx, 1)[0]
      eventos.set(from, list)
      await reply(`${emoji.check} Evento *${removed.titulo}* removido.`)
      return
    }

    // Listar eventos futuros (inclusive hoje).
    const hoje = Date.now() - 86400000
    const list = (eventos.get(from, []))
      .filter(e => e.timestamp >= hoje)
      .sort((a, b) => a.timestamp - b.timestamp)

    if (!list.length) {
      await reply(
        `${emoji.moon} Nenhum evento agendado.\n\n` +
        `_Admins: *${config.prefix}evento add <título> | <desc> | <dd/mm/aaaa> | <hh:mm>*_`
      )
      return
    }

    await reply(`${emoji.raven} *Próximos eventos*\n\n` + list.map(formatEvento).join('\n\n'))
  }
}
