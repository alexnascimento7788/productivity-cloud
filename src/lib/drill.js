// ── Drill-down: filtros compartilhados por URL ───────────────────────────────
// Todo número clicável do portal leva para uma página de análise (/explorar/*)
// com EXATAMENTE os mesmos filtros que produziram o número. A URL é a fonte da
// verdade: ?gr=&rca=&cidade=&status=&curva=&positivado=&dias=&q=
// Assim "3 clientes ativos" clicado abre a lista com esses 3 — nem mais, nem menos.

import { useMemo } from 'react'
import { useAuth, useData, useParams, filterRowsByRole } from '../App'
import { processExcelData, enrichWithCurva, getClienteStatus } from '../services/dataService'

export const DRILL_KEYS = ['gr', 'rca', 'cidade', 'status', 'curva', 'positivado', 'dias', 'q']

// status agregados usados pelos cards ("Inativos" do Dashboard = bloqueado + inativo)
export const STATUS_LABEL = {
  ativo: 'Ativos',
  bloqueado: 'Bloqueados',
  inativo: 'Inativos',
  monitorado: 'Monitorados',
  inativos: 'Inativos + Bloqueados',
  risco: 'Ativos em risco de bloqueio',
}

/** Monta "/caminho?k=v" ignorando valores vazios. */
export function drillUrl(path, filters = {}) {
  const qs = new URLSearchParams()
  for (const k of DRILL_KEYS) {
    const v = filters[k]
    if (v !== null && v !== undefined && v !== '') qs.set(k, String(v))
  }
  const s = qs.toString()
  return s ? `${path}?${s}` : path
}

export function readDrill(searchParams) {
  return Object.fromEntries(DRILL_KEYS.map(k => [k, searchParams.get(k) || null]))
}

/**
 * Faixa de dias: "0-30", "31-90" (inclusivas) ou "90+" (= mais de 90).
 * Várias faixas separadas por vírgula são combinadas com E (interseção).
 */
export function matchDias(dias, faixa) {
  if (!faixa) return true
  if (faixa.includes(',')) return faixa.split(',').every(f => matchDias(dias, f))
  const d = dias ?? 0
  const plus = faixa.match(/^(\d+)\+$/)
  if (plus) return d > Number(plus[1])
  const range = faixa.match(/^(\d+)-(\d+)$/)
  if (range) return d >= Number(range[1]) && d <= Number(range[2])
  return true
}

export function diasLabel(faixa) {
  if (!faixa) return ''
  if (faixa.includes(',')) return faixa.split(',').map(diasLabel).join(' e ')
  if (faixa.endsWith('+')) return `Mais de ${faixa.replace('+', '')} dias sem compra`
  return `${faixa.replace('-', '–')} dias sem compra`
}

/**
 * Aplica os filtros de drill sobre linhas já enriquecidas (useCarteira).
 * `skip` permite ignorar chaves (ex.: cards que mostram o detalhamento por status).
 */
export function applyDrill(rows, f, { mesAtual, diasBloqueio = 90, skip = [] } = {}) {
  const on = k => f[k] && !skip.includes(k)
  let data = rows
  if (on('gr')) data = data.filter(r => r.gr === f.gr)
  if (on('rca')) data = data.filter(r => r.rca === Number(f.rca))
  if (on('cidade')) data = data.filter(r => r.cidade === f.cidade)
  if (on('status')) {
    if (f.status === 'inativos') data = data.filter(r => r._status === 'inativo' || r._status === 'bloqueado')
    else if (f.status === 'risco') data = data.filter(r => isRisco(r, diasBloqueio))
    else data = data.filter(r => r._status === f.status)
  }
  if (on('curva')) data = data.filter(r => r.curva === f.curva)
  if (on('positivado') && mesAtual) {
    if (f.positivado === 'sim') data = data.filter(r => (r[mesAtual] || 0) > 0)
    if (f.positivado === 'nao') data = data.filter(r => (r[mesAtual] || 0) === 0)
  }
  if (on('dias')) data = data.filter(r => matchDias(r.diasUltCmp, f.dias))
  if (on('q')) {
    const q = f.q.toLowerCase()
    data = data.filter(r => r.razaoSocial.toLowerCase().includes(q) || String(r.seqPessoa) === q)
  }
  return data
}

/** Ativo, mas a menos de 30 dias de cair em bloqueio — a "lista de ataque". */
export function isRisco(r, diasBloqueio = 90) {
  return r._status === 'ativo' && r.diasUltCmp != null && r.diasUltCmp > Math.max(diasBloqueio - 30, 0)
}

/**
 * Carteira completa da empresa já pronta para análise: respeita o perfil
 * (consulta só vê as próprias equipes) e acrescenta status, curva e médias.
 */
