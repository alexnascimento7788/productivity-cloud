// Kit visual das páginas de análise (/explorar/*).
// Visual propositalmente diferente das abas de gestão: hero com gradiente,
// chips de filtro removíveis e "pivot" entre Clientes / Vendedores / Municípios
// mantendo a mesma seleção.

import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate, useSearchParams, Link } from 'react-router-dom'
import {
  ArrowLeft, X, Users, UserRound, MapPinned, SlidersHorizontal, ChevronUp, ChevronDown, Sparkles, Search, Download,
} from 'lucide-react'
import Pagination from '../../components/Pagination'
import { DRILL_KEYS, STATUS_LABEL, diasLabel, drillUrl, readDrill } from '../../lib/drill'
import { formatCurrency, formatCurrencyAbbr } from '../../services/dataService'

export const STATUS_COLOR = { ativo: '#10b981', bloqueado: '#f59e0b', inativo: '#ef4444', monitorado: '#3b82f6' }
export const CURVA_COLOR = { A: '#10b981', B: '#3b82f6', C: '#f59e0b' }
export const STATUS_TXT = { ativo: 'Ativo', bloqueado: 'Bloqueado', inativo: 'Inativo', monitorado: 'Monitorado' }

export const chartTooltip = {
  contentStyle: { background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--text-primary)', fontSize: 12 },
  itemStyle: { color: 'var(--text-primary)' },
  labelStyle: { color: 'var(--text-secondary)' },
  cursor: { fill: 'rgba(148,163,184,0.08)' },
}
export const axisTick = { fill: 'var(--text-secondary)', fontSize: 10 }

export const n = v => (v ?? 0).toLocaleString('pt-BR')
export const money = formatCurrency
export const moneyAbbr = formatCurrencyAbbr
export const pct = v => (v == null ? '—' : `${v.toFixed(1)}%`)

// ── Filtros na URL ───────────────────────────────────────────────────────────
export function useDrill() {
  const [searchParams, setSearchParams] = useSearchParams()
  const f = useMemo(() => readDrill(searchParams), [searchParams])
  const set = patch => {
    const next = new URLSearchParams(searchParams)
    for (const [k, v] of Object.entries(patch)) {
      if (v === null || v === undefined || v === '') next.delete(k)
      else next.set(k, String(v))
    }
    setSearchParams(next, { replace: true })
  }
  const clear = () => setSearchParams(new URLSearchParams(), { replace: true })
  return { f, set, clear }
}

// ── Shell ────────────────────────────────────────────────────────────────────
const PIVOTS = [
  { path: '/explorar/clientes', label: 'Clientes', icon: Users },
  { path: '/explorar/vendedores', label: 'Vendedores', icon: UserRound },
  { path: '/explorar/municipios', label: 'Municípios', icon: MapPinned },
]

