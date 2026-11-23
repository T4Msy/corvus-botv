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
function cookieOpts (url, useCookies = true) {
  return useCookies && isInstagram(url) && existsSync(IG_COOKIES) ? { cookies: IG_COOKIES } : {}
}

/** Obtém metadados (título, duração, url) de um link ou busca no YouTube. */
async function getInfo (query, useCookies = true) {
  const input = isUrl(query) ? query : `ytsearch1:${query}`
  const info = await ytdl(input, {
    dumpSingleJson: true,
    noPlaylist: true,
    noWarnings: true,
    ...cookieOpts(input, useCookies)
  })
  const entry = info.entries ? info.entries[0] : info
  if (!entry) throw new Error('Nada encontrado.')
  return {
    url: entry.webpage_url || entry.original_url || input,
    title: entry.title || 'mídia',
    duration: entry.duration || 0
  }
}

async function fetchVideo (query, maxDuration, useCookies) {
  const { url, title, duration } = await getInfo(query, useCookies)
  if (duration && duration > maxDuration) throw new Error('Vídeo muito longo.')
  const file = tmpFile('mp4')
  await ytdl(url, {
    output: file,
    format: 'best[height<=480][ext=mp4]/best[ext=mp4]/best',
    noPlaylist: true,
    maxFilesize: '64M',
    noWarnings: true,
    ffmpegLocation: FFMPEG_DIR,
    ...cookieOpts(url, useCookies)
  })
  return { file, title }
}

/**
 * Baixa o vídeo (mp4, até 480p/64MB). Quando o yt-dlp é bloqueado, o TikTok
 * cai no tikwm.com; o Instagram lança um erro com code 'IG_BLOCKED'.
 * Quando a sessão dos cookies cai ou o Instagram limita o IP do servidor, ele
 * responde HTTP 400/401/403/429 a esmo; aí tentamos de novo sem cookies (vale
 * para posts públicos) e, se ainda falhar, uma última vez com cookies depois
 * de alguns segundos — esses bloqueios costumam ser passageiros.
 */
const IG_RETRY = /HTTP Error (400|401|403|429)|login|rate-limit/i
const IG_RETRY_DELAY_MS = 5000

async function downloadVideo (query, { maxDuration = 900 } = {}) {
  const ig = isUrl(query) && isInstagram(query)
  const tt = isUrl(query) && isTikTok(query)

  try {
    try {
      return await fetchVideo(query, maxDuration, true)
    } catch (err) {
      if (!(ig && IG_RETRY.test(err.message))) throw err
      console.error('[instagram] falhou, tentando sem cookies:', err.message.slice(0, 120))
      try {
        return await fetchVideo(query, maxDuration, false)
      } catch (err2) {
        if (!IG_RETRY.test(err2.message)) throw err2
        await new Promise(resolve => setTimeout(resolve, IG_RETRY_DELAY_MS))
        return await fetchVideo(query, maxDuration, true)
      }
    }
  } catch (err) {
    if (tt) {
      const { downloadFromTikwm } = require('./tikwm')
      return downloadFromTikwm(query)
    }
    if (ig && IG_RETRY.test(err.message)) {
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
