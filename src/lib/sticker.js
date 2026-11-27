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

const MAX_SECONDS = 6 // limita a 6s para manter o sticker < 1MB

/** Converte um vídeo/GIF (já salvo em `input`) em WebP animado usando o ffmpeg empacotado. */
async function videoFileToWebp (input) {
  const output = tmpFile('webp')
  const args = [
    '-y',
    '-i', input,
    '-t', String(MAX_SECONDS),
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
    await fs.rm(output, { force: true })
  }
}

/** Converte um vídeo/GIF em WebP animado usando o ffmpeg empacotado. */
async function videoToWebp (buffer) {
  const input = tmpFile('mp4')
  await fs.writeFile(input, buffer)
  try {
    return await videoFileToWebp(input)
  } finally {
    await fs.rm(input, { force: true })
  }
}

/**
 * Lê a primeira faixa de áudio do vídeo (os mesmos 6s da animação) como PCM
 * mono 8 kHz. Retorna null se o vídeo não tiver áudio.
 */
async function readPcm (input) {
  const args = [
    '-hide_banner', '-loglevel', 'error',
    '-i', input,
    '-t', String(MAX_SECONDS),
    '-vn', '-map', '0:a:0?',
    '-ac', '1', '-ar', '8000',
    '-f', 's16le', 'pipe:1'
  ]
  try {
    const pcm = await runFfmpeg(args, { stdout: true })
    return pcm.length >= 2 ? pcm : null
  } catch (err) {
    // Sem faixa de áudio o ffmpeg não tem o que escrever: não é erro.
    if (/does not contain any stream/i.test(err.message)) return null
    throw err
  }
}

/** 64 barras (0–100) para a onda do áudio, como o WhatsApp usa em PTT. */
function waveformFrom (pcm) {
  const samples = Math.floor(pcm.length / 2)
  const bars = 64
  const per = Math.max(1, Math.floor(samples / bars))
  const out = []
  for (let b = 0; b < bars; b++) {
    let sum = 0
    let n = 0
    for (let i = b * per; i < Math.min(samples, (b + 1) * per); i++) {
      sum += Math.abs(pcm.readInt16LE(i * 2))
      n++
    }
    out.push(n ? sum / n : 0)
  }
  const max = Math.max(...out)
  return {
    peak: max,
    waveform: Buffer.from(out.map((v) => (max ? Math.round((v / max) * 100) : 0)))
  }
}

/** Áudio do vídeo em Ogg/Opus mono 48 kHz (o formato das figurinhas com som). */
async function audioFileToOpus (input) {
  const output = tmpFile('ogg')
  const args = [
    '-y',
    '-i', input,
    '-t', String(MAX_SECONDS),
    '-vn', '-map', '0:a:0',
    '-ac', '1', '-ar', '48000',
    '-c:a', 'libopus', '-b:a', '32k',
    '-map_metadata', '-1',
    '-f', 'ogg',
    output
  ]
  try {
    await runFfmpeg(args)
    return await fs.readFile(output)
  } finally {
    await fs.rm(output, { force: true })
  }
}

// Abaixo disso (média de amplitude, em 16 bits) o áudio é tratado como silêncio.
const SILENCE_PEAK = 30

/**
 * Figurinha animada que mantém o áudio do vídeo.
 * Retorna { webp, audio, seconds, waveform } — `audio` é null quando o vídeo
 * não tem som (ou só tem silêncio): aí vale a figurinha normal.
 */
async function createSoundSticker (buffer, meta) {
  const input = tmpFile('mp4')
  await fs.writeFile(input, buffer)
  try {
    const webp = await addExif(await videoFileToWebp(input), meta.pack, meta.author)

    let pcm = null
    try {
      pcm = await readPcm(input)
    } catch (err) {
      console.error('[sticker] não consegui ler o áudio do vídeo:', err.message)
    }
    if (!pcm) return { webp, audio: null }

    const { peak, waveform } = waveformFrom(pcm)
    if (peak < SILENCE_PEAK) return { webp, audio: null }

    const seconds = Math.max(1, Math.round(pcm.length / 2 / 8000))
    const audio = await audioFileToOpus(input)
    return { webp, audio, seconds, waveform }
  } finally {
    await fs.rm(input, { force: true })
  }
}

/** Roda o ffmpeg. Com { stdout: true } resolve com o que ele escreveu na saída. */
function runFfmpeg (args, { stdout = false } = {}) {
  return new Promise((resolve, reject) => {
    const proc = spawn(ffmpegPath, args)
    let stderr = ''
    const chunks = []
    if (stdout) proc.stdout.on('data', (d) => chunks.push(d))
    proc.stderr.on('data', (d) => { stderr += d.toString() })
    proc.on('error', reject)
    proc.on('close', (code) => {
      if (code === 0) resolve(stdout ? Buffer.concat(chunks) : undefined)
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

module.exports = { createSticker, createSoundSticker, addExif }
