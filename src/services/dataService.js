import * as XLSX from 'xlsx'

// ── Excel processing ──────────────────────────────────────────────────────────
export function processExcelData(rows) {
  if (!rows || rows.length === 0) return null

  const sampleRow = rows[0]

  // Aceita VD YYYY-MM ou VD YYYY-M (sem zero à esquerda)
  const vdCols = Object.keys(sampleRow)
    .filter(k => /^VD \d{4}-\d{1,2}$/.test(k))
    .sort((a, b) => {
      const parse = s => { const m = s.match(/VD (\d{4})-(\d{1,2})/); return m ? parseInt(m[1]) * 100 + parseInt(m[2]) : 0 }
      return parse(b) - parse(a)
    })

  const meses = vdCols

  const processed = rows.map(row => {
    const diasRaw = row['Dias.Ult.Cmp']
    // Robusto: lida com NaN, strings de data ("2025-01-15"), Date objects
    let dias = null
    if (diasRaw != null) {
      if (diasRaw instanceof Date) {
        // lido como data pela opção cellDates — calcula dias a partir de hoje
        dias = Math.round(Math.abs(Date.now() - diasRaw.getTime()) / 86400000)
      } else {
        const n = Math.abs(Number(String(diasRaw).replace(',', '.')))
        dias = isNaN(n) ? null : n
      }
    }

    const vdValues = {}
    vdCols.forEach(col => {
      vdValues[col] = row[col] != null ? Number(row[col]) : 0
    })

    return {
      gr: String(row['GR'] ?? ''),
      rca: Number(row['RCA']) || 0,
      nome: String(row['Nome'] ?? ''),
      seqPessoa: Number(row['SeqPessoa']) || 0,
      razaoSocial: String(row['Razao Social'] ?? ''),
      classCom: row['Clas.Com'],
      dtUltCmp: row['Dt.Ult.Cmp'],
      diasUltCmp: dias,
      endereco: String(row['Endereco'] ?? ''),
      numero: String(row['Numero'] ?? ''),
      bairro: String(row['Bairro'] ?? ''),
      cep: row['Cep'],
      cidade: String(row['Cidade'] ?? ''),
      segmento: String(row['Segmento'] ?? ''),
      limiteGlobal: Number(row['Limite Global']) || 0,
      monitorado: row['Monitorado'] != null && row['Monitorado'] !== '',
      latitude: row['_latitude'] ?? null,
      longitude: row['_longitude'] ?? null,
      ...vdValues,
    }
  })

  return { rows: processed, meses }
}

// ── Filters ───────────────────────────────────────────────────────────────────
export function filterBySession(rows, session) {
  if (!session || session.role === 'master' || session.role === 'admin') return rows
  return rows.filter(r => r.rca === session.rca)
}

export function filterByGrAndRca(rows, gr, rca) {
  let filtered = rows
  if (gr) filtered = filtered.filter(r => r.gr === gr)
  if (rca) filtered = filtered.filter(r => r.rca === Number(rca))
  return filtered
}

export function getVendedores(rows) {
  const map = new Map()
  rows.forEach(r => {
    if (!map.has(r.rca)) map.set(r.rca, { rca: r.rca, nome: r.nome, gr: r.gr })
  })
  return [...map.values()].sort((a, b) => a.nome.localeCompare(b.nome))
}

export function getCidades(rows) {
  return [...new Set(rows.map(r => r.cidade).filter(Boolean))].sort()
}

// ── Status de cliente (usa parâmetros do SQLite) ──────────────────────────────
export function getClienteStatus(row, diasBloqueio = 90, diasInativacao = 180) {
  if (row.monitorado) return 'monitorado'
  const dias = row.diasUltCmp
  // null ou NaN (campo ausente / mal lido) → sem dados suficientes, trata como ativo
  if (dias == null || isNaN(dias)) return 'ativo'
  if (dias <= diasBloqueio) return 'ativo'
  if (dias <= diasInativacao) return 'bloqueado'
  return 'inativo'
}

