'use strict'

const { downloadVideo, cleanup } = require('../lib/ytdlp')
const { emoji } = require('../ui/theme')

// Baixa o vídeo de um link de rede social (yt-dlp detecta a plataforma).
function makeRun () {
  return async function ({ sock, from, args, msg, reply }) {
    const link = args[0]
    if (!link || !/^https?:\/\//i.test(link)) {
      await reply(`${emoji.feather} Envie o link. Ex.: o comando seguido da URL.`)
      return
    }
    await reply(`${emoji.moon} Baixando...`)
    let file
    try {
      const res = await downloadVideo(link)
      file = res.file
      await sock.sendMessage(from, { video: { url: file }, caption: res.title }, { quoted: msg })
    } catch (err) {
      console.error('[redes] erro:', err)
      await reply(`${emoji.cross} Não consegui baixar (${err.message}).`)
    } finally {
      await cleanup(file)
    }
  }
}

const run = makeRun()
const base = { category: 'Downloads', cooldown: 20, run }

module.exports = [
  { ...base, name: 'baixar', aliases: ['dl'], desc: 'Baixa vídeo de um link (TikTok, Instagram, etc.).' },
  { ...base, name: 'tiktok', aliases: ['tt'], desc: 'Baixa vídeo do TikTok.' },
  { ...base, name: 'instagram', aliases: ['ig'], desc: 'Baixa vídeo do Instagram.' },
  { ...base, name: 'twitter', aliases: ['x'], desc: 'Baixa vídeo do Twitter/X.' },
  { ...base, name: 'facebook', aliases: ['fb'], desc: 'Baixa vídeo do Facebook.' }
]
