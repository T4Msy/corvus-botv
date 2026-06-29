'use strict'

const { store } = require('../lib/store')
const { emoji } = require('../ui/theme')
const palavras = require('../data/anagrama.json')

const games = store('anagrama')

module.exports = {
  name: 'anagrama',
  category: 'Jogos',
  groupOnly: true,
  desc: 'Desembaralhe a palavra: !anagrama para iniciar, !anagrama <palpite> para responder.',
  async run ({ from, args, reply, config }) {
    const game = games.get(from, null)
    const guess = args.join(' ').trim().toUpperCase()

    if (guess) {
      if (!game) { await reply('Inicie com *!anagrama*.'); return }
      if (guess === game.palavra) {
        await games.delete(from)
        await reply(`${emoji.crown} Acertou! Era *${game.palavra}*.`)
      } else {
        await reply(`${emoji.cross} Não é. Tente de novo!`)
      }
      return
    }

    if (game) {
      await reply(`${emoji.crystal} Palavra: *${game.embaralhada}*\nDica: ${game.dica}`)
      return
    }

    const item = palavras[Math.floor(Math.random() * palavras.length)]
    await games.set(from, item)
    await reply(
      `${emoji.raven} *Anagrama*\nDesembaralhe: *${item.embaralhada}*\nDica: ${item.dica}\n\n` +
      `Responda com *${config.prefix}anagrama <palavra>*.`
    )
  }
}
