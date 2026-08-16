import React, { useState, useRef, useEffect } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, Trophy, Users, Building2,
  TrendingUp, MapPin, LogOut, ChevronLeft, ChevronRight,
  AlertTriangle, RefreshCw, Settings, Database, SlidersHorizontal, Crown, Upload,
  Link2, Map, Info, X, Route,
} from 'lucide-react'
import { useAuth, useData, isElevated, isStaff } from '../App'

const navItems = [
  { to: '/dashboard',      icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/equipes',        icon: Building2,        label: 'Equipes' },
  { to: '/ranking',        icon: Trophy,           label: 'Ranking' },
  { to: '/clientes',       icon: Users,            label: 'Clientes' },
  { to: '/evolucao',       icon: TrendingUp,       label: 'Evolucao' },
  { to: '/geolocalizacao', icon: MapPin,           label: 'Geolocalizacao',           flag: 'geoPadraoHabilitado' },
  { to: '/geolocalizacao-vendas-cidades', icon: Route, label: 'Geolocalizacao Vendas Cidades', flag: 'geoVendasCidadesHabilitado' },
]

const adminItems = [
  { to: '/master',         icon: Crown,             label: 'Painel Master',      masterOnly: true },
  { to: '/usuarios',       icon: Settings,          label: 'Usuarios',           staff: true },
  { to: '/equipes-config', icon: Link2,             label: 'Relacionar Equipes', staff: true },
  { to: '/cidades',        icon: Map,               label: 'Tratar Cidades',     staff: true, alertKey: 'cidades' },
  { to: '/importar',       icon: Upload,            label: 'Importar Planilha',  adminOnly: true },
  { to: '/parametros',     icon: SlidersHorizontal, label: 'Parametros',         elevated: true },
  { to: '/sql',            icon: Database,          label: 'SQL Console',        masterOnly: true },
]

function roleBadge(role) {
  if (role === 'master') return 'bg-accent-blue/20 text-accent-blue'
  if (role === 'admin') return 'bg-accent-green/20 text-accent-green'
  if (role === 'operador') return 'bg-accent-amber/20 text-accent-amber'
  return 'bg-bg-tertiary text-text-secondary'
}

// Detecta viewport mobile (breakpoint md do Tailwind)
function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() => window.matchMedia('(max-width: 767px)').matches)
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)')
    const handler = e => setIsMobile(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])
  return isMobile
}

