import React, { useState } from 'react'
import { useNavigate, Navigate } from 'react-router-dom'
import { KeyRound, Loader2 } from 'lucide-react'
import { useAuth } from '../App'

export default function TrocarSenha() {
  const { session, updateSession, logout } = useAuth()
  const navigate = useNavigate()
  const [senha, setSenha] = useState('')
  const [confirma, setConfirma] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  if (!session) return <Navigate to="/login" replace />
  if (!session.mustChangePassword) return <Navigate to="/dashboard" replace />

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (senha.length < 6) { setError('A senha deve ter ao menos 6 caracteres.'); return }
    if (senha !== confirma) { setError('As senhas não conferem.'); return }

    setSaving(true)
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.token}` },
        body: JSON.stringify({ action: 'change_password', password: senha }),
      })
      const json = await res.json()
      if (!json.ok) throw new Error(json.error || 'Erro ao trocar a senha')
      updateSession({ mustChangePassword: false })
      navigate('/dashboard')
    } catch (err) {
      setError(err.message)
    }
    setSaving(false)
  }

  return (
    <div className="min-h-screen bg-bg-primary flex items-center justify-center p-6">
      <div className="bg-bg-secondary border border-border-color rounded-2xl p-8 w-full max-w-md shadow-2xl animate-fade-in">
        <div className="w-12 h-12 bg-accent-blue/10 rounded-xl flex items-center justify-center mb-5">
          <KeyRound size={22} className="text-accent-blue" />
        </div>
        <h1 className="text-xl font-bold text-text-primary mb-1">Defina sua nova senha</h1>
        <p className="text-sm text-text-secondary mb-6">
          Este é seu primeiro acesso. Por segurança, é obrigatório trocar a senha antes de continuar.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs text-text-secondary mb-1">Nova senha</label>
            <input
              type="password" value={senha} onChange={e => setSenha(e.target.value)}
              className="w-full bg-bg-tertiary border border-border-color text-text-primary text-sm rounded-lg px-3 py-2.5 focus:outline-none focus:ring-1 focus:ring-accent-blue"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-xs text-text-secondary mb-1">Confirmar nova senha</label>
            <input
              type="password" value={confirma} onChange={e => setConfirma(e.target.value)}
              className="w-full bg-bg-tertiary border border-border-color text-text-primary text-sm rounded-lg px-3 py-2.5 focus:outline-none focus:ring-1 focus:ring-accent-blue"
            />
          </div>

          {error && <p className="text-sm text-accent-red">{error}</p>}

          <button
            type="submit" disabled={saving}
            className="w-full py-2.5 bg-accent-blue text-white rounded-lg text-sm font-medium hover:bg-blue-600 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {saving && <Loader2 size={14} className="animate-spin" />}
            Salvar nova senha
          </button>

          <button
            type="button"
            onClick={() => { logout(); navigate('/login') }}
            className="w-full py-2 text-xs text-text-secondary hover:text-text-primary transition-colors"
          >
            Sair
          </button>
        </form>
      </div>
    </div>
  )
}