// ── Curva ABC ─────────────────────────────────────────────────────────────────
// Classifica pelo faturamento do mês atual (meses[0]) em faixas de valor
export function enrichWithCurva(rows, meses, curvaAMin = 20000, curvaBMin = 15000) {
  const mesAtual = meses[0]
  return rows.map(r => {
    const fat = r[mesAtual] || 0
    const curva = fat >= curvaAMin ? 'A' : fat >= curvaBMin ? 'B' : 'C'
    return { ...r, curva }
  })
}

export function calcCurvaABC(rows, meses, curvaAMin = 20000, curvaBMin = 15000) {
  const enriched = enrichWithCurva(rows, meses, curvaAMin, curvaBMin)
  const mesAtual = meses[0]
  const totalRev = enriched.reduce((s, r) => s + (r[mesAtual] || 0), 0)

  const groups = { A: { count: 0, revenue: 0 }, B: { count: 0, revenue: 0 }, C: { count: 0, revenue: 0 } }
  enriched.forEach(r => {
    const fat = r[mesAtual] || 0
    groups[r.curva].count++
    groups[r.curva].revenue += fat
  })

  return {
    A: { ...groups.A, pct: totalRev > 0 ? (groups.A.revenue / totalRev) * 100 : 0 },
    B: { ...groups.B, pct: totalRev > 0 ? (groups.B.revenue / totalRev) * 100 : 0 },
    C: { ...groups.C, pct: totalRev > 0 ? (groups.C.revenue / totalRev) * 100 : 0 },
  }
}

// ── KPIs ──────────────────────────────────────────────────────────────────────
export function calcKPIs(rows, meses, diasBloqueio = 90, diasInativacao = 180) {
  const mesAtual = meses[0]
  const mesAnterior = meses[1]

  const totalClientes = rows.length
  const ativos = rows.filter(r => getClienteStatus(r, diasBloqueio, diasInativacao) === 'ativo').length
  const bloqueados = rows.filter(r => getClienteStatus(r, diasBloqueio, diasInativacao) === 'bloqueado').length
  const inativos = rows.filter(r => getClienteStatus(r, diasBloqueio, diasInativacao) === 'inativo').length
  const positivados = rows.filter(r => (r[mesAtual] || 0) > 0).length
  const fatMesAtual = rows.reduce((sum, r) => sum + (r[mesAtual] || 0), 0)
  const fatMesAnterior = rows.reduce((sum, r) => sum + (r[mesAnterior] || 0), 0)
  const limiteLiberado = rows.reduce((sum, r) => sum + (r.limiteGlobal || 0), 0)
  const limiteUsado = fatMesAtual
  const variacaoMensal = fatMesAnterior > 0 ? ((fatMesAtual - fatMesAnterior) / fatMesAnterior) * 100 : 0
  const ticketMedio = positivados > 0 ? fatMesAtual / positivados : 0

  return {
    totalClientes,
    ativos,
    bloqueados,
    inativos,
    positivados,
    naoPositivados: totalClientes - positivados,
    fatMesAtual,
    fatMesAnterior,
    variacaoMensal,
    ticketMedio,
    limiteLiberado,
    limiteUsado,
  }
}

// ── Evolução mensal (receita por mês) ────────────────────────────────────────
export function calcEvolucaoMensal(rows, meses) {
  return meses.slice().reverse().map(mes => ({
    mes,
    label: formatMesLabel(mes),
    valor: rows.reduce((s, r) => s + (r[mes] || 0), 0),
  }))
}

// ── Evolução mensal (positivados por mês) ─────────────────────────────────────
export function calcEvolucaoMensalPositivados(rows, meses) {
  return meses.slice().reverse().map(mes => ({
    mes,
    label: formatMesLabel(mes),
    positivados: rows.filter(r => (r[mes] || 0) > 0).length,
  }))
}

