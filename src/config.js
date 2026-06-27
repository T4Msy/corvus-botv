'use strict'

require('dotenv').config()

const fs = require('fs')
const path = require('path')

const SETTINGS_PATH = path.resolve(__dirname, '..', 'config', 'settings.json')

/**
 * Normaliza um número para o formato de dígitos puros (DDI + número),
 * removendo sufixos de JID (@s.whatsapp.net) e qualquer caractere não-numérico.
 */
function normalizeNumber (value) {
  return String(value || '').replace(/\D/g, '')
}

function loadSettings () {
  let raw
  try {
    raw = fs.readFileSync(SETTINGS_PATH, 'utf-8')
  } catch (err) {
    throw new Error(`Não foi possível ler config/settings.json: ${err.message}`)
  }

  let settings
  try {
    settings = JSON.parse(raw)
  } catch (err) {
    throw new Error(`config/settings.json contém JSON inválido: ${err.message}`)
  }

  // .env tem precedência sobre o arquivo de settings.
  const prefix = process.env.BOT_PREFIX || settings.prefix || '!'

  const ownerNumbers = (
    process.env.OWNER_NUMBERS
      ? process.env.OWNER_NUMBERS.split(',')
      : (settings.owner && settings.owner.numbers) || []
  )
    .map(normalizeNumber)
    .filter(Boolean)

  const config = {
    prefix,
    botName: settings.botName || 'Corvus',
    iaName: settings.iaName || 'Masayoshi',
    owner: {
      nick: (settings.owner && settings.owner.nick) || 'Dono',
      numbers: ownerNumbers
    },
    flags: settings.flags || {},

    /** Retorna true se o JID/número pertence a um dono configurado. */
    isOwner (jid) {
      const num = normalizeNumber(jid)
      return ownerNumbers.includes(num)
    }
  }

  return config
}

const config = loadSettings()

if (config.owner.numbers.length === 0) {
  console.warn(
    '[config] Nenhum número de dono configurado. ' +
    'Defina OWNER_NUMBERS no .env ou owner.numbers em config/settings.json ' +
    'para habilitar comandos restritos ao dono.'
  )
}

module.exports = config
