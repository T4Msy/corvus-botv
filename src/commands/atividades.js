'use strict'

const db = require('../lib/supabase')
const { profileOf } = require('../lib/portal')
const { emoji, header, error } = require('../ui/theme')

// Atividades do portal ainda abertas para a pessoa: responsável ou
// colaboradora, sem entrega dela. Entregar continua sendo pelo portal.
const ABERTAS = ['Pendente', 'Em andamento']
const LINK = 'portalmsy.site/atividades.html'

/** Prazo efetivo (estendido, se houver) como Date de Brasília. */
function prazoOf (a) {
  const date = a.extended_deadline || a.deadline
  if (!date) return null
  const time = (a.extended_deadline ? a.extended_deadline_time : a.deadline_time) || '23:59'
  return new Date(`${date}T${String(time).slice(0, 5).padStart(5, '0')}:00-03:00`)
}

function quando (d, now = Date.now()) {
  const br = x => new Date(x - 3 * 3600e3)
  const a = br(d.getTime())
  const hoje = br(now).toISOString().slice(0, 10)
  const amanha = br(now + 86400e3).toISOString().slice(0, 10)
  const dia = a.toISOString().slice(0, 10)
  const hh = a.toISOString().slice(11, 16)
  if (d.getTime() < now) return `⚠️ *atrasada* (era ${dia.slice(8, 10)}/${dia.slice(5, 7)} às ${hh})`
  if (dia === hoje) return `⏰ *vence hoje às ${hh}*`
  if (dia === amanha) return `vence amanhã às ${hh}`
  return `vence ${dia.slice(8, 10)}/${dia.slice(5, 7)} às ${hh}`
}

module.exports = {
  name: 'atividades',
  membersOnly: true,
  aliases: ['atividade', 'tarefas', 'pendencias'],
  category: 'Geral',
  fetchMeta: true,
  cooldown: 10,
  desc: 'Suas atividades pendentes no Portal MSY e os prazos.',
  async run ({ msg, sender, groupMetadata, reply }) {
    if (!db.enabled()) { await reply(error('O portal não está conectado ao bot.')); return }
    const { profile } = await profileOf({ msg, sender, groupMetadata, select: 'id,name' })
    if (!profile) { await reply(error('Seu WhatsApp não está cadastrado no Portal MSY. Cadastre em *Meu Perfil* no portal.')); return }

    const collabs = await db.select(`activity_collaborators?select=activity_id&user_id=eq.${profile.id}`)
    const ids = collabs.map(c => c.activity_id)
    const or = ids.length ? `or=(assigned_to.eq.${profile.id},id.in.(${ids.join(',')}))` : `assigned_to=eq.${profile.id}`
    const acts = await db.select(
      `activities?select=id,title,status,deadline,deadline_time,extended_deadline,extended_deadline_time,opens_at&${or}` +
      `&status=in.(${ABERTAS.map(encodeURIComponent).join(',')})`
    )
    const entregues = acts.length
      ? new Set((await db.select(`activity_responses?select=activity_id&user_id=eq.${profile.id}&activity_id=in.(${acts.map(a => a.id).join(',')})`)).map(r => r.activity_id))
      : new Set()
    const now = Date.now()
    const pendentes = acts
      .filter(a => !entregues.has(a.id))
      .map(a => ({ ...a, prazo: prazoOf(a) }))
      .sort((a, b) => (a.prazo?.getTime() ?? Infinity) - (b.prazo?.getTime() ?? Infinity))

    if (!pendentes.length) {
      await reply(`${emoji.check} *${profile.name}*, você não tem atividades pendentes. Tudo em dia! 🍷`)
      return
    }

    const linhas = pendentes.map((a, i) => {
      const abre = a.opens_at && new Date(a.opens_at).getTime() > now ? ` _(abre ${new Date(new Date(a.opens_at).getTime() - 3 * 3600e3).toISOString().slice(0, 16).replace(/(\d{4})-(\d{2})-(\d{2})T/, '$3/$2 ')})_` : ''
      return `*${i + 1}.* ${a.title}${abre}\n   ${emoji.bullet} ${a.prazo ? quando(a.prazo, now) : 'sem prazo'}`
    })
    await reply(
      `${header(`Atividades de ${profile.name}`)}\n\n${linhas.join('\n\n')}\n\n` +
      `${emoji.feather} Entregue pelo portal: ${LINK}`
    )
  }
}