// ── Ranking ───────────────────────────────────────────────────────────────────
export function calcRanking(rows, meses, mesIdx = 0, diasBloqueio = 90, diasInativacao = 180) {
  const mesRef = meses[mesIdx]
  const mesAnt = meses[mesIdx + 1] || null

  const vendedoresMap = new Map()
  rows.forEach(r => {
    if (!vendedoresMap.has(r.rca)) {
      vendedoresMap.set(r.rca, {
        rca: r.rca, nome: r.nome, gr: r.gr,
        fatMesSel: 0, fatMesAnt: 0,
        total12M: 0, ativos: 0, inativos: 0, bloqueados: 0,
      })
    }
    const v = vendedoresMap.get(r.rca)
    v.fatMesSel += r[mesRef] || 0
    v.fatMesAnt += mesAnt ? (r[mesAnt] || 0) : 0
    v.total12M += meses.reduce((s, m) => s + (r[m] || 0), 0)
    const status = getClienteStatus(r, diasBloqueio, diasInativacao)
    if (status === 'ativo') v.ativos++
    else if (status === 'bloqueado') v.bloqueados++
    else if (status === 'inativo') v.inativos++
  })

  return [...vendedoresMap.values()]
    .map(v => ({
      ...v,
      variacao: v.fatMesAnt > 0 ? ((v.fatMesSel - v.fatMesAnt) / v.fatMesAnt) * 100 : 0,
    }))
    .sort((a, b) => b.fatMesSel - a.fatMesSel)
}

// ── Equipes ───────────────────────────────────────────────────────────────────
export function calcEquipesData(rows, meses, equipesList, diasBloqueio = 90, diasInativacao = 180) {
  const mesAtual = meses[0]
  const equipeMap = Object.fromEntries((equipesList || []).map(e => [String(e.cod_equipe), e.nome]))

  const grMap = new Map()
  rows.forEach(r => {
    const gr = r.gr
    if (!grMap.has(gr)) {
      grMap.set(gr, {
        gr,
        nome: equipeMap[gr] || 'Equipe ' + gr,
        vendedores: new Set(),
        cidades: new Set(),
        totalClientes: 0,
        ativos: 0,
        bloqueados: 0,
        inativos: 0,
        positivados: 0,
        fatMesAtual: 0,
        fat12M: 0,
      })
    }
    const e = grMap.get(gr)
    e.vendedores.add(r.rca)
    if (r.cidade) e.cidades.add(r.cidade)
    e.totalClientes++
    const status = getClienteStatus(r, diasBloqueio, diasInativacao)
    if (status === 'ativo') e.ativos++
    else if (status === 'bloqueado') e.bloqueados++
    else e.inativos++
    if ((r[mesAtual] || 0) > 0) e.positivados++
    e.fatMesAtual += r[mesAtual] || 0
    e.fat12M += meses.reduce((s, m) => s + (r[m] || 0), 0)
  })

  return [...grMap.values()].map(e => ({
    ...e,
    vendedoresCount: e.vendedores.size,
    municipiosCount: e.cidades.size,
    positivacaoPct: e.totalClientes > 0 ? (e.positivados / e.totalClientes) * 100 : 0,
    ticketMedio: e.ativos > 0 ? e.fatMesAtual / e.ativos : 0,
    vendedores: undefined,
    cidades: undefined,
  })).sort((a, b) => b.fatMesAtual - a.fatMesAtual)
}

export function calcEquipeVendedores(rows, meses, gr, equipesList, diasBloqueio = 90, diasInativacao = 180) {
  const mesAtual = meses[0]
  const equipeMap = Object.fromEntries((equipesList || []).map(e => [String(e.cod_equipe), e.nome]))
  const grRows = rows.filter(r => r.gr === gr)

  const vendMap = new Map()
  grRows.forEach(r => {
    if (!vendMap.has(r.rca)) {
      vendMap.set(r.rca, {
        rca: r.rca, nome: r.nome, gr: r.gr,
        equipeNome: equipeMap[gr] || 'Equipe ' + gr,
        municipios: new Set(),
        totalClientes: 0, ativos: 0, bloqueados: 0, inativos: 0, positivados: 0,
        fatMesAtual: 0, fat12M: 0,
      })
    }
    const v = vendMap.get(r.rca)
    if (r.cidade) v.municipios.add(r.cidade)
    v.totalClientes++
    const status = getClienteStatus(r, diasBloqueio, diasInativacao)
    if (status === 'ativo') v.ativos++
    else if (status === 'bloqueado') v.bloqueados++
    else v.inativos++
    if ((r[mesAtual] || 0) > 0) v.positivados++
    v.fatMesAtual += r[mesAtual] || 0
    v.fat12M += meses.reduce((s, m) => s + (r[m] || 0), 0)
  })

  return [...vendMap.values()].map(v => ({
    ...v,
    municipiosCount: v.municipios.size,
    positivacaoPct: v.totalClientes > 0 ? (v.positivados / v.totalClientes) * 100 : 0,
    ticketMedio: v.ativos > 0 ? v.fatMesAtual / v.ativos : 0,
    municipios: undefined,
  })).sort((a, b) => b.fatMesAtual - a.fatMesAtual)
}

