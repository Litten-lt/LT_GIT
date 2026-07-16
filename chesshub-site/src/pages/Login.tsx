import { useState } from 'react'
import { isAdmin, setAuth } from '../auth'
import { login as apiLogin } from '../api'

export default function Login() {
  if (isAdmin()) {
    window.location.replace('/')
    return null
  }

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleAdminLogin(event: React.FormEvent) {
    event.preventDefault()
    setError('')
    setLoading(true)
    try {
      const result = await apiLogin(username, password)
      setAuth(result.token, result.role, result.username)
      window.location.href = '/'
    } catch (reason: any) {
      setError(reason.message || '登录失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen grid lg:grid-cols-[1.1fr_0.9fr] bg-bg">
      <section className="hidden lg:flex relative overflow-hidden p-14 flex-col justify-between bg-ink text-white">
        <div className="absolute inset-0 opacity-10 login-grid" />
        <a href="/" className="relative font-serif text-3xl tracking-tight focus-ring rounded">
          LongTeng<span className="text-accent">.</span>
        </a>
        <div className="relative max-w-xl">
          <p className="text-xs font-mono tracking-[0.2em] text-white/50">PRIVATE STUDIO</p>
          <h1 className="mt-6 text-5xl font-extrabold tracking-tight leading-tight">
            内容在前台被阅读，<br />创作在这里发生。
          </h1>
          <p className="mt-6 max-w-md text-white/60 leading-relaxed">
            这是网站的管理入口。普通访客无需登录即可浏览公开内容。
          </p>
        </div>
        <p className="relative text-xs font-mono text-white/30">SHENZHEN · 2026</p>
      </section>

      <section className="flex items-center justify-center px-6 py-16">
        <div className="w-full max-w-sm">
          <a href="/" className="lg:hidden inline-block font-serif text-3xl text-ink mb-12 focus-ring rounded">
            LongTeng<span className="text-accent">.</span>
          </a>
          <p className="text-xs font-mono text-accent tracking-[0.18em]">/ ADMIN ACCESS</p>
          <h2 className="mt-4 text-3xl font-extrabold text-ink">管理后台登录<span className="text-accent">。</span></h2>
          <p className="mt-3 text-sm text-ink-soft leading-relaxed">登录后可以发布内容、上传图片并维护网站设置。</p>

          <form onSubmit={handleAdminLogin} className="mt-9 space-y-4">
            <label className="block">
              <span className="block mb-2 text-xs font-semibold text-ink-soft">账号</span>
              <input
                type="text"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                autoComplete="username"
                className="w-full px-4 py-3 bg-white/60 border border-ink/15 rounded-xl focus:outline-none focus:border-accent"
                required
                autoFocus
              />
            </label>
            <label className="block">
              <span className="block mb-2 text-xs font-semibold text-ink-soft">密码</span>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
                className="w-full px-4 py-3 bg-white/60 border border-ink/15 rounded-xl focus:outline-none focus:border-accent"
                required
              />
            </label>

            {error && <p role="alert" className="text-sm text-red-700">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full disabled:opacity-50"
            >
              {loading ? '正在登录…' : '进入管理模式'}
            </button>
          </form>

          <a href="/" className="mt-7 inline-block text-sm text-ink-soft hover:text-accent focus-ring rounded">
            ← 返回公开网站
          </a>
        </div>
      </section>
    </main>
  )
}
