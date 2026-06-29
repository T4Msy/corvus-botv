'use strict'

const { createWorker } = require('tesseract.js')

let workerPromise = null

// Reaproveita um único worker (o modelo de idioma é baixado na 1ª vez).
function getWorker () {
  if (!workerPromise) workerPromise = createWorker('por+eng')
  return workerPromise
}

/**
 * Extrai texto de uma imagem (buffer). Retorna string (pode ser vazia).
 */
async function readText (buffer) {
  const worker = await getWorker()
  const { data } = await worker.recognize(buffer)
  return (data.text || '').trim()
}

module.exports = { readText }