// ── Map data ──────────────────────────────────────────────────────────────────
export function calcMapData(rows, meses, equipes, diasBloqueio = 90, diasInativacao = 180) {
  const mesAtual = meses[0]
  const equipeMap = Object.fromEntries((equipes || []).map(e => [e.cod_equipe, e.nome]))

  const key = (rca, cidade) => `${rca}::${cidade}`
  const map = new Map()

  rows.forEach(r => {
    const k = key(r.rca, r.cidade)
    if (!map.has(k)) {
      map.set(k, {
        rca: r.rca,
        nome: r.nome,
        gr: r.gr,
        equipeNome: equipeMap[r.gr] || ('Equipe ' + r.gr),
        cidade: r.cidade,
        ativos: 0,
        bloqueados: 0,
        inativos: 0,
        fatMesAtual: 0,
      })
    }
    const entry = map.get(k)
    entry.fatMesAtual += r[mesAtual] || 0
    const status = getClienteStatus(r, diasBloqueio, diasInativacao)
    if (status === 'ativo') entry.ativos++
    else if (status === 'bloqueado') entry.bloqueados++
    else entry.inativos++
  })

  return [...map.values()]
}

// ── Inativos ──────────────────────────────────────────────────────────────────
export function calcInativos(rows, meses, diasBloqueio = 90, diasInativacao = 180) {
  const mesAtual = meses[0]
  return rows
    .filter(r => (r[mesAtual] || 0) === 0)
    .map(r => {
      const mediaHist = meses.reduce((s, m) => s + (r[m] || 0), 0) / meses.length
      const melhorMes = Math.max(...meses.map(m => r[m] || 0))
      const dias = r.diasUltCmp ?? 0
      let urgencia = 'recente'
      if (dias > diasInativacao) urgencia = 'critico'
      else if (dias > diasBloqueio) urgencia = 'alerta'
      return { ...r, mediaHist, melhorMes, urgencia }
    })
    .sort((a, b) => (b.diasUltCmp || 0) - (a.diasUltCmp || 0))
}

// ── Formatação ────────────────────────────────────────────────────────────────
export function formatCurrency(value) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0)
}

export function formatCurrencyAbbr(value) {
  const v = value || 0
  if (v >= 1_000_000) return `R$ ${(v / 1_000_000).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}M`
  if (v >= 1_000) return `R$ ${(v / 1_000).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 1 })}k`
  return formatCurrency(v)
}

export function formatMesLabel(colName) {
  const match = colName.match(/VD (\d{4})-(\d{2})/)
  if (!match) return colName
  return `${match[2]}/${match[1]}`
}

export function formatPct(value) {
  return `${(value || 0).toFixed(1)}%`
}

// ── Export Excel ──────────────────────────────────────────────────────────────
export function exportExcel(data, filename) {
  if (!data || data.length === 0) return
  const ws = XLSX.utils.json_to_sheet(data)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Dados')
  const wbout = XLSX.write(wb, { type: 'array', bookType: 'xlsx' })
  const blob = new Blob([wbout], { type: 'application/octet-stream' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

// ── Export CSV (mantido para compatibilidade) ─────────────────────────────────
export function exportCSV(data, filename) {
  exportExcel(data, filename.replace('.csv', '.xlsx'))
}
