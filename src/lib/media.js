'use strict'

const { downloadMediaMessage } = require('@whiskeysockets/baileys')
const pino = require('pino')

const logger = pino({ level: 'silent' })

/**
 * Resolve a mídia "alvo" de um comando: a própria mensagem ou a mensagem citada.
 * Retorna { kind: 'image'|'video', node, isVideo, seconds } ou null.
 */
function resolveMedia (msg) {
  const m = msg.message || {}
  const quoted = m.extendedTextMessage?.contextInfo?.quotedMessage

  const pick = (container) => {
    if (!container) return null
    if (container.imageMessage) {
      return { kind: 'image', isVideo: false, node: container.imageMessage }
    }
    if (container.videoMessage) {
      return {
        kind: 'video',
        isVideo: true,
        node: container.videoMessage,
        seconds: container.videoMessage.seconds || 0
      }
    }
    return null
  }

  return pick(m) || pick(quoted)
}

/**
 * Baixa o conteúdo de mídia (da própria mensagem ou da citada) como Buffer.
 */
async function downloadMedia (msg) {
  const m = msg.message || {}
  const quoted = m.extendedTextMessage?.contextInfo?.quotedMessage

  // Se a mídia está na citada, reconstrói um WAMessage mínimo para o Baileys.
  const target = (m.imageMessage || m.videoMessage)
    ? msg
    : { key: msg.key, message: quoted }

  return downloadMediaMessage(target, 'buffer', {}, { logger, reuploadRequest: () => {} })
}

module.exports = { resolveMedia, downloadMedia }
