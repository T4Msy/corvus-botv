'use strict'

const { resolveMedia, downloadMedia } = require('../lib/media')
const { createSticker } = require('../lib/sticker')
const { emoji } = require('../ui/theme')

const MAX_VIDEO_SECONDS = 10

module.exports = {
  name: 'sticker',
  aliases: ['fig', 's', 'figu'],
  desc: 'Transforma imagem ou vídeo curto em figurinha.',
  async run ({ sock, msg, from, reply, config }) {
    const media = resolveMedia(msg)
    if (!media) {
      await reply(
        `${emoji.feather} Envie uma imagem/vídeo com *${config.prefix}sticker* na legenda, ` +
        'ou responda a uma mídia com o comando.'
      )
      return
    }

    if (media.isVideo && media.seconds > MAX_VIDEO_SECONDS) {
      await reply(`${emoji.cross} Vídeo muito longo (máx. ${MAX_VIDEO_SECONDS}s).`)
      return
    }

    try {
      const buffer = await downloadMedia(msg)
      const webp = await createSticker(buffer, media.isVideo, {
        pack: config.botName,
        author: config.iaName
      })
      await sock.sendMessage(from, { sticker: webp }, { quoted: msg })
    } catch (err) {
      console.error('[sticker] erro:', err)
      await reply(`${emoji.cross} Não consegui criar a figurinha.`)
    }
  }
}
