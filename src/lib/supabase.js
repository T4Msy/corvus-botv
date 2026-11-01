'use strict'

/**
 * Acesso mínimo ao banco do Portal MSY (Supabase REST) para os avisos
 * automáticos. Usa a chave secreta (service role), que ignora o RLS —
 * fica só no .env do servidor: SUPABASE_URL e SUPABASE_SERVICE_KEY.
 */

const URL = String(process.env.SUPABASE_URL || '').replace(/\/$/, '')
const KEY = process.env.SUPABASE_SERVICE_KEY || ''

function enabled () {
  return Boolean(URL && KEY)
}

function headers (extra = {}) {
  const h = { apikey: KEY, 'Content-Type': 'application/json', ...extra }
  // Chaves antigas (JWT) também vão no Authorization; as novas (sb_secret_) só no apikey.
  if (KEY.startsWith('eyJ')) h.Authorization = `Bearer ${KEY}`
  return h
}

async function rest (path, { method = 'GET', body, prefer } = {}) {
  const res = await fetch(`${URL}/rest/v1/${path}`, {
    method,
    headers: headers(prefer ? { Prefer: prefer } : {}),
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(15000)
  })
  const text = await res.text()
  if (!res.ok) throw new Error(`Supabase ${res.status}: ${text.slice(0, 200)}`)
  return text ? JSON.parse(text) : null
}

/** GET /rest/v1/<path> — path no formato do PostgREST (tabela?select=...&filtro). */
function select (path) {
  return rest(path)
}

/** Insere linhas; com `ignoreDuplicates` devolve só as que entraram de fato. */
function insert (table, rows, { ignoreDuplicates = false } = {}) {
  return rest(table, {
    method: 'POST',
    body: rows,
    prefer: ignoreDuplicates ? 'return=representation,resolution=ignore-duplicates' : 'return=minimal'
  })
}

module.exports = { enabled, select, insert }
