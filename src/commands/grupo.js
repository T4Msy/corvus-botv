'use strict'

const { emoji } = require('../ui/theme')

module.exports = {
  name: 'grupo',
  aliases: ['group'],
  groupOnly: true,
  adminOnly: true,
  botAdmin: true,
  desc: 'Abre ou fecha o grupo: !grupo abrir | fechar.',
  async run ({ sock, from, args, reply, config }) {
    const opt = (args[0] || '').toLowerCase()
    if (opt === 'fechar') {
      await sock.groupSettingUpdate(from, 'announcement')
      await reply(`${emoji.lock} Grupo fechado — apenas administradores podem enviar mensagens.`)
    } else if (opt === 'abrir') {
      await sock.groupSettingUpdate(from, 'not_announcement')
      await reply(`${emoji.raven} Grupo aberto — todos podem enviar mensagens.`)
    } else {
      await reply(`Use *${config.prefix}grupo abrir* ou *${config.prefix}grupo fechar*.`)
    }
  }
}