export default function Sidebar({ mobileOpen = false, onMobileClose }) {
  const [collapsedPref, setCollapsedPref] = useState(false)
  const [gearOpen, setGearOpen] = useState(false)
  const [quemSomosOpen, setQuemSomosOpen] = useState(false)
  const isMobile = useIsMobile()
  // no drawer mobile a sidebar abre sempre expandida
  const collapsed = collapsedPref && !isMobile
  const { session, logout, companyFlags } = useAuth()
  const { unmappedCities, reloadExcel, loadingData } = useData()
  const navigate = useNavigate()
  const alertCount = unmappedCities?.length || 0
  const gearRef = useRef(null)

  useEffect(() => {
    function handler(e) {
      if (gearRef.current && !gearRef.current.contains(e.target)) setGearOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  function handleLogout() {
    onMobileClose?.()
    logout()
    navigate('/login')
  }

  const filtered = navItems.filter(item => {
    if (item.flag && !companyFlags?.[item.flag]) return false
    if (item.masterOnly) return session?.role === 'master'
    if (item.elevated) return isElevated(session?.role)
    if (item.staff) return isStaff(session?.role)
    return true
  })

  const showGear = isStaff(session?.role)

  const visibleAdminItems = adminItems.filter(item => {
    if (item.masterOnly) return session?.role === 'master'
    if (item.adminOnly) return session?.role === 'admin'
    if (item.elevated) return isElevated(session?.role)
    if (item.staff) return isStaff(session?.role)
    return true
  })

  const gearHasAlert = alertCount > 0

  return (
    <aside
      className={`flex flex-col h-full bg-bg-secondary border-r border-border-color transition-all duration-300
        fixed inset-y-0 left-0 z-50 transform md:relative md:translate-x-0 md:z-auto
        ${mobileOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'}`}
      style={{ width: collapsed ? 64 : 240 }}
    >
      {/* Logo */}
      <div className="flex items-center h-11 px-4 border-b border-border-color">
        <div className="w-7 h-7 bg-accent-blue rounded-lg flex items-center justify-center flex-shrink-0">
          <TrendingUp size={14} className="text-white" />
        </div>
        {!collapsed && (
          <span className="ml-3 font-semibold text-sm text-text-primary truncate">
            Produtividade
          </span>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 py-4 space-y-1 px-2 overflow-y-auto">
        {filtered.map(({ to, icon: Icon, label, alertKey }) => {
          const showAlert = alertKey === 'cidades' && alertCount > 0
          return (
            <NavLink
              key={to}
              to={to}
              end={to === '/clientes'}
              onClick={() => onMobileClose?.()}
              className={({ isActive }) =>
                `relative flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                  isActive
                    ? 'bg-accent-blue/15 text-accent-blue font-medium'
                    : 'text-text-secondary hover:bg-bg-tertiary hover:text-text-primary'
                }`
              }
            >
              <Icon size={18} className="flex-shrink-0" />
              {!collapsed ? (
                <>
                  <span className="truncate flex-1">{label}</span>
                  {showAlert && (
                    <span className="flex items-center gap-1 bg-accent-red/20 text-accent-red text-xs px-1.5 py-0.5 rounded-full font-medium">
                      <AlertTriangle size={10} />
                      {alertCount}
                    </span>
                  )}
                </>
              ) : (
                showAlert && (
                  <span className="absolute top-1 right-1 w-2 h-2 bg-accent-red rounded-full" />
                )
              )}
            </NavLink>
          )
        })}
      </nav>

      {/* Divider */}
      <div className="border-t border-border-color mx-2 mb-2" />

      {/* User info */}
      {!collapsed && session && (
        <div className="px-4 py-2 mb-1">
          <p className="text-xs text-text-primary font-medium truncate">{session.nome || session.email}</p>
          <span className={`text-xs px-1.5 py-0.5 rounded-full mt-0.5 inline-block ${roleBadge(session.role)}`}>
            {session.role}
          </span>
        </div>
      )}

      {/* Gear - staff only */}
      {showGear && (
        <div ref={gearRef} className="relative">
          <button
            onClick={() => setGearOpen(o => !o)}
            title="Administracao"
            className={`flex items-center gap-3 px-5 py-3 w-full text-sm transition-colors ${
              gearOpen
                ? 'text-accent-blue bg-accent-blue/10'
                : 'text-text-secondary hover:text-text-primary hover:bg-bg-tertiary'
            }`}
          >
            <div className="relative flex-shrink-0">
              <Settings size={18} />
              {gearHasAlert && (
                <span className="absolute -top-1 -right-1 w-2 h-2 bg-accent-red rounded-full" />
              )}
            </div>
            {!collapsed && <span>Administracao</span>}
          </button>

          {gearOpen && (
            <div
              className="absolute bottom-full left-2 right-2 mb-1 bg-bg-primary border border-border-color rounded-xl shadow-xl overflow-hidden z-50"
            >
              {visibleAdminItems.map(({ to, icon: Icon, label, alertKey }) => {
                const showAlert = alertKey === 'cidades' && alertCount > 0
                return (
                  <NavLink
                    key={to}
                    to={to}
                    onClick={() => { setGearOpen(false); onMobileClose?.() }}
                    className={({ isActive }) =>
                      `flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${
                        isActive
                          ? 'bg-accent-blue/15 text-accent-blue font-medium'
                          : 'text-text-secondary hover:bg-bg-tertiary hover:text-text-primary'
                      }`
                    }
                  >
                    <Icon size={16} className="flex-shrink-0" />
                    <span className="flex-1">{label}</span>
                    {showAlert && (
                      <span className="flex items-center gap-1 bg-accent-red/20 text-accent-red text-xs px-1.5 py-0.5 rounded-full font-medium">
                        <AlertTriangle size={10} />
                        {alertCount}
                      </span>
                    )}
                  </NavLink>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Reprocessar planilha */}
      <button
        onClick={reloadExcel}
        disabled={loadingData}
        title="Recarregar dados"
        className="flex items-center gap-3 px-5 py-3 text-sm text-text-secondary hover:text-accent-blue hover:bg-accent-blue/10 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      >
        <RefreshCw size={18} className={`flex-shrink-0 ${loadingData ? 'animate-spin' : ''}`} />
        {!collapsed && <span>Recarregar dados</span>}
      </button>

      {/* Logout */}
      <button
        onClick={handleLogout}
        className="flex items-center gap-3 px-5 py-3 text-sm text-text-secondary hover:text-accent-red hover:bg-accent-red/10 transition-colors"
      >
        <LogOut size={18} className="flex-shrink-0" />
        {!collapsed && <span>Sair</span>}
      </button>

      {/* Quem Somos */}
      <div className="relative">
        <button
          onClick={() => setQuemSomosOpen(o => !o)}
          title="Quem Somos"
          className={`flex items-center gap-3 px-5 py-3 w-full text-sm transition-colors ${
            quemSomosOpen
              ? 'text-accent-blue bg-accent-blue/10'
              : 'text-text-secondary hover:text-text-primary hover:bg-bg-tertiary'
          }`}
        >
          <Info size={18} className="flex-shrink-0" />
          {!collapsed && <span>Quem Somos</span>}
        </button>

        {quemSomosOpen && (
          <div className="absolute bottom-full left-2 right-2 mb-1 bg-bg-primary border border-border-color rounded-xl shadow-xl z-50 flex flex-col max-h-[70vh]">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border-color shrink-0">
              <span className="text-xs font-semibold text-text-primary tracking-wide uppercase">Quem Somos</span>
              <button onClick={() => setQuemSomosOpen(false)} className="text-text-secondary hover:text-text-primary">
                <X size={14} />
              </button>
            </div>
            <div className="overflow-y-auto">

            {/* SIXHours */}
            <div className="px-4 py-4 border-b border-border-color">
              <p className="text-sm font-bold text-text-primary">SIXHours</p>
            </div>

            {/* Versão 4.9.1 */}
            <div className="px-4 py-4 border-b border-border-color">
              <p className="text-xs font-semibold text-accent-blue mb-3">Versão Cloud 4.9.1</p>
              <ul className="space-y-2 text-xs text-text-secondary">
                <li className="flex gap-2">
                  <span className="text-accent-green mt-0.5 flex-shrink-0">✓</span>
                  <span><span className="text-text-primary font-medium">Correção:</span> "Apagar base" agora também limpa as equipes — antes elas ficavam órfãs (criadas pelo import, não removidas pelo wipe). Reimport normal do admin continua preservando equipes e cidades normalmente, só o wipe do master zera tudo</span>
                </li>
              </ul>
            </div>

            {/* Versão 4.9 */}
            <div className="px-4 py-4 border-b border-border-color">
              <p className="text-xs font-semibold text-accent-blue mb-3">Versão Cloud 4.9</p>
              <ul className="space-y-2 text-xs text-text-secondary">
                <li className="flex gap-2">
                  <span className="text-accent-green mt-0.5 flex-shrink-0">✓</span>
                  <span><span className="text-text-primary font-medium">Correção:</span> "Apagar base" de uma empresa agora também limpa o de/para de cidades — antes, pendências de cidades continuavam aparecendo mesmo depois de apagar tudo</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-accent-green mt-0.5 flex-shrink-0">✓</span>
                  <span><span className="text-text-primary font-medium">Painel Master:</span> novo botão para excluir empresa por completo (dados, equipes, cidades, usuários e login) e para excluir usuário individual</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-accent-green mt-0.5 flex-shrink-0">✓</span>
                  <span><span className="text-text-primary font-medium">Import:</span> pré-processamento mais inteligente do nome das cidades (remove sufixo de UF, pontuação e abreviações como "Sto./Sta./S.") e correspondência aproximada como reforço, reduzindo pendências manuais no de/para de cidades</span>
                </li>
              </ul>
            </div>

            {/* Versão 4.8 */}
            <div className="px-4 py-4 border-b border-border-color">
              <p className="text-xs font-semibold text-accent-blue mb-3">Versão Cloud 4.8</p>
              <ul className="space-y-2 text-xs text-text-secondary">
                <li className="flex gap-2">
                  <span className="text-accent-green mt-0.5 flex-shrink-0">✓</span>
                  <span><span className="text-text-primary font-medium">Vendas Cidades:</span> mapa agora colore por Região (padrão) ou por Rota, alternável nos filtros — o filtro de Setores/Rotas funciona nos dois modos</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-accent-green mt-0.5 flex-shrink-0">✓</span>
                  <span><span className="text-text-primary font-medium">Vendas Cidades:</span> novo filtro por Região nos filtros fixo e flutuante, junto com o filtro de Setores/Rotas</span>
                </li>
              </ul>
            </div>

            {/* Versão 4.7.1 */}
            <div className="px-4 py-4 border-b border-border-color">
              <p className="text-xs font-semibold text-accent-blue mb-3">Versão Cloud 4.7.1</p>
              <ul className="space-y-2 text-xs text-text-secondary">
                <li className="flex gap-2">
                  <span className="text-accent-green mt-0.5 flex-shrink-0">✓</span>
                  <span><span className="text-text-primary font-medium">Popup Vendas Cidades:</span> layout corrigido — "Rota - Nome", Região, Cidade e valores em linhas separadas</span>
                </li>
              </ul>
            </div>

            {/* Versão 4.7 */}
            <div className="px-4 py-4 border-b border-border-color">
              <p className="text-xs font-semibold text-accent-blue mb-3">Versão Cloud 4.7</p>
              <ul className="space-y-2 text-xs text-text-secondary">
                <li className="flex gap-2">
                  <span className="text-accent-green mt-0.5 flex-shrink-0">✓</span>
                  <span><span className="text-text-primary font-medium">Tratamento de Cidades:</span> opção "não é município (distrito/povoado)" com coordenadas manuais fica visível lado a lado com a busca IBGE</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-accent-green mt-0.5 flex-shrink-0">✓</span>
                  <span><span className="text-text-primary font-medium">Import Vendas Cidades:</span> lista de cidades pendentes atualiza automaticamente após o import, sem precisar de F5</span>
                </li>
              </ul>
            </div>

            {/* Versão 4.6 */}
            <div className="px-4 py-4 border-b border-border-color">
              <p className="text-xs font-semibold text-accent-blue mb-3">Versão Cloud 4.6</p>
              <ul className="space-y-2 text-xs text-text-secondary">
                <li className="flex gap-2">
                  <span className="text-accent-green mt-0.5 flex-shrink-0">✓</span>
                  <span><span className="text-text-primary font-medium">Geolocalização Vendas Cidades:</span> segunda geolocalização independente, importada via CSV por setor/rota e cidade, com filtro, legenda e painel flutuante em tela cheia</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-accent-green mt-0.5 flex-shrink-0">✓</span>
                  <span><span className="text-text-primary font-medium">Mapa sem limite de estado:</span> geolocalização não trava mais o pan/zoom em Minas Gerais</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-accent-green mt-0.5 flex-shrink-0">✓</span>
                  <span><span className="text-text-primary font-medium">Controle por empresa:</span> master decide quais geolocalizações cada empresa enxerga</span>
                </li>
              </ul>
            </div>

            {/* Versão 4.5 */}
            <div className="px-4 py-4 border-b border-border-color">
              <p className="text-xs font-semibold text-accent-blue mb-3">Versão Cloud 4.5</p>
              <ul className="space-y-2 text-xs text-text-secondary">
                <li className="flex gap-2">
                  <span className="text-accent-green mt-0.5 flex-shrink-0">✓</span>
                  <span><span className="text-text-primary font-medium">Master apaga base de empresa:</span> painel Master → Empresas → ícone de borracha, com confirmação digitando o nome da empresa</span>
                </li>
              </ul>
            </div>

            {/* Versão 4.4 */}
            <div className="px-4 py-4 border-b border-border-color">
              <p className="text-xs font-semibold text-accent-blue mb-3">Versão Cloud 4.4</p>
              <ul className="space-y-2 text-xs text-text-secondary">
                <li className="flex gap-2">
                  <span className="text-accent-green mt-0.5 flex-shrink-0">✓</span>
                  <span><span className="text-text-primary font-medium">Equipes separadas:</span> 1 pin por equipe por cidade — equipes nunca compartilham o mesmo círculo</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-accent-green mt-0.5 flex-shrink-0">✓</span>
                  <span><span className="text-text-primary font-medium">Jitter por equipe:</span> equipes na mesma cidade ficam levemente deslocadas para não se sobrepor</span>
                </li>
              </ul>
            </div>

            {/* Versão 4.3 */}
            <div className="px-4 py-4 border-b border-border-color">
              <p className="text-xs font-semibold text-accent-blue mb-3">Versão Cloud 4.3</p>
              <ul className="space-y-2 text-xs text-text-secondary">
                <li className="flex gap-2">
                  <span className="text-accent-green mt-0.5 flex-shrink-0">✓</span>
                  <span><span className="text-text-primary font-medium">Zoom adaptativo:</span> mapa abre com ~80 cidades principais; ao dar zoom mais cidades aparecem progressivamente</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-accent-green mt-0.5 flex-shrink-0">✓</span>
                  <span><span className="text-text-primary font-medium">Sem borda nos pins:</span> círculos limpos sem contorno branco</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-accent-green mt-0.5 flex-shrink-0">✓</span>
                  <span><span className="text-text-primary font-medium">Cores corrigidas:</span> paleta reordenada — índices vizinhos nunca recebem hue parecido; azuis duplicados removidos</span>
                </li>
              </ul>
            </div>

            {/* Versão 4.2 */}
            <div className="px-4 py-4 border-b border-border-color">
              <p className="text-xs font-semibold text-accent-blue mb-3">Versão Cloud 4.2</p>
              <ul className="space-y-2 text-xs text-text-secondary">
                <li className="flex gap-2">
                  <span className="text-accent-green mt-0.5 flex-shrink-0">✓</span>
                  <span><span className="text-text-primary font-medium">Mapa por cidade:</span> modo padrão exibe 1 pin por cidade — a cidade é soberana</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-accent-green mt-0.5 flex-shrink-0">✓</span>
                  <span><span className="text-text-primary font-medium">Ícone limpo:</span> círculo colorido sem texto — cor da equipe dominante da cidade</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-accent-green mt-0.5 flex-shrink-0">✓</span>
                  <span><span className="text-text-primary font-medium">Hover completo:</span> hover na cidade lista todas as equipes e vendedores com ativos, bloqueados, inativos, fat. e médio</span>
                </li>
              </ul>
            </div>

            {/* Versão 4.1 */}
            <div className="px-4 py-4 border-b border-border-color">
              <p className="text-xs font-semibold text-accent-blue mb-3">Versão Cloud 4.1</p>
              <ul className="space-y-2 text-xs text-text-secondary">
                <li className="flex gap-2">
                  <span className="text-accent-green mt-0.5 flex-shrink-0">✓</span>
                  <span><span className="text-text-primary font-medium">Mapa agrupado:</span> visão padrão agrupa vendedores por equipe e cidade — 1 ícone por equipe/cidade</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-accent-green mt-0.5 flex-shrink-0">✓</span>
                  <span><span className="text-text-primary font-medium">Hover no mapa:</span> passe o mouse sobre o ícone para ver equipe, vendedores, ativos/bloqueados/inativos e faturamento</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-accent-green mt-0.5 flex-shrink-0">✓</span>
                  <span><span className="text-text-primary font-medium">Legenda móvel:</span> painel arrastável com cor e nome de cada equipe no mapa</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-accent-green mt-0.5 flex-shrink-0">✓</span>
                  <span><span className="text-text-primary font-medium">Cores de equipe:</span> paleta com 20 cores distintas, atribuição por índice para máxima separação visual</span>
                </li>
              </ul>
            </div>

            {/* Versão 4.0 */}
            <div className="px-4 py-4">
              <p className="text-xs font-semibold text-accent-blue mb-3">Versão Cloud 4.0</p>
              <ul className="space-y-2 text-xs text-text-secondary">
                <li className="flex gap-2">
                  <span className="text-accent-green mt-0.5 flex-shrink-0">✓</span>
                  <span><span className="text-text-primary font-medium">LGPD:</span> CNPJ/CPF e Inscrição Estadual removidos da planilha e de todo o sistema</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-accent-green mt-0.5 flex-shrink-0">✓</span>
                  <span><span className="text-text-primary font-medium">Mês atual:</span> planilha agora enviada com o mês corrente como referência principal</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-accent-green mt-0.5 flex-shrink-0">✓</span>
                  <span><span className="text-text-primary font-medium">Ticket Médio:</span> novo indicador no Dashboard — faturamento por cliente positivado</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-accent-green mt-0.5 flex-shrink-0">✓</span>
                  <span><span className="text-text-primary font-medium">Variação Mensal:</span> comparativo mês atual vs anterior no card de faturamento</span>
                </li>
              </ul>
            </div>
            </div>{/* fim overflow-y-auto */}
          </div>
        )}
      </div>

      {/* Collapse toggle — só faz sentido no desktop */}
      <button
        onClick={() => setCollapsedPref(c => !c)}
        className="hidden md:flex items-center justify-center h-10 border-t border-border-color text-text-secondary hover:text-text-primary hover:bg-bg-tertiary transition-colors"
      >
        {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
      </button>
    </aside>
  )
}
