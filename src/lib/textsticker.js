'use strict'

const path = require('path')
const sharp = require('sharp')

/**
 * Figurinha animada de texto (/fig attp): fundo preto arredondado, texto na
 * fonte Cinzel ondulando como bandeira (cada coluna de pixels sobe e desce
 * numa onda) e as cores do arco-íris correndo pelas letras. A fonte vem junto
 * com o bot (assets/fonts) porque o servidor não tem fontes instaladas.
 */

const FONT_FILE = path.resolve(__dirname, '..', '..', 'assets', 'fonts', 'Cinzel.ttf')
const FONT = 'Cinzel Bold'
const SIZE = 512
const RADIUS = 72 // cantos do fundo preto
const BOX = 400 // área do texto (sobra margem para a onda)
const FRAMES = 16
const DELAY_MS = 70
const WAVE_PX = 12 // altura da onda
const WAVE_LEN = 220 // largura de uma onda, em px
const MAX_BYTES = 480 * 1024 // o WhatsApp recusa figurinha animada acima de ~500 KB

const escape = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/** Tira emojis: sem fonte de emoji no servidor eles viram quadradinhos. */
function clean (text) {
  return String(text || '')
    .replace(/[\p{Extended_Pictographic}‍️⃣]/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function hslToRgb (h, s, l) {
  s /= 100; l /= 100
  const k = n => (n + h / 30) % 12
  const a = s * Math.min(l, 1 - l)
  const f = n => Math.round(255 * (l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))))
  return [f(0), f(8), f(4)]
}

/** Texto em branco (só a forma), ajustado para caber em BOX×BOX. */
async function renderMask (text) {
  const { data, info } = await sharp({
    text: {
      text: `<span foreground="white">${escape(text)}</span>`,
      font: FONT,
      fontfile: FONT_FILE,
      width: BOX,
      height: BOX,
      align: 'centre',
      wrap: 'word',
      rgba: true
    }
  }).raw().toBuffer({ resolveWithObject: true })
  return { data, width: info.width, height: info.height }
}

/** Fundo preto com cantos arredondados (RGBA cru, SIZE×SIZE). */
async function background () {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}">` +
    `<rect width="${SIZE}" height="${SIZE}" rx="${RADIUS}" fill="#000"/></svg>`
  return sharp(Buffer.from(svg)).ensureAlpha().raw().toBuffer()
}

/** Quadro f: cada coluna deslocada na onda e pintada com a cor da sua posição. */
function frame (bg, mask, f) {
  const out = Buffer.from(bg)
  const left = Math.round((SIZE - mask.width) / 2)
  const top = Math.round((SIZE - mask.height) / 2)
  const phase = (2 * Math.PI * f) / FRAMES
  for (let x = 0; x < mask.width; x++) {
    const X = left + x
    const dy = Math.round(WAVE_PX * Math.sin((2 * Math.PI * X) / WAVE_LEN - phase))
    const [r, g, b] = hslToRgb(((X / SIZE) * 360 + (f * 360) / FRAMES) % 360, 100, 62)
    for (let y = 0; y < mask.height; y++) {
      const a = mask.data[(y * mask.width + x) * 4 + 3]
      if (!a) continue
      const Y = top + y + dy
      if (Y < 0 || Y >= SIZE) continue
      const o = (Y * SIZE + X) * 4
      const t = a / 255 // mistura com o preto do fundo (bordas suaves)
      out[o] = Math.round(r * t + out[o] * (1 - t))
      out[o + 1] = Math.round(g * t + out[o + 1] * (1 - t))
      out[o + 2] = Math.round(b * t + out[o + 2] * (1 - t))
    }
  }
  return out
}

/** WebP animado 512×512 com o texto. Lança erro se não sobrar texto. */
async function textSticker (input) {
  const text = clean(input)
  if (!text) throw new Error('Texto vazio.')

  const [bg, mask] = await Promise.all([background(), renderMask(text)])
  const raw = { width: SIZE, height: SIZE, channels: 4 }
  const frames = await Promise.all(
    Array.from({ length: FRAMES }, (_, f) => sharp(frame(bg, mask, f), { raw }).png().toBuffer())
  )

  // Lossless: a compressão com perda borrava as cores no fundo preto e deixava
  // risquinhos entre os quadros. Se passar do limite do WhatsApp, cai para
  // quase-sem-perda e, por último, com perda.
  const encode = opts => sharp(frames, { join: { animated: true } })
    .webp({ ...opts, loop: 0, delay: Array(FRAMES).fill(DELAY_MS) })
    .toBuffer()
  for (const opts of [{ lossless: true }, { nearLossless: true, quality: 60 }]) {
    const webp = await encode(opts)
    if (webp.length <= MAX_BYTES) return webp
  }
  return encode({ quality: 80, smartSubsample: true })
}

module.exports = { textSticker, clean, _test: { frame, background, renderMask, FRAMES, DELAY_MS } }
