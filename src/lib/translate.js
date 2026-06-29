'use strict'

const { fetchJson } = require('./fetch')

/**
 * Traduz texto usando o endpoint público gtx do Google Translate
 * (sem chave). Detecta o idioma de origem automaticamente.
 */
async function translate (text, to = 'pt') {
  const url =
    'https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto' +
    `&tl=${encodeURIComponent(to)}&dt=t&q=${encodeURIComponent(text)}`
  const data = await fetchJson(url)
  return (data[0] || []).map((seg) => seg[0]).join('')
}

module.exports = { translate }
