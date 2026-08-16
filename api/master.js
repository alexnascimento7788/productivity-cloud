// Vercel Serverless Function — /api/master
// Somente master. Gerencia empresas e usuários (admin/viewer).

const { createClient } = require('@supabase/supabase-js')

const strip = s => (s?.charCodeAt(0) === 0xFEFF ? s.slice(1) : s ?? '')

function getSupabase() {
  return createClient(
    strip(process.env.SUPABASE_URL),
    strip(process.env.SUPABASE_SERVICE_KEY),
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

module.exports = async function handler(req, res) {
  // ── 1. Auth ──────────────────────────────────────────────────────────────────
  const token = (req.headers.authorization || '').replace('Bearer ', '').trim()
  if (!token) return res.status(401).json({ error: 'Token ausente' })

  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
    return res.status(500).json({ error: 'SUPABASE_URL / SUPABASE_SERVICE_KEY não configurados' })
  }

  const supabase = getSupabase()

  const { data: { user }, error: authErr } = await supabase.auth.getUser(token)
  if (authErr || !user) return res.status(401).json({ error: 'Token inválido ou expirado' })

  const { data: perfil } = await supabase
    .from('perfis')
    .select('role, ativo')
    .eq('user_id', user.id)
    .single()

  if (!perfil || !perfil.ativo || perfil.role !== 'master') {
    return res.status(403).json({ error: 'Acesso restrito ao master' })
  }

  // ── 2. Roteamento por action ──────────────────────────────────────────────────
  const action = req.method === 'GET' ? req.query.action : (req.body || {}).action
  const body = req.body || {}

  // ── list_companies ───────────────────────────────────────────────────────────
  if (action === 'list_companies') {
    const { data, error } = await supabase
      .from('companies')
      .select('id, codigo, name, slug, ativo, created_at, geo_padrao_habilitado, geo_vendas_cidades_habilitado')
      .order('codigo', { ascending: true })
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ companies: data })
  }

  // ── list_users ───────────────────────────────────────────────────────────────
  if (action === 'list_users') {
    const { data: perfis, error: perfisErr } = await supabase
      .from('perfis')
      .select('user_id, nome, role, ativo, company_id')
      .neq('role', 'master')
      .order('role')
    if (perfisErr) return res.status(500).json({ error: perfisErr.message })

    const { data: usersData, error: usersErr } = await supabase.auth.admin.listUsers({ perPage: 1000 })
    const emailMap = {}
    if (!usersErr && usersData?.users) {
      usersData.users.forEach(u => { emailMap[u.id] = u.email })
    }

    return res.status(200).json({
      users: (perfis || []).map(p => ({ ...p, email: emailMap[p.user_id] || null }))
    })
  }

  // ── create_company ───────────────────────────────────────────────────────────
  if (req.method === 'POST' && action === 'create_company') {
    const { name, slug } = body
    if (!name?.trim() || !slug?.trim()) {
      return res.status(400).json({ error: 'Nome e slug são obrigatórios' })
    }
    const slugClean = slug.trim().toLowerCase().replace(/[^a-z0-9-]/g, '')
    if (!slugClean) return res.status(400).json({ error: 'Slug inválido' })

    const { data, error } = await supabase
      .from('companies')
      .insert({ name: name.trim(), slug: slugClean, created_by: user.id })
      .select()
      .single()

    if (error) return res.status(400).json({ error: error.message })
    return res.status(200).json({ company: data })
  }

  // ── create_user ───────────────────────────────────────────────────────────────
  if (req.method === 'POST' && action === 'create_user') {
    const { email, nome, password, company_id, role } = body
    if (!email || !nome || !password || !company_id || !role) {
      return res.status(400).json({ error: 'Campos obrigatórios: email, nome, password, company_id, role' })
    }
    if (!['admin', 'operador', 'consulta'].includes(role)) {
      return res.status(400).json({ error: 'Role deve ser admin, operador ou consulta' })
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Senha deve ter ao menos 6 caracteres' })
    }

    const { data: newUser, error: createErr } = await supabase.auth.admin.createUser({
      email: email.trim().toLowerCase(),
      password,
      email_confirm: true,
    })
    if (createErr) return res.status(400).json({ error: createErr.message })

    const { error: perfilErr } = await supabase
      .from('perfis')
      .insert({ user_id: newUser.user.id, company_id, role, nome: nome.trim(), ativo: true, must_change_password: true })

    if (perfilErr) {
      await supabase.auth.admin.deleteUser(newUser.user.id)
      return res.status(500).json({ error: 'Erro ao criar perfil: ' + perfilErr.message })
    }

    return res.status(200).json({ ok: true, user_id: newUser.user.id })
  }

  // ── wipe_company_data ────────────────────────────────────────────────────────
  // Apaga TODA a base importada da empresa: vendas, clientes, vendedores,
  // equipes, de/para de cidades e histórico de imports. Depois do wipe a
  // empresa fica zerada; um novo import recria equipes e de/para do zero.
  if (req.method === 'POST' && action === 'wipe_company_data') {
    const { company_id } = body
    if (!company_id) return res.status(400).json({ error: 'company_id é obrigatório' })

    const { data: company } = await supabase
      .from('companies')
      .select('id, name')
      .eq('id', company_id)
      .single()
    if (!company) return res.status(404).json({ error: 'Empresa não encontrada' })

    try {
      for (const table of ['vendas_mensais', 'ultima_compra', 'clientes', 'vendedores', 'cidades_depara', 'equipes']) {
        const { error } = await supabase.from(table).delete().eq('company_id', company_id)
        if (error) throw new Error(`${table}: ${error.message}`)
      }

      const { data: files } = await supabase.storage.from('planilhas').list(company_id)
      if (files?.length) {
        const paths = files.map(f => `${company_id}/${f.name}`)
        const { error: removeErr } = await supabase.storage.from('planilhas').remove(paths)
        if (removeErr) console.warn('Storage remove warning:', removeErr.message)
      }

      const { error: uploadsErr } = await supabase.from('uploads').delete().eq('company_id', company_id)
      if (uploadsErr) throw new Error('uploads: ' + uploadsErr.message)
    } catch (err) {
      return res.status(500).json({ error: err.message })
    }

    return res.status(200).json({ ok: true })
  }

  // ── update_company_geo_flags ────────────────────────────────────────────────
  if (req.method === 'POST' && action === 'update_company_geo_flags') {
    const { company_id, geo_padrao_habilitado, geo_vendas_cidades_habilitado } = body
    if (!company_id) return res.status(400).json({ error: 'company_id é obrigatório' })

    const updates = {}
    if (geo_padrao_habilitado !== undefined) updates.geo_padrao_habilitado = geo_padrao_habilitado
    if (geo_vendas_cidades_habilitado !== undefined) updates.geo_vendas_cidades_habilitado = geo_vendas_cidades_habilitado
    if (!Object.keys(updates).length) return res.status(400).json({ error: 'Nenhuma flag informada' })

    const { error } = await supabase.from('companies').update(updates).eq('id', company_id)
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ ok: true })
  }

  // ── toggle_company ───────────────────────────────────────────────────────────
  if (req.method === 'POST' && action === 'toggle_company') {
    const { company_id, ativo } = body
    if (!company_id || ativo === undefined) {
      return res.status(400).json({ error: 'company_id e ativo são obrigatórios' })
    }
    const { error } = await supabase.from('companies').update({ ativo }).eq('id', company_id)
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ ok: true })
  }

  // ── toggle_perfil ─────────────────────────────────────────────────────────────
  if (req.method === 'POST' && action === 'toggle_perfil') {
    const { user_id: targetId, ativo } = body
    if (!targetId || ativo === undefined) {
      return res.status(400).json({ error: 'user_id e ativo são obrigatórios' })
    }
    const { error } = await supabase.from('perfis').update({ ativo }).eq('user_id', targetId)
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ ok: true })
  }

  // ── delete_user ───────────────────────────────────────────────────────────────
  // Apaga o usuário do Auth; o perfil cai junto via ON DELETE CASCADE.
  if (req.method === 'POST' && action === 'delete_user') {
    const { user_id: targetId } = body
    if (!targetId) return res.status(400).json({ error: 'user_id é obrigatório' })
    if (targetId === user.id) return res.status(400).json({ error: 'Você não pode excluir o próprio usuário' })

    const { data: targetPerfil } = await supabase
      .from('perfis')
      .select('role')
      .eq('user_id', targetId)
      .single()
    if (targetPerfil?.role === 'master') {
      return res.status(400).json({ error: 'Não é possível excluir um usuário master por aqui' })
    }

    const { error } = await supabase.auth.admin.deleteUser(targetId)
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ ok: true })
  }

  // ── delete_company ───────────────────────────────────────────────────────────
  // Apaga a empresa por completo: usuários (Auth), arquivos no Storage e, via
  // ON DELETE CASCADE em company_id, todas as tabelas de dados (clientes, vendas,
  // equipes, cidades_depara, geo_*, uploads, parametros, perfis).
  if (req.method === 'POST' && action === 'delete_company') {
    const { company_id } = body
    if (!company_id) return res.status(400).json({ error: 'company_id é obrigatório' })

    const { data: company } = await supabase
      .from('companies')
      .select('id, name')
      .eq('id', company_id)
      .single()
    if (!company) return res.status(404).json({ error: 'Empresa não encontrada' })

    try {
      const { data: perfisEmpresa } = await supabase
        .from('perfis')
        .select('user_id')
        .eq('company_id', company_id)

      const { data: files } = await supabase.storage.from('planilhas').list(company_id)
      if (files?.length) {
        const paths = files.map(f => `${company_id}/${f.name}`)
        const { error: removeErr } = await supabase.storage.from('planilhas').remove(paths)
        if (removeErr) console.warn('Storage remove warning:', removeErr.message)
      }

      for (const p of perfisEmpresa || []) {
        const { error: delUserErr } = await supabase.auth.admin.deleteUser(p.user_id)
        if (delUserErr) console.warn('Auth deleteUser warning:', delUserErr.message)
      }

      const { error: companyErr } = await supabase.from('companies').delete().eq('id', company_id)
      if (companyErr) throw new Error(companyErr.message)
    } catch (err) {
      return res.status(500).json({ error: err.message })
    }

    return res.status(200).json({ ok: true })
  }

  return res.status(400).json({ error: 'Ação desconhecida: ' + action })
}
