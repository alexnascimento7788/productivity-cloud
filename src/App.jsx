import React, { createContext, useContext, useState, useEffect, useMemo } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Ranking from './pages/Ranking'
import Clientes from './pages/Clientes'
import Inativos from './pages/Inativos'
import Equipes from './pages/Equipes'
import EquipesConfig from './pages/EquipesConfig'
import Cidades from './pages/Cidades'
import Evolucao from './pages/Evolucao'
import Mapa from './pages/Mapa'
import GeoVendasCidades from './pages/GeoVendasCidades'
import Usuarios from './pages/Usuarios'
import SqlConsole from './pages/SqlConsole'
import Parametros from './pages/Parametros'
import Master from './pages/Master'
import Importar from './pages/Importar'
import TrocarSenha from './pages/TrocarSenha'
import ExplorarClientes from './pages/explorar/ExplorarClientes'
import ExplorarCliente from './pages/explorar/ExplorarCliente'
import ExplorarVendedores from './pages/explorar/ExplorarVendedores'
import ExplorarVendedor from './pages/explorar/ExplorarVendedor'
import ExplorarMunicipios from './pages/explorar/ExplorarMunicipios'
import ExplorarMunicipio from './pages/explorar/ExplorarMunicipio'
import Layout from './components/Layout'
import { supabase } from './lib/supabaseClient'
import { logoutUser, getSession } from './services/authService'
import { loadCompanyData } from './lib/dataLoader'
import { markSessionStart, staleSessionReason, setLogoutReason, startSessionGuard } from './lib/sessionGuard'

export const AuthContext = createContext(null)
export const DataContext = createContext(null)
export const ParamsContext = createContext({ diasBloqueio: 90, diasInativacao: 180, curvaAMin: 20000, curvaBMin: 15000 })
export const ThemeContext = createContext({ theme: 'dark', toggleTheme: () => {} })

export function useAuth() { return useContext(AuthContext) }
export function useData() { return useContext(DataContext) }
export function useParams() { return useContext(ParamsContext) }
export function useTheme() { return useContext(ThemeContext) }

export function isElevated(role) { return role === 'master' || role === 'admin' }
export function isStaff(role) { return role === 'master' || role === 'admin' || role === 'operador' }

// Linhas visíveis conforme o perfil: consulta enxerga apenas suas equipes
export function filterRowsByRole(rows, session) {
  if (session?.role === 'consulta') {
    const allowed = new Set((session.equipes || []).map(Number))
    return rows.filter(r => allowed.has(Number(r.gr)))
  }
  return rows
}

function PrivateRoute({ children, elevated = false, masterOnly = false, staff = false }) {
  const { session } = useAuth()
  const location = useLocation()
  if (!session) return <Navigate to="/login" replace />
  if (session.mustChangePassword && location.pathname !== '/trocar-senha') {
    return <Navigate to="/trocar-senha" replace />
  }
  if (masterOnly && session.role !== 'master') return <Navigate to="/dashboard" replace />
  if (elevated && !isElevated(session.role)) return <Navigate to="/dashboard" replace />
  if (staff && !isStaff(session.role)) return <Navigate to="/dashboard" replace />
  return children
}

