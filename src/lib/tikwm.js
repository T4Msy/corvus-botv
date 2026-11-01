'use strict'

const os = require('os')
const path = require('path')
const crypto = require('crypto')
const fs = require('fs/promises')
const { fetchJson, getBuffer } = require('./fetch')

const TMP = os.tmpdir()
const API = 'https://www.tikwm.com/api/'
const MAX_BYTES = 64 * 1024 * 1024

function tmpFile (ext) {
  return path.join(TMP, `corvus-${crypto.randomBytes(6).toString('hex')}.${ext}`)
}

/**
 * Baixa um vídeo do TikTok (sem marca d'água) via tikwm.com — fallback
 * para quando o TikTok bloqueia o yt-dlp (acontece em IPs de datacenter).
 * Retorna { file, title }.
 */
async function downloadFromTikwm (url) {
  const res = await fetchJson(`${API}?url=${encodeURIComponent(url)}`, { timeout: 20000 })
  if (res?.code !== 0 || !res.data) throw new Error(`tikwm: ${res?.msg || 'sem resposta'}`)

  const { play, size, title } = res.data
  if (!play) throw new Error('Esse TikTok não tem vídeo (é post de fotos).')
  if (size && size > MAX_BYTES) throw new Error('Vídeo muito grande.')

  const file = tmpFile('mp4')
  await fs.writeFile(file, await getBuffer(play, { timeout: 90000, maxContentLength: MAX_BYTES }))
  return { file, title: title || 'TikTok' }
}

module.exports = { downloadFromTikwm }
