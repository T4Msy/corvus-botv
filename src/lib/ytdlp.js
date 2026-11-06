'use strict'

const os = require('os')
const { existsSync } = require('fs')
const fs = require('fs/promises')
const path = require('path')
const crypto = require('crypto')
const ytdl = require('youtube-dl-exec')
const ffmpegPath = require('ffmpeg-static')

const TMP = os.tmpdir()
const FFMPEG_DIR = path.dirname(ffmpegPath)

// Cookies (formato Netscape) de uma conta secundária do Instagram, que bloqueia
// o acesso anônimo vindo do IP do servidor. Fica em data/, fora do git.
const IG_COOKIES = process.env.IG_COOKIES_FILE ||
  path.resolve(__dirname, '..', '..', 'data', 'instagram-cookies.txt')

function tmpFile (ext) {
  return path.join(TMP, `corvus-${crypto.randomBytes(6).toString('hex')}.${ext}`)
}

function isUrl (s) {
  return /^https?:\/\//i.test(s)
}

function isInstagram (s) {
  return /instagram\.com/i.test(s)
}

function isTikTok (s) {
  return /tiktok\.com/i.test(s)
}

/** Só o Instagram recebe os cookies, e só se o arquivo existir. */
function cookieOpts (url) {
  return isInstagram(url) && existsSync(IG_COOKIES) ? { cookies: IG_COOKIES } : {}
}

/** Obtém metadados (título, duração, url) de um link ou busca no YouTube. */
async function getInfo (query) {
  const input = isUrl(query) ? query : `ytsearch1:${query}`
  const info = await ytdl(input, {
    dumpSingleJson: true,
    noPlaylist: true,
    noWarnings: true,
    ...cookieOpts(input)
  })
  const entry = info.entries ? info.entries[0] : info
  if (!entry) throw new Error('Nada encontrado.')
  return {
    url: entry.webpage_url || entry.original_url || input,
    title: entry.title || 'mídia',
    duration: entry.duration || 0
  }
}

/**
 * Baixa o vídeo (mp4, até 480p/64MB). Quando o yt-dlp é bloqueado, o TikTok
 * cai no tikwm.com; o Instagram lança um erro com code 'IG_BLOCKED'.
 */
async function downloadVideo (query, { maxDuration = 900 } = {}) {
  const ig = isUrl(query) && isInstagram(query)
  const tt = isUrl(query) && isTikTok(query)

  try {
    const { url, title, duration } = await getInfo(query)
    if (duration && duration > maxDuration) throw new Error('Vídeo muito longo.')
    const file = tmpFile('mp4')
    await ytdl(url, {
      output: file,
      format: 'best[height<=480][ext=mp4]/best[ext=mp4]/best',
      noPlaylist: true,
      maxFilesize: '64M',
      noWarnings: true,
      ffmpegLocation: FFMPEG_DIR,
      ...cookieOpts(url)
    })
    return { file, title }
  } catch (err) {
    if (tt) {
      const { downloadFromTikwm } = require('./tikwm')
      return downloadFromTikwm(query)
    }
    if (ig && /login|cookies|rate-limit/i.test(err.message)) {
      console.error('[instagram] bloqueado:', err.message)
      throw Object.assign(new Error('Instagram bloqueou o download'), { code: 'IG_BLOCKED' })
    }
    throw err
  }
}

/** Remove um arquivo temporário, ignorando erros. */
async function cleanup (file) {
  if (file) await fs.rm(file, { force: true })
}

module.exports = { downloadVideo, cleanup }
