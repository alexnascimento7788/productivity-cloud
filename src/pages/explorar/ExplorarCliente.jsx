import React, { useMemo } from 'react'
import { useParams as useRouteParams, useNavigate, Link } from 'react-router-dom'
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, Cell } from 'recharts'
import { Store, MapPin, UserRound, Lightbulb, Trophy, Wallet, CalendarCheck, Flame } from 'lucide-react'
import { useCarteira, aggregateBy, drillUrl } from '../../lib/drill'
import { formatMesLabel } from '../../services/dataService'
import {
  ExplorarShell, Kpi, Panel, StatusBadge, CurvaBadge, Variacao, MiniMap, EmptyState,
  chartTooltip, axisTick, STATUS_COLOR, n, money, moneyAbbr, pct,
} from './ui'

// Nota de 0–100: recência (40), frequência (30) e tendência (30)
function healthScore({ dias, diasBloqueio, mesesCompra, totalMeses, media3, media12, status }) {
  if (status === 'monitorado') return null
  const rec = dias == null ? 20 : Math.max(0, 40 * (1 - Math.min(dias, diasBloqueio) / diasBloqueio))
  const freq = totalMeses ? 30 * (mesesCompra / totalMeses) : 0
  let trend = 15
  if (media12 > 0) trend = Math.max(0, Math.min(30, 15 + 15 * ((media3 - media12) / media12)))
  else if (media3 > 0) trend = 30
  return Math.round(rec + freq + trend)
}

function ScoreRing({ score }) {
  const r = 42, c = 2 * Math.PI * r
  const color = score == null ? '#3b82f6' : score >= 70 ? '#10b981' : score >= 40 ? '#f59e0b' : '#ef4444'
  const label = score == null ? 'Monitorado' : score >= 70 ? 'Saudável' : score >= 40 ? 'Atenção' : 'Crítico'
  return (
    <div className="flex items-center gap-4">
      <svg width="104" height="104" viewBox="0 0 104 104" className="flex-shrink-0">
        <circle cx="52" cy="52" r={r} fill="none" stroke="var(--bg-tertiary)" strokeWidth="10" />
        <circle cx="52" cy="52" r={r} fill="none" stroke={color} strokeWidth="10" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - (score ?? 100) / 100)} transform="rotate(-90 52 52)" />
        <text x="52" y="50" textAnchor="middle" fontSize="24" fontWeight="700" fill="var(--text-primary)">{score ?? '—'}</text>
        <text x="52" y="68" textAnchor="middle" fontSize="10" fill="var(--text-secondary)">de 100</text>
      </svg>
      <div>
        <p className="text-lg font-bold" style={{ color }}>{label}</p>
        <p className="text-xs text-text-secondary leading-relaxed">Combina há quanto tempo comprou, em quantos meses comprou e se as compras recentes estão acima ou abaixo da média.</p>
      </div>
    </div>
  )
}

function RecencyBar({ dias, diasBloqueio, diasInativacao }) {
  const max = diasInativacao * 1.25
  const pos = Math.min((dias ?? 0) / max, 1) * 100
  return (
    <div>
      <div className="relative h-3 rounded-full overflow-hidden flex">
        <div style={{ width: `${(diasBloqueio / max) * 100}%`, background: '#10b98155' }} />
        <div style={{ width: `${((diasInativacao - diasBloqueio) / max) * 100}%`, background: '#f59e0b55' }} />
        <div className="flex-1" style={{ background: '#ef444455' }} />
      </div>
      <div className="relative h-0">
        <div className="absolute -top-[18px] w-1 h-6 rounded bg-text-primary shadow" style={{ left: `calc(${pos}% - 2px)` }} />
      </div>
      <div className="flex justify-between text-[10px] text-text-secondary mt-2">
        <span>0</span><span>bloqueio · {diasBloqueio}d</span><span>inativação · {diasInativacao}d</span>
      </div>
    </div>
  )
}

