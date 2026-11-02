'use strict'

const sharp = require('sharp')
const supabase = require('../lib/supabase')
const { profileOf } = require('../lib/portal')
const { insigniasOf } = require('../lib/insignias')
const { getTargets } = require('../lib/group')
const { getBuffer } = require('../lib/fetch')
const { emoji, header, error } = require('../ui/theme')

const TOP = 5 // insígnias "mais importantes" mostradas

function fmtDate (date) {
  const [y, m, d] = String(date || '').slice(0, 10).split('-')
  return d ? `${d}/${m}/${y}` : null
}

module.exports = {
  name: 'perfil',
  aliases: ['profile', 'eu'],
  category: 'Geral',
  fetchMeta: true,
  cooldown: 10,
  desc: 'Seu perfil do Portal MSY (ou de alguém: perfil @fulano): foto, insígnias e ICM.',
  async run ({ sock, from, msg, sender, groupMetadata, reply }) {
    if (!supabase.enabled()) { await reply(error('O portal não está conectado ao bot.')); return }

    const target = getTargets(msg)[0]
    const { phone, profile } = await profileOf({
      msg, sender, groupMetadata, jid: target, select: 'id,name,role,tier,avatar_url,join_date,icm,selected_badges'
    })
    if (!phone) { await reply(error('Não consegui identificar o número dessa pessoa.')); return }
    if (!profile) {
      await reply(error(target
        ? 'Essa pessoa não tem o WhatsApp cadastrado no Portal MSY.'
        : 'Seu WhatsApp não está cadastrado no Portal MSY. Cadastre em *Meu Perfil* no portal.'))
      return
    }

    const insignias = await insigniasOf(profile)
    const lines = [header(profile.name), '']
    if (profile.role) lines.push(`${emoji.crown} ${profile.role}${profile.tier === 'diretoria' ? ' · Diretoria' : ''}`)
    if (fmtDate(profile.join_date)) lines.push(`${emoji.wine} Na Masayoshi desde ${fmtDate(profile.join_date)}`)

    const icm = profile.icm
    lines.push('')
    if (icm?.score) {
      lines.push(`🧠 *ICM: ${icm.score}*${icm.classificacao ? ` — ${icm.classificacao}` : ''}`)
      const espectros = [icm.dominante, icm.secundario].filter(Boolean).map(s => s.charAt(0) + s.slice(1).toLowerCase())
      if (espectros.length) lines.push(`${emoji.bullet} Espectro: ${[...new Set(espectros)].join(' / ')}`)
    } else {
      lines.push('🧠 *ICM:* ainda não fez o teste')
    }

    // Total conta as repetidas (Destaque Semanal 30× = 30), como no portal.
    const count = b => b.vezes || 1
    const total = insignias.reduce((sum, b) => sum + count(b), 0)
    const top = insignias.slice(0, TOP)
    lines.push('', `🏅 *Insígnias: ${total}*`)
    for (const b of top) {
      lines.push(`${b.icon} ${b.label}${b.vezes > 1 ? ` (${b.vezes}×)` : ''}`)
    }
    // O que sobra também conta as repetidas, para fechar com o total.
    const resto = total - top.reduce((sum, b) => sum + count(b), 0)
    if (resto > 0) lines.push(`_+${resto} no portal_`)
    lines.push('', `${emoji.feather} portalmsy.site/perfil.html`)

    const caption = lines.join('\n')
    const mentions = target ? [target] : []

    // Foto de perfil do portal (webp) → jpeg; sem foto, vai só o texto.
    let image = null
    if (profile.avatar_url) {
      try {
        image = await sharp(await getBuffer(profile.avatar_url)).resize(640, 640, { fit: 'cover' }).jpeg({ quality: 85 }).toBuffer()
      } catch (err) {
        console.error('[perfil] foto:', err.message)
      }
    }
    await sock.sendMessage(from, image ? { image, caption, mentions } : { text: caption, mentions }, { quoted: msg })
  }
}
