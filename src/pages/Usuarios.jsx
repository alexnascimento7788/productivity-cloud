import React, { useEffect, useState, useRef, useCallback } from 'react'
import { Plus, Edit2, X, Loader2, Save, Upload, CheckCircle, AlertCircle, FileSpreadsheet } from 'lucide-react'
import { useData, useParams, useAuth } from '../App'
import PageHeader from '../components/PageHeader'
import ImportPlanilha from '../components/ImportPlanilha'
import { supabase } from '../lib/supabaseClient'

function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/60" onClick={onClose} />
      <div className="relative bg-bg-secondary border border-border-color rounded-2xl p-6 w-full max-w-md shadow-2xl animate-fade-in">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-text-primary">{title}</h2>
          <button onClick={onClose} className="text-text-secondary hover:text-text-primary"><X size={18} /></button>
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

const inputCls = "w-full bg-bg-tertiary border border-border-color text-text-primary text-sm rounded-lg px-3 py-2.5 focus:outline-none focus:ring-1 focus:ring-accent-blue"

// ── Tab: Parâmetros ───────────────────────────────────────────────────────────
function TabParametros() {
  const { diasBloqueio, diasInativacao, curvaAMin, curvaBMin, updateParam } = useParams()

  const [localBloqueio, setLocalBloqueio] = useState(String(diasBloqueio))
  const [localInativacao, setLocalInativacao] = useState(String(diasInativacao))
  const [localCurvaA, setLocalCurvaA] = useState(String(curvaAMin))
  const [localCurvaB, setLocalCurvaB] = useState(String(curvaBMin))
  const [saving, setSaving] = useState(false)
  const [feedback, setFeedback] = useState('')
  const [curvaFeedback, setCurvaFeedback] = useState('')

  useEffect(() => {
    setLocalBloqueio(String(diasBloqueio))
    setLocalInativacao(String(diasInativacao))
    setLocalCurvaA(String(curvaAMin))
    setLocalCurvaB(String(curvaBMin))
  }, [diasBloqueio, diasInativacao, curvaAMin, curvaBMin])

  async function handleSaveParams() {
    const b = parseInt(localBloqueio)
    const i = parseInt(localInativacao)
    if (isNaN(b) || isNaN(i)) { setFeedback('Valores inválidos.'); return }
    if (i <= b) { setFeedback('Dias de Inativação deve ser maior que Dias de Bloqueio.'); return }
    setSaving(true)
    await updateParam('dias_bloqueio', b)
    await updateParam('dias_inativacao', i)
    setSaving(false)
    setFeedback('Parâmetros salvos com sucesso!')
    setTimeout(() => setFeedback(''), 3000)
  }

  async function handleSaveCurva() {
    const a = parseInt(localCurvaA)
    const bv = parseInt(localCurvaB)
    if (isNaN(a) || isNaN(bv) || a < 1 || bv < 1) { setCurvaFeedback('Valores inválidos.'); return }
    if (bv >= a) { setCurvaFeedback('O mínimo da Curva B deve ser menor que o da Curva A.'); return }
    setSaving(true)
    await updateParam('curva_a_min', a)
    await updateParam('curva_b_min', bv)
    setSaving(false)
    setCurvaFeedback('Parâmetros da Curva ABC salvos!')
    setTimeout(() => setCurvaFeedback(''), 3000)
  }

  return (
    <div className="space-y-8">
      <div className="bg-bg-secondary border border-border-color rounded-xl p-5">
        <h3 className="text-sm font-semibold text-text-primary mb-4">Parâmetros de Status de Cliente</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          <Field label="Dias para Bloqueio">
            <input type="number" value={localBloqueio} onChange={e => setLocalBloqueio(e.target.value)} className={inputCls} min={1} />
            <p className="text-xs text-text-secondary mt-1">Clientes sem compra há X dias → 🟡 BLOQUEADO</p>
          </Field>
          <Field label="Dias para Inativação">
            <input type="number" value={localInativacao} onChange={e => setLocalInativacao(e.target.value)} className={inputCls} min={1} />
            <p className="text-xs text-text-secondary mt-1">Clientes sem compra há X dias → 🔴 INATIVO</p>
          </Field>
        </div>
        {feedback && <p className={`text-sm mb-3 ${feedback.includes('sucesso') ? 'text-accent-green' : 'text-accent-red'}`}>{feedback}</p>}
        <button onClick={handleSaveParams} disabled={saving} className="flex items-center gap-2 px-4 py-2 bg-accent-blue text-white text-sm rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-60">
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
          Salvar parâmetros
        </button>
      </div>

      <div className="bg-bg-secondary border border-border-color rounded-xl p-5">
        <h3 className="text-sm font-semibold text-text-primary mb-1">Parâmetros da Curva ABC</h3>
        <p className="text-xs text-text-secondary mb-4">
          Classifica cada cliente pelo faturamento do <strong className="text-text-primary">mês anterior</strong>.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          <Field label="Mínimo para Curva A (R$)">
            <input type="number" value={localCurvaA} onChange={e => setLocalCurvaA(e.target.value)} className={inputCls} min={1} />
            <p className="text-xs text-accent-green mt-1">Curva A: faturamento ≥ R$ {Number(localCurvaA || 0).toLocaleString('pt-BR')}</p>
          </Field>
          <Field label="Mínimo para Curva B (R$)">
            <input type="number" value={localCurvaB} onChange={e => setLocalCurvaB(e.target.value)} className={inputCls} min={1} />
            <p className="text-xs text-accent-blue mt-1">Curva B: R$ {Number(localCurvaB || 0).toLocaleString('pt-BR')} – R$ {Math.max(0, Number(localCurvaA || 0) - 1).toLocaleString('pt-BR')}</p>
          </Field>
        </div>
        {curvaFeedback && <p className={`text-sm mb-3 ${curvaFeedback.includes('inválid') || curvaFeedback.includes('deve') ? 'text-accent-red' : 'text-accent-green'}`}>{curvaFeedback}</p>}
        <button onClick={handleSaveCurva} disabled={saving} className="flex items-center gap-2 px-4 py-2 bg-accent-blue text-white text-sm rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-60">
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
          Salvar Curva ABC
        </button>
      </div>
    </div>
  )
}

