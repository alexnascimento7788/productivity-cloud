import React, { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { Sun, Moon, ShieldCheck, ShieldAlert, Shield, Building2, RefreshCw, Menu } from 'lucide-react'
import Sidebar from './Sidebar'
import { useAuth, useData, useTheme } from '../App'

// Identificação do usuário logado no header
function UserChip() {
  const { session } = useAuth()
  if (!session) return null
  const nome = session.nome || session.email || '?'
  const initials = nome.trim().split(/\s+/).map(p => p[0]).slice(0, 2).join('').toUpperCase()
  return (
    <div className="flex items-center gap-2.5 px-3 py-1 mr-2 bg-bg-tertiary/60 border border-border-color rounded-full">
      <div
        className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0 shadow-sm"
        style={{ background: 'linear-gradient(135deg, #3b82f6 0%, #10b981 120%)' }}
      >
        {initials}
      </div>
      <p className="hidden sm:block text-xs font-semibold text-text-primary max-w-[150px] truncate leading-none">{nome}</p>
      <span className="hidden sm:inline text-[10px] px-1.5 py-0.5 rounded-full bg-accent-blue/15 text-accent-blue capitalize leading-none">
        {session.role}
      </span>
    </div>
  )
}

// Combobox de empresa — visível só para o master; trocar a empresa
// recarrega os dados de todas as abas
function CompanySelector() {
  const { session, companies, activeCompanyId, setActiveCompanyId } = useAuth()
  if (session?.role !== 'master') return <div />
  if (!companies.length) {
    return <span className="text-xs text-text-secondary">Nenhuma empresa cadastrada</span>
  }
  return (
    <div className="flex items-center gap-2">
      <Building2 size={14} className="text-accent-blue flex-shrink-0" />
      <select
        value={activeCompanyId || ''}
        onChange={e => setActiveCompanyId(e.target.value)}
        className="bg-bg-tertiary border border-border-color text-text-primary text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-accent-blue min-w-0 max-w-[160px] sm:max-w-none sm:min-w-[200px]"
      >
        {companies.map(c => (
          <option key={c.id} value={c.id}>{String(c.codigo).padStart(3, '0')} — {c.name}</option>
        ))}
      </select>
    </div>
  )
}

function HashBanner({ hashInfo }) {
  if (!hashInfo) return null

  if (hashInfo.isValid === true) {
    return (
      <div
        className="flex items-center gap-2 px-6 py-1.5 text-xs flex-shrink-0 border-b"
        style={{
          background: 'linear-gradient(135deg, #0f2d1a 0%, #1a5c32 35%, #2e8c52 50%, #1a5c32 65%, #0f2d1a 100%)',
          borderColor: '#2e7a46',
          color: '#7eeaaa',
          textShadow: '0 1px 2px rgba(0,0,0,0.5)',
        }}
      >
        <ShieldCheck size={13} className="flex-shrink-0" style={{ filter: 'drop-shadow(0 1px 1px rgba(0,0,0,0.4))' }} />
        <span className="font-semibold tracking-wide">Planilha validada — dados íntegros</span>
        <span className="ml-1 opacity-60">· {hashInfo.nome}</span>
      </div>
    )
  }

  if (hashInfo.isValid === false) {
    return (
      <div
        className="flex items-center gap-2 px-6 py-1.5 text-xs flex-shrink-0 border-b"
        style={{
          background: 'linear-gradient(135deg, #2d1400 0%, #6b3000 35%, #a84800 50%, #6b3000 65%, #2d1400 100%)',
          borderColor: '#9a4200',
          color: '#ffb366',
          textShadow: '0 1px 2px rgba(0,0,0,0.5)',
        }}
      >
        <ShieldAlert size={13} className="flex-shrink-0" style={{ filter: 'drop-shadow(0 1px 1px rgba(0,0,0,0.4))' }} />
        <span className="font-semibold tracking-wide">Os dados apresentados são de uma planilha que foi editada e alterada</span>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2 px-6 py-1.5 bg-bg-secondary border-b border-border-color text-xs text-text-secondary flex-shrink-0">
      <Shield size={13} className="flex-shrink-0" />
      <span>Planilha carregada · Sem hash de referência cadastrado</span>
    </div>
  )
}

export default function Layout() {
  const { loadingData, dataError, hashInfo, excelData } = useData()
  const { theme, toggleTheme } = useTheme()
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  return (
    <div className="flex h-screen [height:100dvh] bg-bg-primary overflow-hidden">
      <Sidebar mobileOpen={mobileNavOpen} onMobileClose={() => setMobileNavOpen(false)} />

      {/* Overlay do drawer mobile */}
      {mobileNavOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setMobileNavOpen(false)}
        />
      )}

      <main className="flex-1 overflow-hidden flex flex-col min-w-0">

        {/* Top bar */}
        <div className="flex items-center justify-between h-11 px-2 sm:px-4 border-b border-border-color bg-bg-secondary flex-shrink-0 gap-2">
          <div className="flex items-center gap-1 min-w-0">
            <button
              onClick={() => setMobileNavOpen(true)}
              title="Abrir menu"
              className="md:hidden p-2 -ml-1 rounded-lg text-text-secondary hover:text-text-primary hover:bg-bg-tertiary transition-colors flex-shrink-0"
            >
              <Menu size={18} />
            </button>
            <CompanySelector />
          </div>
          <div className="flex items-center">
            {/* Atualização em segundo plano — não bloqueia a navegação */}
            {loadingData && excelData && (
              <span className="flex items-center gap-1.5 text-[11px] text-accent-blue mr-3">
                <RefreshCw size={12} className="animate-spin" /> Atualizando dados...
              </span>
            )}
            <UserChip />
            <button
              onClick={toggleTheme}
              title={theme === 'dark' ? 'Mudar para modo claro' : 'Mudar para modo escuro'}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs text-text-secondary hover:text-text-primary hover:bg-bg-tertiary transition-colors"
            >
              {theme === 'dark'
                ? <Sun size={14} className="flex-shrink-0" />
                : <Moon size={14} className="flex-shrink-0" />
              }
              <span className="hidden md:inline">{theme === 'dark' ? 'Modo claro' : 'Modo escuro'}</span>
            </button>
          </div>
        </div>

        {/* Hash status banner */}
        <HashBanner hashInfo={hashInfo} />

        {dataError && (
          <div className="mx-6 mt-4 p-4 bg-accent-red/10 border border-accent-red/30 rounded-xl text-accent-red flex-shrink-0">
            <strong>Erro ao carregar dados:</strong> {dataError}
          </div>
        )}

        <div className="flex-1 overflow-auto">
          {/* Primeira carga: spinner discreto na área de conteúdo, navegação livre */}
          {loadingData && !excelData ? (
            <div className="h-full flex items-center justify-center">
              <div className="text-center">
                <div className="w-10 h-10 border-[3px] border-accent-blue border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                <p className="text-text-secondary text-sm">Carregando dados...</p>
              </div>
            </div>
          ) : (
            <Outlet />
          )}
        </div>

        <footer className="px-4 sm:px-6 py-2 sm:py-3 flex items-center justify-between text-text-secondary/40 text-xs border-t border-border-color/30 flex-shrink-0 gap-2">
          <span className="hidden sm:block w-32" />
          <span className="truncate">Desenvolvido por SixHours@2026</span>
          <span className="sm:w-32 text-right text-text-secondary/60 font-medium whitespace-nowrap">Versão Cloud 4.9.2</span>
        </footer>
      </main>
    </div>
  )
}
