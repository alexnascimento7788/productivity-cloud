import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { Plus, X, Loader2, Trash2, Eraser } from 'lucide-react'
import { useAuth } from '../App'
import { supabase } from '../lib/supabaseClient'
import PageHeader from '../components/PageHeader'

const inputCls = "w-full bg-bg-tertiary border border-border-color text-text-primary text-sm rounded-lg px-3 py-2.5 focus:outline-none focus:ring-1 focus:ring-accent-blue"

function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/60" onClick={onClose} />
      <div className="relative bg-bg-secondary border border-border-color rounded-2xl p-6 w-full max-w-md shadow-2xl animate-fade-in">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-text-primary">{title}</h2>
          <button onClick={onClose} className="text-text-secondary hover:text-text-primary">
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

function Field({ label, children }) {
  return (
    <div>
      <label className="block text-xs text-text-secondary mb-1">{label}</label>
      {children}
    </div>
  )
}

function StatusBadge({ ativo, onClick, activeLabel, inactiveLabel }) {
  return (
    <button
      onClick={onClick}
      className={`px-2 py-0.5 rounded-full text-xs cursor-pointer transition-colors ${
        ativo
          ? 'bg-accent-green/20 text-accent-green hover:bg-accent-red/20 hover:text-accent-red'
          : 'bg-accent-red/20 text-accent-red hover:bg-accent-green/20 hover:text-accent-green'
      }`}
    >
      {ativo ? activeLabel : inactiveLabel}
    </button>
  )
}

