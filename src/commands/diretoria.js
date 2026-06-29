'use strict'

const { store } = require('../lib/store')
const { emoji } = require('../ui/theme')

const info = store('info')

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
      info.set('diretoria', texto.replace(/\s*\|\s*/g, '\n'))
      await reply(`${emoji.check} Diretoria atualizada.`)
      return
    }

    if (sub === 'clear') {
      if (!isOwner) { await reply(`${emoji.lock} Comando restrito ao dono.`); return }
      info.delete('diretoria')
      await reply(`${emoji.check} Diretoria removida.`)
      return
    }

    const diretoria = info.get('diretoria', null)
    if (!diretoria) {
      await reply(`${emoji.feather} Diretoria não configurada.\nDono: *${config.prefix}diretoria set <texto>*`)
      return
    }
    await reply(`${emoji.crown} *Diretoria da Masayoshi*\n\n${diretoria}`)
  }
}
