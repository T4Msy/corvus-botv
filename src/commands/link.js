'use strict'

const { emoji } = require('../ui/theme')

module.exports = {
  name: 'link',
  aliases: ['linkgp'],
  groupOnly: true,
  adminOnly: true,
  botAdmin: true,
  desc: 'Mostra o link de convite do grupo.',
  async run ({ sock, from, reply }) {
    const code = await sock.groupInviteCode(from)
    await reply(`${emoji.feather} Link do grupo:\nhttps://chat.whatsapp.com/${code}`)
  }
}
