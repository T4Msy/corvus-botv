'use strict'

/**
 * Barra justificativas de falta "pouco trabalhadas" na /presença:
 * "não vou ir", "não posso", "preguiça", "porque sim", "kkkk", "asdasd"…
 * Regra: depois de tirar as palavras de enchimento ("não", "vou", "ir",
 * "posso", "evento"…), tem que sobrar um motivo de verdade.
 */

const MIN_CHARS = 8

// Palavras que não explicam nada sozinhas.
const VAZIAS = new Set((
  'nao n nem vou vo ir indo posso poder pode consigo conseguir consegui da dar deu ' +
  'eu me mim meu minha a o os as um uma de do da dos das no na nos nas em pra pro para por ' +
  'que q porque pq e ja hoje amanha dia la lá aqui ai ali mesmo tambem tb so só mais muito ' +
  'evento eventos reuniao presenca participar comparecer estar estarei ficar fico vai ' +
  'infelizmente desculpa desculpe foi mal sorry galera pessoal gente ok blz beleza ' +
  'tenho tem tive vai ter estou to tô tou sim isso assim coisa coisas'
).split(/\s+/))

// Motivos que não são motivo.
const FRACOS = [
  /\bpregui[cç]a\b/, /\bsem\s*vontade\b/, /\bn[aã]o\s*(to|tô|estou)?\s*a?\s*fim\b/, /\bn[aã]o\s*quero\b/,
  /\bporque\s*sim\b/, /\bsei\s*l[aá]\b/, /\bsem\s*motivo\b/, /\bnada\b/, /\bpq\s*n[aã]o\b/,
  /\bn[aã]o\s*gosto\b/, /\bt[oô]\s*com\s*sono\b/, /\bdesanimad[oa]\b/
]

function normalize (text) {
  return String(text || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
}

/** Risada ou teclado batido: "kkkk", "hahaha", "asdasd", "aaaa". */
function lixo (word) {
  return /^(k+|(ha)+h?|(he)+h?|(rs)+|a+|e+)$/.test(word) || /(.)\1{3,}/.test(word) ||
    (word.length >= 5 && !/[aeiou]/.test(word)) || /^(asd|qwe|sdf|jkl)+/.test(word)
}

/**
 * { ok: true } ou { ok: false, dica } — `dica` explica o que melhorar.
 */
function validate (motivo) {
  const text = normalize(motivo).trim()
  const words = text.replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean)
  const uteis = words.filter(w => !VAZIAS.has(w) && !lixo(w) && w.length >= 3)

  if (text.replace(/[^a-z]/g, '').length < MIN_CHARS || !uteis.length) {
    return { ok: false, dica: 'Isso não explica o motivo. Diga o que vai te impedir de ir.' }
  }
  if (FRACOS.some(re => re.test(text)) && uteis.length < 4) {
    return { ok: false, dica: 'Isso não é um motivo que a Diretoria possa aceitar.' }
  }
  return { ok: true }
}

module.exports = { validate }
