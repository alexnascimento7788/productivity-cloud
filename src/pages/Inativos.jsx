import React, { useMemo, useState } from 'react'
import { Download, AlertCircle, Clock, CheckCircle2 } from 'lucide-react'
import { useAuth, useData, isStaff, filterRowsByRole } from '../App'
import { processExcelData, calcInativos, formatCurrency, exportCSV } from '../services/dataService'
import KPICard from '../components/KPICard'
import PageHeader from '../components/PageHeader'
import { FiltrosBar, Select } from '../components/Filtros'
import Pagination from '../components/Pagination'

const PAGE_SIZE = 50

const diasRanges = [
  { value: '1-30', label: '1–30 dias' },
  { value: '31-90', label: '31–90 dias' },
  { value: '91-180', label: '91–180 dias' },
  { value: '180+', label: '180+ dias' },
]

function urgenciaBadge(urgencia) {
  if (urgencia === 'critico') return <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-accent-red/20 text-accent-red"><AlertCircle size={10} />Crítico</span>
  if (urgencia === 'alerta') return <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-accent-amber/20 text-accent-amber"><Clock size={10} />Alerta</span>
  return <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-accent-green/20 text-accent-green"><CheckCircle2 size={10} />Recente</span>
}

function filtrarDias(dias, faixa) {
  if (!faixa) return true
  if (faixa === '1-30') return dias >= 1 && dias <= 30
  if (faixa === '31-90') return dias >= 31 && dias <= 90
  if (faixa === '91-180') return dias >= 91 && dias <= 180
  if (faixa === '180+') return dias > 180
  return true
}

