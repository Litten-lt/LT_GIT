import { useEffect, useRef, useState } from 'react'
import { getRole, getToken } from '../auth'

const FALLBACK_BG =
  'linear-gradient(135deg, #c58582 0%, #b87a8a 50%, #9d8090 100%)'

type PhotoState =
  | { status: 'loading' }
  | { status: 'empty' }
  | { status: 'ready'; url: string }

export default function About() {
  const [photo, setPhoto] = useState<PhotoState>({ status: 'loading' })
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const isAdmin = getRole() === 'admin'

  // 启动 fetch
  useEffect(() => {
    let cancelled = false
    fetch('/api/settings/about-photo')
      .then((r) => (r.ok ? r.json() : ({} as { url?: string })))
      .then((data) => {
        if (cancelled) return
        if (data && data.url) setPhoto({ status: 'ready', url: data.url })
        else setPhoto({ status: 'empty' })
      })
      .catch(() => {
        if (!cancelled) setPhoto({ status: 'empty' })
      })
    return () => {
      cancelled = true
    }
  }, [])

  const authHeader = (): HeadersInit => {
    const t = getToken()
    return t ? { Authorization: `Bearer ${t}` } : {}
  }

  const reload = async () => {
    try {
      const r = await fetch('/api/settings/about-photo')
      const data: { url?: string } = r.ok ? await r.json() : {}
      if (data && data.url) setPhoto({ status: 'ready', url: data.url })
      else setPhoto({ status: 'empty' })
    } catch {
      setPhoto({ status: 'empty' })
    }
  }

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = '' // 清空让下次选同文件还能触发
    if (!file) return
    setBusy(true)
    setErr(null)
    try {
      const form = new FormData()
      form.append('file', file)
      const r = await fetch('/api/settings/about-photo/upload', {
        method: 'POST',
        headers: { ...authHeader() },
        body: form,
      })
      if (!r.ok) {
        const errBody = await r.json().catch(() => ({}))
        throw new Error(errBody.error || `HTTP ${r.status}`)
      }
      const data = await r.json()
      setPhoto({ status: 'ready', url: data.url })
    } catch (e: any) {
      setErr(e?.message || '上传失败')
    } finally {
      setBusy(false)
    }
  }

  const handleRemove = async () => {
    if (!confirm('确认移除照片?')) return
    setBusy(true)
    setErr(null)
    try {
      const r = await fetch('/api/settings/about-photo', {
        method: 'DELETE',
        headers: { ...authHeader() },
      })
      if (!r.ok) {
        const errBody = await r.json().catch(() => ({}))
        throw new Error(errBody.error || `HTTP ${r.status}`)
      }
      setPhoto({ status: 'empty' })
    } catch (e: any) {
      setErr(e?.message || '移除失败')
    } finally {
      setBusy(false)
    }
  }

  // 照片框 (有图 / 占位 / loading 三态)
  const renderPhotoBox = () => {
    if (photo.status === 'loading') {
      return (
        <div
          className="w-full max-w-xs aspect-[3/4] rounded-3xl overflow-hidden"
          style={{ background: FALLBACK_BG }}
        >
          <div className="w-full h-full flex items-center justify-center text-white/60 text-sm font-mono">
            加载中…
          </div>
        </div>
      )
    }

    if (photo.status === 'empty') {
      // 占位 + admin 可上传
      return (
        <div className="relative group w-full max-w-xs">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handleUpload}
            disabled={busy}
            className="hidden"
          />
          <div
            className="aspect-[3/4] rounded-3xl overflow-hidden"
            style={{ background: FALLBACK_BG }}
          >
            <div className="w-full h-full flex items-center justify-center text-white/80 text-sm font-mono">
              // 你的照片
            </div>
          </div>
          {isAdmin && (
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={busy}
              className="absolute inset-0 flex items-center justify-center bg-black/0 hover:bg-black/40 transition rounded-3xl group disabled:opacity-50"
              title="上传照片"
            >
              <span className="opacity-0 group-hover:opacity-100 transition text-white text-sm font-medium bg-black/60 px-3 py-1.5 rounded-full">
                📷 上传照片
              </span>
            </button>
          )}
        </div>
      )
    }

    // 有图: 显示 + admin hover 编辑
    return (
      <div className="relative group w-full max-w-xs">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={handleUpload}
          disabled={busy}
          className="hidden"
        />
        <img
          src={photo.url}
          alt="LongTeng"
          className="w-full aspect-[3/4] rounded-3xl object-cover shadow-lg"
        />
        {isAdmin && (
          <div className="absolute inset-0 rounded-3xl bg-black/0 group-hover:bg-black/40 transition flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={busy}
              className="text-sm font-medium bg-white/90 hover:bg-white text-ink px-3 py-1.5 rounded-full shadow transition disabled:opacity-50"
              title="换一张"
            >
              📷 换一张
            </button>
            <button
              onClick={handleRemove}
              disabled={busy}
              className="text-sm font-medium bg-white/90 hover:bg-red-50 text-red-600 px-3 py-1.5 rounded-full shadow transition disabled:opacity-50"
              title="移除照片"
            >
              🗑 移除
            </button>
          </div>
        )}
      </div>
    )
  }

  return (
    <section id="about" className="grid md:grid-cols-2 gap-10 items-center">
      {/* 左：照片 / 占位 */}
      <div className="flex justify-center md:justify-end">
        {renderPhotoBox()}
      </div>

      {/* 右：文字 */}
      <div className="text-center md:text-left">
        <p className="text-xs font-mono text-accent mb-3 tracking-widest">/ ABOUT</p>
        <h2 className="text-3xl md:text-4xl font-extrabold text-ink leading-tight">
          你好,我是 <span className="underline-scribble">LongTeng</span>
        </h2>
        <p className="mt-5 text-ink-soft leading-relaxed">
          嵌入式软件工程师,日常 C / Lua / Shell 写 WiFi 产品。
          业余折腾 Blender、AI 工具链、二次元手办。
        </p>
        <p className="mt-3 text-ink-soft leading-relaxed">
          相信<span className="text-ink font-semibold">硬核技术</span>和
          <span className="text-ink font-semibold">好玩的东西</span>不该是反义词。
        </p>

        {/* 几个小标签 */}
        <div className="mt-6 flex flex-wrap gap-2 justify-center md:justify-start">
          {['嵌入式', 'OpenWrt', 'AI', 'Blender', '二次元'].map((t) => (
            <span
              key={t}
              className="text-xs px-3 py-1 rounded-full border border-ink/15 text-ink-soft"
            >
              {t}
            </span>
          ))}
        </div>

        {/* 错误提示 */}
        {err && (
          <p className="mt-3 text-xs text-red-600">{err}</p>
        )}
      </div>
    </section>
  )
}
