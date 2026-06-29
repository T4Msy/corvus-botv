'use strict'

const { resolveMedia, downloadMedia } = require('../lib/media')
const { applyEffect, EFFECTS } = require('../lib/audio')
const { emoji } = require('../ui/theme')

const DESCRIPTIONS = {
  grave: 'Deixa a voz grave.',
  agudo: 'Deixa a voz aguda.',
  rapido: 'Acelera o áudio.',
  lento: 'Deixa o áudio lento.',
  reverse: 'Inverte o áudio.',
  robot: 'Efeito de voz robótica.',
  volume: 'Aumenta o volume.'
}

// Um comando por efeito, gerado a partir da lista em lib/audio.js.
module.exports = EFFECTS.map((effect) => ({
  name: effect,
  category: 'Áudio',
  cooldown: 5,
  desc: DESCRIPTIONS[effect],
  async run ({ sock, from, msg, reply }) {
    const media = resolveMedia(msg)
    if (!media || (media.kind !== 'audio' && media.kind !== 'video')) {
      await reply(`${emoji.feather} Responda a um áudio (ou vídeo) com *${effect}*.`)
      return
    }
    try {
      const buffer = await downloadMedia(msg)
      const out = await applyEffect(buffer, effect)
      await sock.sendMessage(from, { audio: out, mimetype: 'audio/ogg; codecs=opus' }, { quoted: msg })
    } catch (err) {
      console.error(`[efeito ${effect}] erro:`, err)
      await reply(`${emoji.cross} Não consegui aplicar o efeito.`)
    }
  }
}))
