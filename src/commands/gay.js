'use strict'

const { getTargets } = require('../lib/group')
const { roll, bar, phrase } = require('../lib/meter')
const { header } = require('../ui/theme')

const ARCO_IRIS = ['🟥', '🟧', '🟨', '🟩', '🟦', '🟪']

const FRASES = [
  [0, ['Hétero top de academia, só bebe whey. 🏋️', 'Nem um pingo de glitter. Que tédio. 😐']],
  [20, ['Já cantou Lady Gaga no chuveiro e negou depois. 🚿', 'Tem um pézinho no vale, mas finge que não. 👀']],
  [40, ['Meio a meio: bi-curioso oficial. 🤔', 'Sabe todas as coreografias, mas jura que é "só pela música". 💃']],
  [60, ['O glitter já tá escapando pelo bolso. ✨', 'Já tem playlist só de diva pop. 🎤']],
  [80, ['Desfila na parada todo ano. 🏳️‍🌈', 'Nasceu com purpurina no sangue. 💅']],
  [100, ['100%! Ícone. Lenda. Rainha. 👑🏳️‍🌈']]
]

module.exports = {
  name: 'gay',
  aliases: ['gaymetro', 'medidorgay'],
  category: 'Jogos',
  groupOnly: true,
  cooldown: 10,
  desc: 'Medidor gay (brincadeira): gay, gay @fulano ou respondendo alguém.',
  async run ({ sock, from, msg, sender }) {
    const target = getTargets(msg)[0] || sender
    const nota = roll()

    await sock.sendMessage(from, {
      text: `${header('Medidor gay')}\n\n` +
        `🏳️‍🌈 Quanto @${target.split('@')[0]} é gay:\n\n` +
        `${bar(nota, ARCO_IRIS)}\n\n${phrase(nota, FRASES)}`,
      mentions: [target]
    }, { quoted: msg })
  }
}
