import { useEffect, useState } from 'react'
import { isLoggedIn, getRole, getUsername, clearAuth } from './auth'

type Props = {
  current?: 'home' | 'travel' | 'blog' | 'figures' | 'life' | 'work'
  children?: React.ReactNode
}

export default function App({ current = 'home', children }: Props) {
  const [time, setTime] = useState('')

  useEffect(() => {
    const tick = () => {
      const d = new Date()
      const fmt = d.toLocaleString('en-US', {
        timeZone: 'Asia/Shanghai',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      })
      setTime(`SZ · ${fmt}`)
    }
    tick()
    const id = setInterval(tick, 30_000)
    return () => clearInterval(id)
  }, [])

  // 守卫:未登录 → 跳 login.html
  // 放第一行 useEffect 之前,同步检查
  if (typeof window !== 'undefined' && !isLoggedIn()) {
    window.location.replace('/login.html')
    return (
      <div className="min-h-screen flex items-center justify-center text-ink-soft text-sm">
        跳转登录中…
      </div>
    )
  }

  const role = getRole()
  const username = getUsername()
  const isAdmin = role === 'admin'

  return (
    <div className="relative min-h-screen flex flex-col text-ink">
      {/* 顶部 */}
      <header className="border-b border-ink/10">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between gap-4">
          <a
            href="/"
            className="font-serif text-xl tracking-tight text-ink"
            style={{ fontFamily: 'Fraunces, "Source Han Serif SC", Georgia, serif' }}
          >
            LongTeng<span className="text-accent">.</span>
          </a>
          <div className="flex items-center gap-3 text-xs">
            <span
              className={`px-2 py-0.5 rounded-full font-mono ${
                isAdmin
                  ? 'bg-emerald-100 text-emerald-700'
                  : 'bg-amber-100 text-amber-700'
              }`}
            >
              {isAdmin ? '✓ Admin' : '👀 游客'}
            </span>
            <span className="text-ink-soft hidden sm:inline">{username}</span>
            <span className="font-mono text-ink-soft/60 hidden md:inline">{time}</span>
            <button
              onClick={() => {
                if (confirm('确认登出?')) {
                  clearAuth()
                  window.location.href = '/login.html'
                }
              }}
              className="text-ink-soft hover:text-accent transition"
            >
              登出
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t border-ink/10">
        <div className="max-w-3xl mx-auto px-6 py-6 text-center text-xs text-ink-soft/60">
          © 2026 LongTeng · built with <span className="text-accent">♥</span>
        </div>
      </footer>
    </div>
  )
}