'use strict'

const { jidNormalizedUser } = require('@whiskeysockets/baileys')
const leveling = require('../lib/leveling')
const { h2k } = require('../lib/text')
const { header, info } = require('../ui/theme')

const MEDALS = ['🥇', '🥈', '🥉']

module.exports = {
  name: 'rank',
  aliases: ['ranking', 'top'],
  groupOnly: true,
  fetchMeta: true,
  desc: 'Ranking dos membros do grupo com mais XP.',
  async run ({ sock, from, msg, groupMetadata }) {
    // O XP é global; mostra só quem está neste grupo, para não expor
    // membros de outros grupos.
    const members = new Set()
    for (const p of groupMetadata?.participants || []) {
      for (const v of [p.id, p.jid, p.phoneNumber]) {
        if (v) members.add(jidNormalizedUser(v))
      }
    }
    const top = leveling.top(10, (id) => members.has(jidNormalizedUser(id)))
    if (!top.length) {
      await sock.sendMessage(from, { text: info('Ainda não há XP registrado.') }, { quoted: msg })
      return
    }

    const lines = top.map((u, i) => {
      const pos = MEDALS[i] || `${i + 1}.`
      return `${pos} @${u.id.split('@')[0]} — nível ${u.level} (${h2k(u.xp)} XP)`
    })

    await sock.sendMessage(
      from,
      {
        text: `${header('Ranking de XP')}\n\n${lines.join('\n')}`,
        mentions: top.map((u) => u.id)
      },
      { quoted: msg }
    )
  }
}