// ── Tab: Usuários (perfis da empresa) ─────────────────────────────────────────
// admin cria operador/consulta; operador cria consulta (definindo as equipes)
const ROLES_CRIAVEIS = {
  master:   ['admin', 'operador', 'consulta'],
  admin:    ['operador', 'consulta'],
  operador: ['consulta'],
}

function EquipesMultiSelect({ equipesList, selected, onChange }) {
  if (!equipesList.length) {
    return <p className="text-xs text-accent-amber">Nenhuma equipe cadastrada — importe a planilha primeiro.</p>
  }
  function toggle(cod) {
    onChange(selected.includes(cod) ? selected.filter(c => c !== cod) : [...selected, cod])
  }
  return (
    <div className="border border-border-color rounded-lg max-h-44 overflow-y-auto bg-bg-tertiary">
      {equipesList.map(eq => (
        <label key={eq.cod_equipe} className="flex items-center gap-2 px-3 py-2 text-sm text-text-secondary hover:bg-bg-secondary cursor-pointer">
          <input
            type="checkbox"
            checked={selected.includes(eq.cod_equipe)}
            onChange={() => toggle(eq.cod_equipe)}
            className="accent-accent-blue"
          />
          <span className="flex-1">{eq.nome}</span>
          <span className="text-xs text-text-secondary/50">{eq.cod_equipe}</span>
        </label>
      ))}
    </div>
  )
}

function roleBadgeCls(role) {
  if (role === 'master') return 'bg-accent-blue/20 text-accent-blue'
  if (role === 'admin') return 'bg-accent-green/20 text-accent-green'
  if (role === 'operador') return 'bg-accent-amber/20 text-accent-amber'
  return 'bg-bg-tertiary text-text-secondary'
}

