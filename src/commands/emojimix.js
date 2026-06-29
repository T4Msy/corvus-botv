'use strict'

const { mix } = require('../lib/emojimix')
const { createSticker } = require('../lib/sticker')
const { emoji } = require('../ui/theme')

module.exports = {
  name: 'emojimix',
  aliases: ['emojimk', 'mixemoji'],
  category: 'Mídia',
  cooldown: 3,
  desc: 'Combina dois emojis numa figurinha: !emojimix 😀 😎.',
  async run ({ sock, from, args, msg, reply, config }) {
    if (args.length < 2) {
      await reply(`${emoji.feather} Use *${config.prefix}emojimix 😀 😎* (dois emojis).`)
      return
    }
    try {
      const png = await mix(args[0], args[1])
      const sticker = await createSticker(png, false, { pack: config.botName, author: config.iaName })
      await sock.sendMessage(from, { sticker }, { quoted: msg })
    } catch (err) {
      console.error('[emojimix] erro:', err)
      await reply(`${emoji.cross} Esse par de emojis não tem combinação disponível.`)
    }
  }
}
