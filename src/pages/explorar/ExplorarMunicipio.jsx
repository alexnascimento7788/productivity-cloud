import React, { useMemo } from 'react'
import { useParams as useRouteParams, useNavigate } from 'react-router-dom'
import { ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, PieChart, Pie, Cell } from 'recharts'
import { MapPin, Users, DollarSign, Target, Sparkles, UserRound } from 'lucide-react'
import { useCarteira, applyDrill, aggregateBy, summarize, drillUrl } from '../../lib/drill'
import { formatMesLabel } from '../../services/dataService'
import {
  ExplorarShell, FilterChips, Kpi, Panel, StatusBadge, CurvaBadge, Variacao, StatusBar, SortableTable, MiniMap,
  EmptyState, useDrill, chartTooltip, axisTick, STATUS_COLOR, n, money, moneyAbbr, pct,
} from './ui'

const TEAM_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4', '#ec4899', '#84cc16']

export default function ExplorarMunicipio() {
  const { cidade } = useRouteParams() // o react-router já entrega decodificado
  const navigate = useNavigate()
  const { ready, rows, meses, mesAtual, equipeNome, vendedorNome, diasBloqueio } = useCarteira()
  const { f } = useDrill()

  const ctx = useMemo(() => ({ ...f, cidade }), [f, cidade])
  const linhas = useMemo(() => applyDrill(rows, ctx, { mesAtual, diasBloqueio }), [rows, ctx, mesAtual, diasBloqueio])
  const s = useMemo(() => summarize(linhas, meses, diasBloqueio), [linhas, meses, diasBloqueio])

  // participação no total da empresa (mesma seleção, sem o município)
  const total = useMemo(() => summarize(applyDrill(rows, f, { mesAtual, diasBloqueio, skip: ['cidade'] }), meses, diasBloqueio), [rows, f, meses, mesAtual, diasBloqueio])

  const evolucao = useMemo(() => [...meses].reverse().map((m, i) => ({
    label: formatMesLabel(m), valor: s.serie[i] || 0, positivados: linhas.filter(r => (r[m] || 0) > 0).length,
  })), [meses, s, linhas])

  const vendedores = useMemo(() => aggregateBy(linhas, r => r.rca, meses, r => ({ nome: r.nome, gr: r.gr })).sort((a, b) => b.fatMes - a.fatMes), [linhas, meses])
  const equipes = useMemo(() => aggregateBy(linhas, r => r.gr, meses).sort((a, b) => b.fat12 - a.fat12), [linhas, meses])

  const oportunidades = useMemo(() => linhas
    .filter(r => (r[mesAtual] || 0) === 0 && r._media3 > 0)
    .sort((a, b) => b._media3 - a._media3).slice(0, 6), [linhas, mesAtual])

  const points = useMemo(() => {
    // clientes sem coordenada própria herdam a do município: espalha um pouco para não empilhar
    const seen = new Map()
    return linhas.filter(r => r.latitude != null).map(r => {
      const k = `${r.latitude},${r.longitude}`
      const i = seen.get(k) || 0
      seen.set(k, i + 1)
      const ang = i * 2.399963, rad = i ? 0.0015 * Math.sqrt(i) : 0
      return {
        lat: Number(r.latitude) + rad * Math.sin(ang), lng: Number(r.longitude) + rad * Math.cos(ang),
        color: STATUS_COLOR[r._status], radius: 5, seq: r.seqPessoa, label: `${r.razaoSocial} · ${moneyAbbr(r[mesAtual] || 0)}`,
      }
    })
  }, [linhas, mesAtual])

  if (!ready) return <EmptyState>Sem dados carregados.</EmptyState>
  if (!linhas.length) {
    return (
      <ExplorarShell eyebrow="Município" title={cidade} icon={MapPin} accent="#10b981" chips={<FilterChips equipeNome={equipeNome} vendedorNome={vendedorNome} />}>
        <EmptyState>Nenhum cliente deste município na seleção.</EmptyState>
      </ExplorarShell>
    )
  }

  const share = total.fatMes > 0 ? (s.fatMes / total.fatMes) * 100 : 0
  const toClientes = extra => drillUrl('/explorar/clientes', { ...ctx, ...extra })
  const equipeData = equipes.map((e, i) => ({ key: e.key, name: equipeNome(e.key), value: e.fat12, color: TEAM_COLORS[i % TEAM_COLORS.length] }))

  const vendColumns = [
    {
      key: 'nome', label: 'Vendedor', sortable: true, defaultDir: 'asc',
      render: v => <div><p className="text-text-primary font-medium whitespace-nowrap">{v.nome}</p><p className="text-[11px] text-text-secondary">{equipeNome(v.gr)}</p></div>,
    },
    {
      key: 'clientes', label: 'Clientes', sortable: true, align: 'right',
      render: v => <button onClick={e => { e.stopPropagation(); navigate(toClientes({ rca: v.key })) }} className="font-mono hover:text-accent-blue hover:underline">{n(v.clientes)}</button>,
    },
    { key: 'mix', label: 'Carteira', render: v => <div className="w-20"><StatusBar a={v} /></div> },
    { key: 'positivacao', label: 'Posit.', sortable: true, align: 'right', render: v => <span className="font-mono text-text-secondary">{pct(v.positivacao)}</span> },
    { key: 'fatMes', label: 'Fat. mês', sortable: true, align: 'right', render: v => <span className="font-mono text-text-primary whitespace-nowrap">{moneyAbbr(v.fatMes)}</span> },
    { key: 'variacao', label: 'Var.', sortable: true, align: 'right', render: v => <Variacao value={v.variacao} /> },
  ]

  const cliColumns = [
    { key: 'razaoSocial', label: 'Cliente', sortable: true, defaultDir: 'asc', render: r => <span className="text-text-primary font-medium block max-w-[220px] truncate">{r.razaoSocial}</span> },
    { key: 'nome', label: 'Vendedor', sortable: true, defaultDir: 'asc', render: r => <span className="text-text-secondary whitespace-nowrap">{r.nome}</span> },
    { key: '_status', label: 'Situação', sortable: true, render: r => <StatusBadge status={r._status} /> },
    { key: 'curva', label: 'Curva', sortable: true, defaultDir: 'asc', render: r => <CurvaBadge curva={r.curva} /> },
    { key: '_fatMes', label: 'Fat. mês', align: 'right', sortValue: r => r[mesAtual] || 0, render: r => <span className="font-mono text-text-primary">{moneyAbbr(r[mesAtual] || 0)}</span> },
    { key: '_fat12', label: '12M', sortable: true, align: 'right', render: r => <span className="font-mono text-text-secondary">{moneyAbbr(r._fat12)}</span> },
  ]

  return (
    <ExplorarShell
      eyebrow="Município"
      title={cidade}
      icon={MapPin}
      accent="#10b981"
      subtitle={`${pct(share)} do faturamento do mês da seleção · ${n(s.vendedores)} vendedores · ${n(equipes.length)} equipes`}
      chips={<FilterChips equipeNome={equipeNome} vendedorNome={vendedorNome} />}
    >
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        <Kpi label="Clientes" icon={Users} value={n(s.clientes)} onClick={() => navigate(toClientes())} sub="ver lista →" />
        <Kpi label="Ativos" value={n(s.ativos)} tone="text-accent-green" onClick={() => navigate(toClientes({ status: 'ativo' }))} />
        <Kpi label="Inativos/Bloq." value={n(s.inativos + s.bloqueados)} tone="text-accent-amber" onClick={() => navigate(toClientes({ status: 'inativos' }))} />
        <Kpi label="Fat. mês" icon={DollarSign} value={moneyAbbr(s.fatMes)} sub={<span className="flex items-center gap-1.5"><Variacao value={s.variacao} /> vs anterior</span>} />
        <Kpi label="Positivação" icon={Target} value={pct(s.positivacao)} sub={`média geral: ${pct(total.positivacao)}`} tone={s.positivacao >= total.positivacao ? 'text-accent-green' : 'text-accent-red'} />
        <Kpi label="Oportunidade" icon={Sparkles} tone="text-accent-amber" value={moneyAbbr(oportunidades.reduce((a, r) => a + r._media3, 0))} sub="dos que não compraram" onClick={() => navigate(toClientes({ positivado: 'nao' }))} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <Panel title="Clientes no mapa" subtitle="Cor = situação · clique no ponto para abrir o cliente" className="xl:col-span-2">
          <MiniMap points={points} height={320} onPointClick={p => navigate(`/explorar/cliente/${p.seq}`)} />
        </Panel>
        <Panel title="Equipes no município" subtitle="Participação no faturamento 12M">
          <ResponsiveContainer width="100%" height={160}>
            <PieChart>
              <Pie data={equipeData} dataKey="value" innerRadius={40} outerRadius={64} paddingAngle={2}>
                {equipeData.map(d => <Cell key={d.key} fill={d.color} stroke="none" />)}
              </Pie>
              <Tooltip {...chartTooltip} formatter={(v, name) => [money(v), name]} />
            </PieChart>
          </ResponsiveContainer>
          <div className="space-y-1 mt-2">
            {equipeData.map(d => (
              <button key={d.key} onClick={() => navigate(toClientes({ gr: d.key }))} className="w-full flex items-center justify-between gap-2 text-xs px-2 py-1 rounded hover:bg-bg-tertiary">
                <span className="flex items-center gap-1.5 text-text-secondary truncate"><span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: d.color }} />{d.name}</span>
                <span className="font-mono text-text-primary">{moneyAbbr(d.value)}</span>
              </button>
            ))}
          </div>
        </Panel>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <Panel title="Evolução no município" subtitle="Faturamento (barras) e clientes que compraram (linha)" className="xl:col-span-2">
          <ResponsiveContainer width="100%" height={240}>
            <ComposedChart data={evolucao}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="label" tick={axisTick} />
              <YAxis yAxisId="v" tick={axisTick} width={48} tickFormatter={v => moneyAbbr(v).replace('R$ ', '')} />
              <YAxis yAxisId="p" orientation="right" tick={axisTick} width={32} />
              <Tooltip {...chartTooltip} formatter={(v, k) => (k === 'valor' ? [money(v), 'Faturamento'] : [n(v), 'Positivados'])} />
              <Bar yAxisId="v" dataKey="valor" fill="#10b981" radius={[4, 4, 0, 0]} />
              <Line yAxisId="p" type="monotone" dataKey="positivados" stroke="#3b82f6" strokeWidth={2} dot={{ r: 2 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </Panel>
        <Panel title="Quem ainda não comprou" subtitle="Maiores médias dos últimos 3 meses" action={<Sparkles size={15} className="text-accent-amber" />}>
          <div className="space-y-1">
            {oportunidades.map(r => (
              <button key={`${r.seqPessoa}:${r.rca}`} onClick={() => navigate(`/explorar/cliente/${r.seqPessoa}`)} className="w-full flex items-center justify-between gap-2 p-2 rounded-lg hover:bg-bg-tertiary text-left">
                <span className="min-w-0">
                  <span className="block text-xs text-text-primary truncate">{r.razaoSocial}</span>
                  <span className="block text-[10px] text-text-secondary flex items-center gap-1"><UserRound size={10} className="inline" /> {r.nome} · {r.diasUltCmp ?? '—'} dias</span>
                </span>
                <span className="font-mono text-xs text-accent-amber whitespace-nowrap">{moneyAbbr(r._media3)}</span>
              </button>
            ))}
            {!oportunidades.length && <p className="text-xs text-text-secondary">Todos com histórico já compraram no mês.</p>}
          </div>
        </Panel>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <Panel title={`${n(vendedores.length)} vendedores atuando`}>
          <SortableTable columns={vendColumns} rows={vendedores} rowKey={v => v.key} pageSize={8} initialSort={{ key: 'fatMes', dir: 'desc' }}
            onRowClick={v => navigate(`/explorar/vendedor/${v.key}`)} />
        </Panel>
        <Panel title={`${n(linhas.length)} clientes`}>
          <SortableTable columns={cliColumns} rows={linhas} rowKey={r => `${r.seqPessoa}:${r.rca}`} pageSize={8} initialSort={{ key: '_fat12', dir: 'desc' }}
            onRowClick={r => navigate(`/explorar/cliente/${r.seqPessoa}`)} />
        </Panel>
      </div>
    </ExplorarShell>
  )
}
