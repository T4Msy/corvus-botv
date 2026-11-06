'use strict'

const { downloadVideo, cleanup } = require('../lib/ytdlp')
const { emoji } = require('../ui/theme')

module.exports = {
  name: 'baixar',
  aliases: ['dl', 'download', 'tiktok', 'tt', 'instagram', 'ig', 'twitter', 'x'],
  category: 'Downloads',
  cooldown: 20,
  desc: 'Baixa vídeo de qualquer plataforma (TikTok, Instagram, Twitter, YouTube…).',
  async run ({ sock, from, args, msg, reply, config }) {
    const link = args[0]
    if (!link || !/^https?:\/\//i.test(link)) {
      await reply(`${emoji.feather} Envie o link do vídeo. Ex.: *${config.prefix}baixar <link>*`)
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
      if (err.code === 'IG_BLOCKED') {
        await reply(`${emoji.cross} O Instagram bloqueou o download. Baixe o vídeo e envie aqui.`)
        return
      }
      await reply(`${emoji.cross} Não consegui baixar: ${err.message}.`)
    } finally {
      await cleanup(file)
    }
  }
}
