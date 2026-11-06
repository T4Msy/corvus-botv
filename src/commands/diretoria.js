'use strict'

const supabase = require('../lib/supabase')
const { emoji, header, error } = require('../ui/theme')

// A Diretoria vem do Portal MSY: perfis ativos com tier "diretoria",
// do membro mais antigo para o mais novo.
module.exports = {
  name: 'diretoria',
  membersOnly: true,
  aliases: ['diret', 'board'],
  category: 'Geral',
  cooldown: 5,
  desc: 'Exibe a Diretoria atual da Masayoshi (direto do portal).',
  async run ({ reply }) {
    if (!supabase.enabled()) { await reply(error('O portal não está conectado ao bot.')); return }

    const diretoria = await supabase.select(
      'profiles?select=name,role&tier=eq.diretoria&status=eq.ativo&order=join_date.asc.nullslast'
    )
    if (!diretoria.length) { await reply(error('Nenhum membro da Diretoria no portal.')); return }

    const lines = diretoria.map(p => `${emoji.bullet} *${p.name}*${p.role ? ` — ${p.role}` : ''}`)
    await reply(`${header('Diretoria da Masayoshi')}\n\n${lines.join('\n')}`)
  }
}
