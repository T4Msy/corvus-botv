'use strict'

const { onlyMembers } = require('../lib/access')
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
  desc: 'Envia um comunicado para os grupos só com gente da Masayoshi: bcgrupos <mensagem>.',
  async run ({ sock, text, reply, config }) {
    if (!text) {
      await reply(error(`Use *${config.prefix}bcgrupos <mensagem>*.`))
      return
    }

    const all = Object.values(await sock.groupFetchAllParticipating())
    if (!all.length) {
      await reply(error('Não estou em nenhum grupo.'))
      return
    }

    // Comunicado é coisa da Masayoshi: grupo com gente de fora não recebe.
    const groups = []
    for (const meta of all) {
      if (await onlyMembers(sock, meta)) groups.push(meta.id)
    }
    if (!groups.length) {
      await reply(error('Nenhum grupo tem só gente da Masayoshi.'))
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

    const skipped = all.length - groups.length
    await reply(success(
      `Comunicado enviado para ${sent}/${groups.length} grupo(s).` +
      (skipped ? ` ${skipped} com gente de fora não receberam.` : '')
    ))
  }
}
