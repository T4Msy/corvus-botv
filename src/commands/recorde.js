'use strict'

const db = require('../lib/supabase')
const { emoji, header, error } = require('../ui/theme')

// Trono dos Recordes do portal (msy_recordes_top3): os recordes históricos
// de mensagens num dia, numa semana e num mês.
// [tipo, ícone, título, explicação]. O 1º lugar de cada um ganha a insígnia
// do mesmo nome no portal (lib/insignias.js → RECORDE_META).
const TIPOS = [
  ['diario', '🔱', 'Marca Perpétua — recorde em um dia',
    'Quem mais mandou mensagens no grupo da Masayoshi em um único dia.'],
  ['semanal', '⚡', 'Soberania Semanal — recorde em uma semana',
    'Quem mais mandou mensagens somando uma semana inteira.'],
  ['mensal', '🩸', 'Domínio Mensal — recorde em um mês',
    'Quem mais mandou mensagens somando um mês inteiro.']
]
const MEDALHAS = ['🥇', '🥈', '🥉']

/** "2026-01-26" → "26/01/2026"; períodos já escritos ("01/03 a 28/03") ficam como estão. */
function periodo (p) {
  const m = String(p || '').match(/^(\d{4})-(\d{2})-(\d{2})$/)
  return m ? `${m[3]}/${m[2]}/${m[1]}` : String(p || '')
}

module.exports = {
  name: 'recorde',
  membersOnly: true,
  aliases: ['recordes', 'trono'],
  category: 'Geral',
  cooldown: 10,
  desc: 'Recordes históricos de mensagens da Masayoshi (Trono dos Recordes).',
  async run ({ reply }) {
    if (!db.enabled()) { await reply(error('O portal não está conectado ao bot.')); return }
    const rows = await db.select('msy_recordes_top3?select=tipo,posicao,nome,mensagens,periodo&order=posicao.asc')
    if (!rows.length) { await reply(`${emoji.moon} Ainda não há recordes registrados.`); return }

    const blocos = TIPOS.map(([tipo, icon, titulo, explica]) => {
      const top = rows.filter(r => r.tipo === tipo)
      if (!top.length) return null
      const linhas = top.map(r =>
        `${MEDALHAS[r.posicao - 1] || `${r.posicao}.`} *${r.nome}* — ${Number(r.mensagens).toLocaleString('pt-BR')} msgs\n     _${periodo(r.periodo)}_`)
      return `${icon} *${titulo}*\n_${explica}_\n${linhas.join('\n')}`
    }).filter(Boolean)

    await reply(
      `${header('Trono dos Recordes')}\n\n` +
      'Os maiores recordes de mensagens da história da Masayoshi. ' +
      'O 1º lugar de cada recorde leva a insígnia com o nome dele. 👑\n\n' +
      `${blocos.join('\n\n')}\n\n${emoji.feather} portalmsy.site/ranking.html`
    )
  }
}
