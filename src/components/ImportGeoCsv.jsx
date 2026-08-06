import React, { useEffect, useRef, useState } from 'react'
import { Upload, Loader2, FileSpreadsheet, CheckCircle, AlertCircle } from 'lucide-react'
import { supabase } from '../lib/supabaseClient'

const MESES_LABEL = ['', 'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']

function formatMesReferencia(mesRef) {
  if (!mesRef) return ''
  const [ano, mes] = mesRef.split('-')
  return `${MESES_LABEL[Number(mes)]}/${ano}`
}

export default function ImportGeoCsv({ session, onImported }) {
  const [history, setHistory] = useState([])
  const [file, setFile] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [result, setResult] = useState(null)
  const inputRef = useRef()

  const loadHistory = async () => {
    const { data } = await supabase
      .from('uploads_geo')
      .select('id, filename, status, row_count, error_msg, uploaded_at, mes_referencia')
      .eq('company_id', session.company_id)
      .order('uploaded_at', { ascending: false })
      .limit(5)
    setHistory(data || [])
  }

  useEffect(() => { loadHistory() }, [])

  async function handleUpload() {
    if (!file) return
    setUploading(true)
    setResult(null)
    const formData = new FormData()
    formData.append('file', file)
    try {
      const res = await fetch('/api/geo?action=import', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.token}` },
        body: formData,
      })
      const json = await res.json()
      if (json.ok) {
        setResult({ ok: true, msg: `${json.rowCount} municípios · ${json.setoresCount} setores/rotas · referência ${formatMesReferencia(json.mesReferencia)}` })
        setFile(null)
        onImported?.()
      } else {
        setResult({ ok: false, msg: json.error || 'Erro desconhecido' })
      }
    } catch (e) {
      setResult({ ok: false, msg: e.message })
    }
    setUploading(false)
    loadHistory()
  }

  return (
    <div className="space-y-6">
      <div
        onClick={() => inputRef.current?.click()}
        className="border-2 border-dashed rounded-xl p-10 text-center cursor-pointer border-border-color hover:border-accent-blue/50 hover:bg-bg-tertiary transition-colors"
      >
        <input ref={inputRef} type="file" accept=".csv" className="hidden" onChange={e => setFile(e.target.files[0] || null)} />
        <FileSpreadsheet size={36} className="mx-auto mb-3 text-text-secondary" />
        {file ? (
          <div>
            <p className="text-text-primary font-medium">{file.name}</p>
            <p className="text-xs text-text-secondary mt-1">clique para trocar</p>
          </div>
        ) : (
          <div>
            <p className="text-text-primary font-medium">Arraste o CSV aqui ou clique para selecionar</p>
            <p className="text-xs text-text-secondary mt-1">Colunas: SETORES/ROTAS;REGIAO;MUNICIPIO;M. TRIMESTRE;&lt;mês&gt;</p>
          </div>
        )}
      </div>

      <div className="bg-accent-red/10 border border-accent-red/30 rounded-xl px-4 py-3 text-sm text-accent-red">
        O import <strong>substitui todos os dados</strong> desta geolocalização. Setores/rotas existentes são preservados.
      </div>

      <button
        onClick={handleUpload}
        disabled={!file || uploading}
        className="flex items-center gap-2 px-6 py-2.5 bg-accent-blue text-white text-sm rounded-lg font-medium hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {uploading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
        {uploading ? 'Importando...' : 'Importar CSV'}
      </button>

      {result && (
        <div className={`flex items-start gap-3 p-4 rounded-xl border ${result.ok ? 'bg-accent-green/10 border-accent-green/30 text-accent-green' : 'bg-accent-red/10 border-accent-red/30 text-accent-red'}`}>
          {result.ok ? <CheckCircle size={18} className="flex-shrink-0 mt-0.5" /> : <AlertCircle size={18} className="flex-shrink-0 mt-0.5" />}
          <p className="text-sm">{result.msg}</p>
        </div>
      )}

      {history.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-text-primary mb-3">Histórico de Imports</h3>
          <div className="bg-bg-secondary border border-border-color rounded-xl overflow-hidden overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border-color">
                  {['Arquivo', 'Linhas', 'Status', 'Referência', 'Data'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-text-secondary font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {history.map(h => (
                  <tr key={h.id} className="border-b border-border-color/50 hover:bg-bg-tertiary/50">
                    <td className="px-4 py-3 text-text-primary truncate max-w-xs" title={h.filename}>{h.filename}</td>
                    <td className="px-4 py-3 text-text-secondary">{h.row_count ?? '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs ${h.status === 'ok' ? 'bg-accent-green/20 text-accent-green' : 'bg-accent-red/20 text-accent-red'}`}>
                        {h.status === 'ok' ? 'Sucesso' : 'Erro'}
                      </span>
                      {h.error_msg && <p className="text-xs text-accent-red mt-1 truncate max-w-xs" title={h.error_msg}>{h.error_msg}</p>}
                    </td>
                    <td className="px-4 py-3 text-text-secondary text-xs">{formatMesReferencia(h.mes_referencia)}</td>
                    <td className="px-4 py-3 text-text-secondary text-xs">{new Date(h.uploaded_at).toLocaleString('pt-BR')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