export default function ExplorarCliente() {
  const { seq } = useRouteParams()
  const navigate = useNavigate()
  const { ready, rows, meses, mesAtual, equipeNome, diasBloqueio, diasInativacao } = useCarteira()

  const linhas = useMemo(() => rows.filter(r => String(r.seqPessoa) === String(seq)), [rows, seq])

  const data = useMemo(() => {
    if (!linhas.length) return null
    const principal = [...linhas].sort((a, b) => b._fat12 - a._fat12)[0]
    const chrono = [...meses].reverse()
    const serie = chrono.map(m => linhas.reduce((s, r) => s + (r[m] || 0), 0))
    const fat12 = serie.reduce((a, b) => a + b, 0)
    const media12 = meses.length ? fat12 / meses.length : 0
    const last3 = serie.slice(-3)
    const media3 = last3.length ? last3.reduce((a, b) => a + b, 0) / last3.length : 0
    const mesesCompra = serie.filter(v => v > 0).length
    const best = serie.reduce((bi, v, i) => (v > serie[bi] ? i : bi), 0)
    const dias = Math.min(...linhas.map(r => r.diasUltCmp ?? Infinity))
    const fatMes = linhas.reduce((s, r) => s + (r[mesAtual] || 0), 0)
    const fatAnt = meses[1] ? linhas.reduce((s, r) => s + (r[meses[1]] || 0), 0) : 0
    // sequência de meses seguidos comprando (até o mês atual)
    let streak = 0
    for (let i = serie.length - 1; i >= 0 && serie[i] > 0; i--) streak++
    return {
      principal, serie, chrono, fat12, media12, media3, mesesCompra, best, fatMes, fatAnt, streak,
      dias: dias === Infinity ? null : dias,
      vendedores: aggregateBy(linhas, r => r.rca, meses, r => ({ nome: r.nome, gr: r.gr })).sort((a, b) => b.fat12 - a.fat12),
    }
  }, [linhas, meses, mesAtual])

  // comparativos no município e na carteira do vendedor
  const comp = useMemo(() => {
    if (!data) return null
    const { principal } = data
    const porCliente = list => {
      const m = new Map()
      list.forEach(r => m.set(r.seqPessoa, (m.get(r.seqPessoa) || 0) + r._fat12))
      return [...m.entries()].sort((a, b) => b[1] - a[1])
    }
    const cidade = porCliente(rows.filter(r => r.cidade === principal.cidade))
    const carteira = porCliente(rows.filter(r => r.rca === principal.rca))
    const pos = (list) => list.findIndex(([k]) => String(k) === String(seq)) + 1
    const avg = list => (list.length ? list.reduce((s, [, v]) => s + v, 0) / list.length : 0)
    const vizinhos = cidade.filter(([k]) => String(k) !== String(seq)).slice(0, 5).map(([k, v]) => {
      const r = rows.find(x => x.seqPessoa === k)
      return { seq: k, nome: r?.razaoSocial, status: r?._status, fat12: v }
    })
    return {
      posCidade: pos(cidade), totalCidade: cidade.length, mediaCidade: avg(cidade),
      posCarteira: pos(carteira), totalCarteira: carteira.length, mediaCarteira: avg(carteira),
      vizinhos,
    }
  }, [data, rows, seq])

  if (!ready) return <EmptyState>Sem dados carregados.</EmptyState>
  if (!data) {
    return (
      <ExplorarShell eyebrow="Cliente" title="Cliente não encontrado" icon={Store}>
        <EmptyState>Este cliente não está na carteira visível para você.</EmptyState>
      </ExplorarShell>
    )
  }

  const { principal: c } = data
  const status = c._status
  const score = healthScore({ dias: data.dias, diasBloqueio, mesesCompra: data.mesesCompra, totalMeses: meses.length, media3: data.media3, media12: data.media12, status })
  const variacao = data.fatAnt > 0 ? ((data.fatMes - data.fatAnt) / data.fatAnt) * 100 : null
  const tendencia = data.media12 > 0 ? ((data.media3 - data.media12) / data.media12) * 100 : null
  const limite = linhas.reduce((s, r) => s + (r.limiteGlobal || 0), 0)
  const limitePct = limite > 0 ? (data.fatMes / limite) * 100 : null

  // Próximas ações sugeridas — regras simples e explicáveis
  const acoes = []
  if (status === 'ativo' && data.dias != null && data.dias > diasBloqueio - 30) acoes.push({ tone: 'amber', txt: `Bloqueia em ${Math.max(diasBloqueio - data.dias, 0)} dias sem compra. Priorize contato nesta semana.` })
  if (status === 'bloqueado') acoes.push({ tone: 'amber', txt: `Bloqueado há ${data.dias - diasBloqueio} dias — inativa em ${Math.max(diasInativacao - data.dias, 0)} dias. Recuperação ainda é barata.` })
  if (status === 'inativo') acoes.push({ tone: 'red', txt: `Inativo. Comprava em média ${money(data.media12)}/mês — avalie campanha de reativação.` })
  if (data.fatMes === 0 && data.media12 > 0 && status === 'ativo') acoes.push({ tone: 'blue', txt: `Ainda não comprou neste mês. Potencial de ${money(data.media3 || data.media12)} com base nos últimos meses.` })
  if (tendencia != null && tendencia <= -25) acoes.push({ tone: 'red', txt: `Compras dos últimos 3 meses ${Math.abs(tendencia).toFixed(0)}% abaixo da média de 12 meses — investigar perda para concorrente.` })
  if (tendencia != null && tendencia >= 25) acoes.push({ tone: 'green', txt: `Em crescimento: últimos 3 meses ${tendencia.toFixed(0)}% acima da média. Bom momento para ampliar mix.` })
  if (limitePct != null && limitePct >= 90) acoes.push({ tone: 'amber', txt: `Usou ${limitePct.toFixed(0)}% do limite no mês — pode travar novos pedidos.` })
  if (!acoes.length) acoes.push({ tone: 'green', txt: 'Cliente em dia. Mantenha a frequência de visitas.' })
  const TONE = { amber: 'border-accent-amber/40 bg-accent-amber/10', red: 'border-accent-red/40 bg-accent-red/10', blue: 'border-accent-blue/40 bg-accent-blue/10', green: 'border-accent-green/40 bg-accent-green/10' }

  const chart = data.chrono.map((m, i) => ({ label: formatMesLabel(m), valor: data.serie[i] }))
  const endereco = [c.endereco, c.numero].filter(Boolean).join(', ')

  return (
    <ExplorarShell
      eyebrow={`Cliente #${c.seqPessoa}`}
      title={c.razaoSocial}
      icon={Store}
      accent={STATUS_COLOR[status]}
      subtitle={
        <div className="flex flex-wrap items-center gap-2 mt-1">
          <StatusBadge status={status} />
          <CurvaBadge curva={c.curva} />
          {c.segmento && <span className="text-xs px-2 py-0.5 rounded-full bg-bg-secondary border border-border-color">{c.segmento}</span>}
          <Link to={`/explorar/municipio/${encodeURIComponent(c.cidade)}`} className="flex items-center gap-1 text-xs text-accent-blue hover:underline"><MapPin size={12} />{c.cidade}</Link>
          <Link to={`/explorar/vendedor/${c.rca}`} className="flex items-center gap-1 text-xs text-accent-blue hover:underline"><UserRound size={12} />{c.nome}</Link>
          <span className="text-xs text-text-secondary">{equipeNome(c.gr)}</span>
        </div>
      }
    >
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Panel title="Saúde do cliente"><ScoreRing score={score} /></Panel>
        <Panel title="Dias sem comprar" subtitle={c.dtUltCmp ? `Última compra em ${new Date(c.dtUltCmp).toLocaleDateString('pt-BR')}` : 'Sem data de última compra'}>
          <p className="text-3xl font-bold font-mono text-text-primary mb-4">{data.dias ?? '—'}<span className="text-sm text-text-secondary font-sans font-normal"> dias</span></p>
          <RecencyBar dias={data.dias} diasBloqueio={diasBloqueio} diasInativacao={diasInativacao} />
        </Panel>
        <Panel title="Próxima ação sugerida" action={<Lightbulb size={16} className="text-accent-amber" />}>
          <ul className="space-y-2">
            {acoes.slice(0, 3).map((a, i) => <li key={i} className={`text-xs leading-relaxed rounded-lg border px-3 py-2 text-text-primary ${TONE[a.tone]}`}>{a.txt}</li>)}
          </ul>
        </Panel>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        <Kpi label="Fat. mês atual" value={moneyAbbr(data.fatMes)} sub={<span className="flex items-center gap-1.5"><Variacao value={variacao} /> vs anterior</span>} />
        <Kpi label="Média 3 meses" value={moneyAbbr(data.media3)} sub={<span className="flex items-center gap-1.5"><Variacao value={tendencia} /> vs média 12M</span>} />
        <Kpi label="Média 12 meses" value={moneyAbbr(data.media12)} sub={`Total ${moneyAbbr(data.fat12)}`} />
        <Kpi label="Melhor mês" icon={Trophy} value={moneyAbbr(data.serie[data.best])} sub={formatMesLabel(data.chrono[data.best] || '')} />
        <Kpi label="Frequência" icon={CalendarCheck} value={`${data.mesesCompra}/${meses.length}`} sub={data.streak > 1 ? `${data.streak} meses seguidos comprando` : 'meses com compra'} />
        <Kpi label="Limite" icon={Wallet} value={moneyAbbr(limite)} sub={limitePct != null ? `${limitePct.toFixed(0)}% usado no mês` : 'sem limite cadastrado'} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <Panel title="Compras mês a mês" subtitle="Linha tracejada = média de 12 meses" className="xl:col-span-2">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={chart}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="label" tick={axisTick} />
              <YAxis tick={axisTick} width={48} tickFormatter={v => moneyAbbr(v).replace('R$ ', '')} />
              <Tooltip {...chartTooltip} formatter={v => [money(v), 'Compras']} />
              <ReferenceLine y={data.media12} stroke="#f59e0b" strokeDasharray="5 4" />
              <Bar dataKey="valor" radius={[5, 5, 0, 0]}>
                {chart.map((d, i) => <Cell key={i} fill={d.valor === 0 ? '#ef444455' : i === data.best ? '#10b981' : '#3b82f6'} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Panel>

        <Panel title="Comparativos" subtitle="Faturamento 12M deste cliente">
          <div className="space-y-4">
            <Compare label={`No município (${c.cidade})`} pos={comp.posCidade} total={comp.totalCidade} valor={data.fat12} media={comp.mediaCidade} />
            <Compare label={`Na carteira de ${c.nome}`} pos={comp.posCarteira} total={comp.totalCarteira} valor={data.fat12} media={comp.mediaCarteira} />
          </div>
        </Panel>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <Panel title="Localização" subtitle={[endereco, c.bairro, c.cep && `CEP ${c.cep}`].filter(Boolean).join(' · ') || 'Endereço não informado'} className="xl:col-span-2">
          <MiniMap points={[{ lat: c.latitude, lng: c.longitude, color: STATUS_COLOR[status], label: c.razaoSocial, radius: 9 }]} height={240} />
        </Panel>
        <div className="space-y-4">
          <Panel title="Atendido por">
            <div className="space-y-2">
              {data.vendedores.map(v => (
                <Link key={v.key} to={`/explorar/vendedor/${v.key}`} className="flex items-center justify-between gap-2 p-2 rounded-lg hover:bg-bg-tertiary">
                  <span className="min-w-0">
                    <span className="block text-sm text-text-primary font-medium truncate">{v.nome}</span>
                    <span className="block text-[11px] text-text-secondary">RCA {v.key} · {equipeNome(v.gr)}</span>
                  </span>
                  <span className="font-mono text-xs text-text-secondary whitespace-nowrap">{moneyAbbr(v.fat12)} 12M</span>
                </Link>
              ))}
            </div>
          </Panel>
          <Panel title="Maiores da mesma cidade" action={<Flame size={15} className="text-accent-amber" />}>
            <div className="space-y-1">
              {comp.vizinhos.map(v => (
                <button key={v.seq} onClick={() => navigate(`/explorar/cliente/${v.seq}`)} className="w-full flex items-center justify-between gap-2 p-2 rounded-lg hover:bg-bg-tertiary text-left">
                  <span className="flex items-center gap-2 min-w-0">
                    <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: STATUS_COLOR[v.status] }} />
                    <span className="text-xs text-text-primary truncate">{v.nome}</span>
                  </span>
                  <span className="font-mono text-[11px] text-text-secondary whitespace-nowrap">{moneyAbbr(v.fat12)}</span>
                </button>
              ))}
              {!comp.vizinhos.length && <p className="text-xs text-text-secondary">Único cliente no município.</p>}
              <Link to={drillUrl('/explorar/clientes', { cidade: c.cidade })} className="block text-xs text-accent-blue hover:underline pt-1">Ver todos de {c.cidade} →</Link>
            </div>
          </Panel>
        </div>
      </div>
    </ExplorarShell>
  )
}

function Compare({ label, pos, total, valor, media }) {
  const diff = media > 0 ? ((valor - media) / media) * 100 : null
  const topPct = total ? (pos / total) * 100 : 0
  return (
    <div>
      <p className="text-xs text-text-secondary mb-1">{label}</p>
      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-bold font-mono text-text-primary">#{pos}</span>
        <span className="text-xs text-text-secondary">de {n(total)} clientes{topPct <= 20 ? ` · top ${Math.max(Math.ceil(topPct), 1)}%` : ''}</span>
      </div>
      <p className="text-xs text-text-secondary mt-1">
        Média: <span className="font-mono text-text-primary">{moneyAbbr(media)}</span>
        {diff != null && <> · <span className={diff >= 0 ? 'text-accent-green' : 'text-accent-red'}>{diff >= 0 ? '+' : ''}{pct(diff).replace('%', '')}%</span></>}
      </p>
    </div>
  )
}
