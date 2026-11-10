import React, { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell } from 'recharts'
import { UserRound, DollarSign, Target, TrendingUp, Users } from 'lucide-react'
import { useCarteira, applyDrill, aggregateBy, summarize, drillUrl } from '../../lib/drill'
import { exportExcel } from '../../services/dataService'
import {
  ExplorarShell, FilterChips, RefinePanel, Kpi, Panel, Sparkline, Variacao, StatusBar, SortableTable,
  ExportButton, EmptyState, useDrill, chartTooltip, axisTick, n, money, moneyAbbr, pct,
} from './ui'

export default function ExplorarVendedores() {
  const navigate = useNavigate()
  const { ready, rows, meses, mesAtual, equipeNome, vendedorNome, diasBloqueio } = useCarteira()
  const { f } = useDrill()

  const filtered = useMemo(() => applyDrill(rows, f, { mesAtual, diasBloqueio }), [rows, f, mesAtual, diasBloqueio])
  const s = useMemo(() => summarize(filtered, meses, diasBloqueio), [filtered, meses, diasBloqueio])
  const vendedores = useMemo(
    () => aggregateBy(filtered, r => r.rca, meses, r => ({ nome: r.nome, gr: r.gr })).sort((a, b) => b.fatMes - a.fatMes),
    [filtered, meses]
  )
  const top = vendedores.slice(0, 12).map(v => ({ ...v, label: v.nome.split(' ').slice(0, 2).join(' ') }))
  const mediaFat = vendedores.length ? s.fatMes / vendedores.length : 0

  if (!ready) return <EmptyState>Sem dados carregados.</EmptyState>

  function handleExport() {
    exportExcel(vendedores.map(v => ({
      'RCA': v.key, 'Vendedor': v.nome, 'Equipe': equipeNome(v.gr), 'Clientes': v.clientes, 'Ativos': v.ativos,
      'Bloqueados': v.bloqueados, 'Inativos': v.inativos, 'Positivação %': +v.positivacao.toFixed(1),
      'Fat. mês': v.fatMes, 'Fat. mês anterior': v.fatAnt, 'Fat. 12M': v.fat12, 'Municípios': v.municipios,
    })), `analise_vendedores_${new Date().toISOString().slice(0, 10)}.xlsx`)
  }

  // links das contagens preservam a seleção atual + o vendedor
  const toClientes = (v, extra = {}) => drillUrl('/explorar/clientes', { ...f, rca: v.key, ...extra })

  const columns = [
    {
      key: 'nome', label: 'Vendedor', sortable: true, defaultDir: 'asc',
      render: v => (
        <div className="min-w-[160px]">
          <p className="text-text-primary font-medium truncate">{v.nome}</p>
          <p className="text-[11px] text-text-secondary">RCA {v.key} · {equipeNome(v.gr)}</p>
        </div>
      ),
    },
    {
      key: 'clientes', label: 'Clientes', sortable: true, align: 'right',
      render: v => <button onClick={e => { e.stopPropagation(); navigate(toClientes(v)) }} className="font-mono text-text-primary hover:text-accent-blue hover:underline">{n(v.clientes)}</button>,
    },
    {
      key: 'ativos', label: 'Ativos', sortable: true, align: 'right',
      render: v => <button onClick={e => { e.stopPropagation(); navigate(toClientes(v, { status: 'ativo' })) }} className="font-mono text-accent-green hover:underline">{n(v.ativos)}</button>,
    },
    {
      key: 'inat', label: 'Inat./Bloq.', align: 'right', sortValue: v => v.inativos + v.bloqueados,
      render: v => <button onClick={e => { e.stopPropagation(); navigate(toClientes(v, { status: 'inativos' })) }} className="font-mono text-accent-amber hover:underline">{n(v.inativos + v.bloqueados)}</button>,
    },
    { key: 'mix', label: 'Carteira', render: v => <div className="w-24"><StatusBar a={v} /></div> },
    {
      key: 'positivacao', label: 'Positivação', sortable: true, align: 'right',
      render: v => <span className={`font-mono ${v.positivacao >= s.positivacao ? 'text-accent-green' : 'text-text-secondary'}`}>{pct(v.positivacao)}</span>,
    },
    { key: 'fatMes', label: 'Fat. mês', sortable: true, align: 'right', render: v => <span className="font-mono text-text-primary whitespace-nowrap">{moneyAbbr(v.fatMes)}</span> },
    { key: 'variacao', label: 'Var.', sortable: true, align: 'right', render: v => <Variacao value={v.variacao} /> },
    { key: 'serie', label: '12 meses', render: v => <Sparkline data={v.serie} color="#3b82f6" /> },
    {
      key: 'municipios', label: 'Mun.', sortable: true, align: 'right',
      render: v => <button onClick={e => { e.stopPropagation(); navigate(drillUrl('/explorar/municipios', { ...f, rca: v.key })) }} className="font-mono text-text-secondary hover:text-accent-blue hover:underline">{n(v.municipios)}</button>,
    },
  ]

  return (
    <ExplorarShell
      eyebrow="Força de vendas"
      title={<>{n(vendedores.length)} <span className="text-text-secondary font-semibold">·</span> Vendedores</>}
      subtitle="Vendedores com clientes na seleção. Clique em um vendedor para ver o perfil completo."
      icon={UserRound}
      accent="#8b5cf6"
      pivot
      chips={<FilterChips equipeNome={equipeNome} vendedorNome={vendedorNome} />}
      actions={<ExportButton onClick={handleExport} />}
    >
      <RefinePanel rows={rows} equipeNome={equipeNome} />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi label="Clientes na seleção" icon={Users} value={n(s.clientes)} sub={`${n(s.ativos)} ativos`} onClick={() => navigate(drillUrl('/explorar/clientes', f))} />
        <Kpi label="Faturamento do mês" icon={DollarSign} value={moneyAbbr(s.fatMes)} sub={<span className="flex items-center gap-1.5"><Variacao value={s.variacao} /> vs anterior</span>} />
        <Kpi label="Média por vendedor" icon={TrendingUp} value={moneyAbbr(mediaFat)} sub="faturamento do mês" />
        <Kpi label="Positivação" icon={Target} value={pct(s.positivacao)} sub={`${n(s.positivados)} clientes compraram`} />
      </div>

      <Panel title="Quem mais faturou no mês" subtitle="Linha tracejada = média por vendedor · clique numa barra para abrir o perfil">
        {top.length ? (
          <ResponsiveContainer width="100%" height={Math.max(top.length * 30, 140)}>
            <BarChart data={top} layout="vertical" margin={{ left: 8, right: 16 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
              <XAxis type="number" tick={axisTick} tickFormatter={v => moneyAbbr(v).replace('R$ ', '')} />
              <YAxis type="category" dataKey="label" tick={axisTick} width={120} />
              <Tooltip {...chartTooltip} formatter={v => [money(v), 'Faturamento']} />
              <Bar dataKey="fatMes" radius={[0, 6, 6, 0]} onClick={d => navigate(`/explorar/vendedor/${d.payload?.key ?? d.key}`)} style={{ cursor: 'pointer' }}>
                {top.map(v => <Cell key={v.key} fill={v.fatMes >= mediaFat ? '#8b5cf6' : '#8b5cf666'} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : <EmptyState>Nenhum vendedor na seleção.</EmptyState>}
      </Panel>

      <Panel title="Vendedores" subtitle="Números clicáveis abrem os clientes correspondentes">
        <SortableTable
          columns={columns}
          rows={vendedores}
          rowKey={v => v.key}
          initialSort={{ key: 'fatMes', dir: 'desc' }}
          onRowClick={v => navigate(`/explorar/vendedor/${v.key}`)}
        />
      </Panel>
    </ExplorarShell>
  )
}
