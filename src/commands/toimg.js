'use strict'

const sharp = require('sharp')
const { resolveMedia, downloadMedia } = require('../lib/media')
const { emoji } = require('../ui/theme')

module.exports = {
  name: 'toimg',
  aliases: ['paraimg', 'toimage'],
  category: 'Mídia',
  desc: 'Converte uma figurinha (estática) em imagem.',
  async run ({ sock, from, msg, reply }) {
    const media = resolveMedia(msg)
    if (!media || media.kind !== 'sticker') {
      await reply(`${emoji.feather} Responda a uma figurinha com *toimg*.`)
      return
    }
    try {
      const buffer = await downloadMedia(msg)
      const png = await sharp(buffer).png().toBuffer()
      await sock.sendMessage(from, { image: png }, { quoted: msg })
    } catch (err) {
      console.error('[toimg] erro:', err)
      await reply(`${emoji.cross} Não consegui converter (figurinhas animadas não são suportadas).`)
    }
  }
}
