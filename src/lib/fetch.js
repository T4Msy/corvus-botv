'use strict'

const axios = require('axios')

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/120.0 Safari/537.36'

/**
 * Baixa uma URL e retorna um Buffer.
 */
async function getBuffer (url, options = {}) {
  const res = await axios({
    method: 'get',
    url,
    headers: { 'User-Agent': UA, ...(options.headers || {}) },
    responseType: 'arraybuffer',
    ...options
  })
  return Buffer.from(res.data)
}

/**
 * Faz GET e retorna JSON já parseado.
 */
async function fetchJson (url, options = {}) {
  const res = await axios({
    method: 'get',
    url,
    headers: { 'User-Agent': UA, Accept: 'application/json', ...(options.headers || {}) },
    ...options
  })
  return res.data
}

module.exports = { getBuffer, fetchJson }
