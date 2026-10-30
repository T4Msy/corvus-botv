'use strict'

const path = require('path')
const { Boom } = require('@hapi/boom')
const pino = require('pino')
const qrcode = require('qrcode-terminal')
const {
  default: makeWASocket,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  fetchLatestWaWebVersion,
  DisconnectReason,
  Browsers
} = require('@whiskeysockets/baileys')

const { remember, recall, markSent } = require('./lib/msgcache')

const SESSION_DIR = path.resolve(__dirname, '..', 'data', 'session')

const logger = pino({ level: process.env.LOG_LEVEL || 'silent' })

// Reconexão com espera crescente (2s, 4s, 8s… até 60s); zera ao conectar.
const MAX_BACKOFF_MS = 60 * 1000
let reconnectAttempts = 0

// Socket ativo (troca a cada reconexão) — usado pela API HTTP (src/api.js).
let currentSock = null
let isOpen = false

/** Retorna o socket conectado, ou null se o WhatsApp estiver fora. */
function getSocket () {
  return isOpen ? currentSock : null
}

function backoffDelay () {
  return Math.min(MAX_BACKOFF_MS, 2000 * 2 ** reconnectAttempts++)
}

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
  const webVersion = await fetchLatestWaWebVersion({ timeout: 10000 })
  if (!webVersion.isLatest) {
    console.warn(`Não foi possível consultar a versão atual do WhatsApp Web: ${webVersion.error?.message || 'erro desconhecido'}`)
  }
  const { version } = webVersion.isLatest
    ? webVersion
    : await fetchLatestBaileysVersion({ timeout: 10000 })
  console.log(`🌐 Versão do WhatsApp Web: ${version.join('.')}`)

  // Pareamento por código (PAIRING_NUMBER no .env) em vez de QR — útil em
  // servidor, onde não dá para escanear o terminal. Só vale sem sessão.
  const pairingNumber = String(process.env.PAIRING_NUMBER || '').replace(/\D/g, '')
  const usePairingCode = Boolean(pairingNumber) && !state.creds.me
  let pairingRequested = false

  const sock = makeWASocket({
    version,
    logger,
    auth: state,
    // O WhatsApp só aceita código de pareamento de um navegador conhecido.
    browser: usePairingCode ? Browsers.ubuntu('Chrome') : Browsers.appropriate('Corvus'),
    // Honra pedidos de reenvio: sem isso, quem não conseguir descriptografar
    // uma mensagem fica preso no "Aguardando mensagem".
    getMessage: async (key) => recall(key.id)
  })

  // O primeiro pareamento encerra o socket com código 515. Aguarde a gravação
  // das credenciais antes de abrir outro socket com o mesmo diretório de sessão.
  let pendingCredsSave = Promise.resolve()
  sock.ev.on('creds.update', () => {
    pendingCredsSave = pendingCredsSave
      .catch(() => {})
      .then(saveCreds)
    pendingCredsSave.catch((err) => {
      console.error('Falha ao salvar a sessão do WhatsApp:', err)
    })
  })

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
    const { connection, lastDisconnect, qr, isNewLogin } = update

    if (connection === 'connecting') {
      console.log('⏳ Conectando ao WhatsApp...')
    }

    if (isNewLogin) {
      console.log('⏳ QR lido. Aguardando o WhatsApp concluir o pareamento...')
    }

    if (qr && usePairingCode) {
      if (!pairingRequested) {
        pairingRequested = true
        sock.requestPairingCode(pairingNumber).then((code) => {
          const pretty = code.match(/.{1,4}/g).join('-')
          console.log(
            `\n🔑 Código de pareamento para +${pairingNumber}: ${pretty}\n` +
            '   No celular do bot: WhatsApp → Aparelhos conectados → Conectar aparelho →\n' +
            '   "Conectar com número de telefone" e digite o código.\n'
          )
        }).catch((err) => {
          console.error('Falha ao pedir o código de pareamento:', err.message)
        })
      }
    } else if (qr) {
      console.log('\n📲 Escaneie o QR code abaixo com o WhatsApp do bot:\n')
      qrcode.generate(qr, { small: true })
    }

    if (connection === 'open') {
      reconnectAttempts = 0
      currentSock = sock
      isOpen = true
      console.log(`✅ ${config.botName} conectado ao WhatsApp.`)
    }

    if (connection === 'close') {
      if (currentSock === sock) isOpen = false
      const error = lastDisconnect?.error
      const statusCode = error instanceof Boom
        ? error.output.statusCode
        : error?.output?.statusCode
      const loggedOut = statusCode === DisconnectReason.loggedOut

      if (statusCode === DisconnectReason.restartRequired) {
        console.log('🔄 Pareamento aceito. Reiniciando a conexão com a sessão salva...')
      } else {
        console.error(
          `⚠️  WhatsApp encerrou a conexão (código ${statusCode ?? 'desconhecido'}): ${error?.message || 'sem detalhes'}`
        )
      }

      if (loggedOut) {
        console.log(
          '🔌 Sessão deslogada. Apague data/session e reinicie para gerar um novo QR.'
        )
        return
      }

      // Outra instância abriu a mesma sessão: reconectar só faria as duas
      // se derrubarem em loop.
      if (statusCode === DisconnectReason.connectionReplaced) {
        console.log(
          '🛑 Sessão aberta em outra instância do bot. Encerre a outra e reinicie esta.'
        )
        return
      }

      // Após o pareamento (515) reconecta na hora; nos demais casos, espera.
      const delay = statusCode === DisconnectReason.restartRequired ? 0 : backoffDelay()
      if (delay) {
        console.log(`⚠️  Conexão encerrada, reconectando em ${delay / 1000}s...`)
      }
      pendingCredsSave
        .then(() => reconnect(config, handlers, delay))
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

/** Abre um socket novo após `delay` ms; se falhar, tenta de novo com backoff. */
function reconnect (config, handlers, delay) {
  setTimeout(() => {
    startConnection(config, handlers).catch((err) => {
      console.error('Falha ao reconectar ao WhatsApp:', err.message)
      reconnect(config, handlers, backoffDelay())
    })
  }, delay)
}

module.exports = { startConnection, getSocket, SESSION_DIR }
