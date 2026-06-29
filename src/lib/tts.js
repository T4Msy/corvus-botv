'use strict'

const googleTTS = require('google-tts-api')
const { getBuffer } = require('./fetch')

/**
 * Gera um áudio de voz a partir de texto usando o Google Translate TTS
 * (grátis, sem chave). Para textos longos, concatena os trechos.
 */
async function textToSpeech (text, lang = 'pt') {
  const urls = googleTTS.getAllAudioUrls(text, {
    lang,
    slow: false,
    host: 'https://translate.google.com'
  })

  const buffers = []
  for (const { url } of urls) {
    buffers.push(await getBuffer(url))
  }
  return Buffer.concat(buffers)
}

module.exports = { textToSpeech }
