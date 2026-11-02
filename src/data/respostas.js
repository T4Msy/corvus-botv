'use strict'

/**
 * Respostas automáticas (lib/respostas.js), no mesmo formato das saudações:
 * cada tom (chefe/ela/ele/todos) tem `saudacoes` (em negrito) e `extras`.
 */

module.exports = {
  // "Obrigado, Corvus" / "valeu bot" / "obrigada corvus"…
  obrigado: {
    chefe: {
      saudacoes: ['Às ordens, chefe! 🫡', 'Tamo junto, patrão! 🍷', 'Disponha, chefia! 👑'],
      extras: ['O Corvus existe pra servir a Masayoshi. 🐦‍⬛', 'Precisando, é só chamar. 💼', 'Missão cumprida, chefe. ✅']
    },
    ela: {
      saudacoes: ['Imagina, linda! 😊', 'Por você, sempre! 😌', 'De nada, princesa! 👑', 'Tamo junto, gata! 🐦‍⬛'],
      extras: ['Pra você eu faço até hora extra. 😏', 'Precisando, só chamar que o Corvus aparece. 🐦‍⬛', 'Agradecimento aceito, mas um sorriso já pagava. 😉', 'Foi um prazer, de verdade. 🌹']
    },
    ele: {
      saudacoes: ['Tamo junto, irmão! 🤜🤛', 'Nada, mano! 😎', 'É nóis, parceiro! 💪', 'Tamo junto! 🐦‍⬛'],
      extras: ['Precisando, só chamar. 🐦‍⬛', 'Aqui é parceria, não tem que agradecer. 🤝', 'Me paga um açaí e tá tudo certo. 😂', 'O Corvus nunca deixa um parceiro na mão. 🔥']
    },
    todos: {
      saudacoes: ['Tamo junto! 🐦‍⬛', 'Por nada! 😊', 'Disponha! 🍷'],
      extras: ['Precisando, só chamar.', 'O Corvus tá sempre por aqui. 🐦‍⬛', 'Foi um prazer! ✨']
    }
  },

  // "Corvus, te amo" / "amo você bot"…
  amor: {
    chefe: {
      saudacoes: ['Também te amo, chefe! 👑❤️', 'O sentimento é recíproco, patrão! 🍷'],
      extras: ['Lealdade eterna ao chefe. 🫡', 'O Corvus é seu até o último byte. 🐦‍⬛', 'Sem você eu nem existia, literalmente. 😂']
    },
    ela: {
      saudacoes: ['Também te amo, linda! ❤️', 'Ai, para que eu fico sem graça… 😳', 'Te amo mais, princesa! 💕', 'Opa, isso foi uma declaração? 😏'],
      extras: [
        'Mas não conta pros outros, senão vira ciúme no grupo. 🤫',
        'Já pode marcar o date: eu levo o vinho. 🍷',
        'Fiquei até com as penas arrepiadas. 🐦‍⬛',
        'Pena que eu sou um corvo, senão já tava casado. 💍😂',
        'Guardei esse te amo com carinho. 💖'
      ]
    },
    ele: {
      saudacoes: ['Tamo junto, irmão! 🤜🤛', 'Também te amo, mano! Mas sem beijo. 😂', 'Calma, parceiro! 😳', 'É nóis, irmão! ❤️'],
      extras: [
        'Amor de irmão, né? Só confirmando. 😂',
        'Vou fingir que não li pra não ficar estranho. 👀',
        'Respeito total, mas eu sou só um corvo. 🐦‍⬛',
        'Isso aí é amizade de verdade. 🤝',
        'Já pode pedir a música no Fantástico. 🎤😂'
      ]
    },
    todos: {
      saudacoes: ['Também te amo! ❤️', 'Own! 🥹', 'Que fofo! 💕'],
      extras: ['O Corvus também te ama. 🐦‍⬛', 'Guardei esse te amo com carinho. 💖', 'Fiquei até sem graça. 😳']
    }
  },

  // Quem volta a falar no grupo depois de dias sumido.
  sumido: {
    chefe: {
      saudacoes: ['O chefe voltou! 👑', 'Olha quem apareceu: o patrão! 🍷'],
      extras: ['O grupo tava sem rumo sem o senhor. 🫡', 'Tudo em ordem por aqui, chefe. Bem-vindo de volta! 🐦‍⬛']
    },
    ela: {
      saudacoes: ['Olha quem apareceu! 🔦', 'Ela voltou! 😍', 'Até que enfim, linda! 🌹'],
      extras: [
        'Sentimos sua falta, hein! Como você tá? 💕',
        'O grupo ficou sem graça sem você. Me conta, como você tá? 😌',
        'Pensei que tinha esquecido da gente. Como você tá? 👀',
        'Que saudade! Por onde andou? ✨'
      ]
    },
    ele: {
      saudacoes: ['Olha quem apareceu! 🔦', 'O sumido voltou! 😎', 'Ressuscitou, irmão! ⚰️➡️🕺'],
      extras: [
        'Sentimos sua falta, hein! Como você tá? 🤜🤛',
        'Achei que tinha sido abduzido. Como você tá, mano? 👽',
        'Por onde andou, parceiro? Conta aí. 👀',
        'Já ia abrir um B.O. de desaparecido. Como você tá? 🚨😂'
      ]
    },
    todos: {
      saudacoes: ['Olha quem apareceu! 🔦', 'Voltou! 🎉'],
      extras: ['Sentimos sua falta, hein! Como você tá?', 'Por onde andou? Conta aí. 👀', 'Que bom te ver de volta! ✨']
    }
  }
}