export function ExplorarShell({ eyebrow, title, subtitle, icon: Icon = Sparkles, accent = '#3b82f6', actions, chips, pivot, children }) {
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const f = readDrill(searchParams)

  function goBack() {
    if (window.history.state?.idx > 0) navigate(-1)
    else navigate('/dashboard')
  }

  return (
    <div className="min-h-full animate-fade-in">
      {/* Hero */}
      <div
        className="relative overflow-hidden border-b border-border-color"
        style={{ background: `radial-gradient(1200px 300px at 0% 0%, ${accent}33, transparent 60%), radial-gradient(900px 260px at 100% 0%, #10b98122, transparent 60%)` }}
      >
        <div className="px-4 md:px-8 pt-4 pb-6 max-w-[1500px] mx-auto">
          <div className="flex items-center justify-between gap-2 mb-4">
            <button onClick={goBack} className="flex items-center gap-1.5 text-xs text-text-secondary hover:text-text-primary px-2.5 py-1.5 rounded-full bg-bg-secondary/70 border border-border-color backdrop-blur">
              <ArrowLeft size={13} /> Voltar
            </button>
            <span className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.14em] font-semibold px-2.5 py-1 rounded-full border" style={{ color: accent, borderColor: `${accent}55`, background: `${accent}14` }}>
              <Sparkles size={11} /> Modo análise
            </span>
          </div>
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
            <div className="flex items-start gap-4 min-w-0">
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-lg" style={{ background: `linear-gradient(135deg, ${accent}, #10b981)` }}>
                <Icon size={22} className="text-white" />
              </div>
              <div className="min-w-0">
                {eyebrow && <p className="text-[11px] uppercase tracking-[0.12em] text-text-secondary font-semibold mb-1">{eyebrow}</p>}
                <h1 className="text-2xl md:text-3xl font-bold text-text-primary leading-tight break-words">{title}</h1>
                {subtitle && <div className="text-sm text-text-secondary mt-1">{subtitle}</div>}
              </div>
            </div>
            {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
          </div>

          {chips}

          {pivot && (
            <div className="mt-5 inline-flex p-1 rounded-xl bg-bg-secondary/80 border border-border-color backdrop-blur max-w-full overflow-x-auto">
              {PIVOTS.map(p => {
                const active = location.pathname === p.path
                return (
                  <Link
                    key={p.path}
                    to={drillUrl(p.path, f)}
                    replace
                    className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${active ? 'bg-accent-blue text-white shadow' : 'text-text-secondary hover:text-text-primary'}`}
                  >
                    <p.icon size={13} /> {p.label}
                  </Link>
                )
              })}
            </div>
          )}
        </div>
      </div>

      <div className="px-4 md:px-8 py-6 max-w-[1500px] mx-auto space-y-6">{children}</div>
    </div>
  )
}

// ── Chips dos filtros ativos (removíveis) ────────────────────────────────────
export function FilterChips({ equipeNome, vendedorNome, extra }) {
  const { f, set, clear } = useDrill()
  const labels = {
    gr: v => equipeNome(v),
    rca: v => `${vendedorNome(v)} (RCA ${v})`,
    cidade: v => v,
    status: v => STATUS_LABEL[v] || v,
    curva: v => `Curva ${v}`,
    positivado: v => (v === 'sim' ? 'Compraram no mês' : 'Sem compra no mês'),
    dias: v => diasLabel(v),
    q: v => `“${v}”`,
  }
  const active = DRILL_KEYS.filter(k => f[k])
  if (!active.length && !extra) {
    return <p className="mt-4 text-xs text-text-secondary">Sem filtros — mostrando toda a carteira visível para você.</p>
  }
  return (
    <div className="mt-4 flex flex-wrap items-center gap-2">
      {active.map(k => (
        <span key={k} className="flex items-center gap-1.5 pl-3 pr-1.5 py-1 rounded-full text-xs bg-bg-secondary border border-border-color text-text-primary">
          {labels[k](f[k])}
          <button onClick={() => set({ [k]: null })} title="Remover filtro" className="p-0.5 rounded-full hover:bg-bg-tertiary text-text-secondary hover:text-text-primary">
            <X size={12} />
          </button>
        </span>
      ))}
      {extra}
      {active.length > 1 && (
        <button onClick={clear} className="text-xs text-text-secondary hover:text-accent-red underline-offset-2 hover:underline ml-1">Limpar tudo</button>
      )}
    </div>
  )
}

// ── Painel "Refinar" — mesmos filtros, gravando na URL ───────────────────────
export function RefinePanel({ rows, equipeNome, show = ['gr', 'rca', 'cidade', 'status', 'curva', 'positivado', 'dias', 'q'] }) {
  const { f, set } = useDrill()
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState(f.q || '')
  useEffect(() => setQ(f.q || ''), [f.q])
  useEffect(() => {
    const t = setTimeout(() => { if ((f.q || '') !== q) set({ q }) }, 350)
    return () => clearTimeout(t)
  }, [q]) // eslint-disable-line

  const opts = useMemo(() => {
    const grs = [...new Set(rows.map(r => r.gr))].sort((a, b) => Number(a) - Number(b))
    const base = f.gr ? rows.filter(r => r.gr === f.gr) : rows
    const vend = new Map()
    base.forEach(r => { if (!vend.has(r.rca)) vend.set(r.rca, r.nome) })
    const cid = [...new Set(base.filter(r => !f.rca || r.rca === Number(f.rca)).map(r => r.cidade).filter(Boolean))].sort()
    return {
      gr: grs.map(g => ({ value: g, label: equipeNome(g) })),
      rca: [...vend.entries()].sort((a, b) => a[1].localeCompare(b[1])).map(([v, l]) => ({ value: String(v), label: `${l} (${v})` })),
      cidade: cid.map(c => ({ value: c, label: c })),
      status: Object.entries(STATUS_LABEL).map(([value, label]) => ({ value, label })),
      curva: ['A', 'B', 'C'].map(c => ({ value: c, label: `Curva ${c}` })),
      positivado: [{ value: 'sim', label: 'Compraram no mês' }, { value: 'nao', label: 'Sem compra no mês' }],
      dias: ['0-30', '31-60', '61-90', '91-180', '180+'].map(v => ({ value: v, label: diasLabel(v) })),
    }
  }, [rows, f.gr, f.rca, equipeNome])

  const LABEL = { gr: 'Equipe', rca: 'Vendedor', cidade: 'Município', status: 'Situação', curva: 'Curva ABC', positivado: 'Positivação', dias: 'Dias s/ compra' }

  return (
    <div className="rounded-2xl border border-border-color bg-bg-secondary/60">
      <div className="flex flex-wrap items-center gap-3 p-3">
        {show.includes('q') && (
          <div className="relative flex-1 min-w-[200px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
            <input
              value={q}
              onChange={e => setQ(e.target.value)}
              placeholder="Buscar cliente por razão social ou código…"
              className="w-full bg-bg-tertiary border border-border-color rounded-xl pl-9 pr-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-accent-blue"
            />
          </div>
        )}
        <button onClick={() => setOpen(o => !o)} className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm border transition-colors ${open ? 'border-accent-blue text-accent-blue bg-accent-blue/10' : 'border-border-color text-text-secondary hover:text-text-primary'}`}>
          <SlidersHorizontal size={14} /> Refinar
        </button>
      </div>
      {open && (
        <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-3 px-3 pb-3">
          {show.filter(k => k !== 'q').map(k => (
            <label key={k} className="flex flex-col gap-1 min-w-0">
              <span className="text-[11px] text-text-secondary font-medium">{LABEL[k]}</span>
              <select
                value={f[k] || ''}
                onChange={e => set(k === 'gr' ? { gr: e.target.value, rca: null } : { [k]: e.target.value })}
                className="bg-bg-tertiary border border-border-color text-text-primary text-sm rounded-lg px-2.5 py-2 focus:outline-none focus:ring-1 focus:ring-accent-blue min-w-0"
              >
                <option value="">Todos</option>
                {opts[k].map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </label>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Blocos ───────────────────────────────────────────────────────────────────
export function Kpi({ label, value, sub, tone = 'text-text-primary', icon: Icon, onClick, active, hint }) {
  const Comp = onClick ? 'button' : 'div'
  return (
    <Comp
      onClick={onClick}
      title={hint}
      className={`text-left rounded-2xl p-4 border bg-bg-secondary transition-all ${active ? 'border-accent-blue ring-1 ring-accent-blue/40' : 'border-border-color'} ${onClick ? 'hover:border-accent-blue/50 hover:-translate-y-0.5 cursor-pointer' : ''}`}
    >
      <div className="flex items-center justify-between gap-2 mb-2">
        <span className="text-[11px] uppercase tracking-wide text-text-secondary font-semibold">{label}</span>
        {Icon && <Icon size={15} className="text-text-secondary" />}
      </div>
      <div className={`text-xl md:text-2xl font-bold font-mono ${tone}`}>{value}</div>
      {sub && <div className="text-xs text-text-secondary mt-1">{sub}</div>}
    </Comp>
  )
}

export function Panel({ title, subtitle, action, children, className = '' }) {
  return (
    <section className={`rounded-2xl border border-border-color bg-bg-secondary p-4 md:p-5 min-w-0 ${className}`}>
      {(title || action) && (
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="min-w-0">
            {title && <h2 className="text-sm font-semibold text-text-primary">{title}</h2>}
            {subtitle && <p className="text-xs text-text-secondary mt-0.5">{subtitle}</p>}
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  )
}

export function Sparkline({ data = [], color = '#3b82f6', width = 96, height = 26 }) {
  if (!data.length) return null
  const max = Math.max(...data, 1)
  const step = data.length > 1 ? width / (data.length - 1) : width
  const pts = data.map((v, i) => `${(i * step).toFixed(1)},${(height - 2 - (v / max) * (height - 4)).toFixed(1)}`)
  return (
    <svg width={width} height={height} className="overflow-visible">
      <polyline points={`0,${height} ${pts.join(' ')} ${width},${height}`} fill={`${color}22`} stroke="none" />
      <polyline points={pts.join(' ')} fill="none" stroke={color} strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={(data.length - 1) * step} cy={pts[pts.length - 1].split(',')[1]} r="2.2" fill={color} />
    </svg>
  )
}

export function StatusBadge({ status }) {
  const c = STATUS_COLOR[status] || '#9ca3af'
  return (
    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium whitespace-nowrap" style={{ color: c, background: `${c}1f` }}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: c }} />
      {STATUS_TXT[status] || status}
    </span>
  )
}

export function CurvaBadge({ curva }) {
  const c = CURVA_COLOR[curva] || '#9ca3af'
  return <span className="inline-flex px-2 py-0.5 rounded-md text-[11px] font-bold font-mono" style={{ color: c, background: `${c}1f` }}>{curva}</span>
}

export function Variacao({ value }) {
  if (value == null) return <span className="text-text-secondary">—</span>
  const up = value >= 0
  return <span className={`font-mono text-xs font-semibold ${up ? 'text-accent-green' : 'text-accent-red'}`}>{up ? '▲' : '▼'} {Math.abs(value).toFixed(1)}%</span>
}

/** Barra de proporção empilhada por status. */
export function StatusBar({ a }) {
  const total = a.clientes || 1
  const parts = [['ativo', a.ativos], ['bloqueado', a.bloqueados], ['inativo', a.inativos], ['monitorado', a.monitorados]]
  return (
    <div className="flex h-1.5 w-full rounded-full overflow-hidden bg-bg-tertiary">
      {parts.map(([k, v]) => v > 0 && <div key={k} style={{ width: `${(v / total) * 100}%`, background: STATUS_COLOR[k] }} />)}
    </div>
  )
}

export function ExportButton({ onClick }) {
  return (
    <button onClick={onClick} className="flex items-center gap-2 px-3.5 py-2 text-sm rounded-xl bg-bg-secondary/80 border border-border-color text-text-secondary hover:text-text-primary backdrop-blur">
      <Download size={14} /> Exportar
    </button>
  )
}

// ── Tabela ordenável e paginada ──────────────────────────────────────────────
export function SortableTable({ columns, rows, rowKey, onRowClick, pageSize = 25, initialSort, empty = 'Nada encontrado com esses filtros.' }) {
  const [sort, setSort] = useState(initialSort || { key: null, dir: 'desc' })
  const [page, setPage] = useState(1)
  useEffect(() => setPage(1), [rows])

  const sorted = useMemo(() => {
    const col = columns.find(c => c.key === sort.key)
    if (!col) return rows
    const get = col.sortValue || (r => r[col.key])
    return [...rows].sort((a, b) => {
      const va = get(a), vb = get(b)
      const cmp = typeof va === 'string' || typeof vb === 'string'
        ? String(va ?? '').localeCompare(String(vb ?? ''), 'pt-BR')
        : (va ?? -Infinity) - (vb ?? -Infinity)
      return sort.dir === 'asc' ? cmp : -cmp
    })
  }, [rows, sort, columns])

  const totalPages = Math.ceil(sorted.length / pageSize)
  const pageRows = sorted.slice((page - 1) * pageSize, page * pageSize)

  function toggle(c) {
    if (!c.sortable && !c.sortValue) return
    setSort(s => (s.key === c.key ? { key: c.key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key: c.key, dir: c.defaultDir || 'desc' }))
  }

  return (
    <div>
      <div className="overflow-x-auto -mx-4 md:mx-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border-color">
              {columns.map(c => {
                const sortable = c.sortable || c.sortValue
                return (
                  <th
                    key={c.key}
                    onClick={() => toggle(c)}
                    className={`px-3 py-2.5 text-[11px] uppercase tracking-wide font-semibold text-text-secondary whitespace-nowrap ${c.align === 'right' ? 'text-right' : 'text-left'} ${sortable ? 'cursor-pointer hover:text-text-primary select-none' : ''}`}
                  >
                    <span className={`inline-flex items-center gap-1 ${c.align === 'right' ? 'flex-row-reverse' : ''}`}>
                      {c.label}
                      {sortable && sort.key === c.key && (sort.dir === 'asc' ? <ChevronUp size={12} className="text-accent-blue" /> : <ChevronDown size={12} className="text-accent-blue" />)}
                    </span>
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {pageRows.map(r => (
              <tr
                key={rowKey(r)}
                onClick={onRowClick ? () => onRowClick(r) : undefined}
                className={`border-b border-border-color/40 ${onRowClick ? 'cursor-pointer hover:bg-accent-blue/5' : ''}`}
              >
                {columns.map(c => (
                  <td key={c.key} className={`px-3 py-2.5 ${c.align === 'right' ? 'text-right' : ''} ${c.className || ''}`}>
                    {c.render ? c.render(r) : r[c.key]}
                  </td>
                ))}
              </tr>
            ))}
            {!pageRows.length && (
              <tr><td colSpan={columns.length} className="px-3 py-10 text-center text-text-secondary text-sm">{empty}</td></tr>
            )}
          </tbody>
        </table>
      </div>
      {totalPages > 1 && (
        <div className="pt-4">
          <Pagination page={page} totalPages={totalPages} onChange={setPage} />
        </div>
      )}
    </div>
  )
}

// ── Mini mapa Leaflet (pins leves, sem cluster/canvas) ───────────────────────
let L = null

export function MiniMap({ points, height = 260, onPointClick }) {
  const ref = useRef(null)
  const map = useRef(null)
  const layer = useRef(null)
  const [ready, setReady] = useState(!!L)

  useEffect(() => {
    if (L) return
    import('leaflet').then(mod => { L = mod.default; setReady(true) })
  }, [])

  useEffect(() => {
    if (!ready || !ref.current || map.current) return
    map.current = L.map(ref.current, { zoomControl: true, attributionControl: false, scrollWheelZoom: false })
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 18 }).addTo(map.current)
    layer.current = L.layerGroup().addTo(map.current)
    return () => { map.current?.remove(); map.current = null }
  }, [ready])

  useEffect(() => {
    if (!map.current) return
    layer.current.clearLayers()
    const valid = (points || []).filter(p => p.lat != null && p.lng != null && !isNaN(p.lat) && !isNaN(p.lng))
    valid.forEach(p => {
      const m = L.circleMarker([p.lat, p.lng], {
        radius: p.radius || 7, color: '#fff', weight: 1.5, fillColor: p.color || '#3b82f6', fillOpacity: 0.85,
      })
      if (p.label) m.bindTooltip(p.label, { direction: 'top', offset: [0, -6] })
      if (onPointClick) m.on('click', () => onPointClick(p))
      m.addTo(layer.current)
    })
    if (valid.length === 1) map.current.setView([valid[0].lat, valid[0].lng], 12)
    else if (valid.length > 1) map.current.fitBounds(valid.map(p => [p.lat, p.lng]), { padding: [24, 24], maxZoom: 12 })
    else map.current.setView([-14.2, -51.9], 4)
    setTimeout(() => map.current?.invalidateSize(), 150)
  }, [points, ready]) // eslint-disable-line

  const hasPoints = (points || []).some(p => p.lat != null && p.lng != null)
  return (
    <div className="relative rounded-xl overflow-hidden border border-border-color" style={{ height }}>
      <div ref={ref} className="absolute inset-0 z-0" />
      {ready && !hasPoints && (
        <div className="absolute inset-0 z-[500] flex items-center justify-center bg-bg-secondary/80 text-xs text-text-secondary text-center p-4">
          Sem coordenadas — ajuste o de/para em Cidades para ver no mapa.
        </div>
      )}
    </div>
  )
}

export function EmptyState({ children }) {
  return <div className="p-10 text-center text-text-secondary text-sm">{children}</div>
}
