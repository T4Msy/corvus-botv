'use strict'

const leveling = require('../lib/leveling')
const { h2k } = require('../lib/text')
const { emoji } = require('../ui/theme')

module.exports = {
  name: 'level',
  aliases: ['nivel', 'xp'],
  desc: 'Mostra seu nível e XP.',
  async run ({ sock, from, sender, msg }) {
    const s = leveling.stats(sender)
    await sock.sendMessage(
      from,
      {
        text:
          `${emoji.crystal} *Perfil de @${sender.split('@')[0]}*\n` +
          `${emoji.bullet} Nível: *${s.level}*\n` +
          `${emoji.bullet} XP: ${h2k(s.xp)}\n` +
          `${emoji.bullet} Faltam ${h2k(s.remaining)} XP para o nível ${s.level + 1}`,
        mentions: [sender]
      },
      { quoted: msg }
    )
  }
}
