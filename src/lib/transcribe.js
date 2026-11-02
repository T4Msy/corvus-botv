'use strict'

/**
 * Transcrição de áudio com o Whisper large-v3 da Groq (cota grátis).
 * A chave fica só no .env do servidor: GROQ_API_KEY. O servidor da Oracle
 * não aguenta rodar um modelo bom localmente (1 GB de RAM).
 */

const API = 'https://api.groq.com/openai/v1/audio/transcriptions'
const MODEL = 'whisper-large-v3' // o mais preciso; o "turbo" erra mais em português
const MAX_BYTES = 25 * 1024 * 1024 // limite da Groq por arquivo

function enabled () {
  return Boolean(process.env.GROQ_API_KEY)
}

/**
 * Texto falado no áudio (Buffer). `mimetype` vem do WhatsApp (ex.:
 * "audio/ogg; codecs=opus"); o nome do arquivo só precisa da extensão certa.
 */
async function transcribe (buffer, mimetype = 'audio/ogg') {
  if (!enabled()) throw new Error('Transcrição desligada (falta GROQ_API_KEY no .env).')
  if (buffer.length > MAX_BYTES) throw new Error('Áudio grande demais para transcrever.')

  const type = String(mimetype).split(';')[0].trim() || 'audio/ogg'
  const ext = { 'audio/ogg': 'ogg', 'audio/mpeg': 'mp3', 'audio/mp4': 'm4a', 'video/mp4': 'mp4', 'audio/wav': 'wav', 'audio/webm': 'webm' }[type] || 'ogg'

  const form = new FormData()
  form.append('file', new Blob([buffer], { type }), `audio.${ext}`)
  form.append('model', MODEL)
  form.append('language', 'pt')
  form.append('response_format', 'json')
  form.append('temperature', '0')

  const res = await fetch(API, {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.GROQ_API_KEY}` },
    body: form,
    signal: AbortSignal.timeout(120000)
  })
  const body = await res.json().catch(() => ({}))
  if (res.status === 429) throw new Error('Limite grátis da transcrição atingido por agora. Tente daqui a pouco.')
  if (!res.ok) throw new Error(body?.error?.message || `Groq ${res.status}`)
  return String(body.text || '').trim()
}

module.exports = { enabled, transcribe }
