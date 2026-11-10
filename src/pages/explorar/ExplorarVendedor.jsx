import React, { useMemo } from 'react'
import { useParams as useRouteParams, useNavigate, Link } from 'react-router-dom'
import { ResponsiveContainer, ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid, Tooltip, PieChart, Pie, Cell } from 'recharts'
import { UserRound, Crosshair, Trophy, Users, Target, DollarSign, MapPinned, Medal } from 'lucide-react'
import { useCarteira, aggregateBy, summarize, drillUrl, isRisco } from '../../lib/drill'
import { formatMesLabel } from '../../services/dataService'
import {
  ExplorarShell, Kpi, Panel, StatusBadge, CurvaBadge, Variacao, StatusBar, SortableTable, MiniMap, EmptyState,
  chartTooltip, axisTick, STATUS_COLOR, CURVA_COLOR, n, money, moneyAbbr, pct,
} from './ui'

export default function ExplorarVendedor() {
  const { rca } = useRouteParams()
  const navigate = useNavigate()
  const { ready, rows, meses, mesAtual, equipeNome, diasBloqueio } = useCarteira()

  const minhas = useMemo(() => rows.filter(r => String(r.rca) === String(rca)), [rows, rca])
  const gr = minhas[0]?.gr
  const s = useMemo(() => summarize(minhas, meses, diasBloqueio), [minhas, meses, diasBloqueio])

  // ranking dentro da equipe e geral (fat. mês)
  const ranking = useMemo(() => {
    const all = aggregateBy(rows, r => r.rca, meses, r => ({ gr: r.gr })).sort((a, b) => b.fatMes - a.fatMes)
    const team = all.filter(v => v.gr === gr)
    const teamSerie = meses.map((_, i) => (team.length ? team.reduce((acc, v) => acc + v.serie[i], 0) / team.length : 0))
    return {
      geral: all.findIndex(v => String(v.key) === String(rca)) + 1, totalGeral: all.length,
      equipe: team.findIndex(v => String(v.key) === String(rca)) + 1, totalEquipe: team.length,
      teamPosit: team.length ? team.reduce((a, v) => a + v.positivacao, 0) / team.length : 0,
      teamSerie,
    }
  }, [rows, meses, gr, rca])

  const evolucao = useMemo(() => [...meses].reverse().map((m, i) => ({
    label: formatMesLabel(m), valor: s.serie[i] || 0, equipe: ranking.teamSerie[i] || 0,
  })), [meses, s, ranking])

  // Lista de ataque: quem tem histórico e está escapando
  const ataque = useMemo(() => minhas
    .filter(r => r._status !== 'monitorado' && r._media12 > 0 && (isRisco(r, diasBloqueio) || r._status === 'bloqueado' || ((r[mesAtual] || 0) === 0 && r._status === 'ativo')))
    .map(r => ({
      ...r,
      _motivo: isRisco(r, diasBloqueio) ? `bloqueia em ${Math.max(diasBloqueio - r.diasUltCmp, 0)}d` : r._status === 'bloqueado' ? 'bloqueado' : 'sem compra no mês',
    }))
    .sort((a, b) => b._media3 - a._media3 || b._media12 - a._media12)
    .slice(0, 10), [minhas, mesAtual, diasBloqueio])
  const ataqueValor = ataque.reduce((acc, r) => acc + (r._media3 || r._media12), 0)

  const topClientes = useMemo(() => [...minhas].sort((a, b) => b._fat12 - a._fat12).slice(0, 8), [minhas])

  const municipios = useMemo(() => aggregateBy(minhas, r => r.cidade, meses).map(m => {
    const pts = minhas.filter(r => r.cidade === m.key && r.latitude != null)
    return {
      ...m,
      lat: pts.length ? pts.reduce((a, r) => a + Number(r.latitude), 0) / pts.length : null,
      lng: pts.length ? pts.reduce((a, r) => a + Number(r.longitude), 0) / pts.length : null,
    }
  }).sort((a, b) => b.fatMes - a.fatMes), [minhas, meses])

  const mapPoints = useMemo(() => {
    const max = Math.max(...municipios.map(m => m.fatMes), 1)
    return municipios.map(m => ({
      lat: m.lat, lng: m.lng, key: m.key,
      radius: 5 + 11 * Math.sqrt(m.fatMes / max),
      color: m.positivacao >= 50 ? '#10b981' : m.positivacao >= 25 ? '#f59e0b' : '#ef4444',
      label: `${m.key} · ${moneyAbbr(m.fatMes)} · ${pct(m.positivacao)} posit.`,
    }))
  }, [municipios])

  if (!ready) return <EmptyState>Sem dados carregados.</EmptyState>
  if (!minhas.length) {
    return (
      <ExplorarShell eyebrow="Vendedor" title="Vendedor não encontrado" icon={UserRound} accent="#8b5cf6">
        <EmptyState>Este vendedor não está na carteira visível para você.</EmptyState>
      </ExplorarShell>
    )
  }

  const nome = minhas[0].nome
  const toClientes = extra => drillUrl('/explorar/clientes', { rca, ...extra })
  const statusData = [['ativo', 'Ativos', s.ativos], ['bloqueado', 'Bloqueados', s.bloqueados], ['inativo', 'Inativos', s.inativos], ['monitorado', 'Monitorados', s.monitorados]]
    .filter(([, , v]) => v > 0).map(([key, name, value]) => ({ key, name, value }))

  const munColumns = [
    { key: 'key', label: 'Município', sortable: true, defaultDir: 'asc', render: m => <span className="text-text-primary font-medium whitespace-nowrap">{m.key}</span> },
    { key: 'clientes', label: 'Clientes', sortable: true, align: 'right', render: m => <span className="font-mono">{n(m.clientes)}</span> },
    { key: 'mix', label: 'Carteira', render: m => <div className="w-20"><StatusBar a={m} /></div> },
    { key: 'positivacao', label: 'Posit.', sortable: true, align: 'right', render: m => <span className="font-mono text-text-secondary">{pct(m.positivacao)}</span> },
    { key: 'fatMes', label: 'Fat. mês', sortable: true, align: 'right', render: m => <span className="font-mono text-text-primary whitespace-nowrap">{moneyAbbr(m.fatMes)}</span> },
    { key: 'variacao', label: 'Var.', sortable: true, align: 'right', render: m => <Variacao value={m.variacao} /> },
  ]

  return (
    <ExplorarShell
      eyebrow={`Vendedor · RCA ${rca}`}
      title={nome}
      icon={UserRound}
      accent="#8b5cf6"
      subtitle={
        <div className="flex flex-wrap items-center gap-3 mt-1">
          <Link to={drillUrl('/explorar/vendedores', { gr })} className="text-xs text-accent-blue hover:underline">{equipeNome(gr)}</Link>
          <span className="flex items-center gap-1 text-xs"><Medal size={13} className="text-accent-amber" /> #{ranking.equipe} de {ranking.totalEquipe} na equipe</span>
          <span className="text-xs text-text-secondary">#{ranking.geral} de {ranking.totalGeral} no geral</span>
        </div>
      }
    >
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        <Kpi label="Clientes" icon={Users} value={n(s.clientes)} onClick={() => navigate(toClientes())} sub="ver carteira →" />
        <Kpi label="Ativos" value={n(s.ativos)} tone="text-accent-green" onClick={() => navigate(toClientes({ status: 'ativo' }))} sub={`${n(s.inativos + s.bloqueados)} inativos/bloq.`} />
        <Kpi label="Em risco" value={n(s.risco)} tone="text-accent-amber" onClick={() => navigate(toClientes({ status: 'risco' }))} sub={`${moneyAbbr(s.riscoValor)}/mês em jogo`} />
        <Kpi label="Fat. mês" icon={DollarSign} value={moneyAbbr(s.fatMes)} sub={<span className="flex items-center gap-1.5"><Variacao value={s.variacao} /> vs anterior</span>} />
        <Kpi label="Positivação" icon={Target} value={pct(s.positivacao)} sub={`equipe: ${pct(ranking.teamPosit)}`} tone={s.positivacao >= ranking.teamPosit ? 'text-accent-green' : 'text-accent-red'} onClick={() => navigate(toClientes({ positivado: 'sim' }))} />
        <Kpi label="Ticket médio" value={moneyAbbr(s.ticket)} sub={`12M: ${moneyAbbr(s.fat12)}`} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <Panel title="Evolução vs média da equipe" subtitle="Área = este vendedor · linha = média por vendedor da equipe" className="xl:col-span-2">
          <ResponsiveContainer width="100%" height={250}>
            <ComposedChart data={evolucao}>
              <defs>
                <linearGradient id="gVend" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.45} />
                  <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="label" tick={axisTick} />
              <YAxis tick={axisTick} width={48} tickFormatter={v => moneyAbbr(v).replace('R$ ', '')} />
              <Tooltip {...chartTooltip} formatter={(v, k) => [money(v), k === 'valor' ? nome : 'Média da equipe']} />
              <Area type="monotone" dataKey="valor" stroke="#8b5cf6" strokeWidth={2} fill="url(#gVend)" />
              <Line type="monotone" dataKey="equipe" stroke="#f59e0b" strokeDasharray="5 4" strokeWidth={2} dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </Panel>

        <Panel title="Carteira" subtitle="Clique para ver os clientes">
          <ResponsiveContainer width="100%" height={150}>
            <PieChart>
              <Pie data={statusData} dataKey="value" innerRadius={42} outerRadius={64} paddingAngle={2}
                onClick={d => navigate(toClientes({ status: d.payload?.key ?? d.key }))} style={{ cursor: 'pointer' }}>
                {statusData.map(d => <Cell key={d.key} fill={STATUS_COLOR[d.key]} stroke="none" />)}
              </Pie>
              <Tooltip {...chartTooltip} formatter={(v, name) => [`${n(v)} clientes`, name]} />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex justify-center gap-2 mt-2">
            {['A', 'B', 'C'].map(k => (
              <button key={k} onClick={() => navigate(toClientes({ curva: k }))} className="flex-1 rounded-lg border border-border-color p-2 hover:border-accent-blue/50">
                <p className="text-[10px] text-text-secondary">Curva {k}</p>
                <p className="font-mono font-bold" style={{ color: CURVA_COLOR[k] }}>{n(s.curva[k])}</p>
              </button>
            ))}
          </div>
        </Panel>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <Panel
          title="Lista de ataque"
          subtitle={ataque.length ? `${ataque.length} clientes com histórico escapando · ${moneyAbbr(ataqueValor)}/mês de potencial` : 'Nenhum cliente com histórico escapando — carteira em dia'}
          action={<Crosshair size={16} className="text-accent-red" />}
        >
          <div className="space-y-1.5">
            {ataque.map(r => (
              <button key={r.seqPessoa} onClick={() => navigate(`/explorar/cliente/${r.seqPessoa}`)} className="w-full flex items-center justify-between gap-3 p-2.5 rounded-xl border border-border-color hover:border-accent-red/40 hover:bg-accent-red/5 text-left">
                <span className="min-w-0">
                  <span className="block text-sm text-text-primary font-medium truncate">{r.razaoSocial}</span>
                  <span className="block text-[11px] text-text-secondary">{r.cidade} · {r.diasUltCmp ?? '—'} dias · <span className="text-accent-amber">{r._motivo}</span></span>
                </span>
                <span className="text-right flex-shrink-0">
                  <span className="block font-mono text-sm text-text-primary">{moneyAbbr(r._media3 || r._media12)}</span>
                  <span className="block text-[10px] text-text-secondary">média/mês</span>
                </span>
              </button>
            ))}
          </div>
        </Panel>

        <Panel title="Maiores clientes" subtitle="Faturamento 12 meses" action={<Trophy size={16} className="text-accent-amber" />}>
          <div className="space-y-1.5">
            {topClientes.map((r, i) => (
              <button key={r.seqPessoa} onClick={() => navigate(`/explorar/cliente/${r.seqPessoa}`)} className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-bg-tertiary text-left">
                <span className="w-6 text-xs font-mono text-text-secondary">#{i + 1}</span>
                <span className="flex-1 min-w-0">
                  <span className="block text-sm text-text-primary truncate">{r.razaoSocial}</span>
                  <span className="flex items-center gap-1.5 mt-0.5"><StatusBadge status={r._status} /><CurvaBadge curva={r.curva} /></span>
                </span>
                <span className="font-mono text-sm text-text-primary whitespace-nowrap">{moneyAbbr(r._fat12)}</span>
              </button>
            ))}
          </div>
        </Panel>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <Panel title="Território" subtitle="Tamanho = faturamento do mês · cor = positivação (verde ≥50%, âmbar ≥25%)" action={<MapPinned size={16} className="text-text-secondary" />}>
          <MiniMap points={mapPoints} height={300} onPointClick={p => navigate(drillUrl(`/explorar/municipio/${encodeURIComponent(p.key)}`, { rca }))} />
        </Panel>
        <Panel title={`${n(municipios.length)} municípios atendidos`}>
          <SortableTable
            columns={munColumns}
            rows={municipios}
            rowKey={m => m.key}
            pageSize={8}
            initialSort={{ key: 'fatMes', dir: 'desc' }}
            onRowClick={m => navigate(drillUrl(`/explorar/municipio/${encodeURIComponent(m.key)}`, { rca }))}
          />
        </Panel>
      </div>
    </ExplorarShell>
  )
}
