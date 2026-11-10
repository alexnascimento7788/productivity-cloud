import React, { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  PieChart, Pie, Cell, BarChart,
} from 'recharts'
import { Users, AlertTriangle, DollarSign, Target, TrendingUp, CalendarClock } from 'lucide-react'
import { useCarteira, applyDrill, summarize, aggregateBy, STATUS_LABEL, isRisco } from '../../lib/drill'
import { formatMesLabel, exportExcel } from '../../services/dataService'
import {
  ExplorarShell, FilterChips, RefinePanel, Kpi, Panel, Sparkline, StatusBadge, CurvaBadge, Variacao,
  SortableTable, ExportButton, EmptyState, useDrill, chartTooltip, axisTick, STATUS_COLOR, CURVA_COLOR,
  n, money, moneyAbbr, pct,
} from './ui'

export default function ExplorarClientes() {
  const navigate = useNavigate()
  const { ready, rows, meses, mesAtual, equipeNome, vendedorNome, diasBloqueio } = useCarteira()
  const { f, set } = useDrill()

  const filtered = useMemo(() => applyDrill(rows, f, { mesAtual, diasBloqueio }), [rows, f, mesAtual, diasBloqueio])
  // cards de situação mostram o detalhamento da seleção sem o próprio filtro de status
  const semStatus = useMemo(() => applyDrill(rows, f, { mesAtual, diasBloqueio, skip: ['status'] }), [rows, f, mesAtual, diasBloqueio])

  const s = useMemo(() => summarize(filtered, meses, diasBloqueio), [filtered, meses, diasBloqueio])
  const sAll = useMemo(() => summarize(semStatus, meses, diasBloqueio), [semStatus, meses, diasBloqueio])

  const evolucao = useMemo(() => {
    const chrono = [...meses].reverse()
    return chrono.map((m, i) => ({
      label: formatMesLabel(m),
      valor: s.serie[i] || 0,
      positivados: filtered.filter(r => (r[m] || 0) > 0).length,
    }))
  }, [s, meses, filtered])

  const statusData = [
    { key: 'ativo', name: 'Ativos', value: s.ativos },
    { key: 'bloqueado', name: 'Bloqueados', value: s.bloqueados },
    { key: 'inativo', name: 'Inativos', value: s.inativos },
    { key: 'monitorado', name: 'Monitorados', value: s.monitorados },
  ].filter(d => d.value > 0)

  const curvaData = ['A', 'B', 'C'].map(k => ({ key: k, name: `Curva ${k}`, value: s.curva[k] }))

  const topCidades = useMemo(
    () => aggregateBy(filtered, r => r.cidade, meses).sort((a, b) => b.fatMes - a.fatMes || b.clientes - a.clientes).slice(0, 8),
    [filtered, meses]
  )

  const tableRows = useMemo(() => filtered.map(r => ({
    ...r,
    _key: `${r.seqPessoa}:${r.rca}`,
    _fatMes: r[mesAtual] || 0,
    _serie: [...meses].reverse().map(m => r[m] || 0),
    _tend: r._media12 > 0 ? ((r._media3 - r._media12) / r._media12) * 100 : null,
    _risco: isRisco(r, diasBloqueio),
  })), [filtered, meses, mesAtual, diasBloqueio])

  if (!ready) return <EmptyState>Sem dados carregados.</EmptyState>

  const titulo = f.status ? STATUS_LABEL[f.status] : f.curva ? `Clientes Curva ${f.curva}` : f.positivado === 'sim' ? 'Clientes que compraram no mês' : f.positivado === 'nao' ? 'Clientes sem compra no mês' : 'Clientes'

  function handleExport() {
    exportExcel(tableRows.map(r => ({
      'Código': r.seqPessoa, 'Razão Social': r.razaoSocial, 'Vendedor': r.nome, 'RCA': r.rca,
      'Equipe': equipeNome(r.gr), 'Município': r.cidade, 'Situação': r._status, 'Curva': r.curva,
      'Dias s/ compra': r.diasUltCmp, 'Fat. mês': r._fatMes, 'Média 3M': +r._media3.toFixed(2),
      'Fat. 12M': r._fat12, 'Meses com compra': r._mesesCompra,
    })), `analise_clientes_${new Date().toISOString().slice(0, 10)}.xlsx`)
  }

  const columns = [
    {
      key: 'razaoSocial', label: 'Cliente', sortable: true, defaultDir: 'asc',
      render: r => (
        <div className="min-w-[180px] max-w-[260px]">
          <p className="text-text-primary font-medium truncate">{r.razaoSocial}</p>
          <p className="text-[11px] text-text-secondary">#{r.seqPessoa} · {r.segmento || '—'}</p>
        </div>
      ),
    },
    { key: 'nome', label: 'Vendedor', sortable: true, defaultDir: 'asc', render: r => <span className="text-text-secondary whitespace-nowrap">{r.nome}</span> },
    { key: 'cidade', label: 'Município', sortable: true, defaultDir: 'asc', render: r => <span className="text-text-secondary whitespace-nowrap">{r.cidade}</span> },
    {
      key: '_status', label: 'Situação', sortable: true,
      render: r => (
        <div className="flex items-center gap-1.5">
          <StatusBadge status={r._status} />
          {r._risco && <span title="A menos de 30 dias de bloquear" className="text-accent-amber"><AlertTriangle size={13} /></span>}
        </div>
      ),
    },
    { key: 'curva', label: 'Curva', sortable: true, defaultDir: 'asc', render: r => <CurvaBadge curva={r.curva} /> },
    { key: 'diasUltCmp', label: 'Dias', sortable: true, align: 'right', render: r => <span className="font-mono text-text-secondary">{r.diasUltCmp ?? '—'}</span> },
    { key: '_fatMes', label: 'Fat. mês', sortable: true, align: 'right', render: r => <span className="font-mono text-text-primary whitespace-nowrap">{moneyAbbr(r._fatMes)}</span> },
    { key: '_media3', label: 'Média 3M', sortable: true, align: 'right', render: r => <span className="font-mono text-text-secondary whitespace-nowrap">{moneyAbbr(r._media3)}</span> },
    { key: '_serie', label: '12 meses', render: r => <Sparkline data={r._serie} color={STATUS_COLOR[r._status]} /> },
    { key: '_tend', label: 'Tendência', sortable: true, align: 'right', render: r => <Variacao value={r._tend} /> },
  ]

  return (
    <ExplorarShell
      eyebrow="Carteira de clientes"
      title={<>{n(filtered.length)} <span className="text-text-secondary font-semibold">·</span> {titulo}</>}
      subtitle="Seleção exata do número que você clicou. Clique em qualquer cliente para ver a análise completa."
      icon={Users}
      pivot
      chips={<FilterChips equipeNome={equipeNome} vendedorNome={vendedorNome} />}
      actions={<ExportButton onClick={handleExport} />}
    >
      <RefinePanel rows={rows} equipeNome={equipeNome} />

      {/* Situação da seleção — clicar filtra */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <Kpi label="Todos" value={n(sAll.clientes)} active={!f.status} onClick={() => set({ status: null })} />
        <Kpi label="Ativos" value={n(sAll.ativos)} tone="text-accent-green" active={f.status === 'ativo'} onClick={() => set({ status: 'ativo' })} />
        <Kpi label="Em risco" value={n(sAll.risco)} tone="text-accent-amber" icon={AlertTriangle} active={f.status === 'risco'} onClick={() => set({ status: 'risco' })}
          sub={`${moneyAbbr(sAll.riscoValor)}/mês em jogo`} hint={`Ativos com mais de ${Math.max(diasBloqueio - 30, 0)} dias sem compra — bloqueiam em até 30 dias`} />
        <Kpi label="Bloqueados" value={n(sAll.bloqueados)} tone="text-accent-amber" active={f.status === 'bloqueado'} onClick={() => set({ status: 'bloqueado' })} />
        <Kpi label="Inativos" value={n(sAll.inativos)} tone="text-accent-red" active={f.status === 'inativo'} onClick={() => set({ status: 'inativo' })} />
        <Kpi label="Monitorados" value={n(sAll.monitorados)} tone="text-accent-blue" active={f.status === 'monitorado'} onClick={() => set({ status: 'monitorado' })} />
      </div>

      {/* Números da seleção */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi label="Faturamento do mês" icon={DollarSign} value={moneyAbbr(s.fatMes)} sub={<span className="flex items-center gap-1.5"><Variacao value={s.variacao} /> vs mês anterior</span>} />
        <Kpi label="Positivação" icon={Target} value={pct(s.positivacao)} sub={`${n(s.positivados)} de ${n(s.clientes)} compraram no mês`}
          onClick={() => set({ positivado: f.positivado === 'sim' ? null : 'sim' })} active={f.positivado === 'sim'} />
        <Kpi label="Ticket médio" icon={TrendingUp} value={moneyAbbr(s.ticket)} sub="por cliente positivado" />
        <Kpi label="Faturamento 12M" icon={CalendarClock} value={moneyAbbr(s.fat12)} sub={`${n(s.vendedores)} vendedores · ${n(s.municipios)} municípios`} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <Panel title="Evolução da seleção" subtitle="Faturamento (barras) e clientes que compraram (linha)" className="xl:col-span-2">
          <ResponsiveContainer width="100%" height={240}>
            <ComposedChart data={evolucao}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="label" tick={axisTick} />
              <YAxis yAxisId="v" tick={axisTick} width={48} tickFormatter={v => moneyAbbr(v).replace('R$ ', '')} />
              <YAxis yAxisId="p" orientation="right" tick={axisTick} width={36} />
              <Tooltip {...chartTooltip} formatter={(v, name) => (name === 'valor' ? [money(v), 'Faturamento'] : [n(v), 'Positivados'])} />
              <Bar yAxisId="v" dataKey="valor" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              <Line yAxisId="p" type="monotone" dataKey="positivados" stroke="#10b981" strokeWidth={2} dot={{ r: 2 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </Panel>

        <Panel title="Situação" subtitle="Clique numa fatia para filtrar">
          {statusData.length ? (
            <>
              <ResponsiveContainer width="100%" height={170}>
                <PieChart>
                  <Pie data={statusData} dataKey="value" innerRadius={48} outerRadius={72} paddingAngle={2}
                    onClick={d => set({ status: d.payload?.key ?? d.key })} style={{ cursor: 'pointer' }}>
                    {statusData.map(d => <Cell key={d.key} fill={STATUS_COLOR[d.key]} stroke="none" />)}
                  </Pie>
                  <Tooltip {...chartTooltip} formatter={(v, name) => [`${n(v)} clientes`, name]} />
                </PieChart>
              </ResponsiveContainer>
              <div className="grid grid-cols-2 gap-1.5 text-xs">
                {statusData.map(d => (
                  <button key={d.key} onClick={() => set({ status: d.key })} className="flex items-center justify-between gap-2 px-2 py-1 rounded hover:bg-bg-tertiary">
                    <span className="flex items-center gap-1.5 text-text-secondary"><span className="w-2 h-2 rounded-full" style={{ background: STATUS_COLOR[d.key] }} />{d.name}</span>
                    <span className="font-mono text-text-primary">{n(d.value)}</span>
                  </button>
                ))}
              </div>
            </>
          ) : <EmptyState>Sem clientes.</EmptyState>}
        </Panel>

        <Panel title="Curva ABC" subtitle="Pelo faturamento do mês atual">
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={curvaData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="name" tick={axisTick} />
              <YAxis tick={axisTick} width={40} />
              <Tooltip {...chartTooltip} formatter={v => [`${n(v)} clientes`]} />
              <Bar dataKey="value" radius={[6, 6, 0, 0]} onClick={d => set({ curva: d.payload?.key ?? d.key })} style={{ cursor: 'pointer' }}>
                {curvaData.map(d => <Cell key={d.key} fill={CURVA_COLOR[d.key]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Panel>

        <Panel title="Onde está o faturamento" subtitle="Municípios da seleção — clique para filtrar" className="xl:col-span-2">
          {topCidades.length ? (
            <div className="space-y-2">
              {topCidades.map(c => {
                const max = topCidades[0].fatMes || 1
                return (
                  <button key={c.key} onClick={() => set({ cidade: c.key })} className="w-full text-left group">
                    <div className="flex items-center justify-between text-xs mb-1 gap-2">
                      <span className="text-text-primary font-medium truncate group-hover:text-accent-blue">{c.key}</span>
                      <span className="text-text-secondary whitespace-nowrap"><span className="font-mono text-text-primary">{moneyAbbr(c.fatMes)}</span> · {n(c.clientes)} clientes · {pct(c.positivacao)} posit.</span>
                    </div>
                    <div className="h-2 rounded-full bg-bg-tertiary overflow-hidden">
                      <div className="h-full rounded-full bg-gradient-to-r from-accent-blue to-accent-green" style={{ width: `${Math.max((c.fatMes / max) * 100, 2)}%` }} />
                    </div>
                  </button>
                )
              })}
            </div>
          ) : <EmptyState>Sem municípios.</EmptyState>}
        </Panel>
      </div>

      <Panel title={`${n(filtered.length)} clientes`} subtitle="Ordene pelas colunas · ⚠ = bloqueia em até 30 dias">
        <SortableTable
          columns={columns}
          rows={tableRows}
          rowKey={r => r._key}
          initialSort={{ key: '_fatMes', dir: 'desc' }}
          onRowClick={r => navigate(`/explorar/cliente/${r.seqPessoa}`)}
        />
      </Panel>
    </ExplorarShell>
  )
}
