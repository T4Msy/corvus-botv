'use strict'

const { downloadVideo, cleanup } = require('../lib/ytdlp')
const { emoji } = require('../ui/theme')

const SUPORTADOS = /^https?:\/\/([a-z0-9-]+\.)*(tiktok\.com|instagram\.com|pinterest\.[a-z.]+|pin\.it|x\.com|twitter\.com)(\/|$)/i

module.exports = {
  name: 'baixar',
  aliases: ['dl', 'download', 'tiktok', 'tt', 'instagram', 'ig', 'twitter', 'x'],
  category: 'Downloads',
  cooldown: 20,
  desc: 'Baixa vídeo do TikTok, Instagram, Pinterest e X (Twitter).',
  async run ({ sock, from, args, msg, reply, config }) {
    const link = args[0]
    if (!link || !/^https?:\/\//i.test(link)) {
      await reply(`${emoji.feather} Envie o link do vídeo. Ex.: *${config.prefix}baixar <link>*`)
      return
    }
    // Só os sites que funcionam no servidor. O YouTube barra o servidor e,
    // contornando, cada vídeo levava ~30s: ficou de fora, como os demais.
    if (!SUPORTADOS.test(link)) {
      const site = /youtube\.com|youtu\.be/i.test(link) ? 'do YouTube' : 'desse site'
      await reply(`${emoji.cross} Desculpe! O Corvus não baixa vídeos ${site}.\n` +
        `Dá para baixar de: *TikTok*, *Instagram*, *Pinterest* e *X (Twitter)*.`)
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
