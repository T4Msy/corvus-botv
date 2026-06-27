'use strict'

const { store } = require('../lib/store')
const { emoji } = require('../ui/theme')

const groups = store('groups')

/**
 * Handler de entradas/saídas de grupo. Só age se as boas-vindas estiverem
 * ativadas para aquele grupo (comando !welcome on).
 */
function createGroupParticipantsHandler () {
  return async function onGroupParticipants (sock, ev) {
    const { id, participants, action } = ev
    const conf = groups.get(id, {})
    if (!conf.welcome) return

    try {
      const meta = await sock.groupMetadata(id)
      for (const p of participants) {
        const mention = `@${p.split('@')[0]}`
        if (action === 'add') {
          await sock.sendMessage(id, {
            text: `${emoji.raven} Bem-vindo(a) ${mention} ao *${meta.subject}*!`,
            mentions: [p]
          })
        } else if (action === 'remove') {
          await sock.sendMessage(id, {
            text: `${emoji.feather} ${mention} saiu do grupo.`,
            mentions: [p]
          })
        }
      }
    } catch (err) {
      console.error('[welcome] erro:', err)
    }
  }
}

module.exports = { createGroupParticipantsHandler, groups }
