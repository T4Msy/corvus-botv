'use strict'

const { header } = require('../ui/theme')

const DIRETORIA = [
  'Tales: Fundador/Dono.',
  'Xitter: Coordenador Geral.',
  'Naíra: Diretora de Gestão interna.',
  'Mariana: Diretora de Marketing.'
].join('\n')

module.exports = {
  name: 'diretoria',
  aliases: ['diret', 'board'],
  category: 'Geral',
  desc: 'Exibe a Diretoria atual da Masayoshi.',
  async run ({ reply }) {
    await reply(`${header('Diretoria da Masayoshi')}\n\n${DIRETORIA}`)
  }
}
