import React, { useMemo, useState, useEffect } from 'react'
import { Download, X } from 'lucide-react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts'
import { useAuth, useData, useParams, isStaff, filterRowsByRole } from '../App'
import {
  processExcelData, formatCurrency, formatCurrencyAbbr, formatMesLabel,
  exportExcel, getClienteStatus, enrichWithCurva, getCidades,
} from '../services/dataService'
import PageHeader from '../components/PageHeader'
import { FiltrosBar, Select, SearchInput } from '../components/Filtros'
import Pagination from '../components/Pagination'

const PAGE_SIZE = 50

const diasOptions = [
  { value: '0-30', label: '0–30 dias' },
  { value: '31-60', label: '31–60 dias' },
  { value: '61-90', label: '61–90 dias' },
  { value: '91-180', label: '91–180 dias' },
  { value: '180+', label: '180+ dias' },
]

const statusOptions = [
  { value: 'ativo', label: '🟢 Ativo' },
  { value: 'bloqueado', label: '🟡 Bloqueado' },
  { value: 'inativo', label: '🔴 Inativo' },
  { value: 'monitorado', label: '🔵 Monitorado' },
]

const curvaOptions = [
  { value: 'A', label: 'Curva A' },
  { value: 'B', label: 'Curva B' },
  { value: 'C', label: 'Curva C' },
]

const STATUS_BADGE = {
  ativo: <span className="px-2 py-0.5 rounded-full text-xs bg-accent-green/20 text-accent-green whitespace-nowrap">🟢 Ativo</span>,
  bloqueado: <span className="px-2 py-0.5 rounded-full text-xs bg-accent-amber/20 text-accent-amber whitespace-nowrap">🟡 Bloqueado</span>,
  inativo: <span className="px-2 py-0.5 rounded-full text-xs bg-accent-red/20 text-accent-red whitespace-nowrap">🔴 Inativo</span>,
  monitorado: <span className="px-2 py-0.5 rounded-full text-xs bg-accent-blue/20 text-accent-blue whitespace-nowrap">🔵 Monitorado</span>,
}

function diasFiltro(dias, faixa) {
  if (!faixa) return true
  const d = dias || 0
  if (faixa === '0-30') return d <= 30
  if (faixa === '31-60') return d >= 31 && d <= 60
  if (faixa === '61-90') return d >= 61 && d <= 90
  if (faixa === '91-180') return d >= 91 && d <= 180
  if (faixa === '180+') return d > 180
  return true
}

