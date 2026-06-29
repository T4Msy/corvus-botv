'use strict'

const { store } = require('../lib/store')
const { getTargets } = require('../lib/group')
const { emptyBoard, winner, isFull, render } = require('../lib/games/ttt')
const { emoji } = require('../ui/theme')

const games = store('ttt')

function tag (jid) {
  return `@${jid.split('@')[0]}`
}

module.exports = {
  name: 'velha',
  aliases: ['jogodavelha', 'ttt'],
  category: 'Jogos',
  groupOnly: true,
  desc: 'Jogo da velha: !velha @oponente para começar, !velha <1-9> para jogar.',
  async run ({ sock, from, sender, args, msg, reply, config }) {
    const game = games.get(from, null)
    const arg = args[0]

    // Jogada: !velha <1-9>
    if (/^[1-9]$/.test(arg || '')) {
      if (!game) { await reply('Não há jogo em andamento. Inicie com *!velha @oponente*.'); return }
      const mark = game.players.X === sender ? 'X' : game.players.O === sender ? 'O' : null
      if (!mark) { await reply('Você não está nesta partida.'); return }
      if (game.turn !== mark) { await reply('Não é sua vez.'); return }
      const pos = Number(arg) - 1
      if (game.board[pos]) { await reply('Casa ocupada, escolha outra.'); return }

      game.board[pos] = mark
      const win = winner(game.board)
      if (win) {
        await games.delete(from)
        await sock.sendMessage(from, {
          text: `${render(game.board)}\n\n${emoji.crown} ${tag(game.players[win])} venceu!`,
          mentions: [game.players[win]]
        })
        return
      }
      if (isFull(game.board)) {
        await games.delete(from)
        await sock.sendMessage(from, { text: `${render(game.board)}\n\n${emoji.feather} Deu velha! Empate.` })
        return
      }
      game.turn = mark === 'X' ? 'O' : 'X'
      await games.set(from, game)
      const next = game.players[game.turn]
      await sock.sendMessage(from, {
        text: `${render(game.board)}\n\nVez de ${tag(next)} (${game.turn === 'X' ? '❌' : '⭕'})`,
        mentions: [next]
      })
      return
    }

    // Início: !velha @oponente
    if (game) { await reply('Já existe uma partida em andamento neste grupo.'); return }
    const opponent = getTargets(msg)[0]
    if (!opponent) { await reply(`Marque o oponente: *${config.prefix}velha @fulano*.`); return }
    if (opponent === sender) { await reply('Você não pode jogar contra si mesmo.'); return }

    const newGame = { board: emptyBoard(), players: { X: sender, O: opponent }, turn: 'X' }
    await games.set(from, newGame)
    await sock.sendMessage(from, {
      text: `${emoji.raven} *Jogo da velha*\n${tag(sender)} (❌) vs ${tag(opponent)} (⭕)\n\n${render(newGame.board)}\n\nVez de ${tag(sender)}. Jogue com *${config.prefix}velha <1-9>*.`,
      mentions: [sender, opponent]
    })
  }
}
