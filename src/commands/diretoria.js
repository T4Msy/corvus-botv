'use strict'

const { store } = require('../lib/store')
const { emoji, header, info, success } = require('../ui/theme')

const infoStore = store('info')

module.exports = {
  name: 'diretoria',
  aliases: ['diret', 'board'],
  category: 'Geral',
  desc: 'Exibe a Diretoria atual da Masayoshi.',
  async run ({ args, isOwner, reply, config }) {
    const sub = args[0]?.toLowerCase()

    if (sub === 'set') {
      if (!isOwner) { await reply(`${emoji.lock} Comando restrito ao dono.`); return }
      const texto = args.slice(1).join(' ')
      if (!texto) {
        await reply(`${emoji.feather} Use: *${config.prefix}diretoria set <texto>* (use | para quebrar linha).`)
        return
      }
      infoStore.set('diretoria', texto.replace(/\s*\|\s*/g, '\n'))
      await reply(success('Diretoria atualizada.'))
      return
    }

    if (sub === 'clear') {
      if (!isOwner) { await reply(`${emoji.lock} Comando restrito ao dono.`); return }
      infoStore.delete('diretoria')
      await reply(success('Diretoria removida.'))
      return
    }

    const diretoria = infoStore.get('diretoria', null)
    if (!diretoria) {
      await reply(info(`Diretoria não configurada.\nDono: *${config.prefix}diretoria set <texto>*`))
      return
    }
    await reply(`${header('Diretoria da Masayoshi')}\n\n${diretoria}`)
  }
}
