'use strict'

const { emoji } = require('../ui/theme')

const FRASES = [
  'Aqueles que caminham na escuridão enxergam mais estrelas.',
  'A força não nasce da luz — nasce de quem sobreviveu à sombra.',
  'Não existe lealdade sem sacrifício. Não existe ordem sem propósito.',
  'O corvo não anuncia tempestades. Ele chega com elas.',
  'Ser fiel à própria natureza é a única forma de transcendência.',
  'O silêncio dos fortes é mais poderoso que o grito dos fracos.',
  'A Masayoshi não promete conforto. Promete crescimento.',
  'Quem não tem visão própria, executa a visão de outrem.',
  'O poder não corrompeu os grandes — revelou quem eles já eram.',
  'Cada decisão que você adia é uma decisão que o mundo toma por você.',
  'Não tema o vazio — é lá que se forja o essencial.',
  'A ordem não é a ausência do caos, mas a sua domesticação.',
  'Quem domina seus instintos, domina o campo.',
  'A escuridão não é inimiga — é onde aprendemos a enxergar.',
  'Lealdade sem entendimento é obediência. Compreensão sem lealdade é egoísmo.',
  'Cada cicatriz é um capítulo que o corpo escreveu sozinho.',
  'O espírito não se forja em dias fáceis.',
  'Caminhe com propósito ou fique parado — movimento sem direção é ruído.',
  'A Masayoshi não busca membros. Ela revela quem já estava pronto.',
  'Não existe chegada para quem nunca saiu do lugar.',
  'A coragem não é ausência de medo — é agir apesar dele.',
  'O corvo voa sozinho mas pousa entre os seus.',
  'Quem define seus próprios limites os escolheu.',
  'A noite revela quem brilha por si, não por empréstimo de outro.',
  'Toda transformação começa com uma ruptura.',
  'Não se torna lenda quem apenas sobrevive — é preciso construir.',
  'A Masayoshi existe onde existe intenção.',
  'O peso do passado pertence ao passado. O agora exige presença.',
  'Dois homens olham para o mesmo abismo. Um recua. O outro desce.',
  'A grandeza é conquistada em silêncio e anunciada pelos resultados.'
]

module.exports = {
  name: 'corvusfrase',
  aliases: ['frase', 'msyfrase'],
  category: 'Geral',
  cooldown: 5,
  desc: 'Frase motivacional da Masayoshi.',
  async run ({ reply }) {
    const frase = FRASES[Math.floor(Math.random() * FRASES.length)]
    await reply(`${emoji.wine} _${frase}_`)
  }
}
