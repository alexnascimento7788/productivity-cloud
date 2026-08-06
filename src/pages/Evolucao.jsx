import React, { useMemo, useState } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts'
import { TrendingUp, TrendingDown, Minus, PlusCircle, XCircle } from 'lucide-react'
import { useAuth, useData, isStaff, filterRowsByRole } from '../App'
import { processExcelData, calcEvolucaoMensal, formatCurrency, formatMesLabel, getVendedores } from '../services/dataService'
import PageHeader from '../components/PageHeader'
import { FiltrosBar, Select } from '../components/Filtros'
import KPICard from '../components/KPICard'

function calcTendencia(evolucao) {
  if (evolucao.length < 6) return null
  const recent = evolucao.slice(-3).reduce((s, e) => s + e.valor, 0)
  const older = evolucao.slice(-6, -3).reduce((s, e) => s + e.valor, 0)
  if (older === 0) return null
  const pct = ((recent - older) / older) * 100
  if (pct > 3) return { label: 'Em alta ↑', color: 'text-accent-green', icon: TrendingUp }
  if (pct < -3) return { label: 'Em queda ↓', color: 'text-accent-red', icon: TrendingDown }
  return { label: 'Estável →', color: 'text-text-secondary', icon: Minus }
}

export default function Evolucao() {
  const { session } = useAuth()
  const { excelData } = useData()
  const isMaster = isStaff(session?.role)

  const [filterGr, setFilterGr] = useState(null)
  const [filterRca, setFilterRca] = useState(null)
  const [filterGr2, setFilterGr2] = useState(null)
  const [filterRca2, setFilterRca2] = useState(null)
  const [comparar, setComparar] = useState(false)

  const { rows, meses } = useMemo(() => {
    if (!excelData) return { rows: [], meses: [] }
    return processExcelData(excelData.data) || { rows: [], meses: [] }
  }, [excelData])

  const baseRows = useMemo(() => {
    return filterRowsByRole(rows, session)
  }, [rows, isMaster, session])

  const equipes = useMemo(() => [...new Set(rows.map(r => r.gr))].sort(), [rows])
  const vendedores1 = useMemo(() => {
    const base = filterGr ? rows.filter(r => r.gr === filterGr) : rows
    return getVendedores(base)
  }, [rows, filterGr])
  const vendedores2 = useMemo(() => {
    const base = filterGr2 ? rows.filter(r => r.gr === filterGr2) : rows
    return getVendedores(base)
  }, [rows, filterGr2])

  const filtered1 = useMemo(() => {
    let data = baseRows
    if (filterGr) data = data.filter(r => r.gr === filterGr)
    if (filterRca) data = data.filter(r => r.rca === Number(filterRca))
    return data
  }, [baseRows, filterGr, filterRca])

  const filtered2 = useMemo(() => {
    if (!comparar) return []
    let data = rows
    if (filterGr2) data = data.filter(r => r.gr === filterGr2)
    if (filterRca2) data = data.filter(r => r.rca === Number(filterRca2))
    return data
  }, [rows, filterGr2, filterRca2, comparar])

  const evolucao1 = useMemo(() => calcEvolucaoMensal(filtered1, meses), [filtered1, meses])
  const evolucao2 = useMemo(() => calcEvolucaoMensal(filtered2, meses), [filtered2, meses])

  const chartData = useMemo(() => evolucao1.map((e, i) => ({
    label: e.label,
    'Principal': e.valor,
    ...(comparar ? { 'Comparativo': evolucao2[i]?.valor ?? 0 } : {}),
  })), [evolucao1, evolucao2, comparar])

  const maxVal = evolucao1.reduce((a, e) => Math.max(a, e.valor), 0)
  const minVal = evolucao1.reduce((a, e) => Math.min(a, e.valor === 0 ? Infinity : e.valor), Infinity)
  const media = evolucao1.length ? evolucao1.reduce((s, e) => s + e.valor, 0) / evolucao1.length : 0
  const melhorMes = evolucao1.find(e => e.valor === maxVal)
  const piorMes = evolucao1.find(e => e.valor === minVal)
  const tendencia = calcTendencia(evolucao1)

  if (!excelData) return <div className="p-4 md:p-6 text-text-secondary">Sem dados carregados.</div>

  return (
    <div className="p-4 md:p-6 animate-fade-in">
      <PageHeader title="Evolução Mensal" />

      <FiltrosBar onClear={() => { setFilterGr(null); setFilterRca(null); setComparar(false) }}>
        {isMaster && (
          <Select label="Equipe" value={filterGr} onChange={v => { setFilterGr(v); setFilterRca(null) }}
            options={equipes.map(gr => ({ value: gr, label: 'Equipe ' + gr }))} />
        )}
        {isMaster && (
          <Select label="Vendedor" value={filterRca} onChange={setFilterRca}
            options={vendedores1.map(v => ({ value: String(v.rca), label: `${v.rca} — ${v.nome}` }))} />
        )}
        {isMaster && !comparar && (
          <button
            onClick={() => setComparar(true)}
            className="flex items-center gap-2 px-3 py-2 text-sm border border-border-color rounded-lg text-text-secondary hover:text-text-primary hover:bg-bg-tertiary transition-colors self-end"
          >
            <PlusCircle size={14} /> Comparar vendedor
          </button>
        )}
        {comparar && (
          <>
            <Select label="Equipe (comparativo)" value={filterGr2} onChange={v => { setFilterGr2(v); setFilterRca2(null) }}
              options={equipes.map(gr => ({ value: gr, label: 'Equipe ' + gr }))} />
            <Select label="Vendedor (comparativo)" value={filterRca2} onChange={setFilterRca2}
              options={vendedores2.map(v => ({ value: String(v.rca), label: `${v.rca} — ${v.nome}` }))} />
            <button onClick={() => { setComparar(false); setFilterGr2(null); setFilterRca2(null) }}
              className="flex items-center gap-1 px-3 py-2 text-sm text-accent-red hover:bg-accent-red/10 border border-border-color rounded-lg self-end">
              <XCircle size={14} /> Remover comparativo
            </button>
          </>
        )}
      </FiltrosBar>

      {/* Chart */}
      <div className="bg-bg-secondary border border-border-color rounded-xl p-5 mb-6">
        <ResponsiveContainer width="100%" height={320}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
            <XAxis dataKey="label" tick={{ fill: '#9ca3af', fontSize: 11 }} />
            <YAxis tickFormatter={v => `R$${(v/1000).toFixed(0)}k`} tick={{ fill: '#9ca3af', fontSize: 11 }} width={75} />
            <Tooltip
              formatter={(v, name) => [formatCurrency(v), name]}
              contentStyle={{ background: '#111827', border: '1px solid #1f2937', borderRadius: 8 }}
              labelStyle={{ color: '#f9fafb' }}
            />
            {comparar && <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12 }} />}
            <Line type="monotone" dataKey="Principal" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3, fill: '#3b82f6' }} activeDot={{ r: 5 }} />
            {comparar && (
              <Line type="monotone" dataKey="Comparativo" stroke="#f59e0b" strokeWidth={2} strokeDasharray="6 3" dot={{ r: 3, fill: '#f59e0b' }} activeDot={{ r: 5 }} />
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          title="Melhor mês"
          value={formatCurrency(maxVal)}
          subtitle={melhorMes?.label || '—'}
          icon={TrendingUp}
          iconColor="text-accent-green"
        />
        <KPICard
          title="Pior mês"
          value={formatCurrency(minVal === Infinity ? 0 : minVal)}
          subtitle={piorMes?.label || '—'}
          icon={TrendingDown}
          iconColor="text-accent-red"
        />
        <KPICard
          title="Média mensal"
          value={formatCurrency(media)}
          subtitle="Últimos 12 meses"
          icon={Minus}
        />
        {tendencia && (
          <div className="bg-bg-secondary border border-border-color rounded-xl p-5">
            <p className="text-text-secondary text-sm font-medium mb-2">Tendência</p>
            <p className={`text-2xl font-bold ${tendencia.color}`}>{tendencia.label}</p>
            <p className="text-text-secondary text-xs mt-1">Últ. 3 meses vs 3 anteriores</p>
          </div>
        )}
      </div>
    </div>
  )
}
