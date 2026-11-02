'use strict'

const { resolveMedia, downloadMedia } = require('../lib/media')
const { createSticker, addExif } = require('../lib/sticker')
const { textSticker, clean } = require('../lib/textsticker')
const { emoji } = require('../ui/theme')

const MAX_VIDEO_SECONDS = 10
const MAX_ATTP = 60 // letras; mais que isso a letra fica pequena demais

/** "/fig attp <texto>": figurinha animada de texto em arco-íris. */
async function attp ({ sock, msg, from, reply, config }, raw) {
  const texto = clean(raw)
  if (!texto) { await reply(`${emoji.feather} Use *${config.prefix}fig attp <texto>*\nEx.: ${config.prefix}fig attp Masayoshi`); return }
  if (texto.length > MAX_ATTP) { await reply(`${emoji.cross} Texto muito grande (máx. ${MAX_ATTP} letras).`); return }
  const sticker = await addExif(await textSticker(texto), 'figurinhas', config.botName)
  await sock.sendMessage(from, { sticker }, { quoted: msg })
}

module.exports = {
  name: 'sticker',
  aliases: ['fig', 's', 'figu', 'figurinha'],
  category: 'Mídia',
  desc: 'Imagem ou vídeo curto vira figurinha. Texto animado: fig attp <texto>.',
  async run (ctx) {
    const { msg, reply, config, args, text } = ctx
    if (/^attp$/i.test(args[0] || '')) { await attp(ctx, text.replace(/^\s*attp\s*/i, '')); return }

    const { sock, from } = ctx
    const media = resolveMedia(msg)
    if (!media) {
      await reply(
        `${emoji.feather} Envie uma imagem/vídeo com *${config.prefix}fig* na legenda, ` +
        'ou responda a uma mídia com o comando.\n' +
        `${emoji.feather} Texto animado: *${config.prefix}fig attp <texto>*`
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
        pack: 'figurinhas',
        author: config.botName
      })
      await sock.sendMessage(from, { sticker: webp }, { quoted: msg })
    } catch (err) {
      console.error('[sticker] erro:', err)
      await reply(`${emoji.cross} Não consegui criar a figurinha.`)
    }
  }
}
