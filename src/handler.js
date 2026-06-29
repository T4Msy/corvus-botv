'use strict'

const leveling = require('./lib/leveling')
const ratelimit = require('./lib/ratelimit')
const { store } = require('./lib/store')
const { getAdmins, botJid } = require('./lib/group')
const { emoji } = require('./ui/theme')

const counters = store('counters')
const timecounters = store('timecounters')

function getDateKey () {
  return new Date().toISOString().slice(0, 10)
}

function getWeekKey () {
  const d = new Date()
  const jan1 = new Date(d.getFullYear(), 0, 1)
  const week = Math.ceil(((d - jan1) / 86400000 + jan1.getDay() + 1) / 7)
  return `${d.getFullYear()}-W${String(week).padStart(2, '0')}`
}

/**
 * Extrai o texto de uma mensagem Baileys, cobrindo os tipos comuns
 * incluindo respostas de lista (listResponseMessage).
 */
function extractText (message) {
  if (!message) return ''
  return (
    message.conversation ||
    message.extendedTextMessage?.text ||
    message.imageMessage?.caption ||
    message.videoMessage?.caption ||
    message.documentMessage?.caption ||
    message.listResponseMessage?.singleSelectReply?.selectedRowId ||
    ''
  )
}

function categoryOf (cmd) {
  if (cmd.ownerOnly) return 'Dono'
  if (cmd.category) return cmd.category
  if (cmd.adminOnly) return 'Admin'
  return 'Geral'
}

/** Retorna texto com todos os comandos de uma categoria. */
function showCategory (cat, commands, config, isOwner) {
  const all = [...new Set(commands.values())]
  const cmds = all
    .filter(c => categoryOf(c) === cat && (!c.ownerOnly || isOwner))
    .sort((a, b) => a.name.localeCompare(b.name))
  if (!cmds.length) return null
  const lines = cmds.map(c => `${emoji.bullet} *${config.prefix}${c.name}*${c.desc ? ` — ${c.desc}` : ''}`)
  return `${emoji.raven} *${cat}*\n\n${lines.join('\n')}`
}

/**
 * Cria o handler de mensagens. Recebe { config, commands } e devolve
 * a função (sock, ev) registrada em messages.upsert.
 */
function createHandler ({ config, commands }) {
  const groupCache = new Map()
  let cacheReady = false

  /** Inicializa cache de grupos na primeira mensagem recebida. */
  function initGroupCache (sock) {
    if (cacheReady) return
    cacheReady = true
    sock.ev.on('groups.upsert', gs => gs.forEach(g => groupCache.set(g.id, g)))
    sock.ev.on('groups.update', us => us.forEach(u => {
      const old = groupCache.get(u.id) || {}
      groupCache.set(u.id, { ...old, ...u })
    }))
    sock.ev.on('group-participants.update', async ({ id }) => {
      try {
        const meta = await sock.groupMetadata(id)
        if (meta) groupCache.set(id, meta)
      } catch {}
    })
  }

  return async function handle (sock, ev) {
    initGroupCache(sock)

    if (ev.type !== 'notify') return

    for (const msg of ev.messages) {
      try {
        if (!msg.message || msg.key.fromMe) continue

        const from = msg.key.remoteJid
        if (!from || from === 'status@broadcast') continue

        const isGroup = from.endsWith('@g.us')
        const sender = isGroup ? msg.key.participant : from
        if (!sender) continue

        // Contador de mensagens: total + diário + semanal.
        if (isGroup) {
          const dayKey = getDateKey()
          const weekKey = getWeekKey()
          counters.update(from, (c) => {
            c[sender] = (c[sender] || 0) + 1
            return c
          }, {})
          timecounters.update(from, (t) => {
            if (!t.daily) t.daily = {}
            if (!t.weekly) t.weekly = {}
            if (!t.daily[dayKey]) t.daily[dayKey] = {}
            if (!t.weekly[weekKey]) t.weekly[weekKey] = {}
            t.daily[dayKey][sender] = (t.daily[dayKey][sender] || 0) + 1
            t.weekly[weekKey][sender] = (t.weekly[weekKey][sender] || 0) + 1
            return t
          }, {})
        }

        // XP por atividade (qualquer mensagem, respeitando cooldown).
        const xp = leveling.grant(sender)
        if (xp?.leveledUp) {
          await sock.sendMessage(from, {
            text: `${emoji.crystal} @${sender.split('@')[0]} subiu para o *nível ${xp.level}*!`,
            mentions: [sender]
          })
        }

        const text = extractText(msg.message).trim()

        // Seleção de categoria no menu interativo (listResponseMessage).
        if (text.startsWith('menu_cat:')) {
          const cat = text.slice('menu_cat:'.length)
          const isOwner = config.isOwner(sender)
          const content = showCategory(cat, commands, config, isOwner)
          if (content) {
            await sock.sendMessage(from, { text: content }, { quoted: msg })
          }
          continue
        }

        if (!text.startsWith(config.prefix)) continue

        const [rawCmd, ...args] = text.slice(config.prefix.length).trim().split(/\s+/)
        const command = commands.get((rawCmd || '').toLowerCase())

        if (!command) {
          // Feedback apenas em DMs para não spammar grupos.
          if (!isGroup) {
            await sock.sendMessage(
              from,
              { text: `${emoji.cross} Comando *${config.prefix}${rawCmd}* não encontrado. Use *${config.prefix}menu*.` },
              { quoted: msg }
            )
          }
          continue
        }

        const isOwner = config.isOwner(sender)

        // Resolve metadados de grupo quando o comando precisa (adminOnly, botAdmin ou fetchMeta).
        let groupMetadata
        let isAdmin = false
        let isBotAdmin = false
        if (isGroup && (command.adminOnly || command.botAdmin || command.fetchMeta)) {
          try {
            groupMetadata = groupCache.get(from) || await sock.groupMetadata(from)
            if (groupMetadata) groupCache.set(from, groupMetadata)
            const admins = getAdmins(groupMetadata)
            isAdmin = admins.includes(sender)
            isBotAdmin = admins.includes(botJid(sock))
          } catch (e) {
            console.error('[handler] groupMetadata falhou:', e.message)
            await sock.sendMessage(
              from,
              { text: `${emoji.cross} Não consegui verificar permissões. Tente novamente.` },
              { quoted: msg }
            )
            continue
          }
        }

        const reply = (content) =>
          sock.sendMessage(
            from,
            typeof content === 'string' ? { text: content } : content,
            { quoted: msg }
          )

        if (command.ownerOnly && !isOwner) {
          await reply(`${emoji.lock} Comando restrito ao dono.`)
          continue
        }
        if (command.groupOnly && !isGroup) {
          await reply(`${emoji.dark} Use este comando dentro de um grupo.`)
          continue
        }
        if (command.adminOnly && !isAdmin && !isOwner) {
          await reply(`${emoji.lock} Apenas administradores.`)
          continue
        }
        if (command.botAdmin && !isBotAdmin) {
          await reply(`${emoji.cross} Preciso ser administrador do grupo para isso.`)
          continue
        }

        // Cooldown por comando (donos isentos).
        if (command.cooldown && !isOwner) {
          const wait = ratelimit.check(command.name, sender, command.cooldown)
          if (wait > 0) {
            await reply(`${emoji.moon} Aguarde ${wait}s para usar *${config.prefix}${command.name}* novamente.`)
            continue
          }
        }

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
