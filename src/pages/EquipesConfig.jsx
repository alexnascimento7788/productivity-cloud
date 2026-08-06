import React, { useState } from 'react'
import { Edit2, Loader2, Save, X, Check } from 'lucide-react'
import { useAuth, useData } from '../App'
import { supabase } from '../lib/supabaseClient'
import PageHeader from '../components/PageHeader'

const inputCls = "w-full bg-bg-tertiary border border-border-color text-text-primary text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-accent-blue"

export default function EquipesConfig() {
  const { effectiveCompanyId } = useAuth()
  const { equipesList, reloadCidades } = useData()
  const [editing, setEditing] = useState(null)   // cod_equipe em edição
  const [nomeEdit, setNomeEdit] = useState('')
  const [saving, setSaving] = useState(false)
  const [feedback, setFeedback] = useState('')

  function startEdit(eq) {
    setEditing(eq.cod_equipe)
    setNomeEdit(eq.nome)
    setFeedback('')
  }

  async function handleSave(eq) {
    if (!nomeEdit.trim()) return
    setSaving(true)
    const { error } = await supabase
      .from('equipes')
      .update({ nome: nomeEdit.trim() })
      .eq('company_id', effectiveCompanyId)
      .eq('cod_equipe', eq.cod_equipe)
    setSaving(false)
    if (error) { setFeedback('Erro: ' + error.message); return }
    setEditing(null)
    setFeedback('Equipe atualizada.')
    reloadCidades()
  }

  async function handleToggle(eq) {
    const { error } = await supabase
      .from('equipes')
      .update({ ativo: !eq.ativo })
      .eq('company_id', effectiveCompanyId)
      .eq('cod_equipe', eq.cod_equipe)
    if (error) { setFeedback('Erro: ' + error.message); return }
    reloadCidades()
  }

  return (
    <div className="p-4 md:p-6 animate-fade-in">
      <PageHeader
        title="Relacionar Equipes"
        subtitle="Associe o código da planilha ao nome da equipe. Equipes inativas saem do mapa."
      />

      {feedback && (
        <p className={`text-sm mb-4 ${feedback.startsWith('Erro') ? 'text-accent-red' : 'text-accent-green'}`}>{feedback}</p>
      )}

      {equipesList.length === 0 ? (
        <div className="bg-bg-secondary border border-border-color rounded-xl p-6 text-sm text-text-secondary">
          Nenhuma equipe encontrada. As equipes são criadas automaticamente ao importar a planilha.
        </div>
      ) : (
        <div className="bg-bg-secondary border border-border-color rounded-xl overflow-hidden overflow-x-auto max-w-3xl">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border-color">
                {['Código', 'Nome da Equipe', 'Status', 'Ações'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-text-secondary font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {equipesList.map(eq => (
                <tr key={eq.cod_equipe} className="border-b border-border-color/50 hover:bg-bg-tertiary/50">
                  <td className="px-4 py-3 font-mono text-text-primary">{eq.cod_equipe}</td>
                  <td className="px-4 py-3">
                    {editing === eq.cod_equipe ? (
                      <input
                        value={nomeEdit}
                        onChange={e => setNomeEdit(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') handleSave(eq); if (e.key === 'Escape') setEditing(null) }}
                        className={inputCls}
                        autoFocus
                      />
                    ) : (
                      <span className="text-text-primary">{eq.nome}</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => handleToggle(eq)}
                      className={`px-2 py-0.5 rounded-full text-xs cursor-pointer transition-colors ${
                        eq.ativo
                          ? 'bg-accent-green/20 text-accent-green hover:bg-accent-red/20 hover:text-accent-red'
                          : 'bg-accent-red/20 text-accent-red hover:bg-accent-green/20 hover:text-accent-green'
                      }`}
                    >
                      {eq.ativo ? 'Ativo' : 'Inativo'}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    {editing === eq.cod_equipe ? (
                      <div className="flex gap-1">
                        <button onClick={() => handleSave(eq)} disabled={saving} className="text-accent-green hover:bg-accent-green/10 p-1.5 rounded">
                          {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                        </button>
                        <button onClick={() => setEditing(null)} className="text-text-secondary hover:bg-bg-tertiary p-1.5 rounded">
                          <X size={14} />
                        </button>
                      </div>
                    ) : (
                      <button onClick={() => startEdit(eq)} className="text-text-secondary hover:text-accent-blue p-1.5 rounded">
                        <Edit2 size={14} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
