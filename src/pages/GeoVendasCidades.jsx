import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Maximize2, Minimize2, Layers, SlidersHorizontal, PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { useAuth } from '../App'
import PageHeader from '../components/PageHeader'
import { FiltrosBar } from '../components/Filtros'

let L = null

const BRASIL_CENTER = [-14.2, -51.9]

// Mesma paleta usada na geolocalização padrão — duplicada aqui de propósito
// para não alterar Mapa.jsx além do necessário.
const PALETTE = [
  '#e53935', '#43a047', '#1e88e5', '#fb8c00', '#8e24aa', '#00897b',
  '#d81b60', '#c0ca33', '#6d4c41', '#00acc1', '#f4511e', '#5e35b1',
  '#558b2f', '#546e7a', '#ff8f00', '#00695c', '#bf360c', '#880e4f',
  '#7cb342', '#3949ab',
]

const MESES_LABEL = ['', 'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']

function formatCurrency(v) {
  if (v == null) return '—'
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
}

function formatMesReferencia(mesRef) {
  if (!mesRef) return ''
  const [ano, mes] = mesRef.split('-')
  return `${MESES_LABEL[Number(mes)]}/${ano}`
}

function createDotIcon(L, color, size, opacity) {
  const html = `<div style="width:${size}px;height:${size}px;border-radius:50%;background:${color};opacity:${opacity};"></div>`
  return L.divIcon({ html, className: '', iconSize: [size, size], iconAnchor: [size / 2, size / 2] })
}

