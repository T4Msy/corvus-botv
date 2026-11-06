'use strict'

const { resolveMedia, downloadMedia } = require('../lib/media')
const { enabled, transcribe } = require('../lib/transcribe')
const { emoji, error } = require('../ui/theme')

const MAX_SECONDS = 15 * 60

const duracao = s => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`

module.exports = {
  name: 'ouvir',
  aliases: ['transcrever', 'escutar', 'oq'],
  category: 'Mídia',
  cooldown: 10,
  desc: 'Escreve o que foi dito num áudio: responda o áudio com ouvir.',
  async run ({ msg, reply, config, isMember }) {
    if (!enabled()) { await reply(error('A transcrição ainda não foi ligada no servidor.')); return }

    const media = resolveMedia(msg)
    if (!media || !['audio', 'video'].includes(media.kind)) {
      await reply(`${emoji.feather} Responda um *áudio* com *${config.prefix}ouvir* que eu escrevo o que foi dito.`)
      return
    }
    if (media.seconds > MAX_SECONDS) {
      await reply(`${emoji.cross} Áudio muito longo (máx. ${MAX_SECONDS / 60} minutos).`)
      return
    }

    try {
      // Baixa antes de responder: o reply citando `msg` apaga dela a mensagem citada.
      const audio = await downloadMedia(msg, media)
      await reply(`${emoji.moon} Ouvindo o áudio${media.seconds ? ` (${duracao(media.seconds)})` : ''}...`)
      const texto = await transcribe(audio, media.node.mimetype, { vocabulary: isMember })
      await reply(texto
        ? `🎙️ *Transcrição*${media.seconds ? ` _(${duracao(media.seconds)})_` : ''}\n\n${texto}`
        : `${emoji.cross} Não consegui entender nada nesse áudio.`)
    } catch (err) {
      console.error('[ouvir] erro:', err.message)
      await reply(`${emoji.cross} Não consegui transcrever: ${err.message}`)
    }
  }
}
