'use strict'

const { downloadVideo, cleanup } = require('../lib/ytdlp')
const { emoji } = require('../ui/theme')

module.exports = {
  name: 'baixar',
  aliases: ['dl', 'download', 'tiktok', 'tt', 'instagram', 'ig', 'twitter', 'x'],
  category: 'Downloads',
  cooldown: 20,
  desc: 'Baixa vídeo de qualquer plataforma (TikTok, Instagram, Twitter, YouTube…).',
  async run ({ sock, from, args, msg, reply }) {
    const link = args[0]
    if (!link || !/^https?:\/\//i.test(link)) {
      await reply(`${emoji.feather} Envie o link do vídeo. Ex.: *!baixar <link>*`)
      return
    }
    await reply(`${emoji.moon} Baixando...`)
    let file
    try {
      const res = await downloadVideo(link)
      file = res.file
      await sock.sendMessage(from, { video: { url: file }, caption: res.title }, { quoted: msg })
    } catch (err) {
      console.error('[baixar] erro:', err)
      const isCobaltFail = err.message?.includes('cobalt')
      const hint = /instagram/i.test(link) && isCobaltFail
        ? ' O Instagram exige login — baixe manualmente e envie o vídeo aqui.'
        : ''
      await reply(`${emoji.cross} Não consegui baixar: ${err.message}.${hint}`)
    } finally {
      await cleanup(file)
    }
  }
}