export default function App() {
  const [session, setSession] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [excelData, setExcelData] = useState(null)
  const [loadingData, setLoadingData] = useState(false)
  const [dataError, setDataError] = useState(null)
  const [params, setParams] = useState({ diasBloqueio: 90, diasInativacao: 180, curvaAMin: 20000, curvaBMin: 15000 })
  const [companyFlags, setCompanyFlags] = useState({ geoPadraoHabilitado: true, geoVendasCidadesHabilitado: false })
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'dark')

  // Master: lista de empresas + empresa selecionada no combobox
  const [companies, setCompanies] = useState([])
  const [activeCompanyId, setActiveCompanyId] = useState(null)

  // Empresa efetiva: master usa o combobox; demais usam a empresa do perfil
  const effectiveCompanyId = session?.role === 'master' ? activeCompanyId : session?.company_id

  useEffect(() => {
    const root = document.documentElement
    if (theme === 'light') root.classList.add('light')
    else root.classList.remove('light')
    localStorage.setItem('theme', theme)
  }, [theme])

  function toggleTheme() {
    setTheme(t => t === 'dark' ? 'light' : 'dark')
  }

  useEffect(() => {
    (async () => {
      const s = await getSession()
      if (s) {
        // sessão salva de um navegador fechado ou parado há muito tempo → descarta
        const reason = staleSessionReason()
        if (reason) {
          setLogoutReason(reason)
          await logoutUser()
        } else {
          setSession(s)
        }
      }
      setAuthLoading(false)
    })()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, authSession) => {
      if (event === 'SIGNED_OUT') {
        setSession(null)
        setExcelData(null)
        return
      }
      // O Supabase renova o JWT sozinho (~1h); sem isso session.token fica
      // vencido e as chamadas /api/* devolvem "Token inválido ou expirado".
      if (authSession?.access_token) {
        setSession(s => (s && s.token !== authSession.access_token ? { ...s, token: authSession.access_token } : s))
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const login = (sessionData) => {
    markSessionStart()
    setSession(sessionData)
  }

  const logout = async () => {
    await logoutUser()
    setSession(null)
    setExcelData(null)
    setCompanies([])
    setActiveCompanyId(null)
  }

  // Inatividade (30 min) e batimento da aba — ver lib/sessionGuard.js
  useEffect(() => {
    if (!session?.id) return
    return startSessionGuard(reason => {
      setLogoutReason(reason)
      logout()
    })
  }, [session?.id])

  // sessão atualizada localmente (ex.: após trocar a senha do 1º acesso)
  const updateSession = (patch) => setSession(s => (s ? { ...s, ...patch } : s))

  // Master: carrega empresas e seleciona a de menor código por padrão
  useEffect(() => {
    if (!session || session.role !== 'master') return
    supabase
      .from('companies')
      .select('*')
      .then(({ data }) => {
        // menor código primeiro (default do master); fallback p/ data de criação
        const ativas = (data || [])
          .filter(c => c.ativo)
          .sort((a, b) => (a.codigo ?? 0) - (b.codigo ?? 0) || String(a.created_at).localeCompare(String(b.created_at)))
        setCompanies(ativas)
        if (ativas.length) setActiveCompanyId(prev => prev || ativas[0].id)
      })
  }, [session?.id, session?.role])

  useEffect(() => {
    if (!session || !effectiveCompanyId) return
    loadParams(effectiveCompanyId)
    loadFromSupabase(effectiveCompanyId)
    loadCompanyFlags(effectiveCompanyId)
  }, [session?.id, effectiveCompanyId])

  async function loadCompanyFlags(companyId) {
    const { data } = await supabase
      .from('companies')
      .select('geo_padrao_habilitado, geo_vendas_cidades_habilitado')
      .eq('id', companyId)
      .single()
    setCompanyFlags({
      geoPadraoHabilitado: data?.geo_padrao_habilitado ?? true,
      geoVendasCidadesHabilitado: data?.geo_vendas_cidades_habilitado ?? false,
    })
  }

  async function loadParams(companyId) {
    try {
      const { data } = await supabase
        .from('parametros')
        .select('chave, valor')
        .eq('company_id', companyId)
      if (data) {
        const map = Object.fromEntries(data.map(p => [p.chave, Number(p.valor)]))
        setParams({
          diasBloqueio: map.dias_bloqueio ?? 90,
          diasInativacao: map.dias_inativacao ?? 180,
          curvaAMin: map.curva_a_min ?? 20000,
          curvaBMin: map.curva_b_min ?? 15000,
        })
      }
    } catch {}
  }

  async function loadFromSupabase(companyId) {
    setLoadingData(true)
    setDataError(null)
    try {
      const result = await loadCompanyData(companyId)
      setExcelData(result)
    } catch (e) {
      setDataError(e.message)
    }
    setLoadingData(false)
  }

  async function updateParam(chave, valor) {
    if (!effectiveCompanyId) return
    await supabase
      .from('parametros')
      .upsert(
        { company_id: effectiveCompanyId, chave, valor: String(valor) },
        { onConflict: 'company_id,chave' }
      )
    await loadParams(effectiveCompanyId)
  }

  const unmappedCities = useMemo(
    () => (excelData?.cidadesDepara || []).filter(d => !d.codigo_ibge && d.latitude == null),
    [excelData]
  )

  if (authLoading) {
    return (
      <div className="min-h-screen bg-bg-primary flex items-center justify-center">
        <div className="text-text-secondary text-sm">Carregando...</div>
      </div>
    )
  }

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      <AuthContext.Provider value={{
        session, login, logout, updateSession,
        companies, activeCompanyId, setActiveCompanyId, effectiveCompanyId,
        companyFlags,
      }}>
        <ParamsContext.Provider value={{ ...params, updateParam, loadParams: () => loadParams(effectiveCompanyId) }}>
          <DataContext.Provider value={{
            excelData, loadingData, dataError,
            reloadExcel: () => effectiveCompanyId && loadFromSupabase(effectiveCompanyId),
            equipesList: excelData?.equipesList || [],
            cidadesDepara: excelData?.cidadesDepara || [],
            unmappedCities,
            reloadCidades: () => effectiveCompanyId && loadFromSupabase(effectiveCompanyId),
            removeUnmappedCity: () => {},
            hashInfo: excelData ? {
              current: excelData.hashAtual || null,
              original: null,
              nome: excelData.fileName || null,
              isValid: null,
            } : null,
          }}>
            <BrowserRouter>
              <Routes>
                <Route path="/login" element={<Login />} />
                <Route path="/trocar-senha" element={<TrocarSenha />} />
                <Route path="/" element={<PrivateRoute><Layout /></PrivateRoute>}>
                  <Route index element={<Navigate to="/dashboard" replace />} />
                  <Route path="dashboard" element={<Dashboard />} />
                  <Route path="equipes" element={<Equipes />} />
                  <Route path="equipes-config" element={<PrivateRoute staff><EquipesConfig /></PrivateRoute>} />
                  <Route path="cidades" element={<PrivateRoute staff><Cidades /></PrivateRoute>} />
                  <Route path="ranking" element={<Ranking />} />
                  <Route path="clientes" element={<Clientes />} />
                  <Route path="clientes/inativos" element={<Inativos />} />
                  <Route path="inativos" element={<Navigate to="/clientes/inativos" replace />} />
                  <Route path="evolucao" element={<Evolucao />} />
                  <Route path="geolocalizacao" element={<Mapa />} />
                  <Route path="geolocalizacao-vendas-cidades" element={<PrivateRoute staff><GeoVendasCidades /></PrivateRoute>} />
                  <Route path="mapa" element={<Navigate to="/geolocalizacao" replace />} />
                  <Route path="usuarios" element={<PrivateRoute staff><Usuarios /></PrivateRoute>} />
                  <Route path="importar" element={<PrivateRoute elevated><Importar /></PrivateRoute>} />
                  <Route path="master" element={<PrivateRoute masterOnly><Master /></PrivateRoute>} />
                  <Route path="sql" element={<PrivateRoute masterOnly><SqlConsole /></PrivateRoute>} />
                  <Route path="parametros" element={<PrivateRoute elevated><Parametros /></PrivateRoute>} />
                  {/* Páginas de análise (fora do menu): destino dos números clicáveis */}
                  <Route path="explorar/clientes" element={<ExplorarClientes />} />
                  <Route path="explorar/cliente/:seq" element={<ExplorarCliente />} />
                  <Route path="explorar/vendedores" element={<ExplorarVendedores />} />
                  <Route path="explorar/vendedor/:rca" element={<ExplorarVendedor />} />
                  <Route path="explorar/municipios" element={<ExplorarMunicipios />} />
                  <Route path="explorar/municipio/:cidade" element={<ExplorarMunicipio />} />
                </Route>
                <Route path="*" element={<Navigate to="/login" replace />} />
              </Routes>
            </BrowserRouter>
          </DataContext.Provider>
        </ParamsContext.Provider>
      </AuthContext.Provider>
    </ThemeContext.Provider>
  )
}
