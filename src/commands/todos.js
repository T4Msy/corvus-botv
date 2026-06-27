'use strict'

const { emoji } = require('../ui/theme')

module.exports = {
  name: 'todos',
  aliases: ['marcar', 'hidetag', 'all'],
  groupOnly: true,
  adminOnly: true,
  desc: 'Marca todos os membros (com texto opcional).',
  async run ({ sock, from, text, groupMetadata }) {
    const members = (groupMetadata.participants || []).map((p) => p.id)
    const body = text || `${emoji.raven} Atenção, pessoal!`
    await sock.sendMessage(from, { text: body, mentions: members })
  }
}
