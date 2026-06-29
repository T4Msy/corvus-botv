'use strict'

const { downloadVideo, cleanup } = require('../lib/ytdlp')
const { emoji } = require('../ui/theme')

module.exports = {
  name: 'video',
  aliases: ['playvid', 'ytv'],
  category: 'Downloads',
  cooldown: 20,
  desc: 'Baixa um vídeo: !video <nome ou link>.',
  async run ({ sock, from, text, msg, reply }) {
    if (!text) { await reply(`${emoji.feather} Use *video <nome ou link>*.`); return }
    await reply(`${emoji.moon} Baixando o vídeo...`)
    let file
    try {
      const res = await downloadVideo(text)
      file = res.file
      await sock.sendMessage(
        from,
        { video: { url: file }, caption: res.title },
        { quoted: msg }
      )
    } catch (err) {
      console.error('[video] erro:', err)
      await reply(`${emoji.cross} Não consegui baixar (${err.message}).`)
    } finally {
      await cleanup(file)
    }
  }
}
