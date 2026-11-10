import React, { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { MapPinned, DollarSign, Target, Users, Sparkles } from 'lucide-react'
import { useCarteira, applyDrill, aggregateBy, summarize, drillUrl } from '../../lib/drill'
import { exportExcel } from '../../services/dataService'
import {
  ExplorarShell, FilterChips, RefinePanel, Kpi, Panel, Sparkline, Variacao, StatusBar, SortableTable, MiniMap,
  ExportButton, EmptyState, useDrill, n, moneyAbbr, pct,
} from './ui'

// coordenada média dos clientes do município (clientes sem lat/lon herdam a do município no loader)
export function withCoords(list, rows, keyFn = r => r.cidade) {
  const acc = new Map()
  for (const r of rows) {
    if (r.latitude == null || r.longitude == null) continue
    const k = keyFn(r)
    const a = acc.get(k) || { lat: 0, lng: 0, c: 0 }
    a.lat += Number(r.latitude); a.lng += Number(r.longitude); a.c++
    acc.set(k, a)
  }
  return list.map(m => {
    const a = acc.get(m.key)
    return { ...m, lat: a ? a.lat / a.c : null, lng: a ? a.lng / a.c : null }
  })
}

export default function ExplorarMunicipios() {
  const navigate = useNavigate()
  const { ready, rows, meses, mesAtual, equipeNome, vendedorNome, diasBloqueio } = useCarteira()
  const { f } = useDrill()

  const filtered = useMemo(() => applyDrill(rows, f, { mesAtual, diasBloqueio }), [rows, f, mesAtual, diasBloqueio])
  const s = useMemo(() => summarize(filtered, meses, diasBloqueio), [filtered, meses, diasBloqueio])
  const municipios = useMemo(
    () => withCoords(aggregateBy(filtered, r => r.cidade, meses), filtered).sort((a, b) => b.fatMes - a.fatMes),
    [filtered, meses]
  )

  // Oportunidade = clientes da seleção que não compraram no mês × média 3M deles
  const oportunidade = useMemo(() => {
    const m = new Map()
    for (const r of filtered) if ((r[mesAtual] || 0) === 0 && r._media3 > 0) m.set(r.cidade, (m.get(r.cidade) || 0) + r._media3)
    return m
  }, [filtered, mesAtual])

  const mapPoints = useMemo(() => {
    const max = Math.max(...municipios.map(m => m.fatMes), 1)
    return municipios.map(m => ({
      lat: m.lat, lng: m.lng, key: m.key,
      radius: 4 + 12 * Math.sqrt(m.fatMes / max),
      color: m.positivacao >= 50 ? '#10b981' : m.positivacao >= 25 ? '#f59e0b' : '#ef4444',
      label: `${m.key} · ${moneyAbbr(m.fatMes)} · ${n(m.clientes)} clientes · ${pct(m.positivacao)} posit.`,
    }))
  }, [municipios])

  const melhores = [...municipios].filter(m => m.clientes >= 5).sort((a, b) => b.positivacao - a.positivacao).slice(0, 3)
  const maiorOport = [...oportunidade.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3)

  if (!ready) return <EmptyState>Sem dados carregados.</EmptyState>

  const open = m => navigate(drillUrl(`/explorar/municipio/${encodeURIComponent(m)}`, { ...f, cidade: null }))

  function handleExport() {
    exportExcel(municipios.map(m => ({
      'Município': m.key, 'Clientes': m.clientes, 'Ativos': m.ativos, 'Bloqueados': m.bloqueados, 'Inativos': m.inativos,
      'Vendedores': m.vendedores, 'Positivação %': +m.positivacao.toFixed(1), 'Fat. mês': m.fatMes, 'Fat. 12M': m.fat12,
      'Oportunidade (média 3M dos sem compra)': +(oportunidade.get(m.key) || 0).toFixed(2),
    })), `analise_municipios_${new Date().toISOString().slice(0, 10)}.xlsx`)
  }

  const columns = [
    { key: 'key', label: 'Município', sortable: true, defaultDir: 'asc', render: m => <span className="text-text-primary font-medium whitespace-nowrap">{m.key}</span> },
    {
      key: 'clientes', label: 'Clientes', sortable: true, align: 'right',
      render: m => <button onClick={e => { e.stopPropagation(); navigate(drillUrl('/explorar/clientes', { ...f, cidade: m.key })) }} className="font-mono text-text-primary hover:text-accent-blue hover:underline">{n(m.clientes)}</button>,
    },
    { key: 'mix', label: 'Carteira', render: m => <div className="w-20"><StatusBar a={m} /></div> },
    {
      key: 'vendedores', label: 'Vend.', sortable: true, align: 'right',
      render: m => <button onClick={e => { e.stopPropagation(); navigate(drillUrl('/explorar/vendedores', { ...f, cidade: m.key })) }} className="font-mono text-text-secondary hover:text-accent-blue hover:underline">{n(m.vendedores)}</button>,
    },
    { key: 'positivacao', label: 'Posit.', sortable: true, align: 'right', render: m => <span className="font-mono text-text-secondary">{pct(m.positivacao)}</span> },
    { key: 'fatMes', label: 'Fat. mês', sortable: true, align: 'right', render: m => <span className="font-mono text-text-primary whitespace-nowrap">{moneyAbbr(m.fatMes)}</span> },
    { key: 'variacao', label: 'Var.', sortable: true, align: 'right', render: m => <Variacao value={m.variacao} /> },
    { key: 'oport', label: 'Oportunidade', align: 'right', sortValue: m => oportunidade.get(m.key) || 0, render: m => <span className="font-mono text-accent-amber whitespace-nowrap">{moneyAbbr(oportunidade.get(m.key) || 0)}</span> },
    { key: 'serie', label: '12 meses', render: m => <Sparkline data={m.serie} color="#10b981" /> },
  ]

  return (
    <ExplorarShell
      eyebrow="Território"
      title={<>{n(municipios.length)} <span className="text-text-secondary font-semibold">·</span> Municípios</>}
      subtitle="Onde a seleção compra. Clique num município (no mapa ou na tabela) para ver o detalhe."
      icon={MapPinned}
      accent="#10b981"
      pivot
      chips={<FilterChips equipeNome={equipeNome} vendedorNome={vendedorNome} />}
      actions={<ExportButton onClick={handleExport} />}
    >
      <RefinePanel rows={rows} equipeNome={equipeNome} />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi label="Clientes na seleção" icon={Users} value={n(s.clientes)} onClick={() => navigate(drillUrl('/explorar/clientes', f))} sub="ver lista →" />
        <Kpi label="Faturamento do mês" icon={DollarSign} value={moneyAbbr(s.fatMes)} sub={<span className="flex items-center gap-1.5"><Variacao value={s.variacao} /> vs anterior</span>} />
        <Kpi label="Positivação" icon={Target} value={pct(s.positivacao)} sub={`${n(s.positivados)} de ${n(s.clientes)}`} />
        <Kpi label="Oportunidade no mês" icon={Sparkles} tone="text-accent-amber" value={moneyAbbr([...oportunidade.values()].reduce((a, b) => a + b, 0))}
          sub="média 3M de quem ainda não comprou" onClick={() => navigate(drillUrl('/explorar/clientes', { ...f, positivado: 'nao' }))} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <Panel title="Mapa da seleção" subtitle="Tamanho = faturamento do mês · cor = positivação (verde ≥50%, âmbar ≥25%, vermelho <25%)" className="xl:col-span-2">
          <MiniMap points={mapPoints} height={380} onPointClick={p => open(p.key)} />
        </Panel>
        <div className="space-y-4">
          <Panel title="Melhor positivação" subtitle="Municípios com 5+ clientes">
            {melhores.map(m => (
              <button key={m.key} onClick={() => open(m.key)} className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-bg-tertiary text-left">
                <span className="text-sm text-text-primary truncate">{m.key}</span>
                <span className="font-mono text-sm text-accent-green">{pct(m.positivacao)}</span>
              </button>
            ))}
            {!melhores.length && <p className="text-xs text-text-secondary">Sem municípios suficientes.</p>}
          </Panel>
          <Panel title="Maior oportunidade" subtitle="Quanto os clientes sem compra no mês costumam comprar">
            {maiorOport.map(([cid, v]) => (
              <button key={cid} onClick={() => navigate(drillUrl('/explorar/clientes', { ...f, cidade: cid, positivado: 'nao' }))} className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-bg-tertiary text-left">
                <span className="text-sm text-text-primary truncate">{cid}</span>
                <span className="font-mono text-sm text-accent-amber">{moneyAbbr(v)}</span>
              </button>
            ))}
            {!maiorOport.length && <p className="text-xs text-text-secondary">Todos compraram no mês. 🎉</p>}
          </Panel>
        </div>
      </div>

      <Panel title="Municípios" subtitle="Números clicáveis abrem clientes ou vendedores daquele município">
        <SortableTable columns={columns} rows={municipios} rowKey={m => m.key} initialSort={{ key: 'fatMes', dir: 'desc' }} onRowClick={m => open(m.key)} />
      </Panel>
    </ExplorarShell>
  )
}
