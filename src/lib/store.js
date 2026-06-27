'use strict'

const fs = require('fs')
const fsp = require('fs/promises')
const path = require('path')

const DATA_DIR = path.resolve(__dirname, '..', '..', 'data')

/**
 * Coleção persistida em um único arquivo JSON (data/<name>.json).
 *
 * - Mantém os dados em cache na memória (leituras são síncronas e baratas).
 * - Escritas são serializadas numa fila e gravadas de forma ATÔMICA
 *   (escreve em <file>.tmp e renomeia), evitando corrupção em caso de crash
 *   e condições de corrida — os dois problemas do legado (fs.writeFileSync solto).
 */
class Store {
  constructor (name) {
    this.file = path.join(DATA_DIR, `${name}.json`)
    this.cache = this._loadSync()
    this._queue = Promise.resolve()
  }

  _loadSync () {
    try {
      return JSON.parse(fs.readFileSync(this.file, 'utf-8'))
    } catch {
      return {}
    }
  }

  /** Enfileira a persistência do estado atual de forma atômica. */
  _persist () {
    this._queue = this._queue.then(async () => {
      await fsp.mkdir(DATA_DIR, { recursive: true })
      const tmp = `${this.file}.tmp`
      await fsp.writeFile(tmp, JSON.stringify(this.cache, null, 2))
      await fsp.rename(tmp, this.file)
    }).catch((err) => {
      console.error(`[store] falha ao persistir ${this.file}:`, err)
    })
    return this._queue
  }

  get (key, fallback) {
    return Object.prototype.hasOwnProperty.call(this.cache, key)
      ? this.cache[key]
      : fallback
  }

  all () {
    return this.cache
  }

  set (key, value) {
    this.cache[key] = value
    return this._persist()
  }

  /** Atualiza uma chave via função pura: update(k, prev => next, default). */
  update (key, fn, fallback) {
    const prev = this.get(key, fallback)
    this.cache[key] = fn(prev)
    return this._persist()
  }

  delete (key) {
    delete this.cache[key]
    return this._persist()
  }
}

// Coleções compartilhadas (singletons por nome).
const instances = new Map()
function store (name) {
  if (!instances.has(name)) instances.set(name, new Store(name))
  return instances.get(name)
}

module.exports = { store, Store, DATA_DIR }
