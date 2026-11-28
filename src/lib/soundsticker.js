'use strict'

/**
 * Figurinha animada com som (recurso novo do WhatsApp, nov/2026).
 *
 * Formato (engenharia reversa da comunidade, Baileys issue #2932; não há doc
 * oficial). É assim que o celular manda:
 *
 *   Message.134 (audioStickerMessage, envelope tipo FutureProofMessage) {
 *     1: Message {
 *       26: StickerMessage { ...campos normais..., 24: 0, 25: emoji,
 *                            26: AudioMessage (Ogg/Opus, "audio/ogg; codecs=opus") }
 *     }
 *   }
 *
 * O áudio é uma mídia à parte. Sem o envelope 134 o Android ainda toca, mas o
 * iPhone não mostra a figurinha.
 *
 * O Baileys 6.7.x não conhece nada disso, e o generateWAMessageFromContent
 * passa tudo por fromObject (que descarta campos desconhecidos). Por isso o
 * áudio fica num mapa pelo fileSha256 da figurinha e dois ganchos
 * (Message.encode e StickerMessage.encode) montam o formato acima na hora de
 * codificar. Assim os reenvios (getMessage/retry, via msgcache) e a cópia para
 * os outros aparelhos do bot (deviceSentMessage) saem iguais enquanto o áudio
 * estiver no mapa.
 */

const {
  proto,
  prepareWAMessageMedia,
  generateWAMessageFromContent
} = require('@whiskeysockets/baileys')
const { remember, markSent } = require('./msgcache')

const AUDIO_MIMETYPE = 'audio/ogg; codecs=opus' // só "audio/ogg" sai muda
const STICKER_AUDIO_TAG = (26 << 3) | 2 // campo 26, length-delimited
const TTL_MS = 60 * 60 * 1000 // cobre os pedidos de reenvio
const MAX_PENDING = 64

const pending = new Map() // base64(fileSha256) -> { bytes, at }

function keyOf (sha) {
  return sha ? Buffer.from(sha).toString('base64') : null
}

function prune () {
  const now = Date.now()
  for (const [k, v] of pending) {
    if (now - v.at > TTL_MS || pending.size > MAX_PENDING) pending.delete(k)
  }
}

const ENVELOPE_TAG = (134 << 3) | 2 // Message.audioStickerMessage
const INNER_MESSAGE_TAG = (1 << 3) | 2 // FutureProofMessage.message
const PREMIUM_TAG = (24 << 3) | 0 // StickerMessage campo 24 (varint, sempre 0)
const EMOJI_TAG = (25 << 3) | 2 // StickerMessage campo 25 (emoji)
const EMOJI = '🔊'

let installed = false
let inEnvelope = 0

function pendingFor (sticker) {
  return sticker?.fileSha256 ? pending.get(keyOf(sticker.fileSha256)) : null
}

function installHook () {
  if (installed) return
  const StickerMessage = proto.Message.StickerMessage
  const originalStickerEncode = StickerMessage.encode
  StickerMessage.encode = function (message, writer) {
    const w = originalStickerEncode.call(this, message, writer)
    const entry = inEnvelope && pendingFor(message)
    if (entry) {
      w.uint32(PREMIUM_TAG).int32(0)
      w.uint32(EMOJI_TAG).string(EMOJI)
      w.uint32(STICKER_AUDIO_TAG).bytes(entry.bytes)
    }
    return w
  }

  // A stickerMessage com áudio sai de dentro do envelope 134, não no campo 26
  // de cima. O resto da mensagem (messageContextInfo etc.) fica onde está.
  const Message = proto.Message
  const originalMessageEncode = Message.encode
  Message.encode = function (message, writer) {
    if (inEnvelope || !pendingFor(message?.stickerMessage)) {
      return originalMessageEncode.call(this, message, writer)
    }
    const { stickerMessage, ...rest } = message
    const w = originalMessageEncode.call(this, rest, writer)
    inEnvelope++
    try {
      w.uint32(ENVELOPE_TAG).fork()
      w.uint32(INNER_MESSAGE_TAG).fork()
      originalMessageEncode.call(this, { stickerMessage }, w)
      w.ldelim()
      w.ldelim()
    } finally {
      inEnvelope--
    }
    return w
  }
  installed = true
}

/**
 * Envia a figurinha com o áudio embutido.
 * @param {object} sock  socket do Baileys
 * @param {string} jid   chat de destino
 * @param {{ webp: Buffer, audio: Buffer, seconds: number, waveform?: Buffer }} st
 * @param {{ quoted?: object }} [opts]
 */
async function sendSoundSticker (sock, jid, st, opts = {}) {
  installHook()
  const upload = sock.waUploadToServer

  const { audioMessage: up } = await prepareWAMessageMedia(
    { audio: st.audio, mimetype: AUDIO_MIMETYPE, seconds: st.seconds },
    { upload }
  )
  const { stickerMessage: sticker } = await prepareWAMessageMedia({ sticker: st.webp }, { upload })
  sticker.isAnimated = true
  sticker.width = 512
  sticker.height = 512

  const audioBytes = proto.Message.AudioMessage.encode(proto.Message.AudioMessage.create({
    url: up.url,
    mimetype: AUDIO_MIMETYPE,
    fileSha256: up.fileSha256,
    fileLength: up.fileLength,
    seconds: st.seconds,
    mediaKey: up.mediaKey,
    fileEncSha256: up.fileEncSha256,
    directPath: up.directPath,
    // Igual ao celular: sem ptt e sem waveform (campos que ele não manda).
    mediaKeyTimestamp: up.mediaKeyTimestamp || Math.floor(Date.now() / 1000)
  })).finish()

  prune()
  pending.set(keyOf(sticker.fileSha256), { bytes: audioBytes, at: Date.now() })

  const msg = generateWAMessageFromContent(jid, { stickerMessage: sticker }, {
    quoted: opts.quoted,
    userJid: sock.user?.id
  })
  await sock.relayMessage(jid, msg.message, { messageId: msg.key.id })
  markSent(msg.key.id)
  remember(msg.key.id, msg.message)
  return msg
}

module.exports = { sendSoundSticker, installHook, AUDIO_MIMETYPE }
