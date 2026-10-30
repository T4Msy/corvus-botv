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
 * Variantes de um número brasileiro com e sem o 9º dígito: no WhatsApp
 * muitos celulares aparecem como 55+DDD+8 dígitos, mesmo tendo o 9.
 */
function brVariants (num) {
  if (!num.startsWith('55')) return [num]
  if (num.length === 13 && num[4] === '9') return [num, num.slice(0, 4) + num.slice(5)]
  if (num.length === 12) return [num, `${num.slice(0, 4)}9${num.slice(4)}`]
  return [num]
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
  const ownerIds = new Set(ownerNumbers.flatMap(brVariants))

  const config = {
    prefix,
    botName: settings.botName || 'Corvus',
    iaName: settings.iaName || 'Masayoshi',
    owner: {
      nick: (settings.owner && settings.owner.nick) || 'Dono',
      numbers: ownerNumbers
    },
    flags: settings.flags || {},

    /** Variantes BR de um número (com e sem o 9º dígito). */
    phoneVariants: (value) => brVariants(normalizeNumber(value)),

    /** Retorna true se o JID/número pertence a um dono configurado. */
    isOwner (jid) {
      // Só a parte do usuário: "5531...:12@s.whatsapp.net" → "5531...".
      const num = normalizeNumber(String(jid || '').split('@')[0].split(':')[0])
      return ownerIds.has(num)
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
