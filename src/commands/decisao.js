'use strict'

const { pick } = require('../lib/meter')
const { emoji, header } = require('../ui/theme')

// O corvo decide: sim, não ou depende — cada um com um comentário.
const RESPOSTAS = {
  '✅ *SIM*': [
    'Vai com tudo, sem medo.',
    'O corvo aprovou. Não discuta.',
    'Pode ir, o universo tá do seu lado.',
    'Sim. E já devia ter feito isso antes.'
  ],
  '❌ *NÃO*': [
    'Nem pensar. Confia no corvo.',
    'Não. Depois você me agradece.',
    'Essa é cilada, foge.',
    'Não. Bebe uma água e pensa de novo.'
  ],
  '🤔 *DEPENDE*': [
    'Depende… quem vai pagar?',
    'Depende do signo da pessoa.',
    'Depende. Pergunta pro Tales.',
    'Depende de quanto você quer arrependimento amanhã.'
  ]
}

module.exports = {
  name: 'decisao',
  aliases: ['decisão', 'decidir', 'decide'],
  category: 'Jogos',
  cooldown: 5,
  desc: 'O corvo decide por você: decisao <pergunta>.',
  async run ({ text, reply, config, isMember }) {
    if (!text) {
      await reply(`${emoji.feather} Use *${config.prefix}decisao <pergunta>*\nEx.: ${config.prefix}decisao devo mandar mensagem pro ex?`)
      return
    }
    const resposta = pick(Object.keys(RESPOSTAS))
    // A piada do Tales só faz sentido para quem é da Masayoshi.
    const comentarios = RESPOSTAS[resposta].filter(c => isMember || !c.includes('Tales'))
    await reply(
      `${header('O corvo decidiu')}\n\n` +
      `${emoji.raven} _${text}_\n\n${resposta}\n${pick(comentarios)}`
    )
  }
}
