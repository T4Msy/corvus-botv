'use strict'

const { profileByPhone } = require('../lib/portal')
const { emoji, header } = require('../ui/theme')

// Os donos são os números de config.owner (OWNER_NUMBERS no .env); nome e
// cargo vêm do Portal MSY. Sem portal, cai no apelido do settings.json.
module.exports = {
  name: 'dono',
  aliases: ['owner', 'criador', 'donos'],
  desc: 'Mostra quem são os donos do Corvus.',
  async run ({ reply, config }) {
    const perfis = await Promise.all(
      config.owner.numbers.map(n => profileByPhone(n, 'name,role').catch(() => null))
    )
    const donos = perfis.filter(Boolean)
    const linhas = donos.length
      ? donos.map(p => `${emoji.crown} *${p.name}*${p.role ? ` — ${p.role}` : ''}`)
      : [`${emoji.crown} *${config.owner.nick}*`]

    await reply(
      `${header(`Donos do ${config.botName}`)}\n\n${linhas.join('\n')}\n\n` +
      `${emoji.raven} ${config.botName}, o bot da Masayoshi ${emoji.wine}`
    )
  }
}
