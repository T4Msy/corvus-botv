'use strict'

const { getBuffer } = require('./fetch')

/**
 * Combina dois emojis com o Google Emoji Kitchen, direto do gstatic.
 * (O emojik.vercel.app passou a responder a imagem "Not Found" para tudo.)
 *
 * As figurinhas ficam em .../emojikitchen/<data>/<emoji1>/<emoji1>_<emoji2>.png,
 * e a data é a da leva em que o par saiu — então testa as datas conhecidas,
 * nas duas ordens. Nem todo par existe: lança erro quando não acha.
 */

const BASE = 'https://www.gstatic.com/android/keyboard/emojikitchen'
const DATES = [
  '20201001', '20210218', '20210521', '20210831', '20211115', '20220110', '20220203',
  '20220406', '20220506', '20220815', '20220823', '20221101', '20221107', '20230126',
  '20230127', '20230216', '20230221', '20230301', '20230405', '20230418', '20230426',
  '20230613', '20230803', '20230818', '20230821', '20231113', '20231128', '20240206',
  '20240214', '20240530', '20240610', '20240715', '20241021', '20241023', '20250130',
  '20250209', '20250430'
]

const found = new Map() // "a_b" → url (null = não existe)

const code = e => [...e].map(c => `u${c.codePointAt(0).toString(16)}`).join('-')

/** Grafias do mesmo emoji: como veio, sem e com o seletor de variação (FE0F). */
function spellings (e) {
  const bare = e.replace(/️/g, '')
  return [...new Set([e, bare, [...bare].length === 1 ? `${bare}️` : bare])]
}

async function exists (url) {
  try {
    const res = await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(10000) })
    return res.ok
  } catch {
    return false
  }
}

async function findUrl (a, b) {
  const pairs = []
  for (const x of spellings(a)) {
    for (const y of spellings(b)) pairs.push([x, y], [y, x])
  }
  // Primeiro as grafias como vieram; as variantes só se não achar.
  for (const batch of [pairs.slice(0, 2), pairs.slice(2)]) {
    const urls = batch.flatMap(([x, y]) => DATES.map(d => `${BASE}/${d}/${code(x)}/${code(x)}_${code(y)}.png`))
    const hits = await Promise.all(urls.map(async url => (await exists(url)) ? url : null))
    const url = hits.filter(Boolean).pop() // a leva mais recente
    if (url) return url
  }
  return null
}

async function mix (emoji1, emoji2) {
  const key = `${emoji1}_${emoji2}`
  if (!found.has(key)) found.set(key, await findUrl(emoji1, emoji2))
  const url = found.get(key)
  if (!url) throw new Error('Combinação não existe no Emoji Kitchen.')
  return getBuffer(url)
}

/** Separa emojis colados ("😭❤️" → ["😭", "❤️"]). */
function splitEmojis (text) {
  const seg = new Intl.Segmenter('pt', { granularity: 'grapheme' })
  return [...seg.segment(text)].map(s => s.segment).filter(s => /\p{Extended_Pictographic}/u.test(s))
}

module.exports = { mix, splitEmojis }
