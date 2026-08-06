import { supabase } from './supabaseClient'

// O PostgREST limita cada select a 1000 linhas. Conta o total e baixa as
// páginas em paralelo (máx. 8 por vez para não estourar timeout/rate limit).
// `applyFilter` permite filtros extras (ex.: vendas com valor != 0).
async function fetchAll(table, select, companyId, applyFilter = q => q) {
  const PAGE = 1000
  const CONCURRENCY = 8

  let head = supabase.from(table).select('*', { count: 'exact', head: true })
  if (companyId) head = head.eq('company_id', companyId)
  head = applyFilter(head)
  const { count, error: cntErr } = await head
  if (cntErr) throw new Error(`${table}: ${cntErr.message || 'tempo limite excedido no banco (timeout)'}`)
  if (!count) return []

  const pages = Math.ceil(count / PAGE)
  const out = []
  for (let start = 0; start < pages; start += CONCURRENCY) {
    const batch = await Promise.all(
      Array.from({ length: Math.min(CONCURRENCY, pages - start) }, (_, j) => {
        const i = start + j
        let q = supabase.from(table).select(select).range(i * PAGE, i * PAGE + PAGE - 1)
        if (companyId) q = q.eq('company_id', companyId)
        q = applyFilter(q)
        return q.then(({ data, error }) => {
          if (error) throw new Error(`${table}: ${error.message || 'tempo limite excedido no banco (timeout)'}`)
          return data || []
        })
      })
    )
    for (const d of batch) out.push(...d)
  }
  return out
}

function normalizeStr(s) {
  return String(s || '').toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim()
}

export async function loadCompanyData(companyId) {
  const [clientes, vendedores, vendas, ultimaCompra, equipesList, depara, { data: lastUpload }] = await Promise.all([
    fetchAll('clientes', '*', companyId),
    fetchAll('vendedores', 'rca, nome, gr', companyId),
    // meses zerados não agregam nada e são a grande maioria das linhas
    fetchAll('vendas_mensais', 'seq_pessoa, rca, ano_mes, valor', companyId, q => q.neq('valor', 0)),
    fetchAll('ultima_compra', 'seq_pessoa, rca, gr, dt_ult_cmp, dias_ult_cmp', companyId),
    fetchAll('equipes', '*', companyId).catch(() => []),
    fetchAll('cidades_depara', '*, cidades_ibge(nome, uf, latitude, longitude)', companyId).catch(() => []),
    supabase
      .from('uploads')
      .select('filename, uploaded_at, hash_sha256')
      .eq('company_id', companyId)
      .eq('status', 'ok')
      .order('uploaded_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])

  const vendMap = new Map((vendedores || []).map(v => [v.rca, v]))
  const clienteMap = new Map((clientes || []).map(c => [c.seq_pessoa, c]))

  // De/Para: cidade normalizada → coordenadas (manuais têm prioridade sobre IBGE)
  const cidadeCoords = new Map()
  for (const d of depara || []) {
    if (d.latitude != null && d.longitude != null) {
      cidadeCoords.set(d.cidade_norm, { lat: d.latitude, lng: d.longitude })
    } else if (d.codigo_ibge && d.cidades_ibge) {
      cidadeCoords.set(d.cidade_norm, {
        lat: d.cidades_ibge.latitude,
        lng: d.cidades_ibge.longitude,
      })
    }
  }

  // VD columns map: `${seq_pessoa}:${rca}` → { 'VD YYYY-MM': valor }
  const vendasMap = new Map()
  const mesesSet = new Set()
  for (const v of vendas || []) {
    const colName = `VD ${v.ano_mes.slice(0, 7)}`
    mesesSet.add(colName)
    const key = `${v.seq_pessoa}:${v.rca}`
    if (!vendasMap.has(key)) vendasMap.set(key, {})
    vendasMap.get(key)[colName] = (vendasMap.get(key)[colName] || 0) + Number(v.valor)
  }

  // processExcelData detecta os meses pela PRIMEIRA linha — toda linha precisa
  // ter todas as colunas VD (meses sem venda ficam zerados)
  const zeroMeses = Object.fromEntries([...mesesSet].map(c => [c, 0]))

  const seen = new Set()
  const rows = []

  for (const uc of ultimaCompra || []) {
    const key = `${uc.seq_pessoa}:${uc.rca}`
    if (seen.has(key)) continue
    seen.add(key)

    const cliente = clienteMap.get(uc.seq_pessoa)
    if (!cliente) continue

    // lat/lon do cliente; se ausentes, herda as coordenadas do município (de/para IBGE)
    const cityCoord = cidadeCoords.get(normalizeStr(cliente.cidade))
    const lat = cliente.latitude ?? cityCoord?.lat ?? null
    const lng = cliente.longitude ?? cityCoord?.lng ?? null

    const vend = vendMap.get(uc.rca)
    rows.push({
      'GR': String(uc.gr),
      'RCA': uc.rca,
      'Nome': vend?.nome || '',
      'SeqPessoa': uc.seq_pessoa,
      'Razao Social': cliente.razao_social,
      'Clas.Com': cliente.clas_com,
      'Dt.Ult.Cmp': uc.dt_ult_cmp,
      'Dias.Ult.Cmp': uc.dias_ult_cmp,
      'Endereco': cliente.endereco || null,
      'Numero': cliente.numero,
      'Bairro': cliente.bairro,
      'Cep': cliente.cep,
      'Cidade': cliente.cidade,
      'Segmento': cliente.segmento,
      'Limite Global': Number(cliente.limite_global) || 0,
      'Monitorado': cliente.monitorado ? 'x' : null,
      '_latitude': lat,
      '_longitude': lng,
      ...zeroMeses,
      ...(vendasMap.get(key) || {}),
    })
  }

  return {
    data: rows,
    equipesList: (equipesList || []).sort((a, b) => a.cod_equipe - b.cod_equipe),
    cidadesDepara: depara || [],
    fileName: lastUpload?.filename || 'Dados do servidor',
    hashAtual: lastUpload?.hash_sha256 || null,
    uploadedAt: lastUpload?.uploaded_at || null,
  }
}
