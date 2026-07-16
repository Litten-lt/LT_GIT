import { getToken, setAuth, type Role } from './auth'

type GuestSession = {
  token: string
  role: Role
  username: string
}

let pending: Promise<void> | null = null

export function ensurePublicSession(): Promise<void> {
  if (getToken()) return Promise.resolve()
  if (pending) return pending

  pending = fetch('/api/auth/guest', { method: 'POST' })
    .then(async (response) => {
      if (!response.ok) throw new Error('无法建立只读会话')
      const session = await response.json() as GuestSession
      setAuth(session.token, session.role, session.username)
    })
    .catch(() => {
      // Pages still render their curated fallbacks when the API is unavailable.
    })
    .finally(() => {
      pending = null
    })

  return pending
}