function TabUsuarios({ session }) {
  const { equipesList } = useData()
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editUser, setEditUser] = useState(null)   // null = criação
  const [saving, setSaving] = useState(false)
  const [feedback, setFeedback] = useState('')
  const [listError, setListError] = useState('')

  const rolesCriaveis = ROLES_CRIAVEIS[session.role] || []
  const [form, setForm] = useState({ email: '', nome: '', password: '', role: rolesCriaveis[0] || 'consulta', ativo: true, equipes: [] })

  async function api(payload) {
    const res = await fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.token}` },
      body: JSON.stringify(payload),
    })
    return res.json()
  }

  async function loadUsers() {
    setLoading(true)
    setListError('')
    const json = await api({ action: 'list_users' })
    if (json.users) setUsers(json.users)
    else setListError(json.error || 'Erro ao listar usuários')
    setLoading(false)
  }

  useEffect(() => { loadUsers() }, [])

  function openCreate() {
    setEditUser(null)
    setForm({ email: '', nome: '', password: '', role: rolesCriaveis[0] || 'consulta', ativo: true, equipes: [] })
    setFeedback('')
    setShowModal(true)
  }

  function openEdit(u) {
    setEditUser(u)
    setForm({ email: u.email || '', nome: u.nome || '', password: '', role: u.role, ativo: u.ativo, equipes: u.equipes || [] })
    setFeedback('')
    setShowModal(true)
  }

  async function handleToggleAtivo(u) {
    const json = await api({ action: 'update_user', user_id: u.user_id, ativo: !u.ativo })
    if (json.error) setListError(json.error)
    loadUsers()
  }

  async function handleSave() {
    setSaving(true)
    setFeedback('')
    let json
    if (editUser) {
      json = await api({
        action: 'update_user',
        user_id: editUser.user_id,
        nome: form.nome,
        ativo: form.ativo,
        ...(editUser.role === 'consulta' ? { equipes: form.equipes } : {}),
      })
    } else {
      json = await api({
        action: 'create_user',
        email: form.email,
        nome: form.nome,
        password: form.password,
        role: form.role,
        ...(form.role === 'consulta' ? { equipes: form.equipes } : {}),
      })
    }
    setSaving(false)
    if (json.error) { setFeedback(json.error); return }
    setShowModal(false)
    loadUsers()
  }

  const equipeNome = cod => equipesList.find(e => e.cod_equipe === cod)?.nome || 'Equipe ' + cod

  if (loading) return <div className="flex items-center gap-2 text-text-secondary"><Loader2 size={16} className="animate-spin" /> Carregando...</div>

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs text-text-secondary">
          {session.role === 'admin' && 'Como admin, você cadastra usuários Operador e Consulta.'}
          {session.role === 'operador' && 'Como operador, você cadastra os Usuários de Consulta e define as equipes que cada um enxerga.'}
          {session.role === 'master' && 'Usuários da empresa selecionada.'}
        </p>
        {rolesCriaveis.length > 0 && (
          <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2 bg-accent-blue text-white text-sm rounded-lg hover:bg-blue-600 transition-colors">
            <Plus size={14} /> Novo usuário
          </button>
        )}
      </div>

      {listError && <p className="text-sm text-accent-red mb-3">{listError}</p>}

      <div className="bg-bg-secondary border border-border-color rounded-xl overflow-hidden overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border-color">
              {['Nome', 'E-mail', 'Perfil', 'Equipes', 'Status', 'Ações'].map(h => (
                <th key={h} className="px-4 py-3 text-left text-text-secondary font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {users.filter(p => p.user_id !== session.id).map(p => (
              <tr key={p.user_id} className="border-b border-border-color/50 hover:bg-bg-tertiary/50">
                <td className="px-4 py-3 text-text-primary">{p.nome || '—'}</td>
                <td className="px-4 py-3 text-text-secondary text-xs">{p.email || '—'}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs ${roleBadgeCls(p.role)}`}>{p.role}</span>
                </td>
                <td className="px-4 py-3 text-xs text-text-secondary max-w-[220px]">
                  {p.role === 'consulta'
                    ? ((p.equipes || []).map(equipeNome).join(', ') || '—')
                    : 'Todas'}
                </td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => handleToggleAtivo(p)}
                    className={`px-2 py-0.5 rounded-full text-xs cursor-pointer ${p.ativo ? 'bg-accent-green/20 text-accent-green hover:bg-accent-red/20 hover:text-accent-red' : 'bg-accent-red/20 text-accent-red hover:bg-accent-green/20 hover:text-accent-green'}`}
                  >
                    {p.ativo ? 'Ativo' : 'Inativo'}
                  </button>
                </td>
                <td className="px-4 py-3">
                  <button onClick={() => openEdit(p)} className="text-text-secondary hover:text-accent-blue p-1"><Edit2 size={14} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {users.filter(p => p.user_id !== session.id).length === 0 && (
          <p className="px-4 py-5 text-sm text-text-secondary">Nenhum usuário cadastrado ainda.</p>
        )}
      </div>

      {showModal && (
        <Modal title={editUser ? 'Editar usuário' : 'Novo usuário'} onClose={() => setShowModal(false)}>
          <div className="space-y-4">
            {!editUser && (
              <>
                <Field label="E-mail">
                  <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} className={inputCls} />
                </Field>
                <Field label="Senha provisória (o usuário troca no 1º acesso)">
                  <input type="text" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} className={inputCls} />
                </Field>
                <Field label="Perfil">
                  <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))} className={inputCls}>
                    {rolesCriaveis.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </Field>
              </>
            )}
            <Field label="Nome">
              <input value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} className={inputCls} />
            </Field>
            {editUser && (
              <Field label="Status">
                <select value={form.ativo ? '1' : '0'} onChange={e => setForm(f => ({ ...f, ativo: e.target.value === '1' }))} className={inputCls}>
                  <option value="1">Ativo</option>
                  <option value="0">Inativo</option>
                </select>
              </Field>
            )}
            {((editUser && editUser.role === 'consulta') || (!editUser && form.role === 'consulta')) && (
              <Field label="Equipes visíveis (1 ou mais)">
                <EquipesMultiSelect
                  equipesList={equipesList}
                  selected={form.equipes}
                  onChange={equipes => setForm(f => ({ ...f, equipes }))}
                />
              </Field>
            )}
            {feedback && <p className="text-accent-red text-sm">{feedback}</p>}
            <div className="flex gap-3 pt-2">
              <button onClick={() => setShowModal(false)} className="flex-1 py-2.5 border border-border-color rounded-lg text-sm text-text-secondary hover:bg-bg-tertiary transition-colors">Cancelar</button>
              <button onClick={handleSave} disabled={saving} className="flex-1 py-2.5 bg-accent-blue text-white rounded-lg text-sm font-medium hover:bg-blue-600 transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
                {saving && <Loader2 size={14} className="animate-spin" />} Salvar
              </button>
            </div>
          </div>
        </Modal>
      )}
    </>
  )
}

// ── Tab: Importar Planilha (componente compartilhado com /importar) ──────────
function TabImportar({ session }) {
  return <ImportPlanilha session={session} />
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function Usuarios() {
  const { session } = useAuth()
  const [tab, setTab] = useState('users')

  const elevated = session?.role === 'master' || session?.role === 'admin'
  const tabs = [
    ['users', 'Usuários'],
    ...(elevated ? [['parametros', 'Parâmetros']] : []),
    ...(session?.role === 'admin' ? [['importar', 'Importar Planilha']] : []),
  ]

  return (
    <div className="p-4 md:p-6 animate-fade-in">
      <PageHeader title="Painel de Usuários" />

      <div className="flex gap-1 bg-bg-secondary border border-border-color rounded-xl p-1 w-fit mb-6">
        {tabs.map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-4 py-2 rounded-lg text-sm transition-colors ${tab === key ? 'bg-accent-blue text-white font-medium' : 'text-text-secondary hover:text-text-primary'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'users' && <TabUsuarios session={session} />}
      {tab === 'parametros' && <TabParametros />}
      {tab === 'importar' && <TabImportar session={session} />}
    </div>
  )
}
