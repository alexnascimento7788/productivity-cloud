import React, { useMemo, useState } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts'
import { UserCheck, UserX, DollarSign, Info, BarChart2 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuth, useData, useParams, isStaff, filterRowsByRole } from '../App'
import {
  processExcelData, filterByGrAndRca, calcKPIs, calcEvolucaoMensalPositivados,
  calcRanking, calcCurvaABC, formatCurrencyAbbr, formatMesLabel, getVendedores,
} from '../services/dataService'
import KPICard from '../components/KPICard'
import PageHeader from '../components/PageHeader'
import { FiltrosBar, Select } from '../components/Filtros'

const CURVA_COLORS = { A: '#10b981', B: '#3b82f6', C: '#f59e0b' }

function TooltipPositivados({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-bg-secondary border border-border-color rounded-lg p-3 text-sm shadow-xl">
      <p className="text-text-secondary mb-1">{label}</p>
      <p className="text-text-primary font-semibold">{payload[0].value} clientes positivados</p>
    </div>
  )
}

export default function Dashboard() {
  const { session } = useAuth()
  const { excelData } = useData()
  const { diasBloqueio, diasInativacao, curvaAMin, curvaBMin } = useParams()
  const isMaster = isStaff(session?.role)
  const navigate = useNavigate()

  const [filterGr, setFilterGr] = useState(null)
  const [filterRca, setFilterRca] = useState(null)

  const { rows, meses } = useMemo(() => {
    if (!excelData) return { rows: [], meses: [] }
    return processExcelData(excelData.data) || { rows: [], meses: [] }
  }, [excelData])

  const sessionRows = useMemo(() => filterRowsByRole(rows, session), [rows, session])

  const equipes = useMemo(() => [...new Set(rows.map(r => r.gr))].sort(), [rows])

  const vendedores = useMemo(() => {
    const base = filterGr ? rows.filter(r => r.gr === filterGr) : rows
    return getVendedores(base)
  }, [rows, filterGr])

  const filteredRows = useMemo(
    () => filterByGrAndRca(sessionRows, filterGr, filterRca),
    [sessionRows, filterGr, filterRca]
  )

  const kpis = useMemo(() => {
    if (!meses.length) return {}
    return calcKPIs(filteredRows, meses, diasBloqueio, diasInativacao)
  }, [filteredRows, meses, diasBloqueio, diasInativacao])

  const evolucao = useMemo(() => {
    if (!meses.length) return []
    return calcEvolucaoMensalPositivados(filteredRows, meses)
  }, [filteredRows, meses])

  const curvaABC = useMemo(() => {
    if (!meses.length) return null
    return calcCurvaABC(filteredRows, meses, curvaAMin, curvaBMin)
  }, [filteredRows, meses, curvaAMin, curvaBMin])

  const top5 = useMemo(() => {
    if (!meses.length || !isMaster) return []
    return calcRanking(filteredRows, meses, 0, diasBloqueio, diasInativacao).slice(0, 5)
  }, [filteredRows, meses, isMaster, diasBloqueio, diasInativacao])

  if (!excelData) {
    return <div className="p-4 md:p-6 text-text-secondary">Nenhuma planilha carregada. Coloque um arquivo .xlsx na pasta db-base/.</div>
  }

  if (!meses.length) {
    const allCols = excelData.data?.[0] ? Object.keys(excelData.data[0]) : []
    const vdLike = allCols.filter(c => c.startsWith('VD'))
    return (
      <div className="p-4 md:p-6 space-y-4">
        <PageHeader title="Dashboard" subtitle={`Planilha: ${excelData.fileName}`} />
        <div className="p-4 bg-accent-amber/10 border border-accent-amber/30 rounded-xl text-sm">
          <p className="font-semibold text-accent-amber mb-2">Colunas de faturamento (VD) não detectadas</p>
          <p className="text-text-secondary mb-2">
            O sistema espera colunas no formato <code className="bg-bg-tertiary px-1 rounded">VD AAAA-MM</code> (ex: <code className="bg-bg-tertiary px-1 rounded">VD 2025-04</code>).
          </p>
          {vdLike.length > 0 ? (
            <p className="text-text-secondary">Colunas VD encontradas na planilha: <span className="text-text-primary font-mono">{vdLike.join(', ')}</span></p>
          ) : (
            <p className="text-text-secondary">Nenhuma coluna começando com <span className="font-mono">VD</span> foi encontrada.</p>
          )}
          <p className="text-text-secondary mt-2 text-xs">Total de colunas: {allCols.length} | Primeiras: {allCols.slice(0, 8).join(', ')}</p>
        </div>
      </div>
    )
  }

  const top5Max = top5[0]?.fatMesSel || 1

  const curvaData = curvaABC ? [
    { name: 'Curva A', value: curvaABC.A.count, pct: curvaABC.A.pct, key: 'A' },
    { name: 'Curva B', value: curvaABC.B.count, pct: curvaABC.B.pct, key: 'B' },
    { name: 'Curva C', value: curvaABC.C.count, pct: curvaABC.C.pct, key: 'C' },
  ] : []

  const positivacaoData = [
    { name: 'Positivados', value: kpis.positivados || 0 },
    { name: 'Não positivados', value: kpis.naoPositivados || 0 },
  ]
  const positivacaoPct = kpis.totalClientes > 0
    ? ((kpis.positivados / kpis.totalClientes) * 100).toFixed(1)
    : '0.0'

  return (
    <div className="p-4 md:p-6 animate-fade-in">
      <PageHeader title="Dashboard" subtitle={`Planilha: ${excelData.fileName}`} />

      {isMaster && (
        <FiltrosBar onClear={() => { setFilterGr(null); setFilterRca(null) }}>
          <Select
            label="Equipe"
            value={filterGr}
            onChange={v => { setFilterGr(v); setFilterRca(null) }}
            options={equipes.map(gr => ({ value: gr, label: 'Equipe ' + gr }))}
          />
          <Select
            label="Vendedor"
            value={filterRca}
            onChange={setFilterRca}
            options={vendedores.map(v => ({ value: String(v.rca), label: `${v.rca} — ${v.nome}` }))}
          />
        </FiltrosBar>
      )}

      {/* Diagnóstico quando ativos e inativos são 0 mas há dados */}
      {rows.length > 0 && kpis.ativos === 0 && (kpis.bloqueados || 0) + (kpis.inativos || 0) === 0 && (
        <div className="mb-4 p-3 bg-accent-amber/10 border border-accent-amber/30 rounded-xl text-xs text-text-secondary">
          <span className="text-accent-amber font-semibold">Diagnóstico: </span>
          {rows.length} clientes carregados · Campo <code className="bg-bg-tertiary px-1 rounded">Dias.Ult.Cmp</code> do 1º cliente:{' '}
          <span className="text-text-primary font-mono">{String(excelData.data?.[0]?.['Dias.Ult.Cmp'] ?? 'ausente')}</span>
          {' · '}Meses VD detectados: <span className="text-text-primary font-mono">{meses.slice(0, 3).join(', ') || 'nenhum'}</span>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        <button onClick={() => navigate('/clientes?status=ativo')} className="text-left">
          <KPICard title="Clientes Ativos" value={kpis.ativos?.toLocaleString('pt-BR') || '0'} icon={UserCheck} iconColor="text-accent-green" />
        </button>
        <button onClick={() => navigate('/clientes/inativos')} className="text-left">
          <KPICard title="Clientes Inativos" value={((kpis.bloqueados || 0) + (kpis.inativos || 0)).toLocaleString('pt-BR')} icon={UserX} iconColor="text-accent-amber" />
        </button>
        <div>
          <KPICard
            title="Fat. Mês Atual"
            value={formatCurrencyAbbr(kpis.fatMesAtual)}
            icon={DollarSign}
            iconColor="text-accent-blue"
            variacao={kpis.variacaoMensal}
          />
        </div>
        <div>
          <KPICard
            title="Ticket Médio"
            value={formatCurrencyAbbr(kpis.ticketMedio)}
            subtitle="por cliente positivado no mês"
            icon={BarChart2}
            iconColor="text-accent-green"
          />
        </div>
      </div>

      {/* Curva ABC + Positivação + Evolução */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mb-6">

        {/* Curva ABC */}
        <div className="bg-bg-secondary border border-border-color rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-text-primary">Curva ABC — Mês Atual</h2>
            <div className="relative group">
              <Info size={14} className="text-text-secondary cursor-help" />
              <div className="absolute right-0 top-5 w-64 bg-bg-primary border border-border-color rounded-lg p-3 text-xs text-text-secondary shadow-xl z-50 hidden group-hover:block">
                <p className="font-semibold text-text-primary mb-2">Classificação por faturamento no mês atual</p>
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-accent-green flex-shrink-0" />
                    <span><span className="text-text-primary font-medium">Curva A</span> — ≥ {formatCurrencyAbbr(curvaAMin)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-accent-blue flex-shrink-0" />
                    <span><span className="text-text-primary font-medium">Curva B</span> — de {formatCurrencyAbbr(curvaBMin)} a {formatCurrencyAbbr(curvaAMin - 1)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-accent-amber flex-shrink-0" />
                    <span><span className="text-text-primary font-medium">Curva C</span> — {'<'} {formatCurrencyAbbr(curvaBMin)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
          {curvaABC ? (
            <>
              <ResponsiveContainer width="100%" height={160}>
                <PieChart>
                  <Pie
                    data={curvaData}
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={65}
                    dataKey="value"
                    onClick={d => navigate(`/clientes?curva=${d.key}`)}
                    style={{ cursor: 'pointer' }}
                  >
                    {curvaData.map(entry => (
                      <Cell key={entry.key} fill={CURVA_COLORS[entry.key]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(val, _n, p) => [`${val} clientes • ${p.payload.pct.toFixed(1)}% fat.`]}
                    contentStyle={{ background: '#111827', border: '1px solid #1f2937', borderRadius: 8, color: '#e5e7eb' }}
                    itemStyle={{ color: '#e5e7eb' }}
                    labelStyle={{ color: '#9ca3af' }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-1.5 mt-1">
                {curvaData.map(d => (
                  <button
                    key={d.key}
                    onClick={() => navigate(`/clientes?curva=${d.key}`)}
                    className="flex items-center justify-between w-full text-xs hover:bg-bg-tertiary rounded px-1 py-0.5 transition-colors"
                  >
                    <span className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ background: CURVA_COLORS[d.key] }} />
                      <span className="text-text-secondary">Curva {d.key}</span>
                    </span>
                    <span className="text-text-primary font-medium">{d.value} ({d.pct.toFixed(1)}%)</span>
                  </button>
                ))}
              </div>
            </>
          ) : <p className="text-text-secondary text-sm">Sem dados.</p>}
        </div>

        {/* Positivação */}
        <div className="bg-bg-secondary border border-border-color rounded-xl p-5">
          <h2 className="text-sm font-semibold text-text-primary mb-3">Positivação — Mês Atual</h2>
          <div className="flex flex-col items-center">
            <div className="relative">
              <PieChart width={160} height={160}>
                <Pie
                  data={positivacaoData}
                  cx={80} cy={80}
                  innerRadius={50}
                  outerRadius={70}
                  dataKey="value"
                  onClick={(_, idx) => navigate(idx === 0 ? '/clientes?positivado=sim' : '/clientes?positivado=nao')}
                  style={{ cursor: 'pointer' }}
                >
                  <Cell fill="#10b981" />
                  <Cell fill="#ef4444" />
                </Pie>
                <Tooltip
                  formatter={(val, name) => [`${val} clientes`, name]}
                  contentStyle={{ background: '#111827', border: '1px solid #1f2937', borderRadius: 8, color: '#e5e7eb' }}
                  itemStyle={{ color: '#e5e7eb' }}
                  labelStyle={{ color: '#9ca3af' }}
                />
              </PieChart>
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <span className="text-2xl font-bold text-text-primary">{positivacaoPct}%</span>
              </div>
            </div>
            <div className="flex gap-4 mt-1 text-xs">
              <span className="flex items-center gap-1.5 text-text-secondary">
                <span className="w-2.5 h-2.5 rounded-full bg-accent-green" />
                {kpis.positivados || 0} positivados
              </span>
              <span className="flex items-center gap-1.5 text-text-secondary">
                <span className="w-2.5 h-2.5 rounded-full bg-accent-red" />
                {kpis.naoPositivados || 0} não
              </span>
            </div>
          </div>
        </div>

        {/* Evolução positivados */}
        <div className="bg-bg-secondary border border-border-color rounded-xl p-5">
          <h2 className="text-sm font-semibold text-text-primary mb-4">Positivados por Mês</h2>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={evolucao}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
              <XAxis dataKey="label" tick={{ fill: '#9ca3af', fontSize: 10 }} />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 10 }} width={35} />
              <Tooltip content={<TooltipPositivados />} />
              <Line type="monotone" dataKey="positivados" stroke="#3b82f6" strokeWidth={2} dot={{ r: 2, fill: '#3b82f6' }} activeDot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Top 5 */}
      {top5.length > 0 && (
        <div className="bg-bg-secondary border border-border-color rounded-xl p-5">
          <h2 className="text-sm font-semibold text-text-primary mb-4">
            Top 5 Vendedores — {meses[0] ? formatMesLabel(meses[0]) : ''}
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border-color">
                  {['#', 'Vendedor', 'Faturamento', 'Progresso', 'Ativos', 'Inativos'].map(h => (
                    <th key={h} className="pb-2 text-left text-text-secondary font-medium pr-4 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {top5.map((v, i) => (
                  <tr key={v.rca} className="border-b border-border-color/30">
                    <td className="py-2 pr-4 text-text-secondary font-mono text-xs">#{i + 1}</td>
                    <td className="py-2 pr-4">
                      <p className="text-text-primary font-medium truncate max-w-[130px]">{v.nome}</p>
                      <p className="text-text-secondary text-xs">RCA {v.rca}</p>
                    </td>
                    <td className="py-2 pr-4 font-mono text-text-primary whitespace-nowrap">{formatCurrencyAbbr(v.fatMesSel)}</td>
                    <td className="py-2 pr-4 min-w-[120px]">
                      <div className="h-1.5 bg-bg-tertiary rounded-full overflow-hidden">
                        <div className="h-full bg-accent-blue rounded-full" style={{ width: `${(v.fatMesSel / top5Max) * 100}%` }} />
                      </div>
                    </td>
                    <td className="py-2 pr-4 text-center">
                      <button
                        onClick={() => navigate(`/clientes?rca=${v.rca}&status=ativo`)}
                        className="text-accent-green font-mono hover:underline"
                      >{v.ativos}</button>
                    </td>
                    <td className="py-2 text-center">
                      <button
                        onClick={() => navigate(`/clientes?rca=${v.rca}&status=inativo`)}
                        className="text-accent-amber font-mono hover:underline"
                      >{(v.inativos || 0) + (v.bloqueados || 0)}</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
