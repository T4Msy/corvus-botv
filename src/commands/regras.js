'use strict'

const { store } = require('../lib/store')
const { emoji } = require('../ui/theme')

const info = store('info')

module.exports = {
  name: 'regras',
  aliases: ['rules', 'normas'],
  category: 'Geral',
  desc: 'Exibe as regras da Masayoshi.',
  async run ({ args, isOwner, reply, config }) {
    const sub = args[0]?.toLowerCase()

    if (sub === 'set') {
      if (!isOwner) { await reply(`${emoji.lock} Comando restrito ao dono.`); return }
      const texto = args.slice(1).join(' ')
      if (!texto) {
        await reply(`${emoji.feather} Use: *${config.prefix}regras set <texto>* (use | para quebrar linha).`)
        return
      }
      info.set('regras', texto.replace(/\s*\|\s*/g, '\n'))
      await reply(`${emoji.check} Regras atualizadas.`)
      return
    }

    if (sub === 'clear') {
      if (!isOwner) { await reply(`${emoji.lock} Comando restrito ao dono.`); return }
      info.delete('regras')
      await reply(`${emoji.check} Regras removidas.`)
      return
    }

    const regras = info.get('regras', null)
    if (!regras) {
      await reply(`${emoji.feather} Nenhuma regra configurada.\nDono: *${config.prefix}regras set <texto>*`)
      return
    }
    await reply(`${emoji.raven} *Regras da Masayoshi*\n\n${regras}`)
  }
}
