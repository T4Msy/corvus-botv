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

/**
 * Forma canônica para comparar números: celulares brasileiros (55 + DDD +
 * 9 + 8 dígitos) perdem o 9 extra, que o WhatsApp omite nos JIDs de vários
 * DDDs — assim 5534984368429 e 553484368429 batem.
 */
function canonicalNumber (value) {
  const num = normalizeNumber(value)
  return /^55\d{2}9\d{8}$/.test(num) ? num.slice(0, 4) + num.slice(5) : num
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
      const num = canonicalNumber(String(jid || '').split(/[:@]/)[0])
      return ownerNumbers.some(n => canonicalNumber(n) === num)
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
