import { supabase } from '../lib/supabaseClient'

function buildSession(user, perfil, token) {
  return {
    id: user.id,
    email: user.email,
    role: perfil.role,
    company_id: perfil.company_id,
    nome: perfil.nome,
    equipes: perfil.equipes || [],
    mustChangePassword: !!perfil.must_change_password,
    token,
  }
}

// select * tolera a janela entre deploy e migração (colunas novas podem não existir ainda)
const PERFIL_FIELDS = '*'

export async function loginUser(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw new Error(error.message)

  const { data: perfil, error: perfilError } = await supabase
    .from('perfis')
    .select(PERFIL_FIELDS)
    .eq('user_id', data.user.id)
    .single()

  if (perfilError || !perfil) throw new Error('Perfil não encontrado. Contate o administrador.')
  if (!perfil.ativo) throw new Error('Usuário inativo. Contate o administrador.')

  return buildSession(data.user, perfil, data.session.access_token)
}

export async function logoutUser() {
  await supabase.auth.signOut()
}

export async function getSession() {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return null

  const { data: perfil } = await supabase
    .from('perfis')
    .select(PERFIL_FIELDS)
    .eq('user_id', session.user.id)
    .single()

  if (!perfil || !perfil.ativo) return null

  return buildSession(session.user, perfil, session.access_token)
}
