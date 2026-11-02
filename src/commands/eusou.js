'use strict'

const { jidNormalizedUser } = require('@whiskeysockets/baileys')
const { setGenero } = require('../lib/bomdia')
const { emoji } = require('../ui/theme')

const OPCOES = { ela: 'ela', ele: 'ele', neutro: null }

module.exports = {
  name: 'eusou',
  aliases: ['souela', 'souele'],
  category: 'Geral',
  desc: 'Como o Corvus te chama no bom dia: eusou ela | ele | neutro.',
  async run ({ msg, sender, args, reply, config }) {
    // /souela e /souele já dizem a opção no próprio nome.
    const used = (msg.message?.conversation || msg.message?.extendedTextMessage?.text || '')
      .slice(config.prefix.length).trim().split(/\s+/)[0].toLowerCase()
    const escolha = used === 'souela' ? 'ela' : used === 'souele' ? 'ele' : (args[0] || '').toLowerCase()

    if (!(escolha in OPCOES)) {
      await reply(
        `${emoji.feather} Diga como o ${config.botName} te chama no bom dia:\n` +
        `${emoji.bullet} *${config.prefix}eusou ela*\n` +
        `${emoji.bullet} *${config.prefix}eusou ele*\n` +
        `${emoji.bullet} *${config.prefix}eusou neutro*`
      )
      return
    }

    const ids = [sender, msg.key.participantPn].filter(Boolean).map(jidNormalizedUser)
    setGenero(ids, OPCOES[escolha])
    const exemplo = { ela: 'Bom dia, linda! ☀️', ele: 'Bom dia, irmão! Suave? 🤜🤛', neutro: 'Bom dia! ☀️' }[escolha]
    await reply(`${emoji.check} Anotado! Seu bom dia vai ser tipo: _${exemplo}_`)
  }
}
