// Vercel Serverless Function — /api/users
// Gestão de usuários da empresa:
//   admin    → cria/edita operador e consulta
//   operador → cria/edita consulta (define as equipes visíveis)
//   qualquer logado → change_password (limpa must_change_password)

const { createClient } = require('@supabase/supabase-js')

const strip = s => (s?.charCodeAt(0) === 0xFEFF ? s.slice(1) : s ?? '')

// quem pode criar/editar qual role
const PODE_GERENCIAR = {
  master:   ['admin', 'operador', 'consulta'],
  admin:    ['operador', 'consulta'],
  operador: ['consulta'],
}

module.exports = async function handler(req, res) {
  try {
    const token = (req.headers.authorization || '').replace('Bearer ', '').trim()
    if (!token) return res.status(401).json({ error: 'Token ausente' })

    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
      return res.status(500).json({ error: 'SUPABASE_URL / SUPABASE_SERVICE_KEY não configurados' })
    }

    const supabase = createClient(
      strip(process.env.SUPABASE_URL),
      strip(process.env.SUPABASE_SERVICE_KEY),
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    const { data: { user }, error: authErr } = await supabase.auth.getUser(token)
    if (authErr || !user) return res.status(401).json({ error: 'Token inválido ou expirado' })

    const { data: perfil } = await supabase
      .from('perfis')
      .select('role, ativo, company_id')
      .eq('user_id', user.id)
      .single()

    if (!perfil || !perfil.ativo) {
      return res.status(403).json({ error: 'Usuário inativo ou sem perfil' })
    }

    const action = req.method === 'GET' ? req.query.action : (req.body || {}).action
    const body = req.body || {}

    // ── change_password — qualquer usuário logado troca a própria senha ─────────
    if (req.method === 'POST' && action === 'change_password') {
      const { password } = body
      if (!password || password.length < 6) {
        return res.status(400).json({ error: 'Senha deve ter ao menos 6 caracteres' })
      }
      const { error: pwErr } = await supabase.auth.admin.updateUserById(user.id, { password })
      if (pwErr) return res.status(400).json({ error: pwErr.message })

      await supabase.from('perfis').update({ must_change_password: false }).eq('user_id', user.id)
      return res.status(200).json({ ok: true })
    }

    // ── daqui pra baixo: somente staff (master/admin/operador) ──────────────────
    const rolesGerenciaveis = PODE_GERENCIAR[perfil.role] || []
    if (!rolesGerenciaveis.length) {
      return res.status(403).json({ error: 'Sem permissão para gerenciar usuários' })
    }

    // master pode informar company_id; demais usam a própria empresa
    const companyId = perfil.role === 'master' ? (body.company_id || req.query.company_id) : perfil.company_id
    if (!companyId) return res.status(400).json({ error: 'company_id não definido' })

    // ── list_users ───────────────────────────────────────────────────────────────
    if (action === 'list_users') {
      const { data: perfis, error } = await supabase
        .from('perfis')
        .select('user_id, nome, role, ativo, company_id, equipes, must_change_password')
        .eq('company_id', companyId)
        .order('role')
      if (error) return res.status(500).json({ error: error.message })

      const { data: usersData } = await supabase.auth.admin.listUsers({ perPage: 1000 })
      const emailMap = {}
      for (const u of usersData?.users || []) emailMap[u.id] = u.email

      return res.status(200).json({
        users: (perfis || []).map(p => ({ ...p, email: emailMap[p.user_id] || null })),
      })
    }

    // ── create_user ──────────────────────────────────────────────────────────────
    if (req.method === 'POST' && action === 'create_user') {
      const { email, nome, password, role, equipes } = body
      if (!email || !nome || !password || !role) {
        return res.status(400).json({ error: 'Campos obrigatórios: email, nome, password, role' })
      }
      if (!rolesGerenciaveis.includes(role)) {
        return res.status(403).json({ error: `Seu perfil (${perfil.role}) não pode criar usuários "${role}"` })
      }
      if (password.length < 6) {
        return res.status(400).json({ error: 'Senha deve ter ao menos 6 caracteres' })
      }
      if (role === 'consulta' && (!Array.isArray(equipes) || !equipes.length)) {
        return res.status(400).json({ error: 'Usuário de consulta precisa de ao menos 1 equipe' })
      }

      const { data: newUser, error: createErr } = await supabase.auth.admin.createUser({
        email: email.trim().toLowerCase(),
        password,
        email_confirm: true,
      })
      if (createErr) return res.status(400).json({ error: createErr.message })

      const { error: perfilErr } = await supabase.from('perfis').insert({
        user_id: newUser.user.id,
        company_id: companyId,
        role,
        nome: nome.trim(),
        ativo: true,
        must_change_password: true,
        equipes: role === 'consulta' ? equipes.map(Number) : null,
      })

      if (perfilErr) {
        await supabase.auth.admin.deleteUser(newUser.user.id)
        return res.status(500).json({ error: 'Erro ao criar perfil: ' + perfilErr.message })
      }

      return res.status(200).json({ ok: true, user_id: newUser.user.id })
    }

    // ── update_user — nome, ativo, equipes ──────────────────────────────────────
    if (req.method === 'POST' && action === 'update_user') {
      const { user_id: targetId, nome, ativo, equipes } = body
      if (!targetId) return res.status(400).json({ error: 'user_id é obrigatório' })

      const { data: alvo } = await supabase
        .from('perfis')
        .select('role, company_id')
        .eq('user_id', targetId)
        .single()
      if (!alvo) return res.status(404).json({ error: 'Usuário não encontrado' })
      if (String(alvo.company_id) !== String(companyId) || !rolesGerenciaveis.includes(alvo.role)) {
        return res.status(403).json({ error: 'Sem permissão para editar este usuário' })
      }

      const updates = {}
      if (nome !== undefined) updates.nome = nome
      if (ativo !== undefined) updates.ativo = ativo
      if (equipes !== undefined && alvo.role === 'consulta') {
        if (!Array.isArray(equipes) || !equipes.length) {
          return res.status(400).json({ error: 'Usuário de consulta precisa de ao menos 1 equipe' })
        }
        updates.equipes = equipes.map(Number)
      }

      const { error } = await supabase.from('perfis').update(updates).eq('user_id', targetId)
      if (error) return res.status(500).json({ error: error.message })
      return res.status(200).json({ ok: true })
    }

    return res.status(400).json({ error: 'Ação desconhecida: ' + action })
  } catch (err) {
    console.error('Unhandled error in users handler:', err)
    return res.status(500).json({ error: 'Erro interno: ' + (err.message || String(err)) })
  }
}