function ClienteModal({ cliente, meses, diasBloqueio, diasInativacao, onClose }) {
  if (!cliente) return null
  const evolucao = [...meses].reverse().map(m => ({ label: formatMesLabel(m), valor: cliente[m] || 0 }))
  const status = getClienteStatus(cliente, diasBloqueio, diasInativacao)

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className="relative w-full max-w-md bg-bg-secondary border-l border-border-color h-full overflow-y-auto animate-slide-in">
        <div className="p-6">
          <div className="flex items-start justify-between mb-6">
            <div>
              <h2 className="text-lg font-bold text-text-primary">{cliente.razaoSocial}</h2>
            </div>
            <button onClick={onClose} className="text-text-secondary hover:text-text-primary p-1"><X size={18} /></button>
          </div>

          <div className="space-y-4 mb-6">
            <div className="grid grid-cols-2 gap-3">
              {[
                ['Vendedor', cliente.nome], ['RCA', cliente.rca],
                ['Equipe', 'Equipe ' + cliente.gr], ['Cidade', cliente.cidade],
                ['Segmento', cliente.segmento], ['Limite', formatCurrency(cliente.limiteGlobal)],
                ['Curva ABC', 'Curva ' + (cliente.curva || '—')],
                ['Fat. 12M', formatCurrency(meses.reduce((s, m) => s + (cliente[m] || 0), 0))],
              ].map(([label, value]) => (
                <div key={label} className="bg-bg-tertiary rounded-lg p-3">
                  <p className="text-xs text-text-secondary mb-0.5">{label}</p>
                  <p className="text-sm text-text-primary font-medium">{value}</p>
                </div>
              ))}
            </div>
            <div className="bg-bg-tertiary rounded-lg p-3">
              <p className="text-xs text-text-secondary mb-0.5">Endereço</p>
              <p className="text-sm text-text-primary">{cliente.endereco}, {cliente.numero} — {cliente.bairro}</p>
            </div>
            <div className="flex gap-2 flex-wrap">
              {STATUS_BADGE[status]}
              {cliente.diasUltCmp != null && (
                <span className="px-2 py-0.5 rounded-full text-xs bg-bg-tertiary text-text-secondary">
                  {cliente.diasUltCmp} dias s/ compra
                </span>
              )}
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-text-primary mb-3">Evolução 12 meses</h3>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={evolucao}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                <XAxis dataKey="label" tick={{ fill: '#9ca3af', fontSize: 10 }} />
                <YAxis tickFormatter={v => `${(v / 1000).toFixed(0)}k`} tick={{ fill: '#9ca3af', fontSize: 10 }} width={40} />
                <Tooltip formatter={v => [formatCurrency(v), 'Vendas']} contentStyle={{ background: '#111827', border: '1px solid #1f2937', borderRadius: 8 }} />
                <Line type="monotone" dataKey="valor" stroke="#3b82f6" strokeWidth={2} dot={{ r: 2 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function Clientes() {
  const { session } = useAuth()
  const { excelData } = useData()
  const { diasBloqueio, diasInativacao, curvaAMin, curvaBMin } = useParams()
  const isMaster = isStaff(session?.role)
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const [search, setSearch] = useState('')
  const [filterGr, setFilterGr] = useState(null)
  const [filterRca, setFilterRca] = useState(searchParams.get('rca') || null)
  const [filterCidade, setFilterCidade] = useState(null)
  const [filterStatus, setFilterStatus] = useState(searchParams.get('status') || null)
  const [filterDias, setFilterDias] = useState(null)
  const [filterCurva, setFilterCurva] = useState(searchParams.get('curva') || null)
  const [filterPositivado, setFilterPositivado] = useState(searchParams.get('positivado') || null)
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState(null)

  // Sincroniza filtros com mudanças de searchParams (navegação vinda de outros componentes)
  useEffect(() => {
    setFilterStatus(searchParams.get('status') || null)
    setFilterRca(searchParams.get('rca') || null)
    setFilterCurva(searchParams.get('curva') || null)
    setFilterPositivado(searchParams.get('positivado') || null)
    setPage(1)
  }, [searchParams])

  const { rows, meses } = useMemo(() => {
    if (!excelData) return { rows: [], meses: [] }
    return processExcelData(excelData.data) || { rows: [], meses: [] }
  }, [excelData])

  const mesAtual = meses[0]

  const baseRows = useMemo(() => filterRowsByRole(rows, session), [rows, session])

  const enrichedRows = useMemo(() => {
    if (!meses.length) return baseRows.map(r => ({ ...r, curva: 'C', _status: getClienteStatus(r, diasBloqueio, diasInativacao) }))
    return enrichWithCurva(baseRows, meses, curvaAMin, curvaBMin).map(r => ({
      ...r,
      _status: getClienteStatus(r, diasBloqueio, diasInativacao),
    }))
  }, [baseRows, meses, diasBloqueio, diasInativacao, curvaAMin, curvaBMin])

  const equipes = useMemo(() => [...new Set(enrichedRows.map(r => r.gr))].sort(), [enrichedRows])
  const vendedoresFiltro = useMemo(() => {
    const base = filterGr ? enrichedRows.filter(r => r.gr === filterGr) : enrichedRows
    const map = new Map()
    base.forEach(r => { if (!map.has(r.rca)) map.set(r.rca, r.nome) })
    return [...map.entries()].map(([rca, nome]) => ({ value: String(rca), label: `${rca} — ${nome}` })).sort((a, b) => a.label.localeCompare(b.label))
  }, [enrichedRows, filterGr])
  const cidades = useMemo(() => getCidades(enrichedRows).map(c => ({ value: c, label: c })), [enrichedRows])

  const filtered = useMemo(() => {
    let data = enrichedRows
    if (filterGr) data = data.filter(r => r.gr === filterGr)
    if (filterRca) data = data.filter(r => r.rca === Number(filterRca))
    if (filterCidade) data = data.filter(r => r.cidade === filterCidade)
    if (search) data = data.filter(r =>
      r.razaoSocial.toLowerCase().includes(search.toLowerCase())
    )
    if (filterStatus) data = data.filter(r => r._status === filterStatus)
    if (filterDias) data = data.filter(r => diasFiltro(r.diasUltCmp, filterDias))
    if (filterCurva) data = data.filter(r => r.curva === filterCurva)
    if (filterPositivado === 'sim') data = data.filter(r => (r[mesAtual] || 0) > 0)
    if (filterPositivado === 'nao') data = data.filter(r => (r[mesAtual] || 0) === 0)
    return data
  }, [enrichedRows, filterGr, filterRca, filterCidade, search, filterStatus, filterDias, filterCurva, filterPositivado, mesAtual])

  const totalBase = enrichedRows.length
  const totalAtivos = enrichedRows.filter(r => r._status === 'ativo').length
  const totalInativos = enrichedRows.filter(r => r._status === 'inativo' || r._status === 'bloqueado').length
  const limiteLiberado = filtered.reduce((s, r) => s + (r.limiteGlobal || 0), 0)
  const limiteUsado = filtered.reduce((s, r) => s + (r[mesAtual] || 0), 0)
  const limiteUsoPct = limiteLiberado > 0 ? (limiteUsado / limiteLiberado) * 100 : 0
  const limiteColor = limiteUsoPct > 90 ? 'bg-accent-red' : limiteUsoPct > 70 ? 'bg-accent-amber' : 'bg-accent-green'

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  function clearFiltros() {
    setSearch(''); setFilterGr(null); setFilterRca(null); setFilterCidade(null)
    setFilterStatus(null); setFilterDias(null); setFilterCurva(null); setFilterPositivado(null); setPage(1)
  }

  const today = new Date().toISOString().slice(0, 10)

  function handleExport() {
    exportExcel(filtered.map(r => ({
      'Razão Social': r.razaoSocial, 'Vendedor': r.nome,
      'Equipe': r.gr, 'Cidade': r.cidade,
      'Últ. Compra': r.dtUltCmp ? new Date(r.dtUltCmp).toLocaleDateString('pt-BR') : '',
      'Dias S/ Compra': r.diasUltCmp,
      'Fat. Mês Atual': r[mesAtual] || 0,
      'Fat. 12M': meses.reduce((s, m) => s + (r[m] || 0), 0),
      'Limite Global': r.limiteGlobal,
      'Curva': r.curva, 'Status': r._status,
    })), `clientes_${today}.xlsx`)
  }

  if (!excelData) return <div className="p-4 md:p-6 text-text-secondary">Sem dados carregados.</div>

  return (
    <div className="p-4 md:p-6 animate-fade-in">
      <PageHeader
        title="Clientes"
        subtitle={`${filtered.length.toLocaleString('pt-BR')} clientes`}
        action={
          <button onClick={handleExport} className="flex items-center gap-2 px-4 py-2 text-sm bg-bg-secondary border border-border-color rounded-lg text-text-secondary hover:text-text-primary hover:bg-bg-tertiary transition-colors">
            <Download size={14} /> Exportar Excel
          </button>
        }
      />

      {/* Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <button onClick={clearFiltros} className="bg-bg-secondary border border-border-color rounded-xl p-4 text-left hover:border-accent-blue/50 transition-colors">
          <p className="text-xs text-text-secondary mb-1">Total de Clientes</p>
          <p className="text-2xl font-bold text-text-primary">{totalBase.toLocaleString('pt-BR')}</p>
        </button>
        <button onClick={() => { setFilterStatus('ativo'); setPage(1) }} className="bg-bg-secondary border border-border-color rounded-xl p-4 text-left hover:border-accent-green/50 transition-colors">
          <p className="text-xs text-text-secondary mb-1">Clientes Ativos</p>
          <p className="text-2xl font-bold text-accent-green">{totalAtivos.toLocaleString('pt-BR')}</p>
        </button>
        <button onClick={() => navigate('/clientes/inativos')} className="bg-bg-secondary border border-border-color rounded-xl p-4 text-left hover:border-accent-amber/50 transition-colors">
          <p className="text-xs text-text-secondary mb-1">Inativos / Bloqueados</p>
          <p className="text-2xl font-bold text-accent-amber">{totalInativos.toLocaleString('pt-BR')}</p>
        </button>
        <div className="bg-bg-secondary border border-border-color rounded-xl p-4">
          <p className="text-xs text-text-secondary mb-1">Limite Liberado vs Usado</p>
          <div className="flex items-baseline gap-1.5 mb-2">
            <span className="text-sm font-bold text-text-primary">{formatCurrencyAbbr(limiteUsado)}</span>
            <span className="text-xs text-text-secondary">/ {formatCurrencyAbbr(limiteLiberado)}</span>
          </div>
          <div className="h-1.5 bg-bg-tertiary rounded-full overflow-hidden">
            <div className={`h-full ${limiteColor} rounded-full`} style={{ width: `${Math.min(limiteUsoPct, 100)}%` }} />
          </div>
          <p className="text-xs text-text-secondary mt-1">{limiteUsoPct.toFixed(1)}% utilizado</p>
        </div>
      </div>

      {/* Filtros */}
      <FiltrosBar onClear={clearFiltros}>
        <SearchInput label="Buscar" value={search} onChange={v => { setSearch(v); setPage(1) }} placeholder="Razão Social" />
        {isMaster && (
          <Select label="Equipe" value={filterGr} onChange={v => { setFilterGr(v); setFilterRca(null); setPage(1) }}
            options={equipes.map(gr => ({ value: gr, label: 'Equipe ' + gr }))} />
        )}
        {isMaster && (
          <Select label="Vendedor" value={filterRca} onChange={v => { setFilterRca(v); setPage(1) }} options={vendedoresFiltro} />
        )}
        <Select label="Cidade" value={filterCidade} onChange={v => { setFilterCidade(v); setPage(1) }} options={cidades} />
        <Select label="Status" value={filterStatus} onChange={v => { setFilterStatus(v); setPage(1) }} options={statusOptions} />
        <Select label="Dias s/ compra" value={filterDias} onChange={v => { setFilterDias(v); setPage(1) }} options={diasOptions} />
        <Select label="Curva ABC" value={filterCurva} onChange={v => { setFilterCurva(v); setPage(1) }} options={curvaOptions} />
      </FiltrosBar>

      {/* Tabela */}
      <div className="bg-bg-secondary border border-border-color rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border-color">
                {['Razão Social', 'Vendedor', 'Equipe', 'Cidade', 'Últ. Compra', 'Dias', 'Fat. Mês Atual', 'Fat. 12M', 'Limite', 'Curva', 'Status'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-text-secondary font-medium whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paginated.map(r => {
                const fat12M = meses.reduce((s, m) => s + (r[m] || 0), 0)
                return (
                  <tr
                    key={r.seqPessoa}
                    onClick={() => setSelected(r)}
                    className="border-b border-border-color/50 hover:bg-bg-tertiary/50 transition-colors cursor-pointer"
                  >
                    <td className="px-4 py-3 text-text-primary font-medium max-w-[180px] truncate">{r.razaoSocial}</td>
                    <td className="px-4 py-3 text-text-secondary">{r.nome}</td>
                    <td className="px-4 py-3 text-text-secondary">{r.gr}</td>
                    <td className="px-4 py-3 text-text-secondary">{r.cidade}</td>
                    <td className="px-4 py-3 text-text-secondary font-mono whitespace-nowrap">
                      {r.dtUltCmp ? new Date(r.dtUltCmp).toLocaleDateString('pt-BR') : '—'}
                    </td>
                    <td className="px-4 py-3 font-mono text-text-secondary">{r.diasUltCmp ?? '—'}</td>
                    <td className="px-4 py-3 font-mono text-text-primary">{formatCurrency(r[mesAtual])}</td>
                    <td className="px-4 py-3 font-mono text-text-secondary">{formatCurrencyAbbr(fat12M)}</td>
                    <td className="px-4 py-3 font-mono text-text-secondary">{formatCurrencyAbbr(r.limiteGlobal)}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-mono font-semibold ${
                        r.curva === 'A' ? 'bg-accent-green/20 text-accent-green' :
                        r.curva === 'B' ? 'bg-accent-blue/20 text-accent-blue' :
                        'bg-accent-amber/20 text-accent-amber'
                      }`}>{r.curva}</span>
                    </td>
                    <td className="px-4 py-3">{STATUS_BADGE[r._status]}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <div className="p-4 border-t border-border-color">
          <Pagination page={page} totalPages={totalPages} onChange={setPage} />
        </div>
      </div>

      {selected && (
        <ClienteModal
          cliente={selected}
          meses={meses}
          diasBloqueio={diasBloqueio}
          diasInativacao={diasInativacao}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  )
}
