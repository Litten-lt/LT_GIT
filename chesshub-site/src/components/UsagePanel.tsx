// 系统用量 / 资源监控 (admin only)
// - 拉 GET /api/admin/usage
// - 显示: 磁盘、RAM、上传目录、孤儿、SQLite、Node 进程
// - 一键清理孤儿 (POST /api/admin/orphans/clean, 带 confirm)

import { useEffect, useState } from 'react'
import { getToken } from '../auth'

type Usage = {
  server_time: string
  memory: {
    total_bytes: number
    free_bytes: number
    used_bytes: number
    use_percent: number
  }
  disk: {
    mount: string
    total_bytes: number
    free_bytes: number
    used_bytes: number
    use_percent: number
  }
  upload_dir: {
    path: string
    file_count: number
    bytes: number
    by_prefix: Record<string, number>
  }
  orphans: {
    count: number
    bytes: number
    files: { filename: string; bytes: number }[]
  }
  db: {
    path: string
    db_bytes: number
    wal_bytes: number
    tables: Record<string, number>
  }
  process: {
    pid: number
    uptime_sec: number
    rss_bytes: number
    heap_used_bytes: number
    heap_total_bytes: number
    node_version: string
  }
}

function fmtBytes(n: number): string {
  if (!Number.isFinite(n)) return '?'
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`
}

function Bar({ percent, color }: { percent: number; color: string }) {
  const p = Math.min(100, Math.max(0, percent))
  return (
    <div className="h-2 bg-ink/10 rounded-full overflow-hidden">
      <div className={`h-full ${color} transition-all`} style={{ width: `${p}%` }} />
    </div>
  )
}

function kv(rows: { label: string; value: React.ReactNode }[]) {
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
      {rows.map((r, i) => (
        <span key={i} className="contents">
          <div className="text-ink-soft">{r.label}</div>
          <div className="text-right text-ink">{r.value}</div>
        </span>
      ))}
    </div>
  )
}

type Props = {
  open: boolean
  onClose: () => void
}

export default function UsagePanel({ open, onClose }: Props) {
  const [data, setData] = useState<Usage | null>(null)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [cleaning, setCleaning] = useState(false)

  const authHeader = (): HeadersInit => {
    const t = getToken()
    return t ? { Authorization: `Bearer ${t}` } : {}
  }

  const load = async () => {
    setLoading(true)
    setErr(null)
    try {
      const r = await fetch('/api/admin/usage', { headers: authHeader() })
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      setData(await r.json())
    } catch (e: any) {
      setErr(e?.message || '加载失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (open) load()
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  const handleClean = async () => {
    if (!data) return
    const msg = `确认删除 ${data.orphans.count} 个孤儿文件 (${fmtBytes(data.orphans.bytes)})?\n\n此操作不可撤销,会从上传目录中真正删除这些文件。`
    if (!confirm(msg)) return
    setCleaning(true)
    try {
      const r = await fetch('/api/admin/orphans/clean', {
        method: 'POST',
        headers: authHeader(),
      })
      if (!r.ok) {
        const errBody = await r.json().catch(() => ({}))
        throw new Error(errBody.error || `HTTP ${r.status}`)
      }
      const result = await r.json()
      alert(`已删除 ${result.deleted_count} 个文件, 释放 ${fmtBytes(result.deleted_bytes)}`)
      await load()
    } catch (e: any) {
      alert(`清理失败: ${e?.message || '未知错误'}`)
    } finally {
      setCleaning(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[88vh] flex flex-col overflow-hidden">
        {/* header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-ink/10">
          <div>
            <div className="text-base font-semibold text-ink">系统用量 / 资源监控</div>
            <div className="text-xs text-ink-soft mt-0.5">
              仅 admin 可看 ·{' '}
              {data ? new Date(data.server_time).toLocaleString('zh-CN') : '加载中…'}
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-ink-soft hover:text-ink text-2xl leading-none w-8 h-8 flex items-center justify-center rounded-full hover:bg-ink/5 transition"
            aria-label="关闭"
          >
            ×
          </button>
        </div>

        {/* body */}
        <div className="flex-1 overflow-y-auto p-5">
          {err && (
            <div className="mb-4 px-3 py-2 text-sm text-red-600 bg-red-50 rounded">
              加载失败: {err}
            </div>
          )}

          {loading && !data && (
            <div className="py-12 text-center text-ink-soft text-sm">加载中…</div>
          )}

          {data && (
            <div className="space-y-5">
              {/* 磁盘 */}
              <section>
                <div className="flex items-baseline justify-between mb-2">
                  <div className="text-xs font-mono text-ink-soft/70 tracking-widest">
                    磁盘 ({data.disk.mount})
                  </div>
                  <div className="text-xs text-ink-soft">
                    {fmtBytes(data.disk.used_bytes)} / {fmtBytes(data.disk.total_bytes)} (
                    {data.disk.use_percent}%)
                  </div>
                </div>
                <Bar percent={data.disk.use_percent} color="bg-accent" />
                <div className="text-xs text-ink-soft/60 mt-1">
                  可用 {fmtBytes(data.disk.free_bytes)}
                </div>
              </section>

              {/* 内存 */}
              <section>
                <div className="flex items-baseline justify-between mb-2">
                  <div className="text-xs font-mono text-ink-soft/70 tracking-widest">
                    内存 (RAM)
                  </div>
                  <div className="text-xs text-ink-soft">
                    {fmtBytes(data.memory.used_bytes)} / {fmtBytes(data.memory.total_bytes)} (
                    {data.memory.use_percent}%)
                  </div>
                </div>
                <Bar percent={data.memory.use_percent} color="bg-emerald-500" />
                <div className="text-xs text-ink-soft/60 mt-1">
                  可用 {fmtBytes(data.memory.free_bytes)}
                </div>
              </section>

              {/* 上传目录 */}
              <section>
                <div className="flex items-baseline justify-between mb-2">
                  <div className="text-xs font-mono text-ink-soft/70 tracking-widest">
                    上传目录
                  </div>
                  <div className="text-xs text-ink-soft">
                    {data.upload_dir.file_count} 文件 · {fmtBytes(data.upload_dir.bytes)}
                  </div>
                </div>
                <div className="text-xs text-ink-soft/60 mb-2 break-all font-mono">
                  {data.upload_dir.path}
                </div>
                <div className="flex flex-wrap gap-2 text-xs">
                  {Object.entries(data.upload_dir.by_prefix).map(([p, n]) => (
                    <span
                      key={p}
                      className="px-2 py-0.5 bg-ink/5 text-ink-soft rounded font-mono"
                    >
                      {p === '(no-prefix)' ? 'figures 等' : p} × {n}
                    </span>
                  ))}
                </div>
              </section>

              {/* 孤儿 */}
              <section>
                <div className="flex items-baseline justify-between mb-2">
                  <div className="text-xs font-mono text-ink-soft/70 tracking-widest">
                    孤儿文件 (DB 未引用,排除 hero-/about-)
                  </div>
                  <div
                    className={`text-xs font-medium ${
                      data.orphans.count > 0 ? 'text-amber-600' : 'text-emerald-600'
                    }`}
                  >
                    {data.orphans.count} 个 · {fmtBytes(data.orphans.bytes)}
                  </div>
                </div>
                {data.orphans.count > 0 ? (
                  <>
                    <div className="bg-amber-50 rounded-lg p-3 mb-2 max-h-32 overflow-y-auto">
                      {data.orphans.files.map((f) => (
                        <div
                          key={f.filename}
                          className="text-xs font-mono text-ink-soft flex justify-between gap-2 py-0.5"
                        >
                          <span className="truncate">{f.filename}</span>
                          <span className="text-ink-soft/60 flex-shrink-0">
                            {fmtBytes(f.bytes)}
                          </span>
                        </div>
                      ))}
                    </div>
                    <button
                      onClick={handleClean}
                      disabled={cleaning}
                      className="text-xs px-3 py-1.5 bg-amber-100 hover:bg-amber-200 text-amber-800 rounded-full transition disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {cleaning ? '清理中…' : '🧹 一键清理'}
                    </button>
                  </>
                ) : (
                  <div className="text-xs text-emerald-600">✓ 上传目录干净,无孤儿</div>
                )}
              </section>

              {/* 数据库 */}
              <section>
                <div className="text-xs font-mono text-ink-soft/70 tracking-widest mb-2">
                  SQLite
                </div>
                {kv([
                  { label: 'DB 文件', value: fmtBytes(data.db.db_bytes) },
                  { label: 'WAL 文件', value: fmtBytes(data.db.wal_bytes) },
                  ...Object.entries(data.db.tables).map(([t, n]) => ({
                    label: t,
                    value: `${n} 条`,
                  })),
                ])}
              </section>

              {/* 进程 */}
              <section>
                <div className="text-xs font-mono text-ink-soft/70 tracking-widest mb-2">
                  Node 进程
                </div>
                {kv([
                  { label: 'RSS', value: fmtBytes(data.process.rss_bytes) },
                  {
                    label: 'Heap',
                    value: `${fmtBytes(data.process.heap_used_bytes)} / ${fmtBytes(
                      data.process.heap_total_bytes
                    )}`,
                  },
                  {
                    label: '运行时间',
                    value: `${Math.floor(data.process.uptime_sec / 60)} 分钟`,
                  },
                  { label: 'Node 版本', value: data.process.node_version },
                  { label: 'PID', value: data.process.pid },
                ])}
              </section>
            </div>
          )}
        </div>

        {/* footer */}
        <div className="px-5 py-3 border-t border-ink/10 flex items-center justify-end">
          <button
            onClick={load}
            disabled={loading}
            className="text-xs px-3 py-1.5 text-ink-soft hover:text-ink hover:bg-ink/5 rounded-full transition disabled:opacity-50"
          >
            {loading ? '刷新中…' : '↻ 刷新'}
          </button>
        </div>
      </div>
    </div>
  )
}
