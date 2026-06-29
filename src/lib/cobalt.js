'use strict'

const os = require('os')
const path = require('path')
const crypto = require('crypto')
const fs = require('fs/promises')
const axios = require('axios')

const TMP = os.tmpdir()
const API = 'https://api.cobalt.tools/'

function tmpFile (ext) {
  return path.join(TMP, `corvus-${crypto.randomBytes(6).toString('hex')}.${ext}`)
}

/**
 * Tenta baixar mídia via cobalt.tools (fallback para plataformas que bloqueiam yt-dlp).
 * Retorna o caminho de um arquivo temporário com o vídeo.
 */
async function downloadFromCobalt (url) {
  const apiRes = await axios.post(API, { url, downloadMode: 'auto' }, {
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json'
    },
    timeout: 20000
  })

  const { status, url: mediaUrl, picker } = apiRes.data

  let finalUrl
  if (status === 'redirect' || status === 'tunnel') {
    finalUrl = mediaUrl
  } else if (status === 'picker' && picker?.length) {
    finalUrl = picker[0].url
  } else {
    const code = apiRes.data?.error?.code || status
    throw new Error(`cobalt.tools: ${code}`)
  }

  const ext = /\.(mp4|webm|mov|mkv|mp3|m4a)/i.exec(finalUrl)?.[1] || 'mp4'
  const file = tmpFile(ext)

  const stream = await axios.get(finalUrl, {
    responseType: 'arraybuffer',
    timeout: 90000,
    headers: { 'User-Agent': 'Mozilla/5.0' }
  })
  await fs.writeFile(file, Buffer.from(stream.data))
  return file
}

module.exports = { downloadFromCobalt }
