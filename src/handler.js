'use strict'

const leveling = require('./lib/leveling')
const { getAdmins, botJid } = require('./lib/group')
const { emoji } = require('./ui/theme')

/**
 * Extrai o texto de uma mensagem do Baileys, cobrindo os tipos comuns.
 */
function extractText (message) {
  if (!message) return ''
  return (
    message.conversation ||
    message.extendedTextMessage?.text ||
    message.imageMessage?.caption ||
    message.videoMessage?.caption ||
    message.documentMessage?.caption ||
    ''
  )
}

/**
 * Cria o handler de mensagens. Recebe { config, commands } e devolve
 * a função (sock, ev) registrada em messages.upsert.
 */
function createHandler ({ config, commands }) {
  return async function handle (sock, ev) {
    if (ev.type !== 'notify') return

    for (const msg of ev.messages) {
      try {
        if (!msg.message || msg.key.fromMe) continue

        const from = msg.key.remoteJid
        if (!from || from === 'status@broadcast') continue

        const isGroup = from.endsWith('@g.us')
        const sender = isGroup ? msg.key.participant : from
        if (!sender) continue

        // XP por atividade (qualquer mensagem, respeitando cooldown).
        const xp = leveling.grant(sender)
        if (xp?.leveledUp) {
          await sock.sendMessage(from, {
            text: `${emoji.crystal} @${sender.split('@')[0]} subiu para o *nível ${xp.level}*!`,
            mentions: [sender]
          })
        }

        const text = extractText(msg.message).trim()
        if (!text.startsWith(config.prefix)) continue

        const [rawCmd, ...args] = text.slice(config.prefix.length).trim().split(/\s+/)
        const command = commands.get((rawCmd || '').toLowerCase())
        if (!command) continue

        const isOwner = config.isOwner(sender)

        // Resolve metadados de grupo só quando o comando precisa.
        let groupMetadata
        let isAdmin = false
        let isBotAdmin = false
        if (isGroup && (command.adminOnly || command.botAdmin)) {
          groupMetadata = await sock.groupMetadata(from)
          const admins = getAdmins(groupMetadata)
          isAdmin = admins.includes(sender)
          isBotAdmin = admins.includes(botJid(sock))
        }

        if (command.ownerOnly && !isOwner) {
          await sock.sendMessage(from, { text: `${emoji.lock} Comando restrito ao dono.` }, { quoted: msg })
          continue
        }
        if (command.groupOnly && !isGroup) {
          await sock.sendMessage(from, { text: '👥 Use este comando dentro de um grupo.' }, { quoted: msg })
          continue
        }
        if (command.adminOnly && !isAdmin && !isOwner) {
          await sock.sendMessage(from, { text: `${emoji.lock} Apenas administradores.` }, { quoted: msg })
          continue
        }
        if (command.botAdmin && !isBotAdmin) {
          await sock.sendMessage(from, { text: `${emoji.cross} Preciso ser administrador do grupo para isso.` }, { quoted: msg })
          continue
        }

        const reply = (content) =>
          sock.sendMessage(
            from,
            typeof content === 'string' ? { text: content } : content,
            { quoted: msg }
          )

        await command.run({
          sock,
          msg,
          args,
          text: args.join(' '),
          from,
          sender,
          isGroup,
          isOwner,
          isAdmin,
          isBotAdmin,
          groupMetadata,
          config,
          commands,
          reply
        })
      } catch (err) {
        console.error('[handler] erro ao processar mensagem:', err)
      }
    }
  }
}

module.exports = { createHandler, extractText }
