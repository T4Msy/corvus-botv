'use strict'

const db = require('../lib/supabase')
const { profileOf } = require('../lib/portal')
const { SIM, NAO, JUSTIFICAR, upcoming, quando, statusOf, myRows, responder } = require('../lib/presenca')
const { emoji, header, error } = require('../ui/theme')

// Regras e gravação ficam em lib/presenca.js (usadas também pela resposta à
// cobrança no privado). Aqui: listar eventos e escolher pelo número.

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

    await reply(await responder({
      profile, ev, atual: statusOf(rows, cancels, ev), resposta, motivo,
      como: `${p}${events.length > 1 ? ` ${idx + 1}` : ''}`
    }))
  }
}

