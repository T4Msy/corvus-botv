'use strict'

const { jidNormalizedUser } = require('@whiskeysockets/baileys')
const { botJids, getTargets } = require('../lib/group')
const { pick, roll, bar, phrase } = require('../lib/meter')
const { emoji, header } = require('../ui/theme')

const FRASES = [
  [0, ['Melhor ficar só na amizade… ou nem isso. 💔', 'Nem com reza forte. 🙏']],
  [30, ['Tem chance, mas vai precisar de muito esforço. 😬', 'Um olhar no corredor, quem sabe… 👀']],
  [55, ['Dá liga! Um date não faria mal. 😏', 'Já tem gente shippando nos bastidores. 🍿']],
  [75, ['Esse casal tem futuro! 💞', 'Já dá pra escolher o nome do filho. 👶']],
  [90, ['Almas gêmeas. Já pode marcar o casamento! 💍', 'Casal do ano, ninguém segura. 🔥']]
]

module.exports = {
  name: 'casal',
  aliases: ['ship', 'shipar', 'namoro'],
  category: 'Jogos',
  groupOnly: true,
  fetchMeta: true,
  cooldown: 10,
  desc: 'Sorteia um casal do grupo (ou: casal @a @b).',
  async run ({ sock, from, msg, groupMetadata, reply }) {
    const bot = new Set(botJids(sock))
    const members = (groupMetadata?.participants || [])
      .filter(p => ![p.id, p.lid, p.jid, p.phoneNumber].filter(Boolean).some(id => bot.has(jidNormalizedUser(id))))
      .map(p => p.id)

    // Marcou duas pessoas: shipa elas. Uma: shipa com alguém sorteado.
    const chosen = getTargets(msg).slice(0, 2)
    while (chosen.length < 2) {
      const others = members.filter(id => !chosen.includes(id))
      if (!others.length) break
      chosen.push(pick(others))
    }
    if (chosen.length < 2) { await reply(`${emoji.cross} Preciso de pelo menos duas pessoas no grupo.`); return }

    const [a, b] = chosen
    const nota = roll()

    await sock.sendMessage(from, {
      text: `${header('Casal do momento')}\n\n` +
        `💘 @${a.split('@')[0]} + @${b.split('@')[0]}\n\n` +
        `${bar(nota, '❤️', '🤍')}\n\n${phrase(nota, FRASES)}`,
      mentions: [a, b]
    }, { quoted: msg })
  }
}
