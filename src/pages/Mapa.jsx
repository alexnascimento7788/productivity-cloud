import React, { useMemo, useState, useEffect, useRef } from 'react'
import { Maximize2, Minimize2, Layers } from 'lucide-react'
import { useAuth, useData, useParams, isStaff, filterRowsByRole } from '../App'
import { processExcelData, calcMapData, formatCurrency } from '../services/dataService'
import { FiltrosBar } from '../components/Filtros'
import PageHeader from '../components/PageHeader'

let L = null

const BRASIL_CENTER = [-14.2, -51.9]

// Paleta com 20 cores – hues espaçados para máxima distinção visual
// Ordenada para que índices vizinhos nunca tenham hue parecido
const TEAM_PALETTE = [
  '#e53935', // 0  vermelho
  '#43a047', // 1  verde
  '#1e88e5', // 2  azul
  '#fb8c00', // 3  laranja
  '#8e24aa', // 4  roxo
  '#00897b', // 5  teal
  '#d81b60', // 6  magenta/pink
  '#c0ca33', // 7  lima
  '#6d4c41', // 8  marrom
  '#00acc1', // 9  ciano
  '#f4511e', // 10 laranja-escuro
  '#5e35b1', // 11 roxo-escuro
  '#558b2f', // 12 verde-escuro
  '#546e7a', // 13 cinza-azul (steel blue — distinto do azul puro)
  '#ff8f00', // 14 âmbar
  '#00695c', // 15 teal-escuro
  '#bf360c', // 16 ferrugem
  '#880e4f', // 17 magenta-escuro
  '#7cb342', // 18 verde-claro
  '#3949ab', // 19 índigo
]

function normalizeStr(s) {
  return String(s || '').toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim()
}

function jitter(rca) {
  const seed = rca % 1000
  return { lat: ((seed * 37 + 13) % 100 - 50) * 0.0002, lng: ((seed * 53 + 7) % 100 - 50) * 0.0002 }
}

function jitterTeam(gr) {
  let seed = 0
  for (let i = 0; i < String(gr).length; i++) seed = (seed * 31 + String(gr).charCodeAt(i)) & 0xffff
  return { lat: ((seed * 37 + 13) % 100 - 50) * 0.003, lng: ((seed * 53 + 7) % 100 - 50) * 0.003 }
}

function hashColor(str) {
  let h = 0
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0
  return TEAM_PALETTE[h % TEAM_PALETTE.length]
}

// Ícone individual do vendedor (RCA no centro)
function createRcaIcon(L, rca, color, size = 32) {
  const label = String(rca)
  const fontSize = label.length > 4 ? Math.max(8, Math.round(size * 0.25)) : Math.round(size * 0.38)
  const html = `<div style="width:${size}px;height:${size}px;border-radius:50%;background:${color};color:#fff;font-weight:700;font-size:${fontSize}px;line-height:${size}px;text-align:center;font-family:'JetBrains Mono',monospace;overflow:hidden;letter-spacing:-0.5px;">${label}</div>`
  return L.divIcon({ html, className: '', iconSize: [size, size], iconAnchor: [size / 2, size / 2] })
}

// Ícone de cidade — círculo puro com cor da equipe dominante, sem texto nem borda
function createCityIcon(L, color, size = 32) {
  const html = `<div style="width:${size}px;height:${size}px;border-radius:50%;background:${color};"></div>`
  return L.divIcon({ html, className: '', iconSize: [size, size], iconAnchor: [size / 2, size / 2] })
}

