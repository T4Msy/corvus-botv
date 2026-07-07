'use strict'

const { store } = require('./store')
const { emoji } = require('../ui/theme')

const warns = store('warns')
const LIMIT = 3

/**
 * Aplica uma advertência a um membro do grupo. Ao atingir o limite (3),
 * anuncia e remove o membro (requer bot admin). Usada por /adv e pelo
 * antilink.
 *
 * @returns {Promise<{ count: number, removed: boolean }>}
 */
async function applyWarn (sock, from, target, motivo = 'sem motivo') {
  const groupWarns = warns.get(from, {})
  const count = (groupWarns[target] || 0) + 1
  groupWarns[target] = count
  await warns.set(from, groupWarns)

  if (count >= LIMIT) {
    await sock.sendMessage(from, {
      text: `${emoji.skull} @${target.split('@')[0]} atingiu ${LIMIT} advertências e foi removido.`,
      mentions: [target]
    })
    await sock.groupParticipantsUpdate(from, [target], 'remove')
    delete groupWarns[target]
    await warns.set(from, groupWarns)
    return { count, removed: true }
  }

  await sock.sendMessage(from, {
    text: `${emoji.cross} @${target.split('@')[0]} advertido (${count}/${LIMIT}).\nMotivo: ${motivo}`,
    mentions: [target]
  })
  return { count, removed: false }
}

module.exports = { applyWarn, warns, LIMIT }
