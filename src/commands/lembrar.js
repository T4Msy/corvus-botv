'use strict'

const { jidNormalizedUser } = require('@whiskeysockets/baileys')
const lembretes = require('../lib/lembretes')
const { emoji, header } = require('../ui/theme')

/** Privado de quem pediu: no grupo, o JID do participante; no privado, a própria conversa. */
const dmOf = ({ from, sender, isGroup }) => jidNormalizedUser(isGroup ? sender : from)

const ajuda = p =>
  `${emoji.feather} Use *${p}lembrar <quando> <o quê>*\n\n` +
  `${emoji.bullet} ${p}lembrar 20h tomar remédio\n` +
  `${emoji.bullet} ${p}lembrar 20:30 entrar na call\n` +
  `${emoji.bullet} ${p}lembrar em 30 min tirar o bolo do forno\n` +
  `${emoji.bullet} ${p}lembrar amanhã 8h pagar o boleto\n` +
  `${emoji.bullet} ${p}lembrar 05/11 15h reunião do trabalho\n\n` +
  `_O Corvus te chama no privado na hora. Veja os seus com ${p}lembretes._`

module.exports = [
  {
    name: 'lembrar',
    aliases: ['lembrete', 'lembra', 'remind'],
    category: 'Geral',
    cooldown: 3,
    desc: 'O Corvus te chama no privado na hora: lembrar 20h tomar remédio.',
    async run (ctx) {
      const { text, reply, config } = ctx
      const parsed = lembretes.parse(text)
      if (!parsed) { await reply(ajuda(config.prefix)); return }
      if (!parsed.text) { await reply(`${emoji.cross} Faltou dizer do que lembrar.\n\n${ajuda(config.prefix)}`); return }

      const res = lembretes.add(dmOf(ctx), parsed.at, parsed.text)
      if (res.error) { await reply(`${emoji.cross} ${res.error}`); return }
      await reply(`${emoji.check} Combinado! *${lembretes.when(res.at)}* eu te chamo no privado:\n_${res.text}_`)
    }
  },
  {
    name: 'lembretes',
    aliases: ['meuslembretes'],
    category: 'Geral',
    desc: 'Seus lembretes marcados (lembretes apagar <número> para cancelar).',
    async run (ctx) {
      const { args, reply, config } = ctx
      const list = lembretes.listOf(dmOf(ctx))

      if (/^(apagar|cancelar|remover|del)$/i.test(args[0] || '')) {
        const n = parseInt(args[1], 10)
        const item = list[n - 1]
        if (!item) { await reply(`${emoji.cross} Número inválido. Veja a lista com *${config.prefix}lembretes*.`); return }
        lembretes.remove(item.id)
        await reply(`${emoji.check} Lembrete apagado: _${item.text}_`)
        return
      }

      if (!list.length) {
        await reply(`${emoji.moon} Você não tem lembretes marcados.\n\n${ajuda(config.prefix)}`)
        return
      }
      const lines = list.map((l, i) => `*${i + 1}.* ${lembretes.when(l.at)} — ${l.text}`)
      const body = `${header('Seus lembretes')}\n\n${lines.join('\n')}\n\n` +
        `_Para cancelar: ${config.prefix}lembretes apagar <número>_`
      // No grupo a lista vai pro privado (são coisas pessoais).
      if (ctx.isGroup) {
        await ctx.sock.sendMessage(dmOf(ctx), { text: body })
        await reply(`${emoji.check} Mandei seus lembretes no privado.`)
      } else {
        await reply(body)
      }
    }
  }
]
