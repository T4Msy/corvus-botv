'use strict'

const { store } = require('./store')
const saudacao = require('./saudacao')
const FRASES = require('../data/respostas')

/**
 * Respostas automáticas além das saudações, no mesmo tom (chefe/ela/ele/todos):
 *  - "obrigado, Corvus" e "te amo, Corvus" (precisa citar o bot ou responder a ele)
 *  - "tô triste" / "dia ruim" (carinho; não precisa citar o bot)
 *  - "olha quem apareceu" para quem volta a falar depois de SUMIDO_DIAS
 * As frases ficam em src/data/respostas.js.
 */

const SUMIDO_DIAS = 3
const lastSeen = store('lastseen') // grupo → { pessoa: timestamp da última mensagem }

// O bot foi citado pelo nome ("corvus", "bot") — ou a mensagem responde a ele.
// (?<!\p{L}) / (?!\p{L}) = limite de palavra que entende acento (o \b não entende "você").
const NOME_RE = /(?<!\p{L})(corvus|corvo|bot)(?!\p{L})/iu
const OBRIGADO_RE = /(?<!\p{L})(obrigad[oa]|brigad[oa]|obg|valeu+|vlw+|agrade[cç]o|grat[oa])(?!\p{L})/iu
const AMOR_RE = /(?<!\p{L})(te\s*amo|amo\s*(voc[eê]|vc|tu|o\s*corvus)|amo\s*demais)(?!\p{L})/iu

// Tristeza dita em primeira pessoa ("tô triste", "dia ruim"…) — não precisa
// citar o bot. "Triste que o jogo acabou" não entra: tem que ser "tô/estou…".
const TRISTE_RE = new RegExp(
  '(?<!\\p{L})(' +
    '(t[oôó]|tou|estou|t[oô]\\s*me\\s*sentindo|me\\s*sinto|fiquei|ando)\\s*(muito\\s*|t[aã]o\\s*|meio\\s*|bem\\s*)?' +
      '(triste|mal|p[eé]ssim[oa]|pra\\s*baixo|chatead[oa]|desanimad[oa]|deprimid[oa]|sozinh[oa]|cansad[oa]\\s*de\\s*tudo|na\\s*bad)' +
    '|dia\\s*(muito\\s*)?(ruim|horr[ií]vel|p[eé]ssimo|dif[ií]cil|de\\s*merda|bosta)' +
    '|(que|q)\\s*(dia|semana)\\s*(ruim|horr[ií]vel|p[eé]ssim[oa]|dif[ií]cil)' +
  ')(?!\\p{L})', 'iu')

/** 'triste' quando a pessoa diz que está mal; sem citar o bot. */
function detectTriste (text) {
  return TRISTE_RE.test(text || '') ? 'triste' : null
}

/** 'amor' | 'obrigado' | null. `toBot` = a mensagem responde a uma do bot. */
function detect (text, { toBot = false } = {}) {
  if (!text || !(toBot || NOME_RE.test(text))) return null
  if (AMOR_RE.test(text)) return 'amor'
  if (OBRIGADO_RE.test(text)) return 'obrigado'
  return null
}

/**
 * Marca a mensagem de agora e diz se a pessoa estava sumida (sem falar no
 * grupo há SUMIDO_DIAS ou mais). Quem o bot nunca viu falar não conta.
 */
function touch (chat, sender, now = Date.now()) {
  const seen = lastSeen.get(chat, {})
  const before = seen[sender]
  lastSeen.update(chat, s => ({ ...s, [sender]: now }), {})
  return Boolean(before) && now - before >= SUMIDO_DIAS * 86400000
}

/** Texto da resposta `tipo` ('obrigado' | 'amor' | 'sumido'); opts como em saudacao.toneOf. */
async function reply (tipo, ids, opts) {
  return saudacao.format(FRASES[tipo][await saudacao.toneOf(ids, opts)])
}

module.exports = { detect, detectTriste, touch, reply, SUMIDO_DIAS }
