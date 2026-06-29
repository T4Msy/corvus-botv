'use strict'

const { downloadAudio, cleanup } = require('../lib/ytdlp')
const { emoji } = require('../ui/theme')

module.exports = {
  name: 'play',
  aliases: ['musica', 'yta'],
  category: 'Downloads',
  cooldown: 15,
  desc: 'Baixa o áudio de uma música/vídeo: !play <nome ou link>.',
  async run ({ sock, from, text, msg, reply }) {
    if (!text) { await reply(`${emoji.feather} Use *play <nome ou link>*.`); return }
    await reply(`${emoji.moon} Baixando o áudio...`)
    let file
    try {
      const res = await downloadAudio(text)
      file = res.file
      await sock.sendMessage(
        from,
        { audio: { url: file }, mimetype: 'audio/mpeg', fileName: `${res.title}.mp3` },
        { quoted: msg }
      )
    } catch (err) {
      console.error('[play] erro:', err)
      await reply(`${emoji.cross} Não consegui baixar (${err.message}).`)
    } finally {
      await cleanup(file)
    }
  }
}
