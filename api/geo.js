// Vercel Serverless Function — /api/geo
// Segunda geolocalização ("Geolocalização Vendas Cidades"), independente da
// planilha principal. GET action=list é leitura (qualquer usuário da empresa);
// POST action=import é upload de CSV, restrito a admin ativo (mesma regra de
// api/upload.js).

const crypto = require('crypto')
const fs = require('fs')
const { formidable } = require('formidable')
const { createClient } = require('@supabase/supabase-js')

const strip = s => (s?.charCodeAt(0) === 0xFEFF ? s.slice(1) : s ?? '')

function normalizeStr(s) {
  return String(s || '').toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim()
}

function chunk(arr, size) {
  const out = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

const MESES_PT = {
  JANEIRO: 1, FEVEREIRO: 2, MARCO: 3, ABRIL: 4, MAIO: 5, JUNHO: 6,
  JULHO: 7, AGOSTO: 8, SETEMBRO: 9, OUTUBRO: 10, NOVEMBRO: 11, DEZEMBRO: 12,
}

function parseNumeroPtBr(raw) {
  if (raw == null) return { valor: null, semVenda: false }
  const s = String(raw).trim()
  if (!s) return { valor: null, semVenda: false }
  if (/^sem venda$/i.test(s)) return { valor: null, semVenda: true }
  const n = Number(s.replace(/\./g, '').replace(',', '.'))
  return { valor: isNaN(n) ? null : n, semVenda: false }
}

// Parser simples de CSV com ';' como delimitador — sem campos entre aspas
// no formato de origem, então split direto é suficiente e previsível.
function parseCsv(text) {
  const clean = text.replace(/^﻿/, '').replace(/\r\n/g, '\n')
  const lines = clean.split('\n').map(l => l.trim()).filter(Boolean)
  return lines.map(l => l.split(';').map(f => f.trim()))
}

function getSupabase() {
  return createClient(
    strip(process.env.SUPABASE_URL),
    strip(process.env.SUPABASE_SERVICE_KEY),
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

module.exports = async function handler(req, res) {
  try {
    const token = (req.headers.authorization || '').replace('Bearer ', '').trim()
    if (!token) return res.status(401).json({ error: 'Token ausente' })

    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
      return res.status(500).json({ error: 'SUPABASE_URL / SUPABASE_SERVICE_KEY não configurados' })
    }
    const supabase = getSupabase()

    const { data: { user }, error: authErr } = await supabase.auth.getUser(token)
    if (authErr || !user) return res.status(401).json({ error: 'Token inválido ou expirado' })

    const { data: perfil } = await supabase
      .from('perfis')
      .select('role, ativo, company_id')
      .eq('user_id', user.id)
      .single()

    if (!perfil || !perfil.ativo) return res.status(403).json({ error: 'Usuário inativo ou sem perfil' })

    // "import" chega via multipart (query string), as demais ações POST via JSON body
    const action = req.query.action || (req.body || {}).action

    // ── list — leitura por qualquer usuário ativo da empresa ────────────────────
    if (req.method === 'GET' && action === 'list') {
      const companyId = perfil.role === 'master' ? req.query.company_id : perfil.company_id
      if (!companyId) return res.status(400).json({ error: 'company_id não definido' })

      const { data: setores, error: setoresErr } = await supabase
        .from('geo_setores_rotas')
        .select('nome, nome_norm, ativo')
        .eq('company_id', companyId)
        .order('nome')
      if (setoresErr) return res.status(500).json({ error: setoresErr.message })

      const { data: vendas, error: vendasErr } = await supabase
        .from('geo_vendas_cidades')
        .select('setor_rota_norm, regiao, cidade_origem, cidade_norm, media_trimestre, venda_mes, mes_referencia, sem_venda')
        .eq('company_id', companyId)
      if (vendasErr) return res.status(500).json({ error: vendasErr.message })

      // mesma resolução de coordenadas usada por clientes: cidades_depara
      // manual tem prioridade sobre o lat/lon herdado de cidades_ibge
      const cidadeCoords = new Map()
      for (let from = 0; ; from += 1000) {
        const { data: dep, error } = await supabase
          .from('cidades_depara')
          .select('cidade_norm, latitude, longitude, codigo_ibge, cidades_ibge(latitude, longitude)')
          .eq('company_id', companyId)
          .range(from, from + 999)
        if (error) return res.status(500).json({ error: error.message })
        for (const d of dep || []) {
          if (d.latitude != null && d.longitude != null) {
            cidadeCoords.set(d.cidade_norm, { lat: d.latitude, lng: d.longitude })
          } else if (d.codigo_ibge && d.cidades_ibge) {
            cidadeCoords.set(d.cidade_norm, { lat: d.cidades_ibge.latitude, lng: d.cidades_ibge.longitude })
          }
        }
        if (!dep || dep.length < 1000) break
      }

      const vendasComCoords = (vendas || []).map(v => {
        const coords = cidadeCoords.get(v.cidade_norm)
        return { ...v, latitude: coords?.lat ?? null, longitude: coords?.lng ?? null }
      })

      return res.status(200).json({ setores: setores || [], vendas: vendasComCoords })
    }

    // ── import — POST multipart, somente admin ativo ────────────────────────────
    if (req.method === 'POST' && action === 'import') {
      if (perfil.role !== 'admin') return res.status(403).json({ error: 'Somente admin pode fazer upload' })
      if (!perfil.company_id) return res.status(403).json({ error: 'Admin sem empresa associada' })
      const companyId = perfil.company_id

      const form = formidable({ maxFileSize: 20 * 1024 * 1024 })
      let files
      try {
        ;[, files] = await form.parse(req)
      } catch (e) {
        return res.status(400).json({ error: 'Erro ao processar upload: ' + e.message })
      }

      const uploadedFile = files.file?.[0]
      if (!uploadedFile) return res.status(400).json({ error: 'Campo "file" não encontrado. Envie o arquivo com o campo "file".' })

      const buffer = fs.readFileSync(uploadedFile.filepath)
      const filename = uploadedFile.originalFilename || 'geo_vendas_cidades.csv'
      const hashSha256 = crypto.createHash('sha256').update(buffer).digest('hex')

      const table = parseCsv(buffer.toString('utf8'))
      if (table.length < 2) return res.status(400).json({ error: 'CSV vazio ou sem linhas de dados' })

      const header = table[0].map(h => normalizeStr(h))
      if (header.length < 5) {
        return res.status(400).json({ error: 'Esperado 5 colunas: SETORES/ROTAS;REGIAO;MUNICIPIO;M. TRIMESTRE;<mês>' })
      }
      const mesLabel = header[4].replace(/^M[EÊ]S\s*/, '').trim()
      const mesNum = MESES_PT[normalizeStr(mesLabel)]
      if (!mesNum) {
        return res.status(400).json({ error: `Coluna do mês não reconhecida: "${table[0][4]}". Use o nome do mês por extenso (ex: JULHO).` })
      }
      const anoAtual = new Date().getFullYear()
      const mesReferencia = `${anoAtual}-${String(mesNum).padStart(2, '0')}-01`

      const rowsMap = new Map()
      const setoresMap = new Map()
      for (let i = 1; i < table.length; i++) {
        const cols = table[i]
        const [setorRaw, regiaoRaw, municipioRaw, trimestreRaw, vendaRaw] = cols
        if (!municipioRaw || !municipioRaw.trim()) continue // linha de total/rodapé

        const setorNorm = normalizeStr(setorRaw)
        if (!setorNorm) continue
        if (!setoresMap.has(setorNorm)) {
          setoresMap.set(setorNorm, { company_id: companyId, nome: setorRaw.trim(), nome_norm: setorNorm })
        }

        const cidadeNorm = normalizeStr(municipioRaw)
        const { valor: media, semVenda: sv1 } = parseNumeroPtBr(trimestreRaw)
        const { valor: venda, semVenda: sv2 } = parseNumeroPtBr(vendaRaw)

        rowsMap.set(`${setorNorm}::${cidadeNorm}`, {
          company_id: companyId,
          setor_rota_norm: setorNorm,
          regiao: regiaoRaw ? regiaoRaw.trim() : null,
          cidade_origem: municipioRaw.trim(),
          cidade_norm: cidadeNorm,
          media_trimestre: media,
          venda_mes: venda,
          mes_referencia: mesReferencia,
          sem_venda: sv1 && sv2,
        })
      }

      if (!rowsMap.size) return res.status(400).json({ error: 'Nenhuma linha válida encontrada no CSV' })

      let uploadStatus = 'ok'
      let errorMsg = null

      try {
        // setores/rotas: nunca truncar, só adiciona os novos (mesma regra de equipes)
        const setoresRows = [...setoresMap.values()]
        for (const batch of chunk(setoresRows, 500)) {
          const { error } = await supabase
            .from('geo_setores_rotas')
            .upsert(batch, { onConflict: 'company_id,nome_norm', ignoreDuplicates: true })
          if (error) throw new Error('geo_setores_rotas: ' + error.message)
        }

        // dados: substitui tudo (mesma regra de vendas_mensais)
        const { error: delErr } = await supabase.from('geo_vendas_cidades').delete().eq('company_id', companyId)
        if (delErr) throw new Error('truncate geo_vendas_cidades: ' + delErr.message)

        const dataRows = [...rowsMap.values()]
        for (const batch of chunk(dataRows, 500)) {
          const { error } = await supabase.from('geo_vendas_cidades').insert(batch)
          if (error) throw new Error('geo_vendas_cidades: ' + error.message)
        }

        // de/para de cidades — reaproveita a MESMA tabela usada pela planilha principal
        const existentes = new Set()
        for (let from = 0; ; from += 1000) {
          const { data: dep, error } = await supabase
            .from('cidades_depara')
            .select('cidade_norm')
            .eq('company_id', companyId)
            .range(from, from + 999)
          if (error) throw error
          for (const d of dep || []) existentes.add(d.cidade_norm)
          if (!dep || dep.length < 1000) break
        }

        const cidadesPlanilha = new Map()
        for (const r of dataRows) {
          if (!cidadesPlanilha.has(r.cidade_norm)) cidadesPlanilha.set(r.cidade_norm, r.cidade_origem)
        }
        const novas = [...cidadesPlanilha.keys()].filter(n => !existentes.has(n))

        if (novas.length) {
          const { data: ufParam } = await supabase
            .from('parametros')
            .select('valor')
            .eq('company_id', companyId)
            .eq('chave', 'uf_padrao')
            .maybeSingle()
          const ufPadrao = (ufParam?.valor || 'MG').toUpperCase()

          const matches = new Map()
          for (const batch of chunk(novas, 200)) {
            const { data: ibge, error } = await supabase
              .from('cidades_ibge')
              .select('codigo_ibge, nome_norm, uf')
              .in('nome_norm', batch)
            if (error) throw error
            for (const c of ibge || []) {
              if (!matches.has(c.nome_norm)) matches.set(c.nome_norm, [])
              matches.get(c.nome_norm).push(c)
            }
          }

          const deparaRows = novas.map(norm => {
            const cands = matches.get(norm) || []
            let escolhido = null
            if (cands.length === 1) escolhido = cands[0]
            else if (cands.length > 1) escolhido = cands.find(c => c.uf === ufPadrao) || null
            return {
              company_id: companyId,
              cidade_origem: cidadesPlanilha.get(norm),
              cidade_norm: norm,
              codigo_ibge: escolhido?.codigo_ibge ?? null,
              status: escolhido ? 'auto' : 'pendente',
            }
          })

          for (const batch of chunk(deparaRows, 500)) {
            const { error } = await supabase
              .from('cidades_depara')
              .upsert(batch, { onConflict: 'company_id,cidade_origem', ignoreDuplicates: true })
            if (error) throw error
          }
        }

        const storagePath = `${companyId}/geo/${Date.now()}_${filename}`
        const { error: storErr } = await supabase.storage
          .from('planilhas')
          .upload(storagePath, buffer, { contentType: 'text/csv' })
        if (storErr) console.warn('Storage upload warning:', storErr.message)

      } catch (err) {
        uploadStatus = 'error'
        errorMsg = err.message
      }

      await supabase.from('uploads_geo').insert({
        company_id: companyId,
        filename,
        hash_sha256: hashSha256,
        uploaded_by: user.id,
        status: uploadStatus,
        row_count: rowsMap.size,
        error_msg: errorMsg,
        mes_referencia: mesReferencia,
      })

      if (uploadStatus === 'error') return res.status(500).json({ error: errorMsg })

      return res.status(200).json({
        ok: true,
        filename,
        rowCount: rowsMap.size,
        setoresCount: setoresMap.size,
        mesReferencia,
      })
    }

    return res.status(400).json({ error: 'Ação desconhecida: ' + action })
  } catch (err) {
    console.error('Unhandled error in geo handler:', err)
    return res.status(500).json({ error: 'Erro interno: ' + (err.message || String(err)) })
  }
}
