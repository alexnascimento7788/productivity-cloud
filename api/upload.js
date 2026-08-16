// Vercel Serverless Function — POST /api/upload
// Somente admin ativo. Faz truncate dos dados da empresa e reimporta.

const crypto = require('crypto')
const fs = require('fs')
const XLSX = require('xlsx')
const { formidable } = require('formidable')
const { createClient } = require('@supabase/supabase-js')

const strip = s => (s?.charCodeAt(0) === 0xFEFF ? s.slice(1) : s ?? '')

const REQUIRED_COLS = [
  'GR', 'RCA', 'Nome', 'SeqPessoa', 'Razao Social', 'Clas.Com',
  'Dt.Ult.Cmp', 'Dias.Ult.Cmp', 'Endereco', 'Numero', 'Bairro',
  'Cep', 'Cidade', 'Segmento', 'Limite Global', 'Monitorado',
]

function chunk(arr, size) {
  const out = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

const UF_CODES = new Set([
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG',
  'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
])

// Pré-processamento do nome da cidade vindo da planilha, tentando aproximar do
// formato oficial IBGE (cidades_ibge.nome_norm) para reduzir pendências manuais
// no de/para: remove sufixo de UF, pontuação e expande abreviações comuns.
function normalizeCity(s) {
  let v = String(s || '').toUpperCase().trim()
  v = v.normalize('NFD').replace(/[̀-ͯ]/g, '')
  v = v.replace(/[.,]/g, ' ')
  v = v.replace(/\s+/g, ' ').trim()
  // remove sufixo de UF ao final: "CIDADE - MG", "CIDADE/MG", "CIDADE (MG)"
  v = v.replace(/\s*[-/(]\s*([A-Z]{2})\)?\s*$/, (full, uf) => (UF_CODES.has(uf) ? '' : full))
  // abreviações comuns de município brasileiro
  v = v.replace(/\bSTO\b/g, 'SANTO').replace(/\bSTA\b/g, 'SANTA')
  v = v.replace(/^S\s+/, 'SAO ')
  v = v.replace(/\s+/g, ' ').trim()
  return v
}

// Distância de Levenshtein — usada só como fallback quando não há match exato,
// para sugerir automaticamente cidades com pequenas diferenças de digitação.
function levenshtein(a, b) {
  const m = a.length, n = b.length
  if (!m) return n
  if (!n) return m
  const dp = new Array(n + 1)
  for (let j = 0; j <= n; j++) dp[j] = j
  for (let i = 1; i <= m; i++) {
    let prev = dp[0]
    dp[0] = i
    for (let j = 1; j <= n; j++) {
      const tmp = dp[j]
      dp[j] = a[i - 1] === b[j - 1] ? prev : 1 + Math.min(prev, dp[j], dp[j - 1])
      prev = tmp
    }
  }
  return dp[n]
}

function parseDate(raw) {
  if (!raw) return null
  if (raw instanceof Date) return raw.toISOString().slice(0, 10)
  const s = String(raw)
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10)
  return null
}

