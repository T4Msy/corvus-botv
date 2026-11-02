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
    if (container.audioMessage) {
      return {
        kind: 'audio',
        isVideo: false,
        node: container.audioMessage,
        seconds: container.audioMessage.seconds || 0
      }
    }
    if (container.stickerMessage) {
      return { kind: 'sticker', isVideo: false, node: container.stickerMessage }
    }
    return null
  }

  return pick(m) || pick(quoted)
}

/**
 * Baixa o conteúdo de mídia (da própria mensagem ou da citada) como Buffer.
 */
async function downloadMedia (msg, media = resolveMedia(msg)) {
  // Entrega ao Baileys só o nó de mídia achado (da própria mensagem ou da
  // citada). Passe o `media` já resolvido se o comando responder antes de
  // baixar: responder citando `msg` faz o Baileys apagar o contextInfo dela
  // (e com ele a mensagem citada).
  if (!media) throw new Error('Nenhuma mídia na mensagem.')
  const target = { key: msg.key, message: { [`${media.kind}Message`]: media.node } }

  return downloadMediaMessage(target, 'buffer', {}, { logger, reuploadRequest: () => {} })
}

module.exports = { resolveMedia, downloadMedia }
