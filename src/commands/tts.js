'use strict'

const { textToSpeech } = require('../lib/tts')
const { toOpus } = require('../lib/audio')
const { extractText } = require('../handler')
const { emoji } = require('../ui/theme')

module.exports = {
  name: 'tts',
  aliases: ['voz', 'falar'],
  category: 'Áudio',
  cooldown: 3,
  desc: 'Converte texto em voz: !tts <texto>.',
  async run ({ sock, from, args, msg, reply, config }) {
    // Texto do comando ou da mensagem citada.
    const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage
    const text = args.join(' ') || (quoted ? extractText(quoted) : '')
    if (!text) {
      await reply(`${emoji.feather} Use *${config.prefix}tts <texto>* ou responda a uma mensagem.`)
      return
    }
    try {
      const mp3 = await textToSpeech(text, 'pt')
      const ogg = await toOpus(mp3)
      await sock.sendMessage(from, { audio: ogg, mimetype: 'audio/ogg; codecs=opus', ptt: true }, { quoted: msg })
    } catch (err) {
      console.error('[tts] erro:', err)
      await reply(`${emoji.cross} Não consegui gerar a voz.`)
    }
  }
}
