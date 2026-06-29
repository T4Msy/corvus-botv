'use strict'

const sharp = require('sharp')
const { createWorker } = require('tesseract.js')

let workerPromise = null

function getWorker () {
  if (!workerPromise) workerPromise = createWorker('por+eng')
  return workerPromise
}

/**
 * Extrai texto de uma imagem (buffer). Pré-processa com sharp para
 * melhorar a precisão do tesseract em imagens de baixo contraste.
 */
async function readText (buffer) {
  const processed = await sharp(buffer)
    .grayscale()
    .normalize()
    .resize({ width: 1200, withoutEnlargement: false })
    .toBuffer()

  const worker = await getWorker()
  const { data } = await worker.recognize(processed)
  return (data.text || '').trim()
}

module.exports = { readText }
