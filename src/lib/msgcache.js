'use strict'

/**
 * Cache em memória das mensagens ENVIADAS pelo bot.
 *
 * Quando um destinatário não consegue descriptografar uma mensagem, o
 * WhatsApp envia um pedido de reenvio (retry receipt) e o Baileys chama
 * getMessage(key) para reenviá-la. Sem esse cache o reenvio falha e a
 * pessoa fica presa no "Aguardando mensagem".
 */

const MAX = 512
const cache = new Map()

// Ids de mensagens que o CÓDIGO do bot enviou (sendMessage/relayMessage),
// para o handler distinguir das digitadas no próprio aparelho.
const sentByBot = new Set()

function remember (id, message) {
  if (!id || !message) return
  if (cache.size >= MAX) cache.delete(cache.keys().next().value)
  cache.set(id, message)
}

function recall (id) {
  return cache.get(id)
}

function markSent (id) {
  if (!id) return
  if (sentByBot.size >= MAX) sentByBot.delete(sentByBot.values().next().value)
  sentByBot.add(id)
}

function wasSentByBot (id) {
  return sentByBot.has(id)
}

module.exports = { remember, recall, markSent, wasSentByBot }
