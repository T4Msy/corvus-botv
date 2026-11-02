'use strict'

const { groupMembers, getTargets } = require('../lib/group')
const { pick } = require('../lib/meter')
const { emoji, header } = require('../ui/theme')

// {a} e {b} viram as duas pessoas sorteadas (marcadas).
const FOFOCAS = [
  'Dizem que {a} foi visto comendo o lanche de {b} escondido. 🍔',
  '{a} stalkeou o Instagram de {b} até 2017 e curtiu sem querer. 📱',
  'Fontes confirmam: {a} e {b} foram vistos juntos na padaria às 3 da manhã. 🥐',
  '{a} chorou ouvindo sofrência e mandou áudio de 7 minutos pro {b}. 🎧',
  '{a} disse que tava dormindo, mas tava online conversando com {b}. 🟢',
  '{a} pegou dinheiro emprestado com {b} em 2022 e até hoje nada. 💸',
  '{a} tem um print guardado de {b} e tá esperando a hora certa. 📸',
  '{a} e {b} brigaram por causa do último pedaço de pizza. 🍕',
  '{a} salvou o contato de {b} com um coraçãozinho. ❤️',
  'Alguém viu {a} saindo da casa de {b} com a mesma roupa de ontem… 👀',
  '{a} fingiu que não viu {b} no shopping e saiu correndo. 🏃',
  '{a} apaga a mensagem toda vez que {b} entra no grupo. 🗑️',
  '{a} ensaiou na frente do espelho o que ia falar pro {b}. 🪞',
  '{a} chamou {b} de "amor" sem querer e fingiu que foi o corretor. 😳',
  '{a} roubou a senha do Netflix de {b} e trocou o perfil. 📺',
  '{a} disse que não ia pro evento, mas foi só porque {b} ia. 🍷'
]

const FONTES = [
  'Fonte: confia.',
  'Fonte: um corvo me contou. 🐦‍⬛',
  'Fonte: ouvi no corredor.',
  'Fonte: o próprio print.',
  'Fonte: minha tia que viu.'
]

module.exports = {
  name: 'fofoca',
  aliases: ['fofocas', 'babado'],
  category: 'Jogos',
  groupOnly: true,
  fetchMeta: true,
  cooldown: 10,
  desc: 'Inventa uma fofoca com duas pessoas do grupo (ou: fofoca @fulano).',
  async run ({ sock, from, msg, groupMetadata, reply }) {
    const members = groupMembers(sock, groupMetadata)
    const chosen = getTargets(msg).slice(0, 2)
    while (chosen.length < 2) {
      const others = members.filter(id => !chosen.includes(id))
      if (!others.length) break
      chosen.push(pick(others))
    }
    if (chosen.length < 2) { await reply(`${emoji.cross} Preciso de pelo menos duas pessoas no grupo.`); return }

    // A ordem também é sorteada: quem marcou pode ser o "a" ou o "b".
    const [a, b] = Math.random() < 0.5 ? chosen : [chosen[1], chosen[0]]
    const tag = id => `@${id.split('@')[0]}`
    const fofoca = pick(FOFOCAS).replace('{a}', tag(a)).replace('{b}', tag(b))

    await sock.sendMessage(from, {
      text: `${header('Babado fresquinho')}\n\n👂 ${fofoca}\n\n_${pick(FONTES)}_`,
      mentions: [a, b]
    }, { quoted: msg })
  }
}
