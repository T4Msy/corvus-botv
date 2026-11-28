'use strict'

const { resolveMedia, downloadMedia } = require('../lib/media')
const { createSticker, createSoundSticker, addExif } = require('../lib/sticker')
const { sendSoundSticker } = require('../lib/soundsticker')
const { textSticker, clean } = require('../lib/textsticker')
const { emoji } = require('../ui/theme')

// Vídeo mais longo é cortado sozinho nos primeiros 10 segundos (MAX_SECONDS em lib/sticker.js).
// Este limite só evita baixar vídeo enorme na VPS (1 GB de RAM).
const MAX_VIDEO_SECONDS = 5 * 60
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
  desc: 'Imagem ou vídeo vira figurinha (vídeo longo é cortado no começo; com som vira figurinha com som). Texto animado: fig attp <texto>.',
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
      await reply(`${emoji.cross} Vídeo grande demais (máx. ${MAX_VIDEO_SECONDS / 60} minutos). A figurinha usa só o começo do vídeo.`)
      return
    }

    try {
      const buffer = await downloadMedia(msg)
      const meta = { pack: 'figurinhas', author: config.botName }
      if (media.isVideo) {
        // Vídeo com som vira figurinha com som; sem som, figurinha normal.
        const st = await createSoundSticker(buffer, meta)
        if (st.audio) {
          try {
            await sendSoundSticker(sock, from, st, { quoted: msg })
            return
          } catch (err) {
            console.error('[sticker] figurinha com som falhou, mandando sem som:', err)
          }
        }
        await sock.sendMessage(from, { sticker: st.webp }, { quoted: msg })
        return
      }
      const webp = await createSticker(buffer, false, meta)
      await sock.sendMessage(from, { sticker: webp }, { quoted: msg })
    } catch (err) {
      console.error('[sticker] erro:', err)
      await reply(`${emoji.cross} Não consegui criar a figurinha.`)
    }
  }
}