// ── Handler ───────────────────────────────────────────────────────────────────
module.exports = async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' })
    }

    // ── 1. Autenticação ──────────────────────────────────────────────────────────
    const token = (req.headers.authorization || '').replace('Bearer ', '').trim()
    if (!token) return res.status(401).json({ error: 'Token ausente' })

    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
      return res.status(500).json({ error: 'SUPABASE_URL / SUPABASE_SERVICE_KEY não configurados' })
    }
    const supabase = createClient(strip(process.env.SUPABASE_URL), strip(process.env.SUPABASE_SERVICE_KEY))

    const { data: { user }, error: authErr } = await supabase.auth.getUser(token)
    if (authErr || !user) return res.status(401).json({ error: 'Token inválido ou expirado' })

    // ── 2. Verificar role admin e obter company_id ────────────────────────────────
    const { data: perfil } = await supabase
      .from('perfis')
      .select('role, ativo, company_id')
      .eq('user_id', user.id)
      .single()

    if (!perfil || !perfil.ativo) {
      return res.status(403).json({ error: 'Usuário inativo ou sem perfil' })
    }
    if (perfil.role !== 'admin') {
      return res.status(403).json({ error: 'Somente admin pode fazer upload' })
    }
    if (!perfil.company_id) {
      return res.status(403).json({ error: 'Admin sem empresa associada' })
    }

    const companyId = perfil.company_id

    // ── 3. Parse multipart ───────────────────────────────────────────────────────
    const form = formidable({ maxFileSize: 50 * 1024 * 1024 })
    let files
    try {
      ;[, files] = await form.parse(req)
    } catch (e) {
      return res.status(400).json({ error: 'Erro ao processar upload: ' + e.message })
    }

    const uploadedFile = files.file?.[0]
    if (!uploadedFile) {
      return res.status(400).json({ error: 'Campo "file" não encontrado. Envie o arquivo com o campo "file".' })
    }

    const buffer = fs.readFileSync(uploadedFile.filepath)
    const filename = uploadedFile.originalFilename || 'planilha.xlsx'

    // ── 4. SHA-256 ───────────────────────────────────────────────────────────────
    const hashSha256 = crypto.createHash('sha256').update(buffer).digest('hex')

    // ── 5. Leitura do xlsx ───────────────────────────────────────────────────────
    let rows
    try {
      const wb = XLSX.read(buffer, { type: 'buffer', cellDates: true })
      rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: null })
    } catch (e) {
      return res.status(400).json({ error: 'Não foi possível ler o arquivo Excel: ' + e.message })
    }

    if (!rows.length) return res.status(400).json({ error: 'A planilha está vazia' })

    // ── 6. Validação de colunas obrigatórias ─────────────────────────────────────
    const cols = Object.keys(rows[0])
    const missing = REQUIRED_COLS.filter(c => !cols.includes(c))
    if (missing.length) {
      return res.status(400).json({ error: `Colunas obrigatórias ausentes: ${missing.join(', ')}` })
    }

    // ── 7. Detectar colunas VD ───────────────────────────────────────────────────
    const vdCols = cols.filter(c => /^VD \d{4}-\d{1,2}$/.test(c))
    if (!vdCols.length) {
      return res.status(400).json({
        error: 'Nenhuma coluna "VD AAAA-MM" encontrada. Verifique os cabeçalhos da planilha.',
      })
    }

    // ── 8. Validação de Dias.Ult.Cmp ─────────────────────────────────────────────
    for (let i = 0; i < rows.length; i++) {
      const raw = rows[i]['Dias.Ult.Cmp']
      if (raw instanceof Date) {
        return res.status(400).json({
          error: `Linha ${i + 2}: "Dias.Ult.Cmp" foi lido como data (${raw.toISOString().slice(0, 10)}). ` +
                 `Deve ser um inteiro ≥ 0. Corrija o formato da célula no Excel (Geral ou Número Inteiro).`,
        })
      }
      if (raw !== null && raw !== undefined && raw !== '') {
        const n = Number(raw)
        if (isNaN(n)) {
          return res.status(400).json({
            error: `Linha ${i + 2}: "Dias.Ult.Cmp" com valor inválido "${raw}". Deve ser um número.`,
          })
        }
      }
    }

    // ── 9. Normalização ──────────────────────────────────────────────────────────
    const vendedoresMap = new Map()
    const clientesMap = new Map()
    const vendasList = []
    const ultimaCompraMap = new Map()

    for (const row of rows) {
      const gr  = Number(row['GR']  ?? 0) || 0
      const rca = Number(row['RCA'] ?? 0) || 0
      const seq = Number(row['SeqPessoa'] ?? 0) || 0

      if (!vendedoresMap.has(rca)) {
        vendedoresMap.set(rca, { company_id: companyId, rca, nome: String(row['Nome'] ?? ''), gr })
      }

      if (!clientesMap.has(seq)) {
        clientesMap.set(seq, {
          company_id:   companyId,
          seq_pessoa:   seq,
          razao_social: String(row['Razao Social'] ?? ''),
          endereco:     row['Endereco'] != null ? String(row['Endereco']) : null,
          numero:       row['Numero'] != null ? String(row['Numero']) : null,
          bairro:       row['Bairro'] != null ? String(row['Bairro']) : null,
          cep:          row['Cep'] != null ? String(row['Cep']) : null,
          cidade:       row['Cidade'] != null ? String(row['Cidade']) : null,
          segmento:     row['Segmento'] != null ? String(row['Segmento']) : null,
          clas_com:     row['Clas.Com'] != null ? Number(row['Clas.Com']) : null,
          limite_global: Number(row['Limite Global']) || 0,
          monitorado:   row['Monitorado'] != null && row['Monitorado'] !== '',
        })
      }

      for (const col of vdCols) {
        const m = col.match(/VD (\d{4})-(\d{1,2})/)
        if (!m) continue
        const valor = Number(row[col]) || 0
        if (!valor) continue // meses zerados não são gravados — reduz a tabela drasticamente
        vendasList.push({
          company_id: companyId,
          seq_pessoa: seq,
          rca,
          gr,
          ano_mes: `${m[1]}-${m[2].padStart(2, '0')}-01`,
          valor,
        })
      }

      const ucKey = `${seq}:${rca}:${gr}`
      if (!ultimaCompraMap.has(ucKey)) {
        const rawDias = row['Dias.Ult.Cmp']
        ultimaCompraMap.set(ucKey, {
          company_id:  companyId,
          seq_pessoa:  seq,
          rca,
          gr,
          dt_ult_cmp:   parseDate(row['Dt.Ult.Cmp']),
          dias_ult_cmp: rawDias != null && rawDias !== '' ? Math.round(Math.abs(Number(rawDias))) : null,
        })
      }
    }

    // ── 10. Truncate + Insert ─────────────────────────────────────────────────────
    let uploadStatus = 'ok'
    let errorMsg = null

    try {
      for (const table of ['vendas_mensais', 'ultima_compra', 'clientes', 'vendedores']) {
        const { error } = await supabase.from(table).delete().eq('company_id', companyId)
        if (error) throw new Error(`truncate ${table}: ${error.message}`)
      }

      for (const batch of chunk([...vendedoresMap.values()], 500)) {
        const { error } = await supabase.from('vendedores').insert(batch)
        if (error) throw new Error('vendedores: ' + error.message)
      }

      for (const batch of chunk([...clientesMap.values()], 500)) {
        const { error } = await supabase
          .from('clientes')
          .upsert(batch, { onConflict: 'company_id,seq_pessoa', ignoreDuplicates: false })
        if (error) throw new Error('clientes: ' + error.message)
      }

      for (const batch of chunk(vendasList, 500)) {
        const { error } = await supabase.from('vendas_mensais').insert(batch)
        if (error) throw new Error('vendas_mensais: ' + error.message)
      }

      for (const batch of chunk([...ultimaCompraMap.values()], 500)) {
        const { error } = await supabase.from('ultima_compra').insert(batch)
        if (error) throw new Error('ultima_compra: ' + error.message)
      }

      // ── 10b. Equipes: insere apenas códigos novos (NUNCA truncar) ────────────────
      const grsPlanilha = [...new Set([...vendedoresMap.values()].map(v => v.gr))]
      if (grsPlanilha.length) {
        const equipesNovas = grsPlanilha.map(g => ({
          company_id: companyId, cod_equipe: g, nome: 'Equipe ' + g, ativo: true,
        }))
        const { error: eqErr } = await supabase
          .from('equipes')
          .upsert(equipesNovas, { onConflict: 'company_id,cod_equipe', ignoreDuplicates: true })
        if (eqErr) console.warn('equipes upsert warning:', eqErr.message)
      }

      // ── 10c. De/Para de cidades: match automático com a base IBGE ────────────────
      // Apenas cidades novas — relacionamentos existentes são preservados.
      try {
        const cidadesPlanilha = new Map() // norm → original
        for (const c of clientesMap.values()) {
          if (c.cidade) {
            const norm = normalizeCity(c.cidade)
            if (norm && !cidadesPlanilha.has(norm)) cidadesPlanilha.set(norm, c.cidade)
          }
        }

        // de/para já existentes da empresa (paginado — PostgREST limita a 1000)
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

        const novas = [...cidadesPlanilha.keys()].filter(n => !existentes.has(n))

        if (novas.length) {
          // UF de preferência para desempate de nomes repetidos entre estados
          const { data: ufParam } = await supabase
            .from('parametros')
            .select('valor')
            .eq('company_id', companyId)
            .eq('chave', 'uf_padrao')
            .maybeSingle()
          const ufPadrao = (ufParam?.valor || 'MG').toUpperCase()

          // busca candidatos na base IBGE em lotes (match exato pelo nome normalizado)
          const matches = new Map() // norm → [{codigo_ibge, uf}]
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

          // fallback fuzzy: para as que não bateram exato, tenta a menor distância
          // de edição dentro da UF padrão da empresa — só assume se houver um único
          // candidato claramente mais próximo, para não gerar vínculo errado.
          const semMatch = novas.filter(norm => !matches.get(norm)?.length)
          if (semMatch.length) {
            const { data: ufCidades } = await supabase
              .from('cidades_ibge')
              .select('codigo_ibge, nome_norm, uf')
              .eq('uf', ufPadrao)

            for (const norm of semMatch) {
              if (norm.length < 4) continue // nomes muito curtos: risco alto de falso positivo
              let best = null, bestDist = Infinity, tie = false
              for (const c of ufCidades || []) {
                const d = levenshtein(norm, c.nome_norm)
                if (d < bestDist) { bestDist = d; best = c; tie = false }
                else if (d === bestDist) tie = true
              }
              const threshold = norm.length <= 7 ? 1 : 2
              if (best && !tie && bestDist > 0 && bestDist <= threshold) {
                matches.set(norm, [best])
              }
            }
          }

          const deparaRows = novas.map(norm => {
            const cands = matches.get(norm) || []
            let escolhido = null
            if (cands.length === 1) escolhido = cands[0]
            else if (cands.length > 1) escolhido = cands.find(c => c.uf === ufPadrao) || null
            return {
              company_id:    companyId,
              cidade_origem: cidadesPlanilha.get(norm),
              cidade_norm:   norm,
              codigo_ibge:   escolhido?.codigo_ibge ?? null,
              status:        escolhido ? 'auto' : 'pendente',
            }
          })

          for (const batch of chunk(deparaRows, 500)) {
            const { error } = await supabase
              .from('cidades_depara')
              .upsert(batch, { onConflict: 'company_id,cidade_origem', ignoreDuplicates: true })
            if (error) throw error
          }
        }
      } catch (depErr) {
        // de/para não pode derrubar o import — fica para tratamento manual
        console.warn('cidades_depara warning:', depErr.message)
      }

      // ── 11. Salvar xlsx no Storage ────────────────────────────────────────────────
      const storagePath = `${companyId}/${Date.now()}_${filename}`
      const { error: storErr } = await supabase.storage
        .from('planilhas')
        .upload(storagePath, buffer, {
          contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        })
      if (storErr) console.warn('Storage upload warning:', storErr.message)

    } catch (err) {
      uploadStatus = 'error'
      errorMsg = err.message
    }

    // ── 12. Registrar em uploads ──────────────────────────────────────────────────
    await supabase.from('uploads').insert({
      company_id:  companyId,
      filename,
      hash_sha256: hashSha256,
      uploaded_by: user.id,
      status:      uploadStatus,
      row_count:   rows.length,
      error_msg:   errorMsg,
    })

    if (uploadStatus === 'error') {
      return res.status(500).json({ error: errorMsg })
    }

    return res.status(200).json({
      ok:              true,
      filename,
      hash:            hashSha256,
      rowCount:        rows.length,
      mesesDetectados: vdCols.length,
    })

  } catch (err) {
    console.error('Unhandled error in upload handler:', err)
    return res.status(500).json({ error: 'Erro interno: ' + (err.message || String(err)) })
  }
}
