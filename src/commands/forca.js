'use strict'

const { store } = require('../lib/store')
const { emoji } = require('../ui/theme')
const palavras = require('../data/anagrama.json')

const games = store('forca')
const MAX = 6

function mascara (palavra, acertos) {
  return palavra
    .split('')
    .map((ch) => (ch === ' ' ? '  ' : acertos.includes(ch) ? `${ch} ` : '_ '))
    .join('')
    .trim()
}

function estado (game) {
  return (
    `${emoji.raven} *Forca*\n` +
    `Palavra: ${mascara(game.palavra, game.acertos)}\n` +
    `Dica: ${game.dica}\n` +
    `Erros: ${game.erros}/${MAX}` +
    (game.erradas.length ? `\nLetras erradas: ${game.erradas.join(', ')}` : '')
  )
}

module.exports = {
  name: 'forca',
  category: 'Jogos',
  groupOnly: true,
  desc: 'Jogo da forca: !forca para iniciar, !forca <letra|palavra> para jogar.',
  async run ({ from, args, reply, config }) {
    const game = games.get(from, null)
    const palpite = args.join(' ').trim().toUpperCase()

    if (!game) {
      const item = palavras[Math.floor(Math.random() * palavras.length)]
      const novo = { palavra: item.palavra, dica: item.dica, acertos: [], erradas: [], erros: 0 }
      await games.set(from, novo)
      await reply(`${estado(novo)}\n\nChute com *${config.prefix}forca <letra>*.`)
      return
    }

    if (!palpite) { await reply(estado(game)); return }

    // Palpite de palavra inteira.
    if (palpite.length > 1) {
      if (palpite === game.palavra) {
        await games.delete(from)
        await reply(`${emoji.crown} Acertou! Era *${game.palavra}*.`)
      } else {
        game.erros++
        await finalizaOuContinua(game, from, reply, `${emoji.cross} Não é "${palpite}".`)
      }
      return
    }

    // Palpite de letra.
    const letra = palpite
    if (game.acertos.includes(letra) || game.erradas.includes(letra)) {
      await reply('Essa letra já foi tentada.')
      return
    }
    if (game.palavra.includes(letra)) {
      game.acertos.push(letra)
      const ganhou = game.palavra.split('').every((ch) => ch === ' ' || game.acertos.includes(ch))
      if (ganhou) {
        await games.delete(from)
        await reply(`${emoji.crown} Acertou! Era *${game.palavra}*.`)
        return
      }
      await games.set(from, game)
      await reply(estado(game))
    } else {
      game.erradas.push(letra)
      game.erros++
      await finalizaOuContinua(game, from, reply, '')
    }
  }
}

async function finalizaOuContinua (game, from, reply, prefixMsg) {
  if (game.erros >= MAX) {
    await games.delete(from)
    await reply(`${emoji.skull} Enforcou! A palavra era *${game.palavra}*.`)
    return
  }
  await games.set(from, game)
  await reply(`${prefixMsg ? prefixMsg + '\n' : ''}${estado(game)}`)
}
