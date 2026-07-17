// 全局认证状态管理
// - 登录后 token 存 localStorage (chesshub.token)
// - role 存 localStorage (chesshub.role)
// - 进入任何页面时,顶层守卫会检查

const TOKEN_KEY = 'chesshub.token'
const ROLE_KEY = 'chesshub.role'
const USER_KEY = 'chesshub.user'

export type Role = 'admin' | 'guest'

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export function getRole(): Role | null {
  const r = localStorage.getItem(ROLE_KEY) as Role | null
  return r === 'admin' || r === 'guest' ? r : null
}

export function getUsername(): string | null {
  return localStorage.getItem(USER_KEY)
}

export function isLoggedIn(): boolean {
  return !!getToken() && !!getRole()
}

export function isAdmin(): boolean {
  return getRole() === 'admin'
}

export function isGuest(): boolean {
  return getRole() === 'guest'
}

export function setAuth(token: string, role: Role, username: string) {
  localStorage.setItem(TOKEN_KEY, token)
  localStorage.setItem(ROLE_KEY, role)
  localStorage.setItem(USER_KEY, username)
}

export function clearAuth() {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(ROLE_KEY)
  localStorage.removeItem(USER_KEY)
}

// 全站守卫:未登录则跳 login.html
export function ensureLoggedIn(loginUrl = '/login.html') {
  if (!isLoggedIn()) {
    window.location.replace(loginUrl)
    return false
  }
  return true
}

// 已登录则跳主页 (用于 login 页避免重复登录)
export function redirectIfLoggedIn(homeUrl = '/') {
  if (isLoggedIn()) {
    window.location.replace(homeUrl)
    return true
  }
  return false
}