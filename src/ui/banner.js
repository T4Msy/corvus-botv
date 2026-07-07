'use strict'

const cfonts = require('cfonts')
const { palette } = require('./theme')

/**
 * Imprime o banner de inicialização do Corvus no terminal.
 * Substitui o spinner "SAKURA-BOT" do legado.
 */
function printBanner (config) {
  cfonts.say('CORVUS', {
    font: 'block',
    align: 'center',
    gradient: palette.cfonts,
    transitionGradient: true,
    space: false
  })

  cfonts.say(`${config.botName} • agente de ${config.iaName}`, {
    font: 'console',
    align: 'center',
    colors: ['red']
  })

  console.log('\x1b[31m%s\x1b[0m', '                         🍷 elegância · autoridade · mistério')
}

module.exports = { printBanner }
