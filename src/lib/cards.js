'use strict'

const path = require('path')
const sharp = require('sharp')
const { getBuffer } = require('./fetch')

/**
 * Artes em imagem no estilo Masayoshi (preto, vinho e dourado, fonte Cinzel).
 * Os textos são desenhados com a fonte do projeto (assets/fonts): o servidor
 * não tem fontes instaladas, então nada de <text> em SVG aqui.
 */

const FONT_FILE = path.resolve(__dirname, '..', '..', 'assets', 'fonts', 'Cinzel.ttf')
const GOLD = '#d4af37'
const W = 1080
const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']

const escape = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/** Texto numa camada PNG: cabe em width×height (o pango escolhe o tamanho). */
async function textLayer (text, { color, font = 'Cinzel Bold', width, height, spacing = 0 }) {
  const markup = `<span foreground="${color}"${spacing ? ` letter_spacing="${spacing * 1024}"` : ''}>${escape(text)}</span>`
  const { data, info } = await sharp({
    text: { text: markup, font, fontfile: FONT_FILE, width, height, align: 'centre', rgba: true }
  }).png().toBuffer({ resolveWithObject: true })
  return { input: data, width: info.width, height: info.height }
}

/** Centraliza uma camada na horizontal, com o centro vertical em `cy`. */
const centered = (layer, cy) => ({ input: layer.input, left: Math.round((W - layer.width) / 2), top: Math.round(cy - layer.height / 2) })

/** Foto redonda (ou iniciais num círculo da cor do membro, se não tiver foto). */
async function avatar ({ avatarUrl, initials, color }, size) {
  const circle = Buffer.from(`<svg width="${size}" height="${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}"/></svg>`)
  if (avatarUrl) {
    try {
      return await sharp(await getBuffer(avatarUrl))
        .resize(size, size, { fit: 'cover' })
        .composite([{ input: circle, blend: 'dest-in' }])
        .png().toBuffer()
    } catch (err) {
      console.error('[cards] foto:', err.message)
    }
  }
  const bg = Buffer.from(`<svg width="${size}" height="${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}" fill="${color || '#7f1d1d'}"/></svg>`)
  const ini = await textLayer(initials || '?', { color: '#ffffff', width: size * 0.6, height: size * 0.4 })
  return sharp(bg).composite([{ input: ini.input, left: Math.round((size - ini.width) / 2), top: Math.round((size - ini.height) / 2) }]).png().toBuffer()
}

/**
 * Card de aniversário 1080×1080 (JPEG): "FELIZ ANIVERSÁRIO", foto redonda
 * com aro dourado, nome, data e "MASAYOSHI" no rodapé.
 */
async function birthdayCard ({ name, avatarUrl, initials, color, date = new Date() }) {
  const AV = 440
  const AV_CY = 520
  const br = new Date(date.getTime() - 3 * 3600e3)
  const dia = `${br.getUTCDate()} de ${MESES[br.getUTCMonth()]}`

  const bg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${W}">
    <defs>
      <radialGradient id="g" cx="50%" cy="45%" r="70%">
        <stop offset="0%" stop-color="#3a0d14"/><stop offset="55%" stop-color="#14060a"/><stop offset="100%" stop-color="#000"/>
      </radialGradient>
      <linearGradient id="gold" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#f5e08e"/><stop offset="50%" stop-color="${GOLD}"/><stop offset="100%" stop-color="#8a6d1f"/>
      </linearGradient>
    </defs>
    <rect width="${W}" height="${W}" fill="url(#g)"/>
    <rect x="36" y="36" width="${W - 72}" height="${W - 72}" rx="28" fill="none" stroke="${GOLD}" stroke-width="3" opacity=".85"/>
    <rect x="52" y="52" width="${W - 104}" height="${W - 104}" rx="20" fill="none" stroke="${GOLD}" stroke-width="1" opacity=".45"/>
    <circle cx="${W / 2}" cy="${AV_CY}" r="${AV / 2 + 14}" fill="none" stroke="url(#gold)" stroke-width="10"/>
    <circle cx="${W / 2}" cy="${AV_CY}" r="${AV / 2 + 30}" fill="none" stroke="${GOLD}" stroke-width="1.5" opacity=".5"/>
    <line x1="${W / 2 - 220}" y1="232" x2="${W / 2 - 40}" y2="232" stroke="${GOLD}" stroke-width="2" opacity=".7"/>
    <line x1="${W / 2 + 40}" y1="232" x2="${W / 2 + 220}" y2="232" stroke="${GOLD}" stroke-width="2" opacity=".7"/>
    <path d="M${W / 2} 220 l12 12 l-12 12 l-12 -12 z" fill="${GOLD}"/>
    <line x1="${W / 2 - 160}" y1="968" x2="${W / 2 + 160}" y2="968" stroke="${GOLD}" stroke-width="1" opacity=".5"/>
  </svg>`)

  const [titulo, nome, data, rodape, foto] = await Promise.all([
    textLayer('FELIZ ANIVERSÁRIO', { color: GOLD, width: 860, height: 92 }),
    textLayer(name, { color: '#ffffff', width: 820, height: 72 }),
    textLayer(dia, { color: GOLD, font: 'Cinzel', width: 480, height: 38 }),
    textLayer('MASAYOSHI', { color: GOLD, width: 260, height: 28, spacing: 8 }),
    avatar({ avatarUrl, initials, color }, AV)
  ])

  return sharp(bg).composite([
    centered(titulo, 150),
    { input: foto, left: Math.round((W - AV) / 2), top: AV_CY - AV / 2 },
    centered(nome, 838),
    centered(data, 912),
    centered(rodape, 1000)
  ]).jpeg({ quality: 90 }).toBuffer()
}

module.exports = { birthdayCard }
