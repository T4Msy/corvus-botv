'use strict'

/**
 * Frases das saudações automáticas (lib/saudacao.js). Para cada período:
 *  - ela:   tom de um cara cumprimentando uma mulher (galanteio leve)
 *  - ele:   tom de parceiro, puxando assunto
 *  - todos: quem não deu pra saber (serve pra qualquer pessoa)
 *  - chefe: os donos do Corvus
 * A resposta junta uma `saudacoes` (em negrito) com uma `extras` embaixo.
 */

module.exports = {
  dia: {
    ela: {
      saudacoes: [
        'Bom dia, linda! ☀️', 'Bom dia, gata! 😏', 'Bom dia, princesa! 👑', 'Bom dia, moça bonita! 😊',
        'Bom dia, linda! Acordou mais bonita hoje? 😉', 'Bom dia, flor do grupo! 🌹', 'Bom dia, maravilhosa! ✨',
        'Bom dia, dona do sorriso mais bonito! 😍'
      ],
      extras: [
        'Seu bom dia já melhorou o meu. 😌',
        'Dormiu bem? Aposto que sonhou comigo. 😂',
        'Já tomou seu café ou quer que eu pague um? ☕',
        'Com esse bom dia o grupo até ficou mais bonito. ✨',
        'E aí, quais os planos pra hoje? 👀',
        'Avisa quando sorrir que o sol fica com inveja. 🌞',
        'Se o dia começou com você, já começou bem. 💫',
        'Acordou linda assim ou já é de fábrica? 😏',
        'Que seu dia seja leve igual seu sorriso. 🌷',
        'Hoje tá com cara de dia bom, e você ajudou nisso. ☀️',
        'Tomou café? Porque beleza assim cansa, hein. 😂☕',
        'Fala aí, qual a música que vai embalar seu dia? 🎶'
      ]
    },
    ele: {
      saudacoes: [
        'Bom dia, irmão! Suave? 🤜🤛', 'Bom dia, mano! Tranquilo? 😎', 'Bom dia, parceiro! Firmeza? 💪',
        'Bom dia, chefe! Como é que tá? 🍷', 'Bom dia, meu consagrado! 🙌', 'Bom dia, guerreiro! ⚔️'
      ],
      extras: [
        'Bora que hoje o dia é nosso. 🔥',
        'Já tomou o café pra ligar o sistema? ☕',
        'E aí, qual é a boa de hoje?',
        'Viu o jogo ontem? ⚽',
        'Hoje é dia de fazer acontecer. 🚀',
        'Dormiu ou só piscou? 😂',
        'Levanta que o boleto não se paga sozinho. 💸',
        'Treino hoje ou vai deixar pra segunda? 🏋️',
        'Partiu vencer mais um dia. 🏆'
      ]
    },
    todos: {
      saudacoes: ['Bom dia! ☀️', 'Bom diaaa! 🌤️', 'Bom dia, bom dia! 🍷', 'Bom dia, luz do grupo! ✨'],
      extras: [
        'Já tomou café? ☕',
        'Dormiu bem? 😴',
        'Qual o plano pra hoje?',
        'Que hoje seja leve e cheio de coisa boa. 🌱',
        'Bora que o dia tá só começando! 🚀',
        'Qual música tá na sua cabeça hoje? 🎶'
      ]
    },
    chefe: {
      saudacoes: ['Bom dia, chefe! 👑', 'Bom dia, patrão! 🍷', 'Bom dia, meu chefe! 🫡', 'Bom dia, chefia! Tudo nos conformes? 😎', 'O chefe chegou! Bom dia! 👑'],
      extras: [
        'O império Masayoshi não para, e o senhor sabe disso. 🏛️',
        'Ordens do dia? Tô aqui pra cumprir. 🫡',
        'Café servido, grupo em ordem e o Corvus de prontidão. ☕🐦‍⬛',
        'Com o chefe acordado, o grupo já tá em outro nível. 🔥',
        'Grande líder, a Masayoshi agradece a presença. 🍷',
        'Diga o que precisa, chefe. O Corvus resolve. 💼'
      ]
    }
  },

  tarde: {
    ela: {
      saudacoes: [
        'Boa tarde, linda! 🌤️', 'Boa tarde, gata! 😏', 'Boa tarde, princesa! 👑', 'Boa tarde, moça bonita! 🌸',
        'Boa tarde, maravilhosa! ✨', 'Boa tarde, dona do grupo! 💅'
      ],
      extras: [
        'Sua tarde tá tão bonita quanto você? 😌',
        'Já almoçou ou vai me deixar preocupado? 🍽️',
        'Chegou e a tarde ficou mais bonita. ☀️',
        'Tá sobrevivendo ao sono pós-almoço? 😴😂',
        'Me conta, o que de bom aconteceu hoje? 👀',
        'Uma tarde dessas pede um açaí… e companhia. 🍧😏',
        'Se a tarde tá corrida, para um minutinho e sorri. 🌷',
        'Com você aqui o grupo até esquentou. 🔥'
      ]
    },
    ele: {
      saudacoes: ['Boa tarde, irmão! Suave? 🤜🤛', 'Boa tarde, mano! Firmeza? 😎', 'Boa tarde, parceiro! 💪', 'Boa tarde, meu consagrado! 🙌'],
      extras: [
        'Já almoçou? Qual foi o rango de hoje? 🍛',
        'Sobreviveu à moleza pós-almoço? 😴',
        'E aí, a tarde tá produtiva ou tá só enrolando? 😂',
        'Bora que ainda dá pra salvar o dia. 🚀',
        'Café da tarde ou já tá no modo soneca? ☕',
        'Qual vai ser a boa de hoje à noite? 🌙'
      ]
    },
    todos: {
      saudacoes: ['Boa tarde! 🌤️', 'Boa tardeee! ☀️', 'Boa tarde, boa tarde! 🍷', 'Boa tarde, tudo bem? ✨'],
      extras: [
        'Já almoçou? 🍽️',
        'Como tá sendo o dia até agora?',
        'Bora que a tarde tá só começando. 🚀',
        'Um cafezinho da tarde cai bem, né? ☕',
        'Que a tarde seja leve. 🌱'
      ]
    },
    chefe: {
      saudacoes: ['Boa tarde, chefe! 👑', 'Boa tarde, patrão! 🍷', 'Boa tarde, chefia! 🫡', 'O chefe apareceu! Boa tarde! 👑'],
      extras: [
        'Relatório da tarde: grupo em ordem e o Corvus de olho. 🐦‍⬛',
        'Almoço do chefe foi à altura? 🍽️',
        'Ordens pra tarde? Tô de prontidão. 🫡',
        'A Masayoshi segue firme sob seu comando. 🏛️',
        'Chefe presente, tarde garantida. 🔥'
      ]
    }
  },

  noite: {
    ela: {
      saudacoes: [
        'Boa noite, linda! 🌙', 'Boa noite, gata! 😏', 'Boa noite, princesa! 👑', 'Boa noite, moça bonita! ✨',
        'Boa noite, estrela do grupo! ⭐', 'Boa noite, maravilhosa! 🌹'
      ],
      extras: [
        'A lua tá bonita hoje, mas não mais que você. 🌙',
        'Como foi seu dia? Quero saber de tudo. 👀',
        'Se for dormir, sonha comigo. 😂💤',
        'Descansa bem, que amanhã o grupo precisa desse sorriso. 😊',
        'Noite boa é noite com você online. 😌',
        'Já jantou ou quer que eu peça uma pizza? 🍕',
        'Que sua noite seja tão linda quanto você. ✨',
        'Dorme bem, princesa. Amanhã tem mais. 💤'
      ]
    },
    ele: {
      saudacoes: ['Boa noite, irmão! Suave? 🤜🤛', 'Boa noite, mano! 😎', 'Boa noite, parceiro! 🌙', 'Boa noite, meu consagrado! 🙌'],
      extras: [
        'E aí, como foi o dia? Vitória ou derrota? 🏆',
        'Hoje tem jogo, série ou só cama? 📺',
        'Já jantou? Qual foi a janta? 🍔',
        'Descansa que amanhã tem mais batalha. ⚔️',
        'Bora um game hoje ou vai dormir cedo? 🎮',
        'Missão do dia cumprida? 💪'
      ]
    },
    todos: {
      saudacoes: ['Boa noite! 🌙', 'Boa noiteee! ✨', 'Boa noite, boa noite! 🍷', 'Boa noite, tudo certo? ⭐'],
      extras: [
        'Como foi o dia? 👀',
        'Já jantou? 🍽️',
        'Descansa bem! 💤',
        'Que a noite seja tranquila. 🌙',
        'Bora encerrar o dia com chave de ouro. 🔑'
      ]
    },
    chefe: {
      saudacoes: ['Boa noite, chefe! 👑', 'Boa noite, patrão! 🍷', 'Boa noite, chefia! 🫡', 'Boa noite, grande líder! 🌙'],
      extras: [
        'Mais um dia de império Masayoshi concluído com sucesso. 🏛️',
        'Pode descansar, chefe. O Corvus fica de vigia. 🐦‍⬛🌙',
        'Missão do dia cumprida. Ordens pra amanhã? 🫡',
        'Um brinde ao chefe antes de dormir. 🥂',
        'Grupo em ordem, chefe. Boa noite e bom descanso. 💤'
      ]
    }
  }
}
