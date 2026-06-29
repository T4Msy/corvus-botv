'use strict'

const { emoji } = require('../ui/theme')

const EMOJI = { pedra: '🪨', papel: '📄', tesoura: '✂️' }
const BEATS = { pedra: 'tesoura', papel: 'pedra', tesoura: 'papel' }
const OPCOES = Object.keys(BEATS)

module.exports = {
  name: 'ppt',
  aliases: ['jokenpo', 'pedrapapeltesoura'],
  category: 'Jogos',
  desc: 'Pedra, papel ou tesoura contra o bot: !ppt pedra|papel|tesoura.',
  async run ({ args, reply, config }) {
    const escolha = (args[0] || '').toLowerCase()
    if (!OPCOES.includes(escolha)) {
      await reply(`${emoji.feather} Use *${config.prefix}ppt pedra*, *papel* ou *tesoura*.`)
      return
    }
    const bot = OPCOES[Math.floor(Math.random() * OPCOES.length)]
    let resultado
    if (escolha === bot) resultado = 'Empate!'
    else if (BEATS[escolha] === bot) resultado = `${emoji.crown} Você ganhou!`
    else resultado = `${emoji.skull} Você perdeu!`

    await reply(
      `Você: ${EMOJI[escolha]}  ${escolha}\n` +
      `Corvus: ${EMOJI[bot]}  ${bot}\n\n${resultado}`
    )
  }
}