export default function Inativos() {
  const { session } = useAuth()
  const { excelData } = useData()
  const isMaster = isStaff(session?.role)

  const [filterGr, setFilterGr] = useState(null)
  const [filterRca, setFilterRca] = useState(null)
  const [filterCidade, setFilterCidade] = useState(null)
  const [filterDias, setFilterDias] = useState(null)
  const [page, setPage] = useState(1)

  const { rows, meses } = useMemo(() => {
    if (!excelData) return { rows: [], meses: [] }
    return processExcelData(excelData.data) || { rows: [], meses: [] }
  }, [excelData])

  const baseRows = useMemo(() => {
    return filterRowsByRole(rows, session)
  }, [rows, isMaster, session])

  const equipes = useMemo(() => [...new Set(baseRows.map(r => r.gr))].sort(), [baseRows])
  const vendedoresFiltro = useMemo(() => {
    const base = filterGr ? baseRows.filter(r => r.gr === filterGr) : baseRows
    const map = new Map()
    base.forEach(r => { if (!map.has(r.rca)) map.set(r.rca, r.nome) })
    return [...map.entries()].map(([rca, nome]) => ({ value: String(rca), label: `${rca} — ${nome}` }))
  }, [baseRows, filterGr])
  const cidades = useMemo(() => [...new Set(baseRows.map(r => r.cidade).filter(Boolean))].sort().map(c => ({ value: c, label: c })), [baseRows])

  const inativos = useMemo(() => {
    let base = baseRows
    if (filterGr) base = base.filter(r => r.gr === filterGr)
    if (filterRca) base = base.filter(r => r.rca === Number(filterRca))
    return calcInativos(base, meses)
  }, [baseRows, meses, filterGr, filterRca])

  const filtered = useMemo(() => {
    let data = inativos
    if (filterCidade) data = data.filter(r => r.cidade === filterCidade)
    if (filterDias) data = data.filter(r => filtrarDias(r.diasUltCmp ?? 0, filterDias))
    return data
  }, [inativos, filterCidade, filterDias])

  const kpis = useMemo(() => ({
    total: filtered.length,
    ate30: filtered.filter(r => (r.diasUltCmp ?? 0) <= 30).length,
    de31a90: filtered.filter(r => (r.diasUltCmp ?? 0) > 30 && (r.diasUltCmp ?? 0) <= 90).length,
    acima90: filtered.filter(r => (r.diasUltCmp ?? 0) > 90).length,
    potencial: filtered.reduce((s, r) => s + r.mediaHist, 0),
  }), [filtered])

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  function handleExport() {
    exportCSV(filtered.map(r => ({
      'Razão Social': r.razaoSocial, 'Vendedor': r.nome, 'Cidade': r.cidade,
      'Últ. Compra': r.dtUltCmp, 'Dias S/ Compra': r.diasUltCmp,
      'Média Mensal Hist.': r.mediaHist.toFixed(2), 'Melhor Mês': r.melhorMes,
      'Urgência': r.urgencia,
    })), 'inativos.csv')
  }

  if (!excelData) return <div className="p-4 md:p-6 text-text-secondary">Sem dados carregados.</div>

  return (
    <div className="p-4 md:p-6 animate-fade-in">
      <PageHeader
        title="Clientes Inativos"
        subtitle="Clientes sem compra no mês atual"
        action={
          <button onClick={handleExport} className="flex items-center gap-2 px-4 py-2 text-sm bg-bg-secondary border border-border-color rounded-lg text-text-secondary hover:text-text-primary hover:bg-bg-tertiary transition-colors">
            <Download size={14} /> Exportar CSV
          </button>
        }
      />

      {isMaster && (
        <FiltrosBar onClear={() => { setFilterGr(null); setFilterRca(null); setFilterCidade(null); setFilterDias(null); setPage(1) }}>
          <Select label="Equipe" value={filterGr} onChange={v => { setFilterGr(v); setFilterRca(null); setPage(1) }}
            options={equipes.map(gr => ({ value: gr, label: 'Equipe ' + gr }))} />
          <Select label="Vendedor" value={filterRca} onChange={v => { setFilterRca(v); setPage(1) }} options={vendedoresFiltro} />
          <Select label="Cidade" value={filterCidade} onChange={v => { setFilterCidade(v); setPage(1) }} options={cidades} />
          <Select label="Faixa de dias" value={filterDias} onChange={v => { setFilterDias(v); setPage(1) }} options={diasRanges} />
        </FiltrosBar>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        <KPICard title="Total Inativos" value={kpis.total.toLocaleString('pt-BR')} icon={AlertCircle} iconColor="text-accent-red" />
        <KPICard title="1–30 dias" value={kpis.ate30.toLocaleString('pt-BR')} icon={CheckCircle2} iconColor="text-accent-green" />
        <KPICard title="31–90 dias" value={kpis.de31a90.toLocaleString('pt-BR')} icon={Clock} iconColor="text-accent-amber" />
        <KPICard title="90+ dias" value={kpis.acima90.toLocaleString('pt-BR')} icon={AlertCircle} iconColor="text-accent-red" />
        <KPICard title="Potencial Perdido" value={formatCurrency(kpis.potencial)} subtitle="Média histórica mensal dos inativos" />
      </div>

      <div className="bg-bg-secondary border border-border-color rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border-color">
                {['Razão Social', 'Vendedor', 'Cidade', 'Últ. Compra', 'Dias s/ Compra', 'Média Hist. (R$)', 'Melhor Mês (R$)', 'Urgência'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-text-secondary font-medium whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paginated.map(r => (
                <tr key={r.seqPessoa} className="border-b border-border-color/50 hover:bg-bg-tertiary/50 transition-colors">
                  <td className="px-4 py-3 text-text-primary font-medium max-w-[200px] truncate">{r.razaoSocial}</td>
                  <td className="px-4 py-3 text-text-secondary">{r.nome}</td>
                  <td className="px-4 py-3 text-text-secondary">{r.cidade}</td>
                  <td className="px-4 py-3 text-text-secondary font-mono whitespace-nowrap">
                    {r.dtUltCmp ? new Date(r.dtUltCmp).toLocaleDateString('pt-BR') : '—'}
                  </td>
                  <td className="px-4 py-3 font-mono text-text-primary">{r.diasUltCmp ?? '—'}</td>
                  <td className="px-4 py-3 font-mono text-text-primary">{formatCurrency(r.mediaHist)}</td>
                  <td className="px-4 py-3 font-mono text-text-secondary">{formatCurrency(r.melhorMes)}</td>
                  <td className="px-4 py-3">{urgenciaBadge(r.urgencia)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="p-4 border-t border-border-color">
          <Pagination page={page} totalPages={totalPages} onChange={setPage} />
        </div>
      </div>
    </div>
  )
}
