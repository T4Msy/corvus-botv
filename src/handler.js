'use strict'

const { jidNormalizedUser } = require('@whiskeysockets/baileys')
const leveling = require('./lib/leveling')
const ratelimit = require('./lib/ratelimit')
const { store } = require('./lib/store')
const { getAdmins, botJid, botJids } = require('./lib/group')
const { emoji, error, info, loading } = require('./ui/theme')
const { wasSentByBot } = require('./lib/msgcache')
const { commandsOfCategory, categoryToText, commandCard } = require('./lib/menuview')
const { applyWarn } = require('./lib/warns')

const counters = store('counters')
const timecounters = store('timecounters')
const groupsConf = store('groups')

// Convite de grupo do WhatsApp (antilink).
const INVITE_RE = /chat\.whatsapp\.com\/\S+/i

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
 * Extrai o texto de uma mensagem Baileys, cobrindo os tipos comuns e
 * respostas de lista (listResponseMessage, usada pelo menu interativo).
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

/**
 * Cria o handler de mensagens. Recebe { config, commands } e devolve
 * a função (sock, ev) registrada em messages.upsert.
 */
function createHandler ({ config, commands }) {
  const groupCache = new Map()
  let cacheReady = false

  // Ids já processados — evita executar a mesma mensagem duas vezes
  // (o Baileys pode entregá-la em 'notify' e 'append').
  const processed = new Set()
  function alreadyProcessed (id) {
    if (!id) return false
    if (processed.has(id)) return true
    if (processed.size >= 512) processed.delete(processed.values().next().value)
    processed.add(id)
    return false
  }

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

    // 'notify' = mensagens de terceiros; 'append' = mensagens da própria
    // conta (digitadas no aparelho do bot OU enviadas pelo código).
    if (ev.type !== 'notify' && ev.type !== 'append') return

    for (const msg of ev.messages) {
      try {
        if (!msg.message) continue

        const from = msg.key.remoteJid
        if (!from || from === 'status@broadcast') continue

        const fromMe = !!msg.key.fromMe

        // Em 'append' só interessam mensagens da própria conta.
        if (ev.type === 'append' && !fromMe) continue

        // Ignora o que o próprio código do bot enviou; o que sobra de
        // fromMe foi digitado no aparelho — vale como comando do dono.
        // O pequeno atraso fecha a corrida: o evento da mensagem pode
        // chegar antes de o envio terminar de marcá-la como do bot.
        if (fromMe) {
          await new Promise(resolve => setTimeout(resolve, 200))
          if (wasSentByBot(msg.key.id)) continue
        }

        // Nunca processa a mesma mensagem duas vezes.
        if (alreadyProcessed(msg.key.id)) continue

        const isGroup = from.endsWith('@g.us')
        const sender = isGroup
          ? (msg.key.participant || (fromMe ? botJid(sock) : null))
          : (fromMe ? botJid(sock) : from)
        if (!sender) continue

        // Contador de mensagens: total + diário + semanal (não conta a
        // própria conta do bot, para não poluir ranking e nível).
        if (isGroup && !fromMe) {
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

        // XP por atividade (mensagens de terceiros, respeitando cooldown).
        if (!fromMe) {
          const xp = leveling.grant(sender)
          if (xp?.leveledUp) {
            await sock.sendMessage(from, {
              text: `${emoji.toast} @${sender.split('@')[0]} subiu para o *nível ${xp.level}*!`,
              mentions: [sender]
            })
          }
        }

        const text = extractText(msg.message).trim()

        // Antilink: apaga convites de outros grupos e adverte (não-admins).
        if (isGroup && !fromMe && groupsConf.get(from, {}).antilink && INVITE_RE.test(text)) {
          try {
            const meta = groupCache.get(from) || await sock.groupMetadata(from)
            if (meta) groupCache.set(from, meta)
            const admins = getAdmins(meta)
            const ids = [sender, msg.key.participantPn].filter(Boolean).map(jidNormalizedUser)
            const senderIsAdmin = ids.some(j => admins.includes(j)) || ids.some(j => config.isOwner(j))
            if (!senderIsAdmin) {
              if (botJids(sock).some(j => admins.includes(j))) {
                await sock.sendMessage(from, { delete: msg.key })
              }
              await applyWarn(sock, from, sender, 'envio de link de grupo (antilink)')
              continue
            }
          } catch (e) {
            console.error('[antilink] erro:', e.message)
          }
        }

        // Respostas de menus interativos antigos ainda presentes nos chats:
        // respondem em texto (o menu atual é 100% texto).
        if (text.startsWith('menu_cat:')) {
          const cat = text.slice('menu_cat:'.length)
          const isOwner = fromMe || config.isOwner(sender)
          const cmds = commandsOfCategory(cat, commands, isOwner)
          if (cmds.length) {
            await sock.sendMessage(from, { text: categoryToText(cat, cmds, config) }, { quoted: msg })
          }
          continue
        }
        if (text.startsWith('menu_cmd:')) {
          const name = text.slice('menu_cmd:'.length).toLowerCase()
          const isOwner = fromMe || config.isOwner(sender)
          const cmd = commands.get(name)
          if (cmd && (!cmd.ownerOnly || isOwner)) {
            await sock.sendMessage(from, { text: commandCard(cmd, config) }, { quoted: msg })
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
              { text: error(`Comando *${config.prefix}${rawCmd}* não encontrado. Use *${config.prefix}menu*.`) },
              { quoted: msg }
            )
          }
          continue
        }

        // Identidades do remetente: em grupos novos o participante chega
        // como @lid; participantPn (quando presente) traz o telefone.
        const senderIds = [sender, msg.key.participantPn]
          .filter(Boolean)
          .map(jidNormalizedUser)

        const isOwner = fromMe || senderIds.some(j => config.isOwner(j))

        // Resolve metadados de grupo quando o comando precisa (adminOnly, botAdmin ou fetchMeta).
        let groupMetadata
        let isAdmin = false
        let isBotAdmin = false
        if (isGroup && (command.adminOnly || command.botAdmin || command.fetchMeta)) {
          try {
            groupMetadata = groupCache.get(from) || await sock.groupMetadata(from)
            if (groupMetadata) groupCache.set(from, groupMetadata)
            const admins = getAdmins(groupMetadata)
            isAdmin = senderIds.some(j => admins.includes(j))
            isBotAdmin = botJids(sock).some(j => admins.includes(j))
          } catch (e) {
            console.error('[handler] groupMetadata falhou:', e.message)
            await sock.sendMessage(
              from,
              { text: error('Não consegui verificar permissões. Tente novamente.') },
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
          await reply(info('Use este comando dentro de um grupo.'))
          continue
        }
        if (command.adminOnly && !isAdmin && !isOwner) {
          await reply(`${emoji.lock} Apenas administradores.`)
          continue
        }
        if (command.botAdmin && !isBotAdmin) {
          await reply(error('Preciso ser administrador do grupo para isso.'))
          continue
        }

        // Cooldown por comando (donos isentos).
        if (command.cooldown && !isOwner) {
          const wait = ratelimit.check(command.name, sender, command.cooldown)
          if (wait > 0) {
            await reply(loading(`Aguarde ${wait}s para usar *${config.prefix}${command.name}* novamente.`))
            continue
          }
        }

        try {
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
          console.error(`[handler] comando ${command.name} falhou:`, err)
          await reply(error('Algo deu errado ao executar o comando. Tente novamente.')).catch(() => {})
        }
      } catch (err) {
        console.error('[handler] erro ao processar mensagem:', err)
      }
    }
  }
}

module.exports = { createHandler, extractText }
