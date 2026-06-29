'use strict'

const { store } = require('../lib/store')
const { emoji } = require('../ui/theme')
const perguntas = require('../data/quiz.json')

const games = store('quiz')

function normalize (s) {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim()
}

module.exports = {
  name: 'quiz',
  aliases: ['trivia'],
  category: 'Jogos',
  groupOnly: true,
  desc: 'Trivia: !quiz para uma pergunta, !quiz <resposta> para responder.',
  async run ({ from, args, reply, config }) {
    const game = games.get(from, null)
    const answer = args.join(' ').trim()

    if (answer) {
      if (!game) { await reply('Inicie com *!quiz*.'); return }
      if (normalize(answer) === normalize(game.resposta)) {
        await games.delete(from)
        await reply(`${emoji.crown} Acertou! A resposta era *${game.resposta}*.`)
      } else {
        await reply(`${emoji.cross} Resposta errada. Tente de novo!`)
      }
      return
    }

    if (game) {
      await reply(`${emoji.crystal} Pergunta: *${game.pergunta}*`)
      return
    }

    const item = perguntas[Math.floor(Math.random() * perguntas.length)]
    await games.set(from, item)
    await reply(
      `${emoji.raven} *Quiz*\n${item.pergunta}\n\nResponda com *${config.prefix}quiz <resposta>*.`
    )
  }
}
