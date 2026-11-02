'use strict'

const path = require('path')
const sharp = require('sharp')

/**
 * Figurinha animada de texto (/fig): o texto em fonte grossa com contorno
 * preto, trocando de cor em arco-íris a cada quadro. A fonte vem junto com
 * o bot (assets/fonts) porque o servidor não tem fontes instaladas.
 */

const FONT_FILE = path.resolve(__dirname, '..', '..', 'assets', 'fonts', 'LuckiestGuy-Regular.ttf')
const FONT = 'Luckiest Guy'
const SIZE = 512
const BOX = 440 // área do texto (sobra margem para o contorno)
const OUTLINE = 6 // espessura do contorno, em px
const FRAMES = 12
const DELAY_MS = 90
const MAX_BYTES = 480 * 1024

const escape = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/** Tira emojis: sem fonte de emoji no servidor eles viram quadradinhos. */
function clean (text) {
  return String(text || '')
    .replace(/[\p{Extended_Pictographic}‍️⃣]/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Texto numa cor, ajustado para caber em BOX×BOX (o pango escolhe o tamanho). */
async function renderText (text, color) {
  const { data, info } = await sharp({
    text: {
      text: `<span foreground="${color}">${escape(text)}</span>`,
      font: FONT,
      fontfile: FONT_FILE,
      width: BOX,
      height: BOX,
      align: 'centre',
      wrap: 'word',
      rgba: true
    }
  }).png().toBuffer({ resolveWithObject: true })
  return { data, width: info.width, height: info.height }
}

function hslToHex (h, s, l) {
  s /= 100; l /= 100
  const k = n => (n + h / 30) % 12
  const a = s * Math.min(l, 1 - l)
  const f = n => Math.round(255 * (l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))))
  return `#${[f(0), f(8), f(4)].map(x => x.toString(16).padStart(2, '0')).join('')}`
}

/** WebP animado 512×512 com o texto. Lança erro se não sobrar texto. */
async function textSticker (input) {
  const text = clean(input)
  if (!text) throw new Error('Texto vazio.')

  // Contorno: o texto em preto carimbado em volta (8 direções).
  const black = await renderText(text, '#000000')
  const left = Math.round((SIZE - black.width) / 2)
  const top = Math.round((SIZE - black.height) / 2)
  const outline = []
  for (const dx of [-OUTLINE, 0, OUTLINE]) {
    for (const dy of [-OUTLINE, 0, OUTLINE]) {
      if (dx || dy) outline.push({ input: black.data, left: left + dx, top: top + dy })
    }
  }

  const frames = []
  for (let i = 0; i < FRAMES; i++) {
    const color = hslToHex((i * 360) / FRAMES, 100, 55) // volta inteira no arco-íris
    const fill = await renderText(text, color)
    frames.push(await sharp({
      create: { width: SIZE, height: SIZE, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } }
    }).composite([...outline, { input: fill.data, left, top }]).png().toBuffer())
  }

  // O WhatsApp recusa figurinha animada acima de ~500 KB: comprime mais se precisar.
  const encode = quality => sharp(frames, { join: { animated: true } })
    .webp({ quality, loop: 0, delay: Array(FRAMES).fill(DELAY_MS) })
    .toBuffer()
  const webp = await encode(80)
  return webp.length > MAX_BYTES ? encode(50) : webp
}

module.exports = { textSticker, clean }
