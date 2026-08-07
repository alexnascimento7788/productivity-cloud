import React, { useMemo, useState } from 'react'
import { MapPin, Search, Loader2, Check, RefreshCw, AlertTriangle } from 'lucide-react'
import { useAuth, useData } from '../App'
import { supabase } from '../lib/supabaseClient'
import PageHeader from '../components/PageHeader'

const inputCls = "w-full bg-bg-tertiary border border-border-color text-text-primary text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-accent-blue"

function normalizeStr(s) {
  return String(s || '').toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim()
}

// Busca incremental na base IBGE + seleção do município
function IbgePicker({ onSelect, busy }) {
  const [term, setTerm] = useState('')
  const [results, setResults] = useState([])
  const [searching, setSearching] = useState(false)

  async function handleSearch(value) {
    setTerm(value)
    if (value.trim().length < 3) { setResults([]); return }
    setSearching(true)
    const { data } = await supabase
      .from('cidades_ibge')
      .select('codigo_ibge, nome, uf')
      .ilike('nome_norm', `%${normalizeStr(value)}%`)
      .order('nome')
      .limit(15)
    setResults(data || [])
    setSearching(false)
  }

  return (
    <div className="relative">
      <div className="relative">
        <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-secondary" />
        <input
          value={term}
          onChange={e => handleSearch(e.target.value)}
          placeholder="Buscar município IBGE..."
          className={inputCls + ' pl-8'}
          disabled={busy}
        />
      </div>
      {term.trim().length >= 3 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-bg-primary border border-border-color rounded-lg shadow-xl z-20 max-h-52 overflow-y-auto">
          {searching ? (
            <div className="px-3 py-2 text-xs text-text-secondary flex items-center gap-2"><Loader2 size={12} className="animate-spin" /> Buscando...</div>
          ) : results.length === 0 ? (
            <div className="px-3 py-2 text-xs text-text-secondary">Nenhum município encontrado.</div>
          ) : results.map(c => (
            <button
              key={c.codigo_ibge}
              onClick={() => { onSelect(c); setTerm(''); setResults([]) }}
              className="w-full text-left px-3 py-2 text-sm text-text-secondary hover:bg-bg-tertiary hover:text-text-primary flex justify-between"
            >
              <span>{c.nome}</span>
              <span className="text-xs text-text-secondary/60">{c.uf}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// Entrada de lat/lon para cidades fora da base IBGE (distritos, povoados...)
function ManualCoords({ onSave, busy }) {
  const [lat, setLat] = useState('')
  const [lng, setLng] = useState('')
  const latN = Number(String(lat).replace(',', '.'))
  const lngN = Number(String(lng).replace(',', '.'))
  const valid = lat !== '' && lng !== '' && !isNaN(latN) && !isNaN(lngN) &&
    latN >= -35 && latN <= 6 && lngN >= -75 && lngN <= -28 // limites aproximados do Brasil

  return (
    <div className="flex items-center gap-2">
      <input value={lat} onChange={e => setLat(e.target.value)} placeholder="Latitude (-19.92)" className={inputCls + ' w-32'} disabled={busy} />
      <input value={lng} onChange={e => setLng(e.target.value)} placeholder="Longitude (-43.94)" className={inputCls + ' w-32'} disabled={busy} />
      <button
        onClick={() => valid && onSave(latN, lngN)}
        disabled={!valid || busy}
        className="px-3 py-2 text-xs bg-accent-blue text-white rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-40"
      >
        Salvar
      </button>
    </div>
  )
}

export default function Cidades() {
  const { effectiveCompanyId } = useAuth()
  const { cidadesDepara, reloadCidades, loadingData } = useData()
  const [busyCity, setBusyCity] = useState(null)
  const [feedback, setFeedback] = useState('')
  const [remapping, setRemapping] = useState(null)   // cidade_origem sendo remapeada
  const [coordMode, setCoordMode] = useState(null)   // cidade_origem em modo coordenadas manuais
  const [busca, setBusca] = useState('')

  const pendentes = useMemo(
    () => cidadesDepara.filter(d => !d.codigo_ibge && d.latitude == null),
    [cidadesDepara]
  )
  const mapeadas = useMemo(() => {
    let list = cidadesDepara.filter(d => d.codigo_ibge || d.latitude != null)
    if (busca.trim()) {
      const termo = normalizeStr(busca)
      list = list.filter(d =>
        normalizeStr(d.cidade_origem).includes(termo) ||
        normalizeStr(d.cidades_ibge?.nome).includes(termo)
      )
    }
    return list.sort((a, b) => a.cidade_origem.localeCompare(b.cidade_origem))
  }, [cidadesDepara, busca])

  async function aplicarUpdate(depara, updates, okMsg) {
    setBusyCity(depara.cidade_origem)
    setFeedback('')
    const { error } = await supabase
      .from('cidades_depara')
      .update(updates)
      .eq('company_id', effectiveCompanyId)
      .eq('cidade_origem', depara.cidade_origem)
    setBusyCity(null)
    setRemapping(null)
    setCoordMode(null)
    if (error) { setFeedback('Erro: ' + error.message); return }
    setFeedback(okMsg)
    reloadCidades()
  }

  function vincular(depara, cidadeIbge) {
    // vincular ao IBGE limpa coordenadas manuais anteriores
    aplicarUpdate(
      depara,
      { codigo_ibge: cidadeIbge.codigo_ibge, status: 'manual', latitude: null, longitude: null },
      `"${depara.cidade_origem}" vinculada a ${cidadeIbge.nome}/${cidadeIbge.uf}.`
    )
  }

  function salvarCoords(depara, lat, lng) {
    aplicarUpdate(
      depara,
      { codigo_ibge: null, status: 'manual', latitude: lat, longitude: lng },
      `"${depara.cidade_origem}" com coordenadas manuais (${lat}, ${lng}).`
    )
  }

  return (
    <div className="p-4 md:p-6 animate-fade-in">
      <PageHeader
        title="Tratamento de Cidades"
        subtitle="De/Para entre as cidades do ERP e a base de municípios do IBGE (coordenadas do mapa)"
        action={
          <button
            onClick={reloadCidades}
            disabled={loadingData}
            className="flex items-center gap-2 px-4 py-2 text-sm bg-bg-secondary border border-border-color rounded-lg text-text-secondary hover:text-text-primary hover:bg-bg-tertiary transition-colors disabled:opacity-50"
          >
            <RefreshCw size={14} className={loadingData ? 'animate-spin' : ''} /> Atualizar
          </button>
        }
      />

      {feedback && (
        <p className={`text-sm mb-4 ${feedback.startsWith('Erro') ? 'text-accent-red' : 'text-accent-green'}`}>{feedback}</p>
      )}

      {/* Pendentes */}
      <div className="mb-8">
        <h3 className="text-sm font-semibold text-text-primary mb-3 flex items-center gap-2">
          <AlertTriangle size={15} className={pendentes.length ? 'text-accent-amber' : 'text-accent-green'} />
          Lista de Tratamento — {pendentes.length} cidade{pendentes.length !== 1 ? 's' : ''} sem correspondência
        </h3>
        {pendentes.length === 0 ? (
          <div className="bg-bg-secondary border border-border-color rounded-xl p-5 text-sm text-accent-green flex items-center gap-2">
            <Check size={15} /> Todas as cidades estão vinculadas à base IBGE.
          </div>
        ) : (
          <div className="bg-bg-secondary border border-border-color rounded-xl overflow-visible">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border-color">
                  {['Cidade (ERP)', 'Modo', 'Vincular ao município IBGE ou informar coordenadas'].map((h, i) => (
                    <th key={i} className="px-4 py-3 text-left text-text-secondary font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pendentes.map(d => (
                  <tr key={d.cidade_origem} className="border-b border-border-color/50">
                    <td className="px-4 py-3 text-text-primary font-medium align-top">{d.cidade_origem}</td>
                    <td className="px-4 py-3 w-[200px] align-top">
                      <div className="inline-flex rounded-lg border border-border-color overflow-hidden text-xs">
                        <button
                          onClick={() => setCoordMode(null)}
                          disabled={!!busyCity}
                          className={`px-2.5 py-1.5 transition-colors ${coordMode !== d.cidade_origem ? 'bg-accent-blue text-white' : 'text-text-secondary hover:bg-bg-tertiary'}`}
                        >
                          Buscar no IBGE
                        </button>
                        <button
                          onClick={() => setCoordMode(d.cidade_origem)}
                          disabled={!!busyCity}
                          className={`px-2.5 py-1.5 transition-colors ${coordMode === d.cidade_origem ? 'bg-accent-blue text-white' : 'text-text-secondary hover:bg-bg-tertiary'}`}
                        >
                          Não é município (distrito/povoado)
                        </button>
                      </div>
                    </td>
                    <td className="px-4 py-3 w-[340px]">
                      {busyCity === d.cidade_origem ? (
                        <div className="flex items-center gap-2 text-xs text-text-secondary"><Loader2 size={13} className="animate-spin" /> Salvando...</div>
                      ) : coordMode === d.cidade_origem ? (
                        <div className="space-y-1.5">
                          <p className="text-xs text-text-secondary">Informe a lat/lon manualmente (ex: coordenadas do Google Maps) — para distritos, povoados e localidades que não têm código IBGE próprio.</p>
                          <ManualCoords onSave={(lat, lng) => salvarCoords(d, lat, lng)} busy={!!busyCity} />
                        </div>
                      ) : (
                        <IbgePicker onSelect={c => vincular(d, c)} busy={!!busyCity} />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Mapeadas */}
      <div>
        <div className="flex items-center justify-between gap-4 mb-3 flex-wrap">
          <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2">
            <MapPin size={15} className="text-accent-blue" />
            Cidades vinculadas — {mapeadas.length}
          </h3>
          <div className="relative w-72">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-secondary" />
            <input
              value={busca}
              onChange={e => setBusca(e.target.value)}
              placeholder="Procurar cidade vinculada..."
              className={inputCls + ' pl-8'}
            />
          </div>
        </div>
        <div className="bg-bg-secondary border border-border-color rounded-xl overflow-visible">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border-color">
                {['Cidade (ERP)', 'Município IBGE', 'UF', 'Origem', 'Ações'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-text-secondary font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {mapeadas.map(d => (
                <tr key={d.cidade_origem} className="border-b border-border-color/50 hover:bg-bg-tertiary/30">
                  <td className="px-4 py-3 text-text-primary">{d.cidade_origem}</td>
                  <td className="px-4 py-3 text-text-secondary">
                    {d.codigo_ibge
                      ? (d.cidades_ibge?.nome || d.codigo_ibge)
                      : <span className="font-mono text-xs">{d.latitude?.toFixed(4)}, {d.longitude?.toFixed(4)}</span>}
                  </td>
                  <td className="px-4 py-3 text-text-secondary">{d.cidades_ibge?.uf || '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs ${
                      !d.codigo_ibge ? 'bg-accent-amber/20 text-accent-amber'
                      : d.status === 'auto' ? 'bg-accent-blue/20 text-accent-blue'
                      : 'bg-accent-green/20 text-accent-green'
                    }`}>
                      {!d.codigo_ibge ? 'Coordenada manual' : d.status === 'auto' ? 'Automático' : 'Manual'}
                    </span>
                  </td>
                  <td className="px-4 py-3 w-[300px]">
                    {remapping === d.cidade_origem ? (
                      <IbgePicker onSelect={c => vincular(d, c)} busy={!!busyCity} />
                    ) : (
                      <button
                        onClick={() => setRemapping(d.cidade_origem)}
                        className="text-xs text-text-secondary hover:text-accent-blue"
                      >
                        Reatribuir
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
