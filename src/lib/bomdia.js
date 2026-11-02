'use strict'

const { store } = require('./store')
const periods = require('./periods')
const { pick } = require('./meter')

/**
 * Resposta automática ao "bom dia": uma vez por pessoa por dia em cada
 * grupo. O tom depende de como a pessoa pediu para ser chamada (/eusou);
 * sem escolha, vai a versão que serve para todo mundo.
 */

const genero = store('genero') // id do participante → 'ela' | 'ele'

// "bom dia", "bomdia", "bom diaaa", "bdia", "bundia"… no começo da mensagem.
const BOM_DIA_RE = /^\s*(bo[mn]\s*dia+|b\s*dia+|bu[mn]\s*dia+)\b/i

const ELA = {
  saudacoes: ['Bom dia, linda! ☀️', 'Bom diaaa, flor! 🌸', 'Bom dia, princesa! 👑', 'Bom dia, maravilhosa! ✨'],
  extras: [
    'Que seu dia seja tão lindo quanto você. 💖',
    'Já tomou seu café? ☕',
    'Dormiu bem? Sonhou com o quê? 💭',
    'Qual a música que vai embalar seu dia hoje? 🎶',
    'Hoje é dia de brilhar, hein! 🌟',
    'Vai fazer o quê de bom hoje? 🌷'
  ]
}

const ELE = {
  saudacoes: ['Bom dia, irmão! Suave? 🤜🤛', 'Bom dia, mano! Tranquilo? 😎', 'Bom dia, parceiro! Firmeza? 💪', 'Bom dia, chefe! Como é que tá? 🍷'],
  extras: [
    'Bora que hoje o dia é nosso. 🔥',
    'Já tomou o café pra ligar o sistema? ☕',
    'E aí, qual é a boa de hoje?',
    'Viu o jogo ontem? ⚽',
    'Hoje é dia de fazer acontecer. 🚀',
    'Dormiu ou só piscou? 😂'
  ]
}

const TODOS = {
  saudacoes: ['Bom dia! ☀️', 'Bom diaaa! 🌤️', 'Bom dia, bom dia! 🍷', 'Bom dia, luz do grupo! ✨'],
  extras: [
    'Já tomou café? ☕',
    'Dormiu bem? 😴',
    'Qual o plano pra hoje?',
    'Que hoje seja leve e cheio de coisa boa. 🌱',
    'Bora que o dia tá só começando! 🚀',
    'Qual música tá na sua cabeça hoje? 🎶'
  ]
}

const greeted = new Map() // "grupo|pessoa" → dia da última resposta

function isGoodMorning (text) {
  return BOM_DIA_RE.test(text || '')
}

/** true se ainda não respondeu essa pessoa hoje nesse grupo (e já marca). */
function firstToday (chat, sender) {
  const key = `${chat}|${sender}`
  const today = periods.dayKey()
  if (greeted.get(key) === today) return false
  if (greeted.size > 2000) greeted.clear()
  greeted.set(key, today)
  return true
}

function reply (ids) {
  const g = ids.map(id => genero.get(id)).find(Boolean)
  const set = g === 'ela' ? ELA : g === 'ele' ? ELE : TODOS
  return `${pick(set.saudacoes)} ${pick(set.extras)}`
}

/** Guarda como a pessoa quer ser chamada em todas as suas identidades. */
function setGenero (ids, value) {
  for (const id of ids) {
    if (value) genero.set(id, value)
    else genero.delete(id)
  }
}

module.exports = { isGoodMorning, firstToday, reply, setGenero }
