'use strict'

const { emoji } = require('../ui/theme')

module.exports = {
  name: 'enquete',
  aliases: ['poll', 'votacao'],
  category: 'Jogos',
  groupOnly: true,
  desc: 'Cria uma enquete: !enquete Pergunta | opção1 | opção2 | ...',
  async run ({ sock, from, text, reply, config }) {
    const parts = text.split('|').map((p) => p.trim()).filter(Boolean)
    if (parts.length < 3) {
      await reply(`${emoji.feather} Use *${config.prefix}enquete Pergunta | opção1 | opção2 | ...* (mín. 2 opções).`)
      return
    }
    const [pergunta, ...opcoes] = parts
    await sock.sendMessage(from, {
      poll: {
        name: pergunta,
        values: opcoes.slice(0, 12),
        selectableCount: 1
      }
    })
  }
}
