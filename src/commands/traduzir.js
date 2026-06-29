'use strict'

const { translate } = require('../lib/translate')
const { extractText } = require('../handler')
const { emoji } = require('../ui/theme')

module.exports = {
  name: 'traduzir',
  aliases: ['translate', 'tr'],
  category: 'Mídia',
  cooldown: 3,
  desc: 'Traduz texto: !traduzir [idioma] <texto>.',
  async run ({ args, msg, reply, config }) {
    let to = 'pt'
    let words = [...args]
    // Primeiro argumento de 2 letras = idioma de destino (ex.: en, es).
    if (words[0] && /^[a-z]{2}$/i.test(words[0])) {
      to = words[0].toLowerCase()
      words = words.slice(1)
    }

    const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage
    const text = words.join(' ') || (quoted ? extractText(quoted) : '')
    if (!text) {
      await reply(`${emoji.feather} Use *${config.prefix}traduzir [idioma] <texto>* ou responda a uma mensagem.`)
      return
    }

    try {
      const res = await translate(text, { to })
      await reply(`${emoji.crystal} *Tradução (${to}):*\n${res.text}`)
    } catch (err) {
      console.error('[traduzir] erro:', err)
      await reply(`${emoji.cross} Não consegui traduzir agora.`)
    }
  }
}
