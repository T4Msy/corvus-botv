'use strict'

const { textSticker, clean } = require('../lib/textsticker')
const { addExif } = require('../lib/sticker')
const { emoji } = require('../ui/theme')

const MAX = 60 // caracteres; mais que isso a letra fica pequena demais

module.exports = {
  name: 'fig',
  aliases: ['attp', 'figtexto', 'textofig'],
  category: 'Mídia',
  cooldown: 5,
  desc: 'Figurinha animada com o seu texto em arco-íris: fig <texto>.',
  async run ({ sock, from, msg, text, reply, config }) {
    const texto = clean(text)
    if (!texto) { await reply(`${emoji.feather} Use *${config.prefix}fig <texto>*\nEx.: ${config.prefix}fig Masayoshi`); return }
    if (texto.length > MAX) { await reply(`${emoji.cross} Texto muito grande (máx. ${MAX} letras).`); return }

    const webp = await textSticker(texto)
    const sticker = await addExif(webp, 'figurinhas', config.botName)
    await sock.sendMessage(from, { sticker }, { quoted: msg })
  }
}
