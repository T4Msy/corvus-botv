'use strict'

const { groups } = require('../events/groupParticipants')
const { emoji, info } = require('../ui/theme')

/**
 * Liga/desliga o Corvus num grupo. Enquanto desativado, o bot ignora o
 * grupo por completo (comandos, XP/nível, contadores, antilink, boas-vindas).
 * Por isso estes dois comandos têm `bypassActive`: precisam rodar mesmo
 * com o grupo desativado.
 */
module.exports = [
  {
    name: 'corvusativar',
    groupOnly: true,
    ownerOnly: true,
    bypassActive: true,
    desc: 'Ativa o Corvus neste grupo (comandos, níveis, contadores...).',
    async run ({ from, reply, config }) {
      if (groups.get(from, {}).active) {
        await reply(info('O Corvus já está ativado neste grupo.'))
        return
      }
      await groups.update(from, (c) => ({ ...c, active: true }), {})
      await reply(
        `${emoji.check} *${config.botName}* ativado neste grupo.\n` +
        `Use *${config.prefix}menu* para ver os comandos.`
      )
    }
  },
  {
    name: 'corvusdesativar',
    groupOnly: true,
    ownerOnly: true,
    bypassActive: true,
    desc: 'Desativa o Corvus neste grupo (ele passa a ignorar o grupo).',
    async run ({ from, reply, config }) {
      if (!groups.get(from, {}).active) {
        await reply(info('O Corvus já está desativado neste grupo.'))
        return
      }
      await groups.update(from, (c) => ({ ...c, active: false }), {})
      await reply(
        `${emoji.cross} *${config.botName}* desativado neste grupo.\n` +
        `Use *${config.prefix}corvusativar* para reativar.`
      )
    }
  }
]
