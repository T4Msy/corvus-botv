'use strict'

const os = require('os')
const fs = require('fs/promises')
const path = require('path')
const crypto = require('crypto')
const { spawn } = require('child_process')
const ffmpegPath = require('ffmpeg-static')

const TMP = os.tmpdir()

function tmpFile (ext) {
  return path.join(TMP, `corvus-${crypto.randomBytes(6).toString('hex')}.${ext}`)
}

function runFfmpeg (args) {
  return new Promise((resolve, reject) => {
    const proc = spawn(ffmpegPath, args)
    let stderr = ''
    proc.stderr.on('data', (d) => { stderr += d.toString() })
    proc.on('error', reject)
    proc.on('close', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`ffmpeg saiu com código ${code}: ${stderr.slice(-400)}`))
    })
  })
}

// Filtros de áudio por efeito. asetrate altera pitch+tempo; atempo corrige
// o tempo de volta quando queremos só mudar o tom.
const FILTERS = {
  grave: 'asetrate=44100*0.8,aresample=44100,atempo=1.25',
  agudo: 'asetrate=44100*1.3,aresample=44100,atempo=0.77',
  rapido: 'atempo=1.5',
  lento: 'atempo=0.7',
  reverse: 'areverse',
  robot: 'afftfilt=real=\'hypot(re,im)*sin(0)\':imag=\'hypot(re,im)*cos(0)\':win_size=512:overlap=0.75',
  volume: 'volume=4'
}

const EFFECTS = Object.keys(FILTERS)

/**
 * Aplica um efeito a um áudio (buffer) e devolve um buffer de áudio (ogg/opus).
 */
async function applyEffect (buffer, effect) {
  const filter = FILTERS[effect]
  if (!filter) throw new Error(`Efeito desconhecido: ${effect}`)

  const input = tmpFile('audio')
  const output = tmpFile('ogg')
  await fs.writeFile(input, buffer)
  try {
    await runFfmpeg(['-y', '-i', input, '-af', filter, '-c:a', 'libopus', '-b:a', '128k', output])
    return await fs.readFile(output)
  } finally {
    await fs.rm(input, { force: true })
    await fs.rm(output, { force: true })
  }
}

/**
 * Extrai/transcodifica o áudio de um vídeo (ou áudio) para MP3.
 */
async function toMp3 (buffer) {
  const input = tmpFile('media')
  const output = tmpFile('mp3')
  await fs.writeFile(input, buffer)
  try {
    await runFfmpeg(['-y', '-i', input, '-vn', '-c:a', 'libmp3lame', '-b:a', '128k', output])
    return await fs.readFile(output)
  } finally {
    await fs.rm(input, { force: true })
    await fs.rm(output, { force: true })
  }
}

/**
 * Converte qualquer áudio para OGG/Opus (formato de mensagem de voz).
 */
async function toOpus (buffer) {
  const input = tmpFile('audio')
  const output = tmpFile('ogg')
  await fs.writeFile(input, buffer)
  try {
    await runFfmpeg(['-y', '-i', input, '-c:a', 'libopus', '-b:a', '128k', output])
    return await fs.readFile(output)
  } finally {
    await fs.rm(input, { force: true })
    await fs.rm(output, { force: true })
  }
}

module.exports = { applyEffect, toMp3, toOpus, EFFECTS }
