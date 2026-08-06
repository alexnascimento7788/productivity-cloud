import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Eye, EyeOff, TrendingUp, Loader2, BarChart3, Trophy, MapPin } from 'lucide-react'
import { useAuth } from '../App'
import { loginUser } from '../services/authService'

const features = [
  { icon: BarChart3, label: 'Dashboards em tempo real' },
  { icon: Trophy, label: 'Ranking de performance' },
  { icon: MapPin, label: 'Geolocalização de clientes' },
]

export default function Login() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  // username field stores email for Supabase auth
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const { session, login } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (session) navigate('/dashboard', { replace: true })
  }, [session])

  async function handleSubmit(e) {
    e.preventDefault()
    if (!username || !password) { setError('Preencha email e senha.'); return }
    setLoading(true)
    setError('')
    try {
      const sessionData = await loginUser(username, password)
      login(sessionData)
      // navigation happens via useEffect above when session state updates
    } catch (err) {
      setError(err.message)
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-bg-primary flex items-center justify-center p-4 relative overflow-hidden">
      {/* Glow decorativo de fundo */}
      <div className="absolute -top-40 -left-40 w-[480px] h-[480px] rounded-full bg-accent-blue/10 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-48 -right-32 w-[520px] h-[520px] rounded-full bg-emerald-500/10 blur-3xl pointer-events-none" />

      <div className="w-full max-w-sm relative">
        {/* Marca */}
        <div className="text-center mb-8">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-accent-blue/40"
            style={{ background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 55%, #10b981 130%)' }}
          >
            <TrendingUp size={32} className="text-white" />
          </div>
          <h1 className="text-3xl font-bold text-text-primary tracking-tight">Produtividade</h1>
          <p className="text-text-secondary text-sm mt-2">
            Inteligência comercial para acelerar seus resultados
          </p>
        </div>

        {/* Card */}
        <div className="bg-bg-secondary/90 backdrop-blur border border-border-color rounded-2xl p-6 shadow-2xl">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm text-text-secondary mb-1.5">Email</label>
              <input
                type="email"
                value={username}
                onChange={e => setUsername(e.target.value)}
                autoFocus
                className="w-full bg-bg-tertiary border border-border-color text-text-primary rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent-blue focus:border-transparent"
                placeholder="seu@email.com"
              />
            </div>

            <div>
              <label className="block text-sm text-text-secondary mb-1.5">Senha</label>
              <div className="relative">
                <input
                  type={showPass ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full bg-bg-tertiary border border-border-color text-text-primary rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent-blue focus:border-transparent pr-10"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPass(s => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-text-secondary hover:text-text-primary"
                >
                  {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {error && (
              <div className="animate-fade-in bg-accent-red/10 border border-accent-red/30 text-accent-red text-sm rounded-lg px-4 py-2.5">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-accent-blue hover:bg-blue-600 text-white font-semibold rounded-lg py-2.5 text-sm transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {loading ? <><Loader2 size={16} className="animate-spin" /> Entrando...</> : 'Acessar plataforma'}
            </button>
          </form>
        </div>

        {/* Destaques comerciais */}
        <div className="flex items-center justify-center gap-4 mt-6 flex-wrap">
          {features.map(({ icon: Icon, label }) => (
            <div key={label} className="flex items-center gap-1.5 text-xs text-text-secondary">
              <Icon size={13} className="text-accent-blue" />
              <span>{label}</span>
            </div>
          ))}
        </div>

        <p className="text-center text-text-secondary/50 text-xs mt-6">
          Desenvolvido por SixHours@2026
        </p>
      </div>
    </div>
  )
}
