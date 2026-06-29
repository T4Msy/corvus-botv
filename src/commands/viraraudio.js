'use strict'

const { resolveMedia, downloadMedia } = require('../lib/media')
const { toMp3 } = require('../lib/audio')
const { emoji } = require('../ui/theme')

module.exports = {
  name: 'viraraudio',
  aliases: ['mp3', 'toaudio'],
  category: 'Áudio',
  cooldown: 5,
  desc: 'Extrai o áudio de um vídeo.',
  async run ({ sock, from, msg, reply }) {
    const media = resolveMedia(msg)
    if (!media || media.kind !== 'video') {
      await reply(`${emoji.feather} Responda a um vídeo com *viraraudio*.`)
      return
    }
    try {
      const buffer = await downloadMedia(msg)
      const mp3 = await toMp3(buffer)
      await sock.sendMessage(from, { audio: mp3, mimetype: 'audio/mpeg' }, { quoted: msg })
    } catch (err) {
      console.error('[viraraudio] erro:', err)
      await reply(`${emoji.cross} Não consegui converter o vídeo.`)
    }
  }
}
