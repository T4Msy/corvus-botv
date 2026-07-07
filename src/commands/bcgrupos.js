'use strict'

const { header, error, success } = require('../ui/theme')

const DELAY_MS = 500

function sleep (ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

module.exports = {
  name: 'bcgrupos',
  aliases: ['broadcast', 'bc'],
  ownerOnly: true,
  cooldown: 60,
  desc: 'Envia um comunicado para todos os grupos: bcgrupos <mensagem>.',
  async run ({ sock, text, reply, config }) {
    if (!text) {
      await reply(error(`Use *${config.prefix}bcgrupos <mensagem>*.`))
      return
    }

    const groups = Object.keys(await sock.groupFetchAllParticipating())
    if (!groups.length) {
      await reply(error('Não estou em nenhum grupo.'))
      return
    }

    const content = `${header('Comunicado')}\n${text}`
    let sent = 0
    for (const jid of groups) {
      try {
        await sock.sendMessage(jid, { text: content })
        sent++
      } catch (err) {
        console.error(`[bcgrupos] falha em ${jid}:`, err.message)
      }
      await sleep(DELAY_MS)
    }

    await reply(success(`Comunicado enviado para ${sent}/${groups.length} grupo(s).`))
  }
}
