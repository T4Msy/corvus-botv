'use strict'

const { jidNormalizedUser } = require('@whiskeysockets/baileys')
const { botJids, getTargets } = require('../lib/group')
const { emoji, header } = require('../ui/theme')

const FRASES = [
  [0, 'Melhor ficar só na amizade… ou nem isso. 💔'],
  [30, 'Tem chance, mas vai precisar de muito esforço. 😬'],
  [55, 'Dá liga! Um date não faria mal. 😏'],
  [75, 'Esse casal tem futuro! 💞'],
  [90, 'Almas gêmeas. Já pode marcar o casamento! 💍']
]

const pick = list => list[Math.floor(Math.random() * list.length)]

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
    const nota = Math.floor(Math.random() * 101)
    const frase = FRASES.filter(([min]) => nota >= min).pop()[1]
    const barra = '❤️'.repeat(Math.round(nota / 20)) + '🤍'.repeat(5 - Math.round(nota / 20))

    await sock.sendMessage(from, {
      text: `${header('Casal do momento')}\n\n` +
        `💘 @${a.split('@')[0]} + @${b.split('@')[0]}\n\n` +
        `${barra}  *${nota}%*\n${frase}`,
      mentions: [a, b]
    }, { quoted: msg })
  }
}