export function useCarteira() {
  const { session } = useAuth()
  const { excelData, equipesList } = useData()
  const { diasBloqueio, diasInativacao, curvaAMin, curvaBMin } = useParams()

  const base = useMemo(() => {
    if (!excelData) return { rows: [], meses: [] }
    return processExcelData(excelData.data) || { rows: [], meses: [] }
  }, [excelData])

  const rows = useMemo(() => {
    const { meses } = base
    const visible = filterRowsByRole(base.rows, session)
    const withCurva = meses.length ? enrichWithCurva(visible, meses, curvaAMin, curvaBMin) : visible.map(r => ({ ...r, curva: 'C' }))
    const m3 = meses.slice(0, 3)
    return withCurva.map(r => {
      const fat12 = meses.reduce((s, m) => s + (r[m] || 0), 0)
      const mesesCompra = meses.filter(m => (r[m] || 0) > 0).length
      return {
        ...r,
        _status: getClienteStatus(r, diasBloqueio, diasInativacao),
        _fat12: fat12,
        _media3: m3.length ? m3.reduce((s, m) => s + (r[m] || 0), 0) / m3.length : 0,
        _media12: meses.length ? fat12 / meses.length : 0,
        _mesesCompra: mesesCompra,
      }
    })
  }, [base, session, diasBloqueio, diasInativacao, curvaAMin, curvaBMin])

  const equipeNome = useMemo(() => {
    const map = Object.fromEntries((equipesList || []).map(e => [String(e.cod_equipe), e.nome]))
    return gr => map[String(gr)] || `Equipe ${gr}`
  }, [equipesList])

  const vendedorNome = useMemo(() => {
    const map = new Map()
    for (const r of base.rows) if (!map.has(r.rca)) map.set(r.rca, r.nome)
    return rca => map.get(Number(rca)) || `RCA ${rca}`
  }, [base])

  return {
    ready: !!excelData,
    rows,
    meses: base.meses,
    mesAtual: base.meses[0],
    equipeNome,
    vendedorNome,
    diasBloqueio,
    diasInativacao,
  }
}

/** Agrega linhas por uma chave (rca, cidade, gr) com as métricas padrão. */
export function aggregateBy(rows, keyFn, meses, init = () => ({})) {
  const mesAtual = meses[0]
  const mesAnt = meses[1]
  const map = new Map()
  for (const r of rows) {
    const k = keyFn(r)
    if (k == null || k === '') continue
    if (!map.has(k)) {
      map.set(k, {
        key: k, ...init(r),
        clientes: 0, ativos: 0, bloqueados: 0, inativos: 0, monitorados: 0, positivados: 0,
        fatMes: 0, fatAnt: 0, fat12: 0, limite: 0,
        serie: meses.map(() => 0), _cid: new Set(), _rca: new Set(), _gr: new Set(),
      })
    }
    const a = map.get(k)
    a.clientes++
    if (r._status === 'ativo') a.ativos++
    else if (r._status === 'bloqueado') a.bloqueados++
    else if (r._status === 'inativo') a.inativos++
    else if (r._status === 'monitorado') a.monitorados++
    if ((r[mesAtual] || 0) > 0) a.positivados++
    a.fatMes += r[mesAtual] || 0
    a.fatAnt += mesAnt ? (r[mesAnt] || 0) : 0
    a.fat12 += r._fat12 || 0
    a.limite += r.limiteGlobal || 0
    meses.forEach((m, i) => { a.serie[i] += r[m] || 0 })
    if (r.cidade) a._cid.add(r.cidade)
    a._rca.add(r.rca)
    a._gr.add(r.gr)
  }
  return [...map.values()].map(a => ({
    ...a,
    municipios: a._cid.size,
    vendedores: a._rca.size,
    equipes: [...a._gr],
    positivacao: a.clientes ? (a.positivados / a.clientes) * 100 : 0,
    ticket: a.positivados ? a.fatMes / a.positivados : 0,
    variacao: a.fatAnt > 0 ? ((a.fatMes - a.fatAnt) / a.fatAnt) * 100 : null,
    serie: [...a.serie].reverse(), // cronológica (mais antigo → atual)
    _cid: undefined, _rca: undefined, _gr: undefined,
  }))
}

/** Resumo de um conjunto de linhas (KPIs do topo das páginas de análise). */
export function summarize(rows, meses, diasBloqueio = 90) {
  const [all] = aggregateBy(rows, () => 'all', meses)
  const risco = rows.filter(r => isRisco(r, diasBloqueio))
  const empty = {
    clientes: 0, ativos: 0, bloqueados: 0, inativos: 0, monitorados: 0, positivados: 0,
    fatMes: 0, fatAnt: 0, fat12: 0, limite: 0, serie: meses.map(() => 0),
    municipios: 0, vendedores: 0, equipes: [], positivacao: 0, ticket: 0, variacao: null,
  }
  return {
    ...(all || empty),
    risco: risco.length,
    riscoValor: risco.reduce((s, r) => s + (r._media3 || 0), 0),
    curva: {
      A: rows.filter(r => r.curva === 'A').length,
      B: rows.filter(r => r.curva === 'B').length,
      C: rows.filter(r => r.curva === 'C').length,
    },
  }
}
