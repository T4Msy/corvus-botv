'use strict'

const { mix, splitEmojis } = require('../lib/emojimix')
const { createSticker } = require('../lib/sticker')
const { emoji } = require('../ui/theme')

module.exports = {
  name: 'emojimix',
  aliases: ['emojimk', 'mixemoji'],
  category: 'Mídia',
  cooldown: 3,
  desc: 'Combina dois emojis numa figurinha: !emojimix 😀 😎.',
  async run ({ sock, from, args, msg, reply, config }) {
    // Aceita com ou sem espaço: "😀 😎" ou "😀😎".
    const emojis = splitEmojis(args.join(''))
    if (emojis.length < 2) {
      await reply(`${emoji.feather} Use *${config.prefix}emojimix 😀 😎* (dois emojis).`)
      return
    }
    try {
      const png = await mix(emojis[0], emojis[1])
      const sticker = await createSticker(png, false, { pack: 'figurinhas', author: config.botName })
      await sock.sendMessage(from, { sticker }, { quoted: msg })
    } catch (err) {
      console.error('[emojimix] erro:', err)
      await reply(`${emoji.cross} Esse par de emojis não tem combinação disponível.`)
    }
  }
}
