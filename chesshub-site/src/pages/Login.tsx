import { useState } from 'react'
import { redirectIfLoggedIn, setAuth } from '../auth'
import { login as apiLogin, guestLogin } from '../api'

export default function Login() {
  // 已登录则跳走
  if (redirectIfLoggedIn()) return null

  const [mode, setMode] = useState<'choose' | 'admin'>('choose')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleAdminLogin(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await apiLogin(username, password)
      setAuth(res.token, res.role, res.username)
      window.location.href = '/'
    } catch (err: any) {
      setError(err.message || '登录失败')
    } finally {
      setLoading(false)
    }
  }

  async function handleGuest() {
    setError('')
    setLoading(true)
    try {
      const res = await guestLogin()
      setAuth(res.token, res.role, res.username)
      window.location.href = '/'
    } catch (err: any) {
      setError(err.message || '游客登录失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg px-6">
      <div className="w-full max-w-md">
        {/* Logo + 标题 */}
        <div className="text-center mb-10">
          <a
            href="/"
            className="inline-block font-serif text-3xl tracking-tight text-ink"
            style={{ fontFamily: 'Fraunces, "Source Han Serif SC", Georgia, serif' }}
          >
            LongTeng<span className="text-accent">.</span>
          </a>
          <p className="mt-2 text-xs font-mono text-ink-soft/60 tracking-widest">
            CHESSHUB / LOGIN
          </p>
        </div>

        {mode === 'choose' && (
          <div className="space-y-4">
            <h1 className="text-center text-xl font-bold text-ink mb-6">
              请选择进入方式
            </h1>

            <button
              onClick={() => setMode('admin')}
              className="w-full p-6 bg-white border-2 border-ink/10 rounded-2xl hover:border-accent/40 hover:shadow-[0_8px_24px_-12px_rgba(239,35,75,0.25)] transition text-left group"
            >
              <div className="flex items-start gap-4">
                <div className="text-3xl">🔐</div>
                <div className="flex-1">
                  <h2 className="text-lg font-bold text-ink group-hover:text-accent transition">
                    管理员登录
                  </h2>
                  <p className="text-sm text-ink-soft mt-1">
                    输账号密码登录,可以发布手办、上传图片
                  </p>
                </div>
                <div className="text-ink-soft/30 group-hover:text-accent group-hover:translate-x-1 transition">
                  →
                </div>
              </div>
            </button>

            <button
              onClick={handleGuest}
              disabled={loading}
              className="w-full p-6 bg-white border-2 border-ink/10 rounded-2xl hover:border-amber-500/40 hover:shadow-[0_8px_24px_-12px_rgba(217,119,6,0.25)] transition text-left group disabled:opacity-50"
            >
              <div className="flex items-start gap-4">
                <div className="text-3xl">👀</div>
                <div className="flex-1">
                  <h2 className="text-lg font-bold text-ink group-hover:text-amber-600 transition">
                    游客访问
                  </h2>
                  <p className="text-sm text-ink-soft mt-1">
                    一键进入,浏览所有手办,但发表功能受限
                  </p>
                </div>
                <div className="text-ink-soft/30 group-hover:text-amber-600 group-hover:translate-x-1 transition">
                  →
                </div>
              </div>
            </button>

            {error && (
              <p className="text-center text-xs text-accent font-mono mt-4">// {error}</p>
            )}

            <p className="text-center text-xs text-ink-soft/50 font-mono mt-8">
              // 进去之后可以随时在右上角登出
            </p>
          </div>
        )}

        {mode === 'admin' && (
          <form
            onSubmit={handleAdminLogin}
            className="bg-white border-2 border-ink/10 rounded-2xl p-8"
          >
            <h1 className="text-xl font-bold text-ink mb-1">管理员登录</h1>
            <p className="text-xs text-ink-soft mb-6 font-mono">
              // 输账号密码
            </p>

            <div className="space-y-3">
              <input
                type="text"
                placeholder="账号"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-4 py-2.5 text-sm bg-bg border border-ink/10 rounded-md focus:outline-none focus:border-ink/30"
                autoFocus
              />
              <input
                type="password"
                placeholder="密码"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-2.5 text-sm bg-bg border border-ink/10 rounded-md focus:outline-none focus:border-ink/30"
              />
              {error && (
                <p className="text-xs text-accent font-mono">// {error}</p>
              )}
            </div>

            <div className="mt-6 flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setMode('choose')
                  setError('')
                }}
                className="flex-1 py-2.5 text-sm text-ink-soft hover:text-ink transition"
              >
                ← 返回
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 py-2.5 text-sm font-semibold text-white bg-ink rounded-md hover:bg-ink/85 transition disabled:opacity-50"
              >
                {loading ? '登录中…' : '登录'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}