// ── Tab: Empresas ─────────────────────────────────────────────────────────────
function TabEmpresas({ apiCall }) {
  const [companies, setCompanies] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({ name: '', slug: '' })
  const [wipeTarget, setWipeTarget] = useState(null)
  const [wipeConfirmText, setWipeConfirmText] = useState('')
  const [wiping, setWiping] = useState(false)
  const [wipeError, setWipeError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    const res = await apiCall('GET', 'list_companies')
    if (res.companies) setCompanies(res.companies)
    setLoading(false)
  }, [apiCall])

  useEffect(() => { load() }, [load])

  function generateSlug(name) {
    return name
      .toLowerCase()
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
  }

  function openModal() {
    setError('')
    setForm({ name: '', slug: '' })
    setShowModal(true)
  }

  async function handleCreate() {
    setError('')
    if (!form.name.trim() || !form.slug.trim()) {
      setError('Nome e slug são obrigatórios.')
      return
    }
    setSaving(true)
    const res = await apiCall('POST', null, { action: 'create_company', name: form.name, slug: form.slug })
    setSaving(false)
    if (res.error) { setError(res.error); return }
    setShowModal(false)
    load()
  }

  async function handleToggle(company) {
    await apiCall('POST', null, { action: 'toggle_company', company_id: company.id, ativo: !company.ativo })
    load()
  }

  async function handleToggleGeoFlag(company, flag) {
    await apiCall('POST', null, { action: 'update_company_geo_flags', company_id: company.id, [flag]: !company[flag] })
    load()
  }

  function openWipeModal(company) {
    setWipeError('')
    setWipeConfirmText('')
    setWipeTarget(company)
  }

  async function handleWipe() {
    if (!wipeTarget || wipeConfirmText !== wipeTarget.name) return
    setWipeError('')
    setWiping(true)
    const res = await apiCall('POST', null, { action: 'wipe_company_data', company_id: wipeTarget.id })
    setWiping(false)
    if (res.error) { setWipeError(res.error); return }
    setWipeTarget(null)
    load()
  }

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-text-secondary">{companies.length} empresa(s) cadastrada(s)</p>
        <button
          onClick={openModal}
          className="flex items-center gap-2 px-4 py-2 bg-accent-blue text-white text-sm rounded-lg hover:bg-blue-600 transition-colors"
        >
          <Plus size={14} /> Nova Empresa
        </button>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-text-secondary text-sm">
          <Loader2 size={16} className="animate-spin" /> Carregando...
        </div>
      ) : (
        <div className="bg-bg-secondary border border-border-color rounded-xl overflow-hidden overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border-color">
                {['Nome', 'Slug', 'Status', 'Geolocalização', 'Criada em', 'Ações'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-text-secondary font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {companies.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-text-secondary">
                    Nenhuma empresa cadastrada. Crie a primeira empresa acima.
                  </td>
                </tr>
              ) : companies.map(c => (
                <tr key={c.id} className="border-b border-border-color/50 hover:bg-bg-tertiary/50">
                  <td className="px-4 py-3 text-text-primary font-medium">{c.name}</td>
                  <td className="px-4 py-3 text-text-secondary font-mono text-xs">{c.slug}</td>
                  <td className="px-4 py-3">
                    <StatusBadge ativo={c.ativo} onClick={() => handleToggle(c)} activeLabel="Ativa" inactiveLabel="Inativa" />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1.5">
                      <StatusBadge
                        ativo={c.geo_padrao_habilitado}
                        onClick={() => handleToggleGeoFlag(c, 'geo_padrao_habilitado')}
                        activeLabel="Padrão"
                        inactiveLabel="Padrão off"
                      />
                      <StatusBadge
                        ativo={c.geo_vendas_cidades_habilitado}
                        onClick={() => handleToggleGeoFlag(c, 'geo_vendas_cidades_habilitado')}
                        activeLabel="Vendas Cidades"
                        inactiveLabel="V.Cidades off"
                      />
                    </div>
                  </td>
                  <td className="px-4 py-3 text-text-secondary text-xs">
                    {new Date(c.created_at).toLocaleDateString('pt-BR')}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => openWipeModal(c)}
                      title="Apagar base de dados desta empresa"
                      className="text-text-secondary hover:text-accent-red p-1 rounded transition-colors"
                    >
                      <Eraser size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <Modal title="Nova Empresa" onClose={() => setShowModal(false)}>
          <div className="space-y-4">
            <Field label="Nome da Empresa">
              <input
                value={form.name}
                onChange={e => {
                  const name = e.target.value
                  setForm(f => ({ ...f, name, slug: generateSlug(name) }))
                }}
                className={inputCls}
                placeholder="Ex: Distribuidora Alpha"
                autoFocus
              />
            </Field>
            <Field label="Slug (identificador único)">
              <input
                value={form.slug}
                onChange={e => setForm(f => ({ ...f, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') }))}
                className={inputCls}
                placeholder="ex: distribuidora-alpha"
              />
              <p className="text-xs text-text-secondary mt-1">Somente letras minúsculas, números e hífens.</p>
            </Field>
            {error && <p className="text-accent-red text-sm">{error}</p>}
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 py-2.5 border border-border-color rounded-lg text-sm text-text-secondary hover:bg-bg-tertiary transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleCreate}
                disabled={saving}
                className="flex-1 py-2.5 bg-accent-blue text-white rounded-lg text-sm font-medium hover:bg-blue-600 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {saving && <Loader2 size={14} className="animate-spin" />}
                Criar Empresa
              </button>
            </div>
          </div>
        </Modal>
      )}

      {wipeTarget && (
        <Modal title="Apagar base da empresa" onClose={() => setWipeTarget(null)}>
          <div className="space-y-4">
            <div className="bg-accent-red/10 border border-accent-red/30 rounded-xl px-4 py-3 text-sm text-accent-red">
              Isso apaga <strong>permanentemente</strong> vendedores, clientes, vendas, últimas compras, histórico de imports e a planilha salva de <strong>{wipeTarget.name}</strong>.
              Equipes e o de/para de cidades são preservados. Não há como desfazer.
            </div>
            <Field label={<>Digite <strong>{wipeTarget.name}</strong> para confirmar</>}>
              <input
                value={wipeConfirmText}
                onChange={e => setWipeConfirmText(e.target.value)}
                className={inputCls}
                autoFocus
              />
            </Field>
            {wipeError && <p className="text-accent-red text-sm">{wipeError}</p>}
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setWipeTarget(null)}
                className="flex-1 py-2.5 border border-border-color rounded-lg text-sm text-text-secondary hover:bg-bg-tertiary transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleWipe}
                disabled={wiping || wipeConfirmText !== wipeTarget.name}
                className="flex-1 py-2.5 bg-accent-red text-white rounded-lg text-sm font-medium hover:bg-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {wiping && <Loader2 size={14} className="animate-spin" />}
                Apagar base
              </button>
            </div>
          </div>
        </Modal>
      )}
    </>
  )
}

// ── Tab: Usuários ─────────────────────────────────────────────────────────────
function TabUsuarios({ apiCall }) {
  const [users, setUsers] = useState([])
  const [companies, setCompanies] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({ email: '', nome: '', password: '', company_id: '', role: 'admin' })

  const load = useCallback(async () => {
    setLoading(true)
    const [usersRes, companiesRes] = await Promise.all([
      apiCall('GET', 'list_users'),
      apiCall('GET', 'list_companies'),
    ])
    if (usersRes.users) setUsers(usersRes.users)
    if (companiesRes.companies) setCompanies(companiesRes.companies.filter(c => c.ativo))
    setLoading(false)
  }, [apiCall])

  useEffect(() => { load() }, [load])

  function companyName(id) {
    return companies.find(c => c.id === id)?.name || '—'
  }

  function openModal() {
    setError('')
    setForm({ email: '', nome: '', password: '', company_id: companies[0]?.id || '', role: 'admin' })
    setShowModal(true)
  }

  async function handleCreate() {
    setError('')
    if (!form.email || !form.nome || !form.password || !form.company_id) {
      setError('Todos os campos são obrigatórios.')
      return
    }
    setSaving(true)
    const res = await apiCall('POST', null, { action: 'create_user', ...form })
    setSaving(false)
    if (res.error) { setError(res.error); return }
    setShowModal(false)
    load()
  }

  async function handleToggle(u) {
    await apiCall('POST', null, { action: 'toggle_perfil', user_id: u.user_id, ativo: !u.ativo })
    load()
  }

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-text-secondary">{users.length} usuário(s) cadastrado(s)</p>
        <button
          onClick={openModal}
          className="flex items-center gap-2 px-4 py-2 bg-accent-blue text-white text-sm rounded-lg hover:bg-blue-600 transition-colors"
        >
          <Plus size={14} /> Novo Usuário
        </button>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-text-secondary text-sm">
          <Loader2 size={16} className="animate-spin" /> Carregando...
        </div>
      ) : (
        <div className="bg-bg-secondary border border-border-color rounded-xl overflow-hidden overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border-color">
                {['Nome', 'Email', 'Empresa', 'Role', 'Status'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-text-secondary font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-text-secondary">
                    Nenhum usuário cadastrado. Crie o primeiro admin acima.
                  </td>
                </tr>
              ) : users.map(u => (
                <tr key={u.user_id} className="border-b border-border-color/50 hover:bg-bg-tertiary/50">
                  <td className="px-4 py-3 text-text-primary">{u.nome || '—'}</td>
                  <td className="px-4 py-3 text-text-secondary">{u.email || '—'}</td>
                  <td className="px-4 py-3 text-text-secondary">{companyName(u.company_id)}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs ${
                      u.role === 'admin'
                        ? 'bg-accent-green/20 text-accent-green'
                        : 'bg-bg-tertiary text-text-secondary'
                    }`}>
                      {u.role}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge ativo={u.ativo} onClick={() => handleToggle(u)} activeLabel="Ativo" inactiveLabel="Inativo" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <Modal title="Novo Usuário" onClose={() => setShowModal(false)}>
          <div className="space-y-4">
            <Field label="Email">
              <input
                type="email"
                value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                className={inputCls}
                placeholder="admin@empresa.com"
                autoFocus
              />
            </Field>
            <Field label="Nome">
              <input
                value={form.nome}
                onChange={e => setForm(f => ({ ...f, nome: e.target.value }))}
                className={inputCls}
                placeholder="Nome completo"
              />
            </Field>
            <Field label="Senha inicial">
              <input
                type="password"
                value={form.password}
                onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                className={inputCls}
                placeholder="Mínimo 6 caracteres"
              />
            </Field>
            <Field label="Empresa">
              <select
                value={form.company_id}
                onChange={e => setForm(f => ({ ...f, company_id: e.target.value }))}
                className={inputCls}
              >
                <option value="">Selecione uma empresa</option>
                {companies.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              {companies.length === 0 && (
                <p className="text-xs text-accent-red mt-1">Nenhuma empresa ativa. Crie uma empresa primeiro.</p>
              )}
            </Field>
            <Field label="Role">
              <select
                value={form.role}
                onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
                className={inputCls}
              >
                <option value="admin">Admin — importa planilhas, cria operadores</option>
                <option value="operador">Operador — relaciona equipes/cidades, cria consultas</option>
                <option value="consulta">Consulta — somente leitura (por equipe)</option>
              </select>
            </Field>
            {error && <p className="text-accent-red text-sm">{error}</p>}
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 py-2.5 border border-border-color rounded-lg text-sm text-text-secondary hover:bg-bg-tertiary transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleCreate}
                disabled={saving || companies.length === 0}
                className="flex-1 py-2.5 bg-accent-blue text-white rounded-lg text-sm font-medium hover:bg-blue-600 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {saving && <Loader2 size={14} className="animate-spin" />}
                Criar Usuário
              </button>
            </div>
          </div>
        </Modal>
      )}
    </>
  )
}

// ── Tab: Logs de Imports (todas as empresas; exclusão exclusiva do master) ───
function TabLogs() {
  const [uploads, setUploads] = useState([])
  const [companies, setCompanies] = useState([])
  const [filterCompany, setFilterCompany] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    const [{ data: ups, error: e1 }, { data: comps }] = await Promise.all([
      supabase
        .from('uploads')
        .select('id, company_id, filename, status, row_count, error_msg, uploaded_at')
        .order('uploaded_at', { ascending: false })
        .limit(200),
      supabase.from('companies').select('id, codigo, name').order('codigo'),
    ])
    if (e1) setError(e1.message)
    setUploads(ups || [])
    setCompanies(comps || [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const companyName = id => {
    const c = companies.find(c => c.id === id)
    return c ? `${String(c.codigo ?? '').padStart(3, '0')} — ${c.name}` : '—'
  }

  const visible = useMemo(
    () => filterCompany ? uploads.filter(u => u.company_id === filterCompany) : uploads,
    [uploads, filterCompany]
  )

  async function handleDelete(id) {
    const { error } = await supabase.from('uploads').delete().eq('id', id)
    if (error) setError(error.message)
    load()
  }

  async function handleClear() {
    const alvo = filterCompany ? companyName(filterCompany) : 'TODAS as empresas'
    if (!window.confirm(`Apagar os logs de import de ${alvo}?`)) return
    let q = supabase.from('uploads').delete()
    q = filterCompany ? q.eq('company_id', filterCompany) : q.gte('uploaded_at', '1970-01-01')
    const { error } = await q
    if (error) setError(error.message)
    load()
  }

  if (loading) return <div className="flex items-center gap-2 text-text-secondary"><Loader2 size={16} className="animate-spin" /> Carregando...</div>

  return (
    <>
      <div className="flex items-center justify-between gap-4 mb-4 flex-wrap">
        <select
          value={filterCompany}
          onChange={e => setFilterCompany(e.target.value)}
          className="bg-bg-tertiary border border-border-color text-text-primary text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-accent-blue min-w-[240px]"
        >
          <option value="">Todas as empresas</option>
          {companies.map(c => (
            <option key={c.id} value={c.id}>{String(c.codigo ?? '').padStart(3, '0')} — {c.name}</option>
          ))}
        </select>
        {visible.length > 0 && (
          <button
            onClick={handleClear}
            className="flex items-center gap-1.5 text-xs text-accent-red hover:bg-accent-red/10 border border-accent-red/30 rounded-lg px-3 py-2 transition-colors"
          >
            <Trash2 size={12} /> Limpar logs {filterCompany ? 'da empresa' : '(todas)'}
          </button>
        )}
      </div>

      {error && <p className="text-sm text-accent-red mb-3">{error}</p>}

      {visible.length === 0 ? (
        <p className="text-sm text-text-secondary">Nenhum log de import.</p>
      ) : (
        <div className="bg-bg-secondary border border-border-color rounded-xl overflow-hidden overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border-color">
                {['Empresa', 'Arquivo', 'Linhas', 'Status', 'Data', 'Ações'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-text-secondary font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visible.map(u => (
                <tr key={u.id} className="border-b border-border-color/50 hover:bg-bg-tertiary/50">
                  <td className="px-4 py-3 text-text-secondary text-xs whitespace-nowrap">{companyName(u.company_id)}</td>
                  <td className="px-4 py-3 text-text-primary truncate max-w-xs" title={u.filename}>{u.filename}</td>
                  <td className="px-4 py-3 text-text-secondary">{u.row_count ?? '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs ${
                      u.status === 'ok' ? 'bg-accent-green/20 text-accent-green' : 'bg-accent-red/20 text-accent-red'
                    }`}>
                      {u.status === 'ok' ? 'Sucesso' : 'Erro'}
                    </span>
                    {u.error_msg && <p className="text-xs text-accent-red mt-1 truncate max-w-xs" title={u.error_msg}>{u.error_msg}</p>}
                  </td>
                  <td className="px-4 py-3 text-text-secondary text-xs whitespace-nowrap">
                    {new Date(u.uploaded_at).toLocaleString('pt-BR')}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => handleDelete(u.id)}
                      title="Excluir log"
                      className="text-text-secondary hover:text-accent-red p-1 rounded transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function Master() {
  const { session } = useAuth()
  const [tab, setTab] = useState('companies')

  const apiCall = useCallback(async (method, getAction, postBody) => {
    const url = method === 'GET'
      ? `/api/master?action=${getAction}`
      : '/api/master'
    try {
      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.token}`,
        },
        body: postBody ? JSON.stringify(postBody) : undefined,
      })
      return await res.json()
    } catch (e) {
      return { error: e.message }
    }
  }, [session.token])

  const tabs = [
    ['companies', 'Empresas'],
    ['users', 'Usuários'],
    ['logs', 'Logs de Imports'],
  ]

  return (
    <div className="p-4 md:p-6 animate-fade-in">
      <PageHeader title="Painel Master" />

      <div className="flex gap-1 bg-bg-secondary border border-border-color rounded-xl p-1 w-fit mb-6">
        {tabs.map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-4 py-2 rounded-lg text-sm transition-colors ${
              tab === key
                ? 'bg-accent-blue text-white font-medium'
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'companies' && <TabEmpresas apiCall={apiCall} />}
      {tab === 'users' && <TabUsuarios apiCall={apiCall} />}
      {tab === 'logs' && <TabLogs />}
    </div>
  )
}
