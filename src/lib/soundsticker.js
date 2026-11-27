'use strict'

/**
 * Figurinha animada com som (recurso novo do WhatsApp, nov/2026).
 *
 * Formato (engenharia reversa da comunidade; não há doc oficial): uma
 * stickerMessage comum que leva, no campo 26, uma AudioMessage completa
 * (Ogg/Opus mono 48 kHz, "audio/ogg; codecs=opus") enviada como mídia à parte.
 *
 * O Baileys 6.7.x não conhece esse campo, e o generateWAMessageFromContent
 * passa tudo por fromObject (que descarta campos desconhecidos). Por isso o
 * áudio fica num mapa pelo fileSha256 da figurinha e um gancho no
 * StickerMessage.encode acrescenta o campo 26 na hora de codificar. Assim os
 * reenvios (getMessage/retry, via msgcache) também levam o áudio enquanto ele
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

let installed = false
function installHook () {
  if (installed) return
  const StickerMessage = proto.Message.StickerMessage
  const originalEncode = StickerMessage.encode
  StickerMessage.encode = function (message, writer) {
    const w = originalEncode.call(this, message, writer)
    const entry = message?.fileSha256 && pending.get(keyOf(message.fileSha256))
    if (entry) w.uint32(STICKER_AUDIO_TAG).bytes(entry.bytes)
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
    ptt: true,
    mediaKey: up.mediaKey,
    fileEncSha256: up.fileEncSha256,
    directPath: up.directPath,
    mediaKeyTimestamp: up.mediaKeyTimestamp || Math.floor(Date.now() / 1000),
    ...(st.waveform ? { waveform: st.waveform } : {})
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
