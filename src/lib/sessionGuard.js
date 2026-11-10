// Controle de sessão do portal.
// O Supabase guarda a sessão no localStorage e a renova sozinho — sem este
// controle, fechar o navegador e voltar dias depois entrava direto.
//
// Regras:
//  • Inatividade: 30 min sem interação (mouse, teclado, toque, rolagem) → sai.
//  • Navegador fechado: toda aba aberta grava um "batimento" a cada 30s.
//    Se ao abrir o portal o último batimento tiver mais de 2 min, nenhuma aba
//    ficou aberta nesse tempo (navegador/PWA fechado) → pede login de novo.
//    F5 e abrir nova aba com outra já aberta continuam logados.

export const IDLE_LIMIT_MS = 30 * 60 * 1000
const CLOSED_LIMIT_MS = 2 * 60 * 1000
const HEARTBEAT_MS = 30 * 1000

const K_ACTIVITY = 'pc_last_activity'
const K_HEARTBEAT = 'pc_heartbeat'
const K_REASON = 'pc_logout_reason'

const now = () => Date.now()

function read(key) {
  try { return Number(localStorage.getItem(key)) || 0 } catch { return 0 }
}
function write(key, v) {
  try { localStorage.setItem(key, String(v)) } catch {}
}

/** Marca sessão recém-aberta (login). */
export function markSessionStart() {
  write(K_ACTIVITY, now())
  write(K_HEARTBEAT, now())
}

/** Na abertura do app: devolve o motivo se a sessão salva deve ser descartada. */
export function staleSessionReason() {
  const act = read(K_ACTIVITY)
  const hb = read(K_HEARTBEAT)
  if (!act || !hb) return 'closed'
  if (now() - act > IDLE_LIMIT_MS) return 'idle'
  if (now() - hb > CLOSED_LIMIT_MS) return 'closed'
  return null
}

export function setLogoutReason(reason) {
  try { sessionStorage.setItem(K_REASON, reason) } catch {}
}

/** Motivo do último logout automático (para a tela de login). */
export function peekLogoutReason() {
  try { return sessionStorage.getItem(K_REASON) } catch { return null }
}
export function clearLogoutReason() {
  try { sessionStorage.removeItem(K_REASON) } catch {}
}

export const LOGOUT_MESSAGES = {
  idle: 'Sua sessão foi encerrada após 30 minutos sem uso. Entre novamente.',
  closed: 'Por segurança, é preciso entrar de novo após fechar o navegador.',
}

/**
 * Enquanto logado: registra atividade, mantém o batimento e chama onExpire
 * quando passar do limite de inatividade. Devolve a função de limpeza.
 */
export function startSessionGuard(onExpire) {
  let lastWrite = 0
  const onActivity = () => {
    const t = now()
    if (t - lastWrite > 5000) { lastWrite = t; write(K_ACTIVITY, t) } // throttle
  }
  const events = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'wheel']
  events.forEach(e => window.addEventListener(e, onActivity, { passive: true, capture: true }))

  const tick = () => {
    write(K_HEARTBEAT, now())
    if (now() - read(K_ACTIVITY) > IDLE_LIMIT_MS) onExpire('idle')
  }
  const interval = setInterval(tick, HEARTBEAT_MS)
  // ao voltar para a aba (celular suspende timers), checa na hora
  const onVisible = () => { if (document.visibilityState === 'visible') tick() }
  document.addEventListener('visibilitychange', onVisible)
  tick()

  return () => {
    events.forEach(e => window.removeEventListener(e, onActivity, { capture: true }))
    clearInterval(interval)
    document.removeEventListener('visibilitychange', onVisible)
  }
}
