'use strict'

const { profileByPhone } = require('../lib/portal')
const { emoji, header } = require('../ui/theme')

// Os donos são os números de config.owner (OWNER_NUMBERS no .env); o nome
// vem do Portal MSY (primeiro nome). Sem portal, cai no apelido do settings.json.
const juntar = nomes => nomes.length > 1 ? `${nomes.slice(0, -1).join(', ')} e ${nomes.at(-1)}` : nomes[0]

module.exports = {
  name: 'dono',
  aliases: ['owner', 'criador', 'donos'],
  desc: 'Mostra quem são os fundadores do Corvus.',
  async run ({ reply, config }) {
    const perfis = await Promise.all(
      config.owner.numbers.map(n => profileByPhone(n, 'name').catch(() => null))
    )
    const nomes = perfis.filter(Boolean).map(p => p.name.split(/\s+/)[0])
    const donos = nomes.length ? juntar(nomes) : config.owner.nick

    await reply(
      `${header(`Donos do ${config.botName}`)}\n\n` +
      `${emoji.crown} ${donos} — Meus Fundadores\n\n` +
      `${emoji.raven} ${config.botName}, o bot da Masayoshi ${emoji.wine}`
    )
  }
}
