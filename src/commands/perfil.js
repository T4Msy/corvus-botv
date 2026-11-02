'use strict'

const sharp = require('sharp')
const { jidNormalizedUser } = require('@whiskeysockets/baileys')
const supabase = require('../lib/supabase')
const { insigniasOf } = require('../lib/insignias')
const { getTargets } = require('../lib/group')
const { getBuffer } = require('../lib/fetch')
const { emoji, header, error } = require('../ui/theme')

const TOP = 5 // insígnias "mais importantes" mostradas

/** Número de telefone (só dígitos) de um JID — @lid vira número pelos participantes do grupo. */
function phoneOf (jid, groupMetadata) {
  if (!jid) return null
  if (jid.endsWith('@s.whatsapp.net')) return jid.split('@')[0].split(':')[0]
  const norm = jidNormalizedUser(jid)
  const p = (groupMetadata?.participants || []).find(x => [x.id, x.lid, x.jid].filter(Boolean).map(jidNormalizedUser).includes(norm))
  const pn = p?.phoneNumber || (p?.jid?.endsWith('@s.whatsapp.net') ? p.jid : null)
  return pn ? pn.split('@')[0].split(':')[0] : null
}

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
  async run ({ sock, from, msg, sender, groupMetadata, config, reply }) {
    if (!supabase.enabled()) { await reply(error('O portal não está conectado ao bot.')); return }

    const target = getTargets(msg)[0]
    const phone = target ? phoneOf(target, groupMetadata) : phoneOf(msg.key.participantPn || sender, groupMetadata)
    if (!phone) { await reply(error('Não consegui identificar o número dessa pessoa.')); return }

    // O WhatsApp manda alguns números BR sem o 9 (5531 8441-…); o portal guarda com.
    const variants = config.phoneVariants(phone).filter(v => /^\d+$/.test(v))
    const rows = await supabase.select(
      `member_whatsapp?select=profiles(id,name,role,tier,avatar_url,join_date,icm,selected_badges)&whatsapp=in.(${variants.join(',')})`
    )
    const profile = rows[0]?.profiles
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
    const total = insignias.reduce((sum, b) => sum + (b.vezes || 1), 0)
    lines.push('', `🏅 *Insígnias: ${total}*${total !== insignias.length ? ` _(${insignias.length} diferentes)_` : ''}`)
    for (const b of insignias.slice(0, TOP)) {
      lines.push(`${b.icon} ${b.label}${b.vezes > 1 ? ` (${b.vezes}×)` : ''}`)
    }
    if (insignias.length > TOP) lines.push(`_+${insignias.length - TOP} diferentes no portal_`)
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