// Legenda flutuante e arrastável
function DraggableLegend({ teamColors, equipes, onClose }) {
  const [pos, setPos] = useState({ x: 16, y: 80 })
  const dragging = useRef(false)
  const offset = useRef({ x: 0, y: 0 })

  const onMouseDown = e => {
    dragging.current = true
    offset.current = { x: e.clientX - pos.x, y: e.clientY - pos.y }
    e.preventDefault()
  }

  useEffect(() => {
    const onMove = e => {
      if (!dragging.current) return
      setPos({ x: e.clientX - offset.current.x, y: e.clientY - offset.current.y })
    }
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
      <div
        className="flex items-center justify-between px-3 py-2 border-b border-border-color cursor-grab active:cursor-grabbing"
        onMouseDown={onMouseDown}
      >
        <span className="text-xs font-semibold text-text-primary">Equipes no mapa</span>
        <button
          onClick={onClose}
          className="text-text-secondary/50 hover:text-text-secondary text-xs ml-4 leading-none"
        >✕</button>
      </div>
      <div className="p-2 space-y-1 max-h-60 overflow-y-auto min-w-[170px]">
        {equipes.map(e => (
          <div key={e.gr} className="flex items-center gap-2 px-1 py-0.5">
            <span
              style={{ background: teamColors[e.gr] || '#888' }}
              className="w-3 h-3 rounded-full shrink-0 border border-white/20"
            />
            <span className="text-xs text-text-secondary">{e.nome}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function MultiSelectEquipes({ equipes, selected, onChange }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    const handler = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const label = selected.length === 0 ? 'Todas as equipes' : `${selected.length} equipe${selected.length > 1 ? 's' : ''}`

  function toggle(gr) {
    onChange(selected.includes(gr) ? selected.filter(g => g !== gr) : [...selected, gr])
  }

  return (
    <div ref={ref} className="relative">
      <label className="block text-xs text-text-secondary mb-1">Equipes</label>
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 bg-bg-tertiary border border-border-color text-text-secondary text-sm rounded-lg px-3 py-2 min-w-[180px] hover:border-accent-blue/50 transition-colors"
      >
        <span className="flex-1 text-left">{label}</span>
        <span className="text-text-secondary/50">▾</span>
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 bg-bg-secondary border border-border-color rounded-lg shadow-xl z-[2000] min-w-[210px] max-h-64 overflow-y-auto">
          <div className="p-2 border-b border-border-color flex gap-2">
            <button onClick={() => onChange([])} className="text-xs text-accent-blue hover:underline">Limpar seleção</button>
            <span className="text-text-secondary/30">|</span>
            <button onClick={() => onChange(equipes.map(e => e.gr))} className="text-xs text-text-secondary hover:text-text-primary">Selecionar todas</button>
          </div>
          {equipes.map(e => (
            <label key={e.gr} className="flex items-center gap-2 px-3 py-2 text-sm text-text-secondary hover:bg-bg-tertiary cursor-pointer">
              <input type="checkbox" checked={selected.includes(e.gr)} onChange={() => toggle(e.gr)} className="accent-accent-blue" />
              <span className="flex-1">{e.nome}</span>
              <span className="text-xs text-text-secondary/50">{e.gr}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  )
}

export default function Mapa() {
  const { session } = useAuth()
  const { excelData, equipesList } = useData()
  const { diasBloqueio, diasInativacao } = useParams()
  const isMaster = isStaff(session?.role)

  const mapRef = useRef(null)
  const mapInstance = useRef(null)
  const markersRef = useRef([])
  const rafRef = useRef(null)

  const [filterGrs, setFilterGrs] = useState([])
  const [showLabels, setShowLabels] = useState(false)
  const [showGeoInativas, setShowGeoInativas] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [leafletReady, setLeafletReady] = useState(false)
  const [showLegend, setShowLegend] = useState(false)
  const [mapZoom, setMapZoom] = useState(7)

  useEffect(() => {
    import('leaflet').then(mod => { L = mod.default; setLeafletReady(true) })
  }, [])

  useEffect(() => {
    if (!mapInstance.current) return
    setTimeout(() => mapInstance.current.invalidateSize(), 200)
  }, [isFullscreen])

  const { rows, meses } = useMemo(() => {
    if (!excelData) return { rows: [], meses: [] }
    return processExcelData(excelData.data) || { rows: [], meses: [] }
  }, [excelData])

  const baseRows = useMemo(() => filterRowsByRole(rows, session), [rows, session])

  const cidadesMap = useMemo(() => {
    const map = {}
    for (const r of rows) {
      if (r.latitude && r.longitude && r.cidade) {
        const k = normalizeStr(r.cidade)
        if (!map[k]) map[k] = { lat: r.latitude, lng: r.longitude }
      }
    }
    return map
  }, [rows])

  const equipeOptions = useMemo(() => {
    const grSet = [...new Set(baseRows.map(r => r.gr))].sort()
    return grSet.map(gr => {
      const e = equipesList.find(eq => String(eq.cod_equipe) === String(gr))
      return {
        gr,
        nome: e?.nome || 'Equipe ' + gr,
        geoAtivo: e ? (e.ativo ? 1 : 0) : 1,
      }
    })
  }, [baseRows, equipesList])

  const visibleEquipes = useMemo(() => {
    if (showGeoInativas) return equipeOptions
    return equipeOptions.filter(e => e.geoAtivo === 1)
  }, [equipeOptions, showGeoInativas])

  function handleShowGeoInativas(show) {
    setShowGeoInativas(show)
    setFilterGrs([])
  }

  const mapData = useMemo(() => {
    const activeGrs = new Set(visibleEquipes.map(e => e.gr))
    let data = baseRows.filter(r => activeGrs.has(r.gr))
    if (filterGrs.length > 0) data = data.filter(r => filterGrs.includes(r.gr))
    return calcMapData(data, meses, equipesList, diasBloqueio, diasInativacao)
  }, [baseRows, meses, equipesList, filterGrs, visibleEquipes, diasBloqueio, diasInativacao])

  // Cores estáveis por equipe — índice garante máxima distinção visual
  const teamColors = useMemo(() => {
    const grs = [...new Set(mapData.map(e => e.gr))].sort()
    return Object.fromEntries(grs.map((gr, i) => [gr, TEAM_PALETTE[i % TEAM_PALETTE.length]]))
  }, [mapData])

  // Modo agrupado = nenhuma equipe específica selecionada
  const isGroupedMode = filterGrs.length === 0

  // Agrupamento por EQUIPE+CIDADE: 1 pin por equipe por cidade (cada equipe tem sua cor)
  const teamCityData = useMemo(() => {
    if (!isGroupedMode) return []
    const map = new Map()
    mapData.forEach(entry => {
      const k = `${entry.gr}::${entry.cidade}`
      if (!map.has(k)) {
        map.set(k, {
          gr: entry.gr,
          equipeNome: entry.equipeNome,
          cidade: entry.cidade,
          vendedores: [],
          ativos: 0,
          bloqueados: 0,
          inativos: 0,
          fatMesAtual: 0,
        })
      }
      const g = map.get(k)
      g.vendedores.push(entry)
      g.ativos += entry.ativos
      g.bloqueados += entry.bloqueados
      g.inativos += entry.inativos
      g.fatMesAtual += entry.fatMesAtual
    })
    return [...map.values()]
  }, [mapData, isGroupedMode])

  // Grupos visíveis por nível de zoom — revela progressivamente ao aproximar
  const visibleCityData = useMemo(() => {
    if (!isGroupedMode || teamCityData.length === 0) return []
    const sorted = [...teamCityData].sort((a, b) => b.fatMesAtual - a.fatMesAtual)
    const limits = { 4: 20, 5: 30, 6: 50, 7: 100, 8: 200, 9: 400, 10: 700, 11: Infinity, 12: Infinity }
    const cap = limits[Math.min(Math.max(mapZoom, 4), 12)] ?? Infinity
    return sorted.slice(0, cap)
  }, [teamCityData, mapZoom, isGroupedMode])

  // true = cores por vendedor individual (equipe única filtrada)
  const colorPorVendedor = useMemo(() => {
    return new Set(mapData.map(e => e.gr)).size <= 1
  }, [mapData])

  useEffect(() => {
    if (!leafletReady || !mapRef.current || mapInstance.current) return
    mapInstance.current = L.map(mapRef.current, {
      center: BRASIL_CENTER,
      zoom: 5,
      minZoom: 4,
      maxZoom: 14,
      preferCanvas: true,
    })
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 18,
    }).addTo(mapInstance.current)
    mapInstance.current.on('zoomend', () => {
      setMapZoom(mapInstance.current.getZoom())
    })
  }, [leafletReady])

  useEffect(() => {
    if (!leafletReady || !mapInstance.current) return

    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    markersRef.current.forEach(m => m.remove())
    markersRef.current = []

    const layerGroup = L.layerGroup().addTo(mapInstance.current)
    markersRef.current = [layerGroup]

    if (isGroupedMode) {
      // ── Modo agrupado: 1 pin por equipe+cidade, cor da equipe ──────────────
      const groupPopupHtml = group => {
        const color = teamColors[group.gr] || '#888'
        const vendHtml = group.vendedores.map(v => {
          const tm = v.ativos > 0 ? v.fatMesAtual / v.ativos : 0
          return `
            <div style="padding:5px 0 3px 10px;border-left:2px solid ${color};">
              <div style="font-size:12px;color:#f9fafb;font-weight:600;">[${v.rca}] ${v.nome}</div>
              <div style="font-size:11px;color:#9ca3af;display:flex;gap:6px;flex-wrap:wrap;margin-top:2px;">
                <span style="color:#10b981;">🟢 ${v.ativos}</span>
                <span style="color:#f59e0b;">🟡 ${v.bloqueados}</span>
                <span style="color:#ef4444;">🔴 ${v.inativos}</span>
                · ${formatCurrency(v.fatMesAtual)}
                · méd ${formatCurrency(tm)}
              </div>
            </div>`
        }).join('')

        return `
          <div style="font-family:Inter,sans-serif;min-width:230px;max-width:290px;">
            <div style="font-weight:700;font-size:14px;color:#f9fafb;margin-bottom:2px;">${group.equipeNome}</div>
            <div style="color:#9ca3af;font-size:12px;margin-bottom:5px;">${group.cidade} · ${group.vendedores.length} vendedor${group.vendedores.length > 1 ? 'es' : ''}</div>
            <div style="font-size:12px;margin-bottom:4px;">
              <span style="color:#10b981;">🟢 ${group.ativos}</span>&nbsp;
              <span style="color:#f59e0b;">🟡 ${group.bloqueados}</span>&nbsp;
              <span style="color:#ef4444;">🔴 ${group.inativos}</span>&nbsp;
              · <span style="color:#f9fafb;font-weight:600;">${formatCurrency(group.fatMesAtual)}</span>
            </div>
            <div style="border-top:1px solid #1f2937;padding-top:3px;">
              ${vendHtml}
            </div>
          </div>`
      }

      const prepared = []
      visibleCityData.forEach(group => {
        const coords = cidadesMap[normalizeStr(group.cidade)]
        if (!coords) return
        const j = jitterTeam(group.gr)
        const color = teamColors[group.gr] || TEAM_PALETTE[0]
        const size = Math.min(42, Math.max(22, Math.log10(group.fatMesAtual + 1) * 7 + 16))
        prepared.push({ group, lat: coords.lat + j.lat, lng: coords.lng + j.lng, color, size })
      })

      // Espaço reservado no auto-pan pra o popup nunca abrir atrás do cabeçalho/
      // barra de filtros (fixos no topo, inclusive a barra flutuante da tela cheia).
      const HOVER_OPEN_DELAY = 150 // ms — evita rajada de openPopup ao passar o mouse rápido por equipes próximas
      const popupOpts = {
        maxWidth: 300,
        autoPan: true,
        autoPanPaddingTopLeft: L.point(20, 110),
        autoPanPaddingBottomRight: L.point(20, 20),
      }

      const CHUNK = 300
      let i = 0
      function addGroupChunk() {
        const end = Math.min(i + CHUNK, prepared.length)
        for (; i < end; i++) {
          const { group, lat, lng, color, size } = prepared[i]
          const marker = L.marker([lat, lng], { icon: createCityIcon(L, color, size) })
          marker.bindPopup(groupPopupHtml(group), popupOpts)
          let hoverTimer = null
          marker.on('mouseover', function () {
            clearTimeout(hoverTimer)
            const m = this
            hoverTimer = setTimeout(() => { if (m._map) m.openPopup() }, HOVER_OPEN_DELAY)
          })
          marker.on('mouseout', function () {
            clearTimeout(hoverTimer)
            this.closePopup()
          })
          layerGroup.addLayer(marker)
        }
        if (i < prepared.length) rafRef.current = requestAnimationFrame(addGroupChunk)
      }
      addGroupChunk()
    } else {
      // ── Modo individual: pins por vendedor (comportamento original) ────────
      const popupHtml = entry => `
        <div style="font-family:Inter,sans-serif;min-width:210px;">
          <div style="font-weight:700;font-size:14px;margin-bottom:2px;color:#f9fafb;">[RCA ${entry.rca}] ${entry.nome}</div>
          <div style="color:#9ca3af;font-size:12px;margin-bottom:8px;">${entry.equipeNome} • ${entry.cidade}</div>
          <div style="border-top:1px solid #1f2937;padding-top:8px;display:flex;flex-direction:column;gap:5px;">
            <div style="display:flex;align-items:center;gap:6px;font-size:13px;"><span style="width:8px;height:8px;border-radius:50%;background:#10b981;display:inline-block;"></span><span style="color:#f9fafb;">🟢 ${entry.ativos} ativos</span></div>
            <div style="display:flex;align-items:center;gap:6px;font-size:13px;"><span style="width:8px;height:8px;border-radius:50%;background:#f59e0b;display:inline-block;"></span><span style="color:#f9fafb;">🟡 ${entry.bloqueados} bloqueados</span></div>
            <div style="display:flex;align-items:center;gap:6px;font-size:13px;"><span style="width:8px;height:8px;border-radius:50%;background:#ef4444;display:inline-block;"></span><span style="color:#f9fafb;">🔴 ${entry.inativos} inativos</span></div>
            <div style="border-top:1px solid #1f2937;padding-top:6px;margin-top:2px;">
              <span style="color:#9ca3af;font-size:12px;">Fat. Mês Atual: </span>
              <span style="color:#f9fafb;font-size:13px;font-weight:600;">${formatCurrency(entry.fatMesAtual)}</span>
            </div>
          </div>
        </div>`

      const prepared = []
      mapData.forEach(entry => {
        const coords = cidadesMap[normalizeStr(entry.cidade)]
        if (!coords) return
        const j = jitter(entry.rca)
        prepared.push({
          entry,
          lat: coords.lat + j.lat,
          lng: coords.lng + j.lng,
          color: colorPorVendedor ? hashColor('v' + entry.rca) : (teamColors[entry.gr] || hashColor(entry.gr)),
          size: Math.min(48, Math.max(28, Math.log10(entry.fatMesAtual + 1) * 8 + 20)),
        })
      })

      const CHUNK = 300
      let i = 0
      function addChunk() {
        const end = Math.min(i + CHUNK, prepared.length)
        for (; i < end; i++) {
          const { entry, lat, lng, color, size } = prepared[i]
          const marker = L.marker([lat, lng], { icon: createRcaIcon(L, entry.rca, color, size) })
          marker.bindPopup(() => popupHtml(entry), { maxWidth: 260 })

          if (showLabels) {
            const lbl = L.divIcon({
              html: `<div style="color:#e2e8f0;font-size:10px;font-weight:600;white-space:nowrap;text-shadow:0 1px 3px #000;font-family:Inter,sans-serif;">${entry.nome.split(' ')[0]}</div>`,
              className: '',
              iconAnchor: [0, size / 2 + 6],
            })
            layerGroup.addLayer(L.marker([lat, lng], { icon: lbl, interactive: false }))
          }

          layerGroup.addLayer(marker)
        }
        if (i < prepared.length) rafRef.current = requestAnimationFrame(addChunk)
      }
      addChunk()
    }

    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [mapData, leafletReady, showLabels, cidadesMap, colorPorVendedor, isGroupedMode, visibleCityData, teamColors])

  if (!excelData) return <div className="p-4 md:p-6 text-text-secondary">Sem dados carregados.</div>

  const pinLabel = isGroupedMode
    ? `${visibleCityData.length} de ${teamCityData.length} grupos · zoom para ver mais`
    : `${mapData.length} pins`

  const legendaEquipes = visibleEquipes.filter(e => teamColors[e.gr])

  const controls = (
    <>
      {isMaster && (
        <MultiSelectEquipes equipes={visibleEquipes} selected={filterGrs} onChange={setFilterGrs} />
      )}
      {isGroupedMode && isMaster && (
        <div className="self-end">
          <label className="block text-xs text-text-secondary mb-1">Legenda</label>
          <button
            onClick={() => setShowLegend(s => !s)}
            className={`flex items-center gap-2 border text-sm rounded-lg px-3 py-2 transition-colors ${
              showLegend
                ? 'bg-accent-blue/10 border-accent-blue/50 text-accent-blue'
                : 'bg-bg-tertiary border-border-color text-text-secondary hover:border-accent-blue/50'
            }`}
          >
            <Layers size={14} />
            Legenda
          </button>
        </div>
      )}
      <label className="flex items-center gap-2 text-sm text-text-secondary cursor-pointer self-end pb-2">
        <input type="checkbox" checked={showLabels} onChange={e => setShowLabels(e.target.checked)} className="accent-accent-blue" />
        Exibir labels
      </label>
      {isMaster && (
        <label className="flex items-center gap-2 text-sm text-text-secondary cursor-pointer self-end pb-2">
          <input type="checkbox" checked={showGeoInativas} onChange={e => handleShowGeoInativas(e.target.checked)} className="accent-accent-amber" />
          Incluir equipes inativas
        </label>
      )}
    </>
  )

  const mapContainer = (
    <div className={
      isFullscreen
        ? 'fixed inset-0 z-50'
        : 'flex-1 relative rounded-xl border border-border-color min-h-[500px]'
    }>
      <div ref={mapRef} className="absolute inset-0" />

      {isFullscreen && (
        <div className="absolute top-0 left-0 right-0 z-[1100] bg-bg-primary/85 backdrop-blur-sm px-4 py-2 flex items-center gap-4 border-b border-border-color/50">
          <div className="shrink-0">
            <p className="text-sm font-bold text-text-primary">Geolocalização</p>
            <p className="text-xs text-text-secondary">{pinLabel}</p>
          </div>
          <div className="flex items-center gap-3 flex-1 flex-wrap">
            {controls}
          </div>
          <button
            onClick={() => setIsFullscreen(false)}
            className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 bg-bg-secondary border border-border-color rounded-lg text-xs text-text-secondary hover:text-text-primary hover:bg-bg-tertiary transition-colors"
          >
            <Minimize2 size={13} /> Minimizar
          </button>
        </div>
      )}

      {/* Legenda de status + botão fullscreen */}
      <div className="absolute bottom-4 right-4 z-[1000] flex flex-col items-end gap-2">
        <button
          onClick={() => setIsFullscreen(f => !f)}
          title={isFullscreen ? 'Sair da tela cheia' : 'Tela cheia'}
          className="bg-bg-secondary/90 border border-border-color rounded-lg p-2 hover:bg-bg-tertiary transition-colors backdrop-blur-sm"
        >
          {isFullscreen
            ? <Minimize2 size={15} className="text-text-secondary" />
            : <Maximize2 size={15} className="text-text-secondary" />}
        </button>
        <div className="bg-bg-secondary/90 border border-border-color rounded-lg p-3 text-xs space-y-1.5 backdrop-blur-sm">
          <p className="text-text-secondary font-medium mb-2">Status</p>
          <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-accent-green" /><span className="text-text-secondary">Ativos</span></div>
          <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-accent-amber" /><span className="text-text-secondary">Bloqueados</span></div>
          <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-accent-red" /><span className="text-text-secondary">Inativos</span></div>
          <div className="border-t border-border-color pt-1.5 text-text-secondary/70">
            {isGroupedMode ? 'Pin = cidade · Hover = detalhes' : 'Pin = código RCA'}
          </div>
          <div className="text-text-secondary/70">
            {isGroupedMode
              ? 'Cor = equipe dominante · Tamanho = fat.'
              : `Cor = ${colorPorVendedor ? 'vendedor' : 'equipe'} · Tamanho = fat.`}
          </div>
        </div>
      </div>

      {/* Legenda móvel de equipes (apenas no modo agrupado) */}
      {showLegend && isGroupedMode && (
        <DraggableLegend
          teamColors={teamColors}
          equipes={legendaEquipes}
          onClose={() => setShowLegend(false)}
        />
      )}
    </div>
  )

  return (
    <div className="p-4 md:p-6 h-full flex flex-col animate-fade-in">
      <PageHeader title="Geolocalização" subtitle={pinLabel} />

      <FiltrosBar onClear={() => { setFilterGrs([]); setShowLabels(false); setShowGeoInativas(false); setShowLegend(false) }}>
        {controls}
      </FiltrosBar>

      {mapContainer}
    </div>
  )
}
