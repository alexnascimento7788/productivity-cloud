import React, { useEffect, useState, useRef, useCallback } from 'react'
import { Upload, Loader2, CheckCircle, AlertCircle, FileSpreadsheet, Trash2 } from 'lucide-react'
import { useAuth, useData } from '../App'
import { supabase } from '../lib/supabaseClient'

// Cor da barra: começa vermelha, passa a laranja e termina verde
function barColor(pct) {
  if (pct < 40) return '#ef4444'
  if (pct < 75) return '#f59e0b'
  return '#10b981'
}

export default function ImportPlanilha({ session }) {
  const { reloadExcel } = useData()
  const { effectiveCompanyId } = useAuth()
  const companyId = effectiveCompanyId || session.company_id
  const isMaster = session.role === 'master'
  const [uploads, setUploads] = useState([])
  const [loadingHistory, setLoadingHistory] = useState(true)
  const [dragging, setDragging] = useState(false)
  const [file, setFile] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState('')
  const [pct, setPct] = useState(0)
  const [result, setResult] = useState(null)
  const inputRef = useRef()
  const trickleRef = useRef(null)

  const loadHistory = useCallback(async () => {
    if (!companyId) return
    setLoadingHistory(true)
    const { data } = await supabase
      .from('uploads')
      .select('id, filename, status, row_count, error_msg, uploaded_at')
      .eq('company_id', companyId)
      .order('uploaded_at', { ascending: false })
      .limit(10)
    setUploads(data || [])
    setLoadingHistory(false)
  }, [companyId])

  // Exclusão de logs de import — exclusivo do perfil master (RLS garante no banco)
  async function handleDeleteUpload(id) {
    const { error } = await supabase.from('uploads').delete().eq('id', id)
    if (error) setResult({ ok: false, msg: 'Erro ao excluir: ' + error.message })
    loadHistory()
  }

  async function handleClearHistory() {
    if (!window.confirm('Apagar TODO o histórico de imports desta empresa?')) return
    const { error } = await supabase.from('uploads').delete().eq('company_id', companyId)
    if (error) setResult({ ok: false, msg: 'Erro ao limpar histórico: ' + error.message })
    loadHistory()
  }

  useEffect(() => { loadHistory() }, [loadHistory])

  useEffect(() => () => clearInterval(trickleRef.current), [])

  function onDrop(e) {
    e.preventDefault()
    setDragging(false)
    const f = e.dataTransfer.files[0]
    if (f) setFile(f)
  }

  // XMLHttpRequest para acompanhar o progresso real do envio;
  // depois do envio a barra avança gradualmente enquanto o servidor processa
  function uploadWithProgress(formData) {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest()
      xhr.open('POST', '/api/upload')
      xhr.setRequestHeader('Authorization', `Bearer ${session.token}`)

      xhr.upload.onprogress = e => {
        if (e.lengthComputable) setPct(Math.round((e.loaded / e.total) * 45))
      }
      xhr.upload.onload = () => {
        setProgress('Processando planilha no servidor...')
        clearInterval(trickleRef.current)
        trickleRef.current = setInterval(() => {
          setPct(p => (p < 92 ? p + 1 : p))
        }, 450)
      }
      xhr.onload = () => {
        clearInterval(trickleRef.current)
        try { resolve(JSON.parse(xhr.responseText)) }
        catch { reject(new Error('Resposta inválida do servidor')) }
      }
      xhr.onerror = () => {
        clearInterval(trickleRef.current)
        reject(new Error('Falha de rede no upload'))
      }
      xhr.send(formData)
    })
  }

  async function handleUpload() {
    if (!file) return
    setUploading(true)
    setProgress('Enviando arquivo...')
    setPct(0)
    setResult(null)

    const formData = new FormData()
    formData.append('file', file)

    try {
      const json = await uploadWithProgress(formData)
      if (json.ok) {
        setPct(100)
        setProgress('Concluído!')
        setResult({ ok: true, msg: `${json.rowCount} linhas importadas — ${json.mesesDetectados} meses detectados.` })
        setFile(null)
        reloadExcel()
        loadHistory()
      } else {
        setResult({ ok: false, msg: json.error || 'Erro desconhecido' })
      }
    } catch (e) {
      setResult({ ok: false, msg: e.message })
    }
    setUploading(false)
  }

  return (
    <div className="space-y-6">
      {/* Drop zone */}
      <div
        onDragOver={e => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors ${
          dragging
            ? 'border-accent-blue bg-accent-blue/10'
            : 'border-border-color hover:border-accent-blue/50 hover:bg-bg-tertiary'
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.xls"
          className="hidden"
          onChange={e => setFile(e.target.files[0] || null)}
        />
        <FileSpreadsheet size={36} className="mx-auto mb-3 text-text-secondary" />
        {file ? (
          <div>
            <p className="text-text-primary font-medium">{file.name}</p>
            <p className="text-xs text-text-secondary mt-1">{(file.size / 1024).toFixed(0)} KB — clique para trocar</p>
          </div>
        ) : (
          <div>
            <p className="text-text-primary font-medium">Arraste a planilha aqui ou clique para selecionar</p>
            <p className="text-xs text-text-secondary mt-1">Arquivos .xlsx ou .xls — máx. 50 MB</p>
          </div>
        )}
      </div>

      {/* Aviso de reimport */}
      <div className="bg-accent-red/10 border border-accent-red/30 rounded-xl px-4 py-3 text-sm text-accent-red">
        Atenção: o import <strong>substitui todos os dados</strong> da empresa. Vendas, clientes e vendedores atuais serão descartados e reimportados do arquivo.
        Nomes de equipes e o de/para de cidades são preservados.
      </div>

      {/* Botão importar */}
      <button
        onClick={handleUpload}
        disabled={!file || uploading}
        className="flex items-center gap-2 px-6 py-2.5 bg-accent-blue text-white text-sm rounded-lg font-medium hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {uploading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
        {uploading ? 'Importando...' : 'Importar Planilha'}
      </button>

      {/* Progress bar */}
      {(uploading || (result?.ok && pct === 100)) && (
        <div className="animate-fade-in">
          <div className="flex items-center justify-between text-xs mb-1.5">
            <span className="text-text-secondary">{progress}</span>
            <span className="font-mono font-semibold" style={{ color: barColor(pct) }}>{pct}%</span>
          </div>
          <div className="h-2.5 bg-bg-tertiary border border-border-color rounded-full overflow-hidden">
            <div
              className="h-full rounded-full"
              style={{
                width: `${pct}%`,
                background: barColor(pct),
                transition: 'width 0.4s ease, background-color 0.6s ease',
              }}
            />
          </div>
        </div>
      )}

      {/* Resultado */}
      {result && (
        <div className={`flex items-start gap-3 p-4 rounded-xl border ${
          result.ok
            ? 'bg-accent-green/10 border-accent-green/30 text-accent-green'
            : 'bg-accent-red/10 border-accent-red/30 text-accent-red'
        }`}>
          {result.ok ? <CheckCircle size={18} className="flex-shrink-0 mt-0.5" /> : <AlertCircle size={18} className="flex-shrink-0 mt-0.5" />}
          <p className="text-sm">{result.msg}</p>
        </div>
      )}

      {/* Histórico de uploads */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-text-primary">Histórico de Imports</h3>
          {isMaster && uploads.length > 0 && (
            <button
              onClick={handleClearHistory}
              className="flex items-center gap-1.5 text-xs text-accent-red hover:bg-accent-red/10 border border-accent-red/30 rounded-lg px-3 py-1.5 transition-colors"
            >
              <Trash2 size={12} /> Limpar histórico
            </button>
          )}
        </div>
        {loadingHistory ? (
          <div className="flex items-center gap-2 text-text-secondary text-sm"><Loader2 size={14} className="animate-spin" /> Carregando...</div>
        ) : uploads.length === 0 ? (
          <p className="text-sm text-text-secondary">Nenhum import realizado ainda.</p>
        ) : (
          <div className="bg-bg-secondary border border-border-color rounded-xl overflow-hidden overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border-color">
                  {['Arquivo', 'Linhas', 'Status', 'Data', ...(isMaster ? ['Ações'] : [])].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-text-secondary font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {uploads.map(u => (
                  <tr key={u.id} className="border-b border-border-color/50 hover:bg-bg-tertiary/50">
                    <td className="px-4 py-3 text-text-primary truncate max-w-xs" title={u.filename}>{u.filename}</td>
                    <td className="px-4 py-3 text-text-secondary">{u.row_count ?? '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs ${
                        u.status === 'ok'
                          ? 'bg-accent-green/20 text-accent-green'
                          : 'bg-accent-red/20 text-accent-red'
                      }`}>
                        {u.status === 'ok' ? 'Sucesso' : 'Erro'}
                      </span>
                      {u.error_msg && <p className="text-xs text-accent-red mt-1 truncate max-w-xs" title={u.error_msg}>{u.error_msg}</p>}
                    </td>
                    <td className="px-4 py-3 text-text-secondary text-xs">
                      {new Date(u.uploaded_at).toLocaleString('pt-BR')}
                    </td>
                    {isMaster && (
                      <td className="px-4 py-3">
                        <button
                          onClick={() => handleDeleteUpload(u.id)}
                          title="Excluir registro"
                          className="text-text-secondary hover:text-accent-red p-1 rounded transition-colors"
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
