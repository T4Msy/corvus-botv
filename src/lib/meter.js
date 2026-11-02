'use strict'

/**
 * Medidores das brincadeiras (/casal, /gay…): nota aleatória de 0 a 100,
 * barra em 10 blocos e a frase da faixa em que a nota caiu.
 */

const pick = list => list[Math.floor(Math.random() * list.length)]

/** Nota de 0 a 100. */
function roll () {
  return Math.floor(Math.random() * 101)
}

/**
 * Barra de 10 blocos. `full` pode ser um emoji só ou uma lista (cada
 * bloco cheio usa o próximo da lista, ex.: as cores do arco-íris).
 */
function bar (pct, full, empty = '▫️') {
  const filled = Math.round(pct / 10)
  const cells = Array.from({ length: 10 }, (_, i) => {
    if (i >= filled) return empty
    return Array.isArray(full) ? full[i % full.length] : full
  })
  return `${cells.join('')} *${pct}%*`
}

/** Frase da faixa: `ranges` = [[min, [frases…]], …] em ordem crescente. */
function phrase (pct, ranges) {
  return pick(ranges.filter(([min]) => pct >= min).pop()[1])
}

module.exports = { pick, roll, bar, phrase }
