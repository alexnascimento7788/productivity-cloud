// Popula a tabela global cidades_ibge com os 5570 municípios brasileiros
// (dataset kelvins/municipios-brasileiros, com latitude/longitude).
// Uso: node scripts/seed-ibge.js   (lê SUPABASE_URL/SUPABASE_SERVICE_KEY de .env.local)

const fs = require('fs')
const path = require('path')
const { createClient } = require('@supabase/supabase-js')

const strip = s => (s?.charCodeAt(0) === 0xFEFF ? s.slice(1) : s ?? '')

function loadEnv() {
  const envPath = path.join(__dirname, '..', '.env.local')
  const content = fs.readFileSync(envPath, 'utf8')
  const env = {}
  for (const line of content.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.+)\s*$/)
    if (m) env[strip(m[1])] = m[2].trim()
  }
  return env
}

function normalize(s) {
  return String(s || '').toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim()
}

async function fetchCsv(url) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`HTTP ${res.status} em ${url}`)
  const text = await res.text()
  const lines = text.replace(/^﻿/, '').split('\n').map(l => l.trim()).filter(Boolean)
  const headers = lines[0].split(',')
  return lines.slice(1).map(line => {
    const vals = line.split(',')
    return Object.fromEntries(headers.map((h, i) => [h, vals[i]]))
  })
}

async function main() {
  const env = loadEnv()
  const supabase = createClient(strip(env.SUPABASE_URL), strip(env.SUPABASE_SERVICE_KEY), {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  console.log('Baixando estados...')
  const estados = await fetchCsv('https://raw.githubusercontent.com/kelvins/municipios-brasileiros/main/csv/estados.csv')
  const ufMap = Object.fromEntries(estados.map(e => [e.codigo_uf, e.uf]))

  console.log('Baixando municípios...')
  const municipios = await fetchCsv('https://raw.githubusercontent.com/kelvins/municipios-brasileiros/main/csv/municipios.csv')

  const rows = municipios.map(m => ({
    codigo_ibge: Number(m.codigo_ibge),
    nome: m.nome,
    nome_norm: normalize(m.nome),
    uf: ufMap[m.codigo_uf] || '??',
    latitude: Number(m.latitude),
    longitude: Number(m.longitude),
  })).filter(r => r.codigo_ibge && r.nome && !isNaN(r.latitude) && !isNaN(r.longitude))

  console.log(`${rows.length} municípios preparados. Inserindo em lotes...`)

  for (let i = 0; i < rows.length; i += 1000) {
    const batch = rows.slice(i, i + 1000)
    const { error } = await supabase.from('cidades_ibge').upsert(batch, { onConflict: 'codigo_ibge' })
    if (error) {
      console.error(`Erro no lote ${i / 1000 + 1}:`, error.message)
      process.exit(1)
    }
    console.log(`  lote ${i / 1000 + 1}/${Math.ceil(rows.length / 1000)} ok`)
  }

  const { count } = await supabase.from('cidades_ibge').select('*', { count: 'exact', head: true })
  console.log(`Concluído. Total na tabela: ${count}`)
}

main().catch(e => { console.error(e); process.exit(1) })
