'use strict'

const { getBuffer } = require('./fetch')

/**
 * Combina dois emojis usando o Google Emoji Kitchen (via endpoint emojik).
 * Retorna um buffer PNG. Nem todo par existe — pode lançar erro.
 */
async function mix (emoji1, emoji2) {
  const url = `https://emojik.vercel.app/s/${encodeURIComponent(emoji1)}_${encodeURIComponent(emoji2)}?size=512`
  return getBuffer(url)
}

module.exports = { mix }
