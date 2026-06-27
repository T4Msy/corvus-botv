'use strict'

const fs = require('fs')
const config = require('./config')
const { printBanner } = require('./ui/banner')
const { startConnection, SESSION_DIR } = require('./connection')
const { loadCommands } = require('./commands/_registry')
const { createHandler } = require('./handler')
const { createGroupParticipantsHandler } = require('./events/groupParticipants')

async function main () {
  // `npm run qr` / --new-session: força novo pareamento apagando a sessão.
  if (process.argv.includes('--new-session')) {
    fs.rmSync(SESSION_DIR, { recursive: true, force: true })
    console.log('🗑️  Sessão anterior removida. Um novo QR será gerado.')
  }

  printBanner(config)

  const commands = loadCommands()
  const uniqueCount = new Set(commands.values()).size
  console.log(`🧩 ${uniqueCount} comando(s) carregado(s).`)

  const handlers = {
    onMessage: createHandler({ config, commands }),
    onGroupParticipants: createGroupParticipantsHandler({ config })
  }

  await startConnection(config, handlers)
}

main().catch((err) => {
  console.error('Falha fatal ao iniciar o Corvus:', err)
  process.exit(1)
})
