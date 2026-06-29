'use strict'

const os = require('os')
const fs = require('fs/promises')
const path = require('path')
const crypto = require('crypto')
const ytdl = require('youtube-dl-exec')
const ffmpegPath = require('ffmpeg-static')

const TMP = os.tmpdir()
// Diretório do ffmpeg empacotado (yt-dlp usa para pós-processar áudio).
const FFMPEG_DIR = path.dirname(ffmpegPath)

function tmpFile (ext) {
  return path.join(TMP, `corvus-${crypto.randomBytes(6).toString('hex')}.${ext}`)
}

function isUrl (s) {
  return /^https?:\/\//i.test(s)
}

/** Obtém metadados (título, duração, url) de um link ou busca no YouTube. */
async function getInfo (query) {
  const input = isUrl(query) ? query : `ytsearch1:${query}`
  const info = await ytdl(input, {
    dumpSingleJson: true,
    noPlaylist: true,
    noWarnings: true
  })
  const entry = info.entries ? info.entries[0] : info
  if (!entry) throw new Error('Nada encontrado.')
  return {
    url: entry.webpage_url || entry.original_url || input,
    title: entry.title || 'mídia',
    duration: entry.duration || 0
  }
}

/** Baixa o áudio (mp3). Retorna { file, title }. */
async function downloadAudio (query, { maxDuration = 2400 } = {}) {
  const { url, title, duration } = await getInfo(query)
  if (duration && duration > maxDuration) throw new Error('Áudio muito longo.')
  const file = tmpFile('mp3')
  await ytdl(url, {
    output: file,
    extractAudio: true,
    audioFormat: 'mp3',
    format: 'bestaudio/best',
    noPlaylist: true,
    maxFilesize: '16M',
    noWarnings: true,
    ffmpegLocation: FFMPEG_DIR
  })
  return { file, title }
}

/** Baixa o vídeo (mp4, até 480p/64MB). Retorna { file, title }. */
async function downloadVideo (query, { maxDuration = 900 } = {}) {
  const { url, title, duration } = await getInfo(query)
  if (duration && duration > maxDuration) throw new Error('Vídeo muito longo.')
  const file = tmpFile('mp4')
  await ytdl(url, {
    output: file,
    format: 'best[height<=480][ext=mp4]/best[ext=mp4]/best',
    noPlaylist: true,
    maxFilesize: '64M',
    noWarnings: true,
    ffmpegLocation: FFMPEG_DIR
  })
  return { file, title }
}

/** Remove um arquivo temporário, ignorando erros. */
async function cleanup (file) {
  if (file) await fs.rm(file, { force: true })
}

module.exports = { downloadAudio, downloadVideo, cleanup }
