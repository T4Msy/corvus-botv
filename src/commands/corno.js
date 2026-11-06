'use strict'

const { getTargets } = require('../lib/group')
const { roll, bar, phrase } = require('../lib/meter')
const { header } = require('../ui/theme')

const FRASES = [
  [0, ['Fiel e amado. Pode dormir tranquilo. 😇', 'Zero chifre. Raridade. 💎']],
  [20, ['Tem um "amigo" que curte todas as fotos… 👀', 'Já viu uma mensagem apagada e fingiu que não. 🤐']],
  [40, ['O "melhor amigo" tá sempre por perto demais. 🫣', 'Já ouviu "é só um colega de trabalho". 💼']],
  [60, ['Os chifres já tão batendo no batente da porta. 🚪', 'Todo mundo sabe, menos você. 🤫']],
  [80, ['Precisa de licença pra passar no túnel. 🚧', 'Coleciona chifre igual figurinha da Copa. 📒']],
  [100, ['100%! O próprio boi da Masayoshi. 🐂👑']]
]

// Para quem é de fora, o 100% não cita a Masayoshi.
const FRASES_FORA = [...FRASES.slice(0, -1), [100, ['100%! O próprio boi do pasto. 🐂👑']]]

module.exports = {
  name: 'corno',
  aliases: ['cornometro', 'chifre'],
  category: 'Jogos',
  groupOnly: true,
  cooldown: 10,
  desc: 'Medidor de corno (brincadeira): corno, corno @fulano ou respondendo alguém.',
  async run ({ sock, from, msg, sender, isMember }) {
    const target = getTargets(msg)[0] || sender
    const nota = roll()

    await sock.sendMessage(from, {
      text: `${header('Cornômetro')}\n\n` +
        `🐂 Quanto @${target.split('@')[0]} é corno:\n\n` +
        `${bar(nota, '🦌')}\n\n${phrase(nota, isMember ? FRASES : FRASES_FORA)}`,
      mentions: [target]
    }, { quoted: msg })
  }
}
