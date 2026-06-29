'use strict'

const { downloadAudio, cleanup } = require('../lib/ytdlp')
const { fetchJson } = require('../lib/fetch')
const { emoji } = require('../ui/theme')

module.exports = {
  name: 'play',
  aliases: ['musica', 'yta'],
  category: 'Downloads',
  cooldown: 15,
  desc: 'Baixa o áudio de uma música/vídeo: !play <nome ou link>.',
  async run ({ sock, from, text, msg, reply }) {
    if (!text) { await reply(`${emoji.feather} Use *play <nome ou link>*.`); return }

    let query = text

    // Spotify usa DRM — converter para busca no YouTube via oEmbed.
    if (/open\.spotify\.com/i.test(text)) {
      try {
        const oembed = await fetchJson(
          `https://open.spotify.com/oembed?url=${encodeURIComponent(text)}`
        )
        const title = oembed?.title
        if (!title) throw new Error('sem título')
        query = title
        await reply(`${emoji.wine} Spotify usa DRM — buscando no YouTube: *${title}*`)
      } catch {
        await reply(`${emoji.cross} Não consegui obter o nome da música. Envie o nome diretamente.`)
        return
      }
    } else {
      await reply(`${emoji.moon} Baixando o áudio...`)
    }

    let file
    try {
      const res = await downloadAudio(query)
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