function DraggableLegend({ setorColors, onClose }) {
  const [pos, setPos] = useState({ x: 16, y: 80 })
  const dragging = useRef(false)
  const offset = useRef({ x: 0, y: 0 })

  const onMouseDown = e => {
    dragging.current = true
    offset.current = { x: e.clientX - pos.x, y: e.clientY - pos.y }
    e.preventDefault()
  }

  useEffect(() => {
    const onMove = e => { if (dragging.current) setPos({ x: e.clientX - offset.current.x, y: e.clientY - offset.current.y }) }
    const onUp = () => { dragging.current = false }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
    return () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
  }, [])

  return (
    <div
      style={{ position: 'absolute', left: pos.x, top: pos.y, zIndex: 1500, userSelect: 'none' }}
      className="bg-bg-secondary/95 border border-border-color rounded-lg shadow-xl backdrop-blur-sm"
    >
      <div className="flex items-center justify-between px-3 py-2 border-b border-border-color cursor-grab active:cursor-grabbing" onMouseDown={onMouseDown}>
        <span className="text-xs font-semibold text-text-primary">Setores/Rotas</span>
        <button onClick={onClose} className="text-text-secondary/50 hover:text-text-secondary text-xs ml-4 leading-none">✕</button>
      </div>
      <div className="p-2 space-y-1 max-h-60 overflow-y-auto min-w-[170px]">
        {Object.entries(setorColors).map(([nome, color]) => (
          <div key={nome} className="flex items-center gap-2 px-1 py-0.5">
            <span style={{ background: color }} className="w-3 h-3 rounded-full shrink-0 border border-white/20" />
            <span className="text-xs text-text-secondary">{nome}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function MultiSelectSetores({ setores, setorColors, selected, onChange }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    const handler = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const label = selected.length === 0 ? 'Todos os setores/rotas' : `${selected.length} setor${selected.length > 1 ? 'es' : ''}/rota${selected.length > 1 ? 's' : ''}`

  function toggle(nomeNorm) {
    onChange(selected.includes(nomeNorm) ? selected.filter(n => n !== nomeNorm) : [...selected, nomeNorm])
  }

  return (
    <div ref={ref} className="relative">
      <label className="block text-xs text-text-secondary mb-1">Setores/Rotas</label>
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 bg-bg-tertiary border border-border-color text-text-secondary text-sm rounded-lg px-3 py-2 min-w-[190px] hover:border-accent-blue/50 transition-colors"
      >
        <span className="flex-1 text-left">{label}</span>
        <span className="text-text-secondary/50">▾</span>
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 bg-bg-secondary border border-border-color rounded-lg shadow-xl z-[2000] min-w-[220px] max-h-64 overflow-y-auto">
          <div className="p-2 border-b border-border-color flex gap-2">
            <button onClick={() => onChange([])} className="text-xs text-accent-blue hover:underline">Limpar seleção</button>
            <span className="text-text-secondary/30">|</span>
            <button onClick={() => onChange(setores.map(s => s.nome_norm))} className="text-xs text-text-secondary hover:text-text-primary">Selecionar todos</button>
          </div>
          {setores.map(s => (
            <label key={s.nome_norm} className="flex items-center gap-2 px-3 py-2 text-sm text-text-secondary hover:bg-bg-tertiary cursor-pointer">
              <input type="checkbox" checked={selected.includes(s.nome_norm)} onChange={() => toggle(s.nome_norm)} className="accent-accent-blue" />
              <span style={{ background: setorColors[s.nome_norm] }} className="w-2.5 h-2.5 rounded-full shrink-0 border border-white/20" />
              <span className="flex-1">{s.nome}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  )
}

function FloatingFilters({ children, collapsed, onToggle }) {
  if (collapsed) {
    return (
      <button
        onClick={onToggle}
        title="Mostrar filtros"
        className="absolute top-4 left-4 z-[1100] bg-bg-secondary/90 border border-border-color rounded-lg p-2 hover:bg-bg-tertiary transition-colors backdrop-blur-sm"
      >
        <PanelLeftOpen size={16} className="text-text-secondary" />
      </button>
    )
  }
  return (
    <div className="absolute top-4 left-4 z-[1100] bg-bg-secondary/95 border border-border-color rounded-xl shadow-xl backdrop-blur-sm max-w-[260px]">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border-color">
        <span className="flex items-center gap-1.5 text-xs font-semibold text-text-primary">
          <SlidersHorizontal size={13} /> Filtros
        </span>
        <button onClick={onToggle} title="Minimizar filtros" className="text-text-secondary/50 hover:text-text-secondary">
          <PanelLeftClose size={15} />
        </button>
      </div>
      <div className="p-3 flex flex-col gap-3">
        {children}
      </div>
    </div>
  )
}

export default function GeoVendasCidades() {
  const { session, effectiveCompanyId } = useAuth()
  const mapRef = useRef(null)
  const mapInstance = useRef(null)
  const markersRef = useRef([])
  const rafRef = useRef(null)

  const [leafletReady, setLeafletReady] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [setores, setSetores] = useState([])
  const [vendas, setVendas] = useState([])
  const [mapZoom, setMapZoom] = useState(5)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [showLegend, setShowLegend] = useState(false)
  const [showSemVenda, setShowSemVenda] = useState(false)
  const [filterSetores, setFilterSetores] = useState([])
  const [filtersCollapsed, setFiltersCollapsed] = useState(false)

  useEffect(() => { import('leaflet').then(mod => { L = mod.default; setLeafletReady(true) }) }, [])

  const loadData = async () => {
    if (!effectiveCompanyId) return
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/geo?action=list&company_id=${effectiveCompanyId}`, {
        headers: { Authorization: `Bearer ${session.token}` },
      })
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      setSetores(json.setores || [])
      setVendas(json.vendas || [])
    } catch (e) {
      setError(e.message)
    }
    setLoading(false)
  }

  useEffect(() => { loadData() }, [effectiveCompanyId])

  useEffect(() => {
    if (!mapInstance.current) return
    setTimeout(() => mapInstance.current.invalidateSize(), 200)
  }, [isFullscreen])

  const setorColors = useMemo(() => {
    return Object.fromEntries(setores.map((s, i) => [s.nome_norm, PALETTE[i % PALETTE.length]]))
  }, [setores])

  const setorNomes = useMemo(() => {
    return Object.fromEntries(setores.map(s => [s.nome_norm, s.nome]))
  }, [setores])

  const visibleVendas = useMemo(() => {
    return vendas.filter(v =>
      v.latitude != null && v.longitude != null
      && (showSemVenda || !v.sem_venda)
      && (filterSetores.length === 0 || filterSetores.includes(v.setor_rota_norm))
    )
  }, [vendas, showSemVenda, filterSetores])

  // O container do mapa é sempre renderizado (nunca some por causa dos dados),
  // então este efeito só depende de leafletReady e roda uma única vez.
  useEffect(() => {
    if (!leafletReady || !mapRef.current || mapInstance.current) return
    mapInstance.current = L.map(mapRef.current, {
      center: BRASIL_CENTER, zoom: 5, minZoom: 4, maxZoom: 14, preferCanvas: true,
    })
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors', maxZoom: 18,
    }).addTo(mapInstance.current)
    mapInstance.current.on('zoomend', () => setMapZoom(mapInstance.current.getZoom()))
  }, [leafletReady])

  useEffect(() => {
    if (!leafletReady || !mapInstance.current) return
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    markersRef.current.forEach(m => m.remove())
    markersRef.current = []

    const layerGroup = L.layerGroup().addTo(mapInstance.current)
    markersRef.current = [layerGroup]

    const showLabel = mapZoom < 9

    const popupHtml = v => `
      <div style="font-family:Inter,sans-serif;min-width:200px;">
        <div style="font-weight:700;font-size:14px;color:#f9fafb;margin-bottom:2px;">${setorNomes[v.setor_rota_norm] || v.setor_rota_norm} - ${v.cidade_origem}</div>
        <div style="color:#9ca3af;font-size:12px;margin-bottom:8px;">${v.regiao || ''}</div>
        ${v.sem_venda ? '<div style="color:#f59e0b;font-size:11px;margin-bottom:6px;">⚠ Sem venda no período</div>' : ''}
        <div style="border-top:1px solid #1f2937;padding-top:6px;">
          <span style="color:#9ca3af;font-size:12px;">Venda ${formatMesReferencia(v.mes_referencia)}: </span>
          <span style="color:#f9fafb;font-size:13px;font-weight:600;">${formatCurrency(v.venda_mes)}</span>
        </div>
        <div style="padding-top:3px;">
          <span style="color:#60a5fa;font-size:12px;">Média Trimestre: </span>
          <span style="color:#60a5fa;font-size:13px;font-weight:600;">${formatCurrency(v.media_trimestre)}</span>
        </div>
      </div>`

    const CHUNK = 300
    let i = 0
    function addChunk() {
      const end = Math.min(i + CHUNK, visibleVendas.length)
      for (; i < end; i++) {
        const v = visibleVendas[i]
        const color = setorColors[v.setor_rota_norm] || PALETTE[0]
        const size = v.sem_venda ? 16 : Math.min(38, Math.max(20, Math.log10((v.venda_mes || 0) + 1) * 6 + 14))
        const opacity = v.sem_venda ? 0.4 : 1
        const marker = L.marker([v.latitude, v.longitude], { icon: createDotIcon(L, color, size, opacity) })
        marker.bindPopup(popupHtml(v), { maxWidth: 280 })
        layerGroup.addLayer(marker)

        if (showLabel) {
          const lbl = L.divIcon({
            html: `<div style="color:#e2e8f0;font-size:10px;font-weight:600;white-space:nowrap;text-shadow:0 1px 3px #000;font-family:Inter,sans-serif;">${v.cidade_origem}</div>`,
            className: '', iconAnchor: [-size / 2 - 2, 4],
          })
          layerGroup.addLayer(L.marker([v.latitude, v.longitude], { icon: lbl, interactive: false }))
        }
      }
      if (i < visibleVendas.length) rafRef.current = requestAnimationFrame(addChunk)
    }
    addChunk()

    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [visibleVendas, leafletReady, mapZoom, setorColors, setorNomes])

  const controls = (
    <>
      <MultiSelectSetores setores={setores} setorColors={setorColors} selected={filterSetores} onChange={setFilterSetores} />
      <label className="flex items-center gap-2 text-sm text-text-secondary cursor-pointer self-end pb-2">
        <input type="checkbox" checked={showSemVenda} onChange={e => setShowSemVenda(e.target.checked)} className="accent-accent-amber" />
        Municípios sem venda
      </label>
      <div className="self-end">
        <label className="block text-xs text-text-secondary mb-1">Legenda</label>
        <button
          onClick={() => setShowLegend(s => !s)}
          className={`flex items-center gap-2 border text-sm rounded-lg px-3 py-2 transition-colors ${showLegend ? 'bg-accent-blue/10 border-accent-blue/50 text-accent-blue' : 'bg-bg-tertiary border-border-color text-text-secondary hover:border-accent-blue/50'}`}
        >
          <Layers size={14} /> Legenda
        </button>
      </div>
    </>
  )

  if (error) return <div className="p-4 md:p-6 text-accent-red">{error}</div>

  const semDados = !loading && vendas.length === 0

  return (
    <div className="p-4 md:p-6 h-full flex flex-col gap-4 animate-fade-in">
      <PageHeader title="Geolocalização Vendas Cidades" subtitle={semDados ? undefined : `${visibleVendas.length} municípios`} />

      {!semDados && (
        <FiltrosBar onClear={() => { setShowLegend(false); setShowSemVenda(false); setFilterSetores([]) }}>
          {controls}
        </FiltrosBar>
      )}

      <div className={isFullscreen ? 'fixed inset-0 z-50' : 'flex-1 relative rounded-xl border border-border-color min-h-[500px]'}>
        <div ref={mapRef} className="absolute inset-0" />

        {(loading || semDados) && (
          <div className="absolute inset-0 z-[900] flex items-center justify-center bg-bg-primary/80 backdrop-blur-sm text-text-secondary text-sm px-6 text-center">
            {loading ? 'Carregando...' : 'Sem dados para esta geolocalização ainda. Peça ao admin para importar o CSV em "Importar Planilha".'}
          </div>
        )}

        {!semDados && (
          <div className="absolute bottom-4 right-4 z-[1000] flex flex-col items-end gap-2">
            <button
              onClick={() => setIsFullscreen(f => !f)}
              title={isFullscreen ? 'Sair da tela cheia' : 'Tela cheia'}
              className="bg-bg-secondary/90 border border-border-color rounded-lg p-2 hover:bg-bg-tertiary transition-colors backdrop-blur-sm"
            >
              {isFullscreen ? <Minimize2 size={15} className="text-text-secondary" /> : <Maximize2 size={15} className="text-text-secondary" />}
            </button>
          </div>
        )}

        {showLegend && !semDados && (
          <DraggableLegend setorColors={Object.fromEntries(Object.entries(setorColors).map(([k, v]) => [setorNomes[k] || k, v]))} onClose={() => setShowLegend(false)} />
        )}

        {isFullscreen && !semDados && (
          <FloatingFilters collapsed={filtersCollapsed} onToggle={() => setFiltersCollapsed(c => !c)}>
            {controls}
          </FloatingFilters>
        )}
      </div>
    </div>
  )
}
