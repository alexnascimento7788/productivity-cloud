import React, { useMemo, useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts'
import { Download, ChevronUp, ChevronDown } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuth, useData, useParams, filterRowsByRole } from '../App'
import { processExcelData, calcRanking, formatCurrency, formatMesLabel, exportExcel } from '../services/dataService'
import PageHeader from '../components/PageHeader'
import { FiltrosBar, Select, SearchInput } from '../components/Filtros'
import Pagination from '../components/Pagination'

const PAGE_SIZE = 20

export default function Ranking() {
  const { session } = useAuth()
  const { excelData } = useData()
  const { diasBloqueio, diasInativacao } = useParams()
  const navigate = useNavigate()
  const [filterGr, setFilterGr] = useState(null)
  const [search, setSearch] = useState('')
  const [mesIdx, setMesIdx] = useState(0)
  const [sortCol, setSortCol] = useState('fatMesSel')
  const [sortDir, setSortDir] = useState('desc')
  const [page, setPage] = useState(1)

  const { rows, meses } = useMemo(() => {
    if (!excelData) return { rows: [], meses: [] }
    const processed = processExcelData(excelData.data) || { rows: [], meses: [] }
    return { rows: filterRowsByRole(processed.rows, session), meses: processed.meses }
  }, [excelData, session])

  const equipes = useMemo(() => [...new Set(rows.map(r => r.gr))].sort(), [rows])

  const ranking = useMemo(() => {
    const base = filterGr ? rows.filter(r => r.gr === filterGr) : rows
    return calcRanking(base, meses, mesIdx, diasBloqueio, diasInativacao)
  }, [rows, meses, filterGr, mesIdx, diasBloqueio, diasInativacao])

  const filtered = useMemo(() => {
    let data = ranking
    if (search) data = data.filter(v => v.nome.toLowerCase().includes(search.toLowerCase()))
    return [...data].sort((a, b) => {
      const va = a[sortCol] ?? 0
      const vb = b[sortCol] ?? 0
      return sortDir === 'asc' ? va - vb : vb - va
    })
  }, [ranking, search, sortCol, sortDir])

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const top10 = ranking.slice(0, 10)

  function toggleSort(col) {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortCol(col); setSortDir('desc') }
    setPage(1)
  }

  function SortIcon({ col }) {
    if (sortCol !== col) return <ChevronUp size={12} className="opacity-30" />
    return sortDir === 'asc' ? <ChevronUp size={12} className="text-accent-blue" /> : <ChevronDown size={12} className="text-accent-blue" />
  }

  const today = new Date().toISOString().slice(0, 10)

  function handleExport() {
    exportExcel(filtered.map(v => ({
      'RCA': v.rca,
      'Nome': v.nome,
      'Equipe': v.gr,
      'Fat. Mês Sel.': v.fatMesSel,
      'Fat. Mês Ant.': v.fatMesAnt,
      'Var. %': +v.variacao.toFixed(1),
      'Total 12M': v.total12M,
      'Clientes Ativos': v.ativos,
      'Clientes Inativos': v.inativos,
    })), `ranking_${today}.xlsx`)
  }

  if (!excelData) return <div className="p-4 md:p-6 text-text-secondary">Sem dados carregados.</div>

  return (
    <div className="p-4 md:p-6 animate-fade-in">
      <PageHeader
        title="Ranking de Vendedores"
        action={
          <button onClick={handleExport} className="flex items-center gap-2 px-4 py-2 text-sm bg-bg-secondary border border-border-color rounded-lg text-text-secondary hover:text-text-primary hover:bg-bg-tertiary transition-colors">
            <Download size={14} /> Exportar Excel
          </button>
        }
      />

      <FiltrosBar onClear={() => { setFilterGr(null); setSearch(''); setMesIdx(0) }}>
        <SearchInput label="Buscar vendedor" value={search} onChange={v => { setSearch(v); setPage(1) }} />
        <Select label="Equipe" value={filterGr} onChange={v => { setFilterGr(v); setPage(1) }}
          options={equipes.map(gr => ({ value: gr, label: 'Equipe ' + gr }))} />
        <Select label="Mês de referência" value={String(mesIdx)} onChange={v => setMesIdx(Number(v))}
          placeholder={null}
          options={meses.map((m, i) => ({ value: String(i), label: formatMesLabel(m) }))} />
      </FiltrosBar>

      {/* Bar chart top 10 */}
      <div className="bg-bg-secondary border border-border-color rounded-xl p-5 mb-6">
        <h2 className="text-sm font-semibold text-text-primary mb-4">Top 10 — {meses[mesIdx] ? formatMesLabel(meses[mesIdx]) : ''}</h2>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={top10} layout="vertical" margin={{ left: 100 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" horizontal={false} />
            <XAxis type="number" tickFormatter={v => `R$${(v / 1000).toFixed(0)}k`} tick={{ fill: '#9ca3af', fontSize: 11 }} />
            <YAxis type="category" dataKey="nome" tick={{ fill: '#9ca3af', fontSize: 11 }} width={95} />
            <Tooltip formatter={v => [formatCurrency(v), 'Faturamento']} contentStyle={{ background: '#111827', border: '1px solid #1f2937', borderRadius: 8 }} labelStyle={{ color: '#f9fafb' }} />
            <Bar dataKey="fatMesSel" fill="#3b82f6" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Table */}
      <div className="bg-bg-secondary border border-border-color rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border-color">
                {[
                  ['#', null], ['Nome', null], ['RCA', null], ['Equipe', null],
                  ['Fat. Mês Sel.', 'fatMesSel'], ['Fat. Mês Ant.', 'fatMesAnt'],
                  ['Var. %', 'variacao'], ['Total 12M', 'total12M'],
                  ['Ativos', 'ativos'], ['Inativos', 'inativos'],
                ].map(([label, col]) => (
                  <th
                    key={label}
                    onClick={() => col && toggleSort(col)}
                    className={`px-4 py-3 text-left text-text-secondary font-medium whitespace-nowrap ${col ? 'cursor-pointer hover:text-text-primary' : ''}`}
                  >
                    <span className="flex items-center gap-1">{label} {col && <SortIcon col={col} />}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paginated.map((v, i) => {
                const rank = (page - 1) * PAGE_SIZE + i + 1
                return (
                  <tr key={v.rca} className="border-b border-border-color/50 hover:bg-bg-tertiary/50 transition-colors">
                    <td className="px-4 py-3 text-text-secondary font-mono">{rank}</td>
                    <td className="px-4 py-3 text-text-primary font-medium">{v.nome}</td>
                    <td className="px-4 py-3 text-text-secondary font-mono">{v.rca}</td>
                    <td className="px-4 py-3 text-text-secondary">{v.gr}</td>
                    <td className="px-4 py-3 font-mono text-text-primary">{formatCurrency(v.fatMesSel)}</td>
                    <td className="px-4 py-3 font-mono text-text-secondary">{formatCurrency(v.fatMesAnt)}</td>
                    <td className={`px-4 py-3 font-mono font-medium ${v.variacao >= 0 ? 'text-accent-green' : 'text-accent-red'}`}>
                      {v.variacao >= 0 ? '+' : ''}{v.variacao.toFixed(1)}%
                    </td>
                    <td className="px-4 py-3 font-mono text-text-primary">{formatCurrency(v.total12M)}</td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => navigate(`/clientes?rca=${v.rca}&status=ativo`)}
                        className="text-accent-green font-mono hover:underline"
                      >{v.ativos}</button>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => navigate(`/clientes?rca=${v.rca}&status=inativo`)}
                        className="text-accent-amber font-mono hover:underline"
                      >{(v.inativos || 0) + (v.bloqueados || 0)}</button>
                    </td>
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
    </div>
  )
}
