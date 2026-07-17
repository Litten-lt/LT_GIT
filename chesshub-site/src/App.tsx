import { useEffect, useState } from 'react'
import { isLoggedIn, getRole, getUsername, clearAuth } from './auth'
import { useHeroBg } from './heroBgContext'
import BackgroundPicker from './components/BackgroundPicker'
import UsagePanel from './components/UsagePanel'

type Props = {
  current?: 'home' | 'travel' | 'blog' | 'figures' | 'life' | 'work' | 'study'
  children?: React.ReactNode
}

export default function App({ current = 'home', children }: Props) {
  const [time, setTime] = useState('')
  const [pickerOpen, setPickerOpen] = useState(false)
  const [usageOpen, setUsageOpen] = useState(false)
  const { heroBg, setHeroBg } = useHeroBg()

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

  const loggedIn = isLoggedIn()
  const role = getRole()
  const username = getUsername()
  const isAdmin = role === 'admin'
  const showAdminSession = loggedIn && isAdmin
  const parentLink = current === 'work' || current === 'study'
    ? { href: '/journal.html', label: '工作与学习' }
    : current === 'travel' || current === 'figures' || current === 'life'
      ? { href: '/life.html', label: '生活分享' }
      : null

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
            {isAdmin && (
              <span className="px-2 py-0.5 rounded-full font-mono bg-emerald-100 text-emerald-700">✓ Admin</span>
            )}
            {isAdmin && (
              <>
                <button
                  onClick={() => setPickerOpen(true)}
                  className="w-7 h-7 flex items-center justify-center rounded-full bg-ink/5 hover:bg-accent-soft hover:text-accent transition text-base"
                  title="更换 Hero 背景"
                  aria-label="更换 Hero 背景"
                >
                  🎨
                </button>
                <button
                  onClick={() => setUsageOpen(true)}
                  className="w-7 h-7 flex items-center justify-center rounded-full bg-ink/5 hover:bg-accent-soft hover:text-accent transition text-base"
                  title="系统用量"
                  aria-label="系统用量"
                >
                  📊
                </button>
              </>
            )}
            {showAdminSession && <span className="text-ink-soft hidden sm:inline">{username}</span>}
            <span className="font-mono text-ink-soft/60 hidden md:inline">{time}</span>
            {showAdminSession ? (
              <button
                onClick={() => {
                  if (confirm('确认登出?')) {
                    clearAuth()
                    window.location.href = '/'
                  }
                }}
                className="text-ink-soft hover:text-accent transition focus-ring rounded"
              >登出</button>
            ) : (
              <a href="/login.html" className="text-ink-soft hover:text-accent transition focus-ring rounded">管理入口</a>
            )}
          </div>
        </div>
        {showAdminSession && parentLink && (
          <div className="max-w-5xl mx-auto px-6 pb-3 flex items-center justify-between text-xs">
            <a href={parentLink.href} className="text-ink-soft hover:text-accent focus-ring rounded">
              ← 返回{parentLink.label}
            </a>
            <span className="font-mono text-emerald-700/70">MANAGEMENT MODE</span>
          </div>
        )}
      </header>

      <main className={showAdminSession && parentLink ? 'flex-1 admin-surface' : 'flex-1'}>{children}</main>

      <footer className="border-t border-ink/10">
        <div className="max-w-3xl mx-auto px-6 py-6 text-center text-xs text-ink-soft/60">
          © 2026 LongTeng · built with <span className="text-accent">♥</span>
        </div>
      </footer>

      <BackgroundPicker
        open={pickerOpen}
        current={heroBg}
        onClose={() => setPickerOpen(false)}
        onChange={setHeroBg}
      />
      <UsagePanel open={usageOpen} onClose={() => setUsageOpen(false)} />
    </div>
  )
}


