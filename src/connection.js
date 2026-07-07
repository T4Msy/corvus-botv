'use strict'

const path = require('path')
const { Boom } = require('@hapi/boom')
const pino = require('pino')
const qrcode = require('qrcode-terminal')
const {
  default: makeWASocket,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  DisconnectReason,
  Browsers
} = require('@whiskeysockets/baileys')

const { remember, recall, markSent } = require('./lib/msgcache')

const SESSION_DIR = path.resolve(__dirname, '..', 'data', 'session')

const logger = pino({ level: process.env.LOG_LEVEL || 'silent' })

/**
 * Cria e mantém a conexão com o WhatsApp.
 * Reconecta automaticamente, exceto quando a sessão foi deslogada
 * (nesse caso é necessário escanear um novo QR).
 *
 * @param {object} config   objeto de configuração (src/config.js)
 * @param {object} handlers { onMessage?, onGroupParticipants? }
 */
async function startConnection (config, handlers = {}) {
  const { state, saveCreds } = await useMultiFileAuthState(SESSION_DIR)
  const { version } = await fetchLatestBaileysVersion()

  const sock = makeWASocket({
    version,
    logger,
    auth: state,
    browser: Browsers.appropriate('Corvus'),
    printQRInTerminal: false,
    // Honra pedidos de reenvio: sem isso, quem não conseguir descriptografar
    // uma mensagem fica preso no "Aguardando mensagem".
    getMessage: async (key) => recall(key.id)
  })

  sock.ev.on('creds.update', saveCreds)

  // Guarda tudo que sai da conta para poder reenviar sob demanda (getMessage).
  sock.ev.on('messages.upsert', ({ messages }) => {
    for (const m of messages) {
      if (m.key?.fromMe && m.message) remember(m.key.id, m.message)
    }
  })

  // Marca o que o CÓDIGO envia, para o handler não confundir com comandos
  // digitados no próprio aparelho do bot.
  const origSendMessage = sock.sendMessage.bind(sock)
  sock.sendMessage = async (...args) => {
    const sent = await origSendMessage(...args)
    if (sent?.key?.id) {
      markSent(sent.key.id)
      if (sent.message) remember(sent.key.id, sent.message)
    }
    return sent
  }

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect, qr } = update

    if (qr) {
      console.log('\n📲 Escaneie o QR code abaixo com o WhatsApp do bot:\n')
      qrcode.generate(qr, { small: true })
    }

    if (connection === 'open') {
      console.log(`✅ ${config.botName} conectado ao WhatsApp.`)
    }

    if (connection === 'close') {
      const statusCode = new Boom(lastDisconnect?.error)?.output?.statusCode
      const loggedOut = statusCode === DisconnectReason.loggedOut

      if (loggedOut) {
        console.log(
          '🔌 Sessão deslogada. Apague data/session e reinicie para gerar um novo QR.'
        )
        return
      }

      console.log('⚠️  Conexão encerrada, reconectando...')
      startConnection(config, handlers)
    }
  })

  if (handlers.onMessage) {
    sock.ev.on('messages.upsert', (ev) => handlers.onMessage(sock, ev))
  }
  if (handlers.onGroupParticipants) {
    sock.ev.on('group-participants.update', (ev) => handlers.onGroupParticipants(sock, ev))
  }

  return sock
}

module.exports = { startConnection, SESSION_DIR }
