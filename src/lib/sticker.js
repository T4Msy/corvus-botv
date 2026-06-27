'use strict'

const os = require('os')
const fs = require('fs/promises')
const path = require('path')
const crypto = require('crypto')
const { spawn } = require('child_process')
const sharp = require('sharp')
const ffmpegPath = require('ffmpeg-static')
const { Image } = require('node-webpmux')

const TMP = os.tmpdir()

function tmpFile (ext) {
  return path.join(TMP, `corvus-${crypto.randomBytes(6).toString('hex')}.${ext}`)
}

/** Converte uma imagem (qualquer formato suportado pelo sharp) em WebP 512x512. */
async function imageToWebp (buffer) {
  return sharp(buffer, { animated: true })
    .resize(512, 512, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    })
    .webp({ quality: 80 })
    .toBuffer()
}

/** Converte um vídeo/GIF em WebP animado usando o ffmpeg empacotado. */
async function videoToWebp (buffer) {
  const input = tmpFile('mp4')
  const output = tmpFile('webp')
  await fs.writeFile(input, buffer)

  const args = [
    '-y',
    '-i', input,
    '-t', '6', // limita a 6s para manter o sticker < 1MB
    '-vcodec', 'libwebp',
    '-filter:v',
    "fps=15,scale=512:512:force_original_aspect_ratio=decrease,format=rgba,pad=512:512:-1:-1:color=#00000000",
    '-loop', '0',
    '-preset', 'default',
    '-an', '-vsync', '0',
    output
  ]

  try {
    await runFfmpeg(args)
    return await fs.readFile(output)
  } finally {
    await fs.rm(input, { force: true })
    await fs.rm(output, { force: true })
  }
}

function runFfmpeg (args) {
  return new Promise((resolve, reject) => {
    const proc = spawn(ffmpegPath, args)
    let stderr = ''
    proc.stderr.on('data', (d) => { stderr += d.toString() })
    proc.on('error', reject)
    proc.on('close', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`ffmpeg saiu com código ${code}: ${stderr.slice(-500)}`))
    })
  })
}

/** Injeta o EXIF de pacote/autor reconhecido pelo WhatsApp. */
async function addExif (webpBuffer, pack, author) {
  const img = new Image()
  await img.load(webpBuffer)

  const json = {
    'sticker-pack-id': 'com.corvus.masayoshi',
    'sticker-pack-name': pack,
    'sticker-pack-publisher': author,
    emojis: ['🐦‍⬛']
  }
  const head = Buffer.from([
    0x49, 0x49, 0x2a, 0x00, 0x08, 0x00, 0x00, 0x00, 0x01, 0x00,
    0x41, 0x57, 0x07, 0x00, 0x00, 0x00, 0x00, 0x00, 0x16, 0x00, 0x00, 0x00
  ])
  const payload = Buffer.from(JSON.stringify(json), 'utf-8')
  const exif = Buffer.concat([head, payload])
  exif.writeUIntLE(payload.length, 14, 4)

  img.exif = exif
  return img.save(null)
}

/**
 * Cria o WebP final de figurinha a partir de um buffer de mídia.
 * @param {Buffer} buffer  mídia de origem
 * @param {boolean} isVideo  true para vídeo/gif
 * @param {{ pack: string, author: string }} meta
 */
async function createSticker (buffer, isVideo, meta) {
  const webp = isVideo ? await videoToWebp(buffer) : await imageToWebp(buffer)
  return addExif(webp, meta.pack, meta.author)
}

module.exports = { createSticker }
