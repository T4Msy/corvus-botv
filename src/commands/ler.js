'use strict'

const { resolveMedia, downloadMedia } = require('../lib/media')
const { readText } = require('../lib/ocr')
const { emoji } = require('../ui/theme')

module.exports = {
  name: 'ler',
  aliases: ['ocr'],
  category: 'Mídia',
  cooldown: 10,
  desc: 'Extrai o texto de uma imagem.',
  async run ({ msg, reply }) {
    const media = resolveMedia(msg)
    if (!media || media.kind !== 'image') {
      await reply(`${emoji.feather} Responda a uma imagem com *ler*.`)
      return
    }
    try {
      const buffer = await downloadMedia(msg)
      const text = await readText(buffer)
      await reply(text ? `${emoji.crystal} *Texto encontrado:*\n${text}` : `${emoji.cross} Não encontrei texto na imagem.`)
    } catch (err) {
      console.error('[ler] erro:', err)
      await reply(`${emoji.cross} Não consegui ler a imagem.`)
    }
  }
}
