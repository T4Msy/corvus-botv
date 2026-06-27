'use strict'

/**
 * Formata um número grande em forma compacta (1200 -> "1.2 K").
 */
function h2k (number) {
  const POSTFIXES = ['', ' K', ' M', ' G', ' T', ' P', ' E']
  const n = Number(number) || 0
  if (n === 0) return '0'
  const tier = (Math.log10(Math.abs(n)) / 3) | 0
  if (tier === 0) return String(n)
  const scaled = n / Math.pow(10, tier * 3)
  return scaled.toFixed(1).replace(/\.0$/, '') + POSTFIXES[tier]
}

/**
 * Converte um total de segundos em "Xd Xh Xm Xs".
 */
function formatUptime (seconds) {
  const s = Math.floor(seconds)
  const d = Math.floor(s / 86400)
  const h = Math.floor((s % 86400) / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  return [d && `${d}d`, h && `${h}h`, m && `${m}m`, `${sec}s`]
    .filter(Boolean)
    .join(' ')
}

module.exports = { h2k, formatUptime }
