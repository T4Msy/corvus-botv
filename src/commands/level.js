'use strict'

const leveling = require('../lib/leveling')
const { h2k } = require('../lib/text')
const { emoji, header } = require('../ui/theme')
const { store } = require('../lib/store')

const groups = store('groups')

module.exports = {
  name: 'level',
  aliases: ['nivel', 'xp'],
  groupOnly: true,
  desc: 'Mostra seu nível e XP.',
  async run ({ sock, from, sender, msg, isGroup }) {
    const s = leveling.stats(sender)
    await sock.sendMessage(
      from,
      {
        text:
          `${header(`Perfil de @${sender.split('@')[0]}`)}\n` +
          `${emoji.bullet} Nível: *${s.level}*\n` +
          `${emoji.bullet} XP: ${h2k(s.xp)}\n` +
          `${emoji.bullet} Faltam ${h2k(s.remaining)} XP para o nível ${s.level + 1}` +
          `\n${emoji.bullet} Corvus: *${groups.get(from, {}).active === true ? 'ativo' : 'inativo'}*`,
        mentions: [sender]
      },
      { quoted: msg }
    )
  }
}
