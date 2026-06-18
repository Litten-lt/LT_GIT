import { useEffect, useRef, useState } from 'react'
import App from '../App'
import {
  listWorks,
  getWork,
  createWork,
  updateWork,
  deleteWork,
  addWorkNote,
  deleteWorkNote,
  type Work,
  type WorkNote,
} from '../api'
import { isAdmin, ensureLoggedIn, clearAuth } from '../auth'

// 待发布图片 (新建 work + 添加 note 共用)
type PendingImage = {
  key: string
  url?: string
  file?: File
  preview: string
}

function fileToPreview(file: File): Promise<string> {
  return new Promise((resolve) => {
    const r = new FileReader()
    r.onload = () => resolve(r.result as string)
    r.readAsDataURL(file)
  })
}

// 时间戳 → "06-18 14:30"
function formatNoteTime(unix: number): string {
  const d = new Date(unix * 1000)
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  const hh = String(d.getHours()).padStart(2, '0')
  const mi = String(d.getMinutes()).padStart(2, '0')
  return `${mm}-${dd} ${hh}:${mi}`
}

export default function WorkPage() {
  const [view, setView] = useState<'list' | 'new' | 'detail' | 'edit'>('list')
  const [works, setWorks] = useState<Work[]>([])
  const [current, setCurrent] = useState<Work | null>(null)
  const [loading, setLoading] = useState(true)
  const [admin, setAdmin] = useState(false)
  const [detailLoading, setDetailLoading] = useState(false)

  // 守卫 + 初次加载列表
  useEffect(() => {
    if (!ensureLoggedIn()) return
    setAdmin(isAdmin())
    loadList()
    const params = new URLSearchParams(window.location.search)
    if (params.get('id')) loadDetail(Number(params.get('id')))
    else if (params.get('new') === '1') setView('new')
  }, [])

  // 浏览器 back/forward 同步
  useEffect(() => {
    const onPop = () => {
      const params = new URLSearchParams(window.location.search)
      if (params.get('id')) loadDetail(Number(params.get('id')))
      else if (params.get('new') === '1') {
        setView('new')
        setCurrent(null)
      } else {
        setView('list')
        setCurrent(null)
      }
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  // 视图切换
  const openDetail = (id: number) => {
    const url = new URL(window.location.href)
    url.searchParams.set('id', String(id))
    url.searchParams.delete('new')
    history.pushState({}, '', url.toString())
    loadDetail(id)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const openNew = () => {
    const url = new URL(window.location.href)
    url.searchParams.set('new', '1')
    url.searchParams.delete('id')
    history.pushState({}, '', url.toString())
    setView('new')
    setCurrent(null)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const closeToList = () => {
    const url = new URL(window.location.href)
    url.searchParams.delete('id')
    url.searchParams.delete('new')
    history.pushState({}, '', url.pathname)
    setView('list')
    setCurrent(null)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // 编辑态切到详情 (添加 note 后 / 取消编辑)
  const toDetail = (id: number) => {
    const url = new URL(window.location.href)
    url.searchParams.set('id', String(id))
    url.searchParams.delete('new')
    history.pushState({}, '', url.toString())
    loadDetail(id)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // 切到编辑态 (从详情)
  const toEdit = () => {
    setView('edit')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // 数据加载
  async function loadList() {
    setLoading(true)
    try {
      const { works } = await listWorks()
      setWorks(works)
    } catch (e: any) {
      console.error('loadWorks error:', e)
      if (e.message?.includes('token')) {
        clearAuth()
        window.location.href = '/login.html'
      }
    } finally {
      setLoading(false)
    }
  }

  async function loadDetail(id: number) {
    setDetailLoading(true)
    setView('detail')
    try {
      const { work } = await getWork(id)
      setCurrent(work)
    } catch (e: any) {
      console.error('loadDetail error:', e)
      if (e.message?.includes('404')) setCurrent(null)
    } finally {
      setDetailLoading(false)
    }
  }

  return (
    <App current="work">
      <div className="max-w-3xl mx-auto px-6 pt-12 pb-24">
        {view === 'list' && (
          <ListView
            works={works}
            loading={loading}
            admin={admin}
            onOpenDetail={openDetail}
            onOpenNew={openNew}
            onDelete={async (id) => {
              if (!confirm('确认删除这条 ticket? (所有说明和图片都会一起删)')) return
              await deleteWork(id)
              await loadList()
            }}
          />
        )}

        {view === 'new' && (
          <NewView
            admin={admin}
            onCancel={closeToList}
            onCreated={async (id) => {
              await loadList()
              toDetail(id)
            }}
          />
        )}

        {view === 'detail' && (
          <DetailView
            work={current}
            loading={detailLoading}
            admin={admin}
            onBack={closeToList}
            onDelete={async (id) => {
              if (!confirm('确认删除这条 ticket? (所有说明和图片都会一起删)')) return
              await deleteWork(id)
              await loadList()
              closeToList()
            }}
            onEdit={toEdit}
            onDeleteNote={async (workId, noteId) => {
              if (!confirm('确认删除这条说明?')) return
              await deleteWorkNote(workId, noteId)
              await loadDetail(workId)
              await loadList()
            }}
          />
        )}

        {view === 'edit' && (
          <EditView
            work={current}
            admin={admin}
            onCancel={() => current && toDetail(current.id)}
            onSaved={async (id) => {
              // 改完 title/description: 重新加载详情数据
              await loadDetail(id)
              await loadList()
            }}
            onAddNote={async (id, payload) => {
              await addWorkNote(id, payload)
              await loadList()
              // 加完 note 跳回详情
              toDetail(id)
            }}
          />
        )}
      </div>
    </App>
  )
}

// ============ 列表视图 ============
function ListView({
  works,
  loading,
  admin,
  onOpenDetail,
  onOpenNew,
  onDelete,
}: {
  works: Work[]
  loading: boolean
  admin: boolean
  onOpenDetail: (id: number) => void
  onOpenNew: () => void
  onDelete: (id: number) => void
}) {
  return (
    <>
      <div className="text-center mb-10">
        <p className="text-xs font-mono text-accent mb-3 tracking-widest">/ WORK</p>
        <h1 className="text-4xl md:text-5xl font-extrabold text-ink">
          工作<span className="text-accent">.</span>
        </h1>
        <p className="mt-4 text-ink-soft max-w-xl mx-auto leading-relaxed">
          调试踩坑笔记。每条 ticket 一行,点进去看详情 + 调查说明。
        </p>
      </div>

      <div className="flex items-center justify-between mb-8 border-b border-ink/10 pb-4 gap-3 flex-wrap">
        <span className="text-sm text-ink-soft">
          共 <span className="text-ink font-semibold">{works.length}</span> 条
          {loading && <span className="ml-2 text-xs text-ink-soft/60">加载中…</span>}
        </span>
        <div className="flex items-center gap-2">
          {admin && (
            <button
              onClick={onOpenNew}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-ink rounded-full hover:bg-ink/85 transition"
            >
              + 发布
            </button>
          )}
          {!admin && (
            <span className="text-xs font-mono text-amber-600">
              // 游客模式 · 发布功能已锁定
            </span>
          )}
        </div>
      </div>

      {loading ? (
        <div className="text-center py-20 text-ink-soft/60">加载中…</div>
      ) : works.length === 0 ? (
        <div className="text-center py-20 text-ink-soft/60">
          还没发布,{admin ? '点 + 发布 发上第一条吧' : '请联系管理员发布'}
        </div>
      ) : (
        <div className="border-y border-ink/10 divide-y divide-ink/10">
          {works.map((w) => (
            <WorkSummaryRow
              key={w.id}
              work={w}
              canDelete={admin}
              onOpen={() => onOpenDetail(w.id)}
              onDelete={() => onDelete(w.id)}
            />
          ))}
        </div>
      )}

      <div className="mt-16 text-center text-xs font-mono text-ink-soft/40">
        // 数据由后端 SQLite 存储 · 清理浏览器数据不影响
      </div>
    </>
  )
}

// 列表项 (极简: ticket # + 标题 + 说明数)
function WorkSummaryRow({
  work,
  canDelete,
  onOpen,
  onDelete,
}: {
  work: Work
  canDelete: boolean
  onOpen: () => void
  onDelete?: () => void
}) {
  const ticketId = String(work.id).padStart(5, '0')
  return (
    <div className="group flex items-center gap-3 py-3 hover:bg-bg-soft/40 transition px-2 -mx-2 rounded-lg">
      <button
        type="button"
        onClick={onOpen}
        className="flex items-center gap-3 flex-1 min-w-0 text-left"
        aria-label={`查看 ${work.title}`}
      >
        <span className="font-mono text-[11px] text-white bg-rose-500 px-2 py-0.5 rounded shrink-0 tracking-wider">
          #{ticketId}
        </span>
        <span className="text-sm font-semibold text-ink truncate group-hover:text-accent transition">
          {work.title}
        </span>
        {work.note_count > 0 && (
          <span className="text-[11px] font-mono text-ink-soft/60 shrink-0">
            · {work.note_count} 说明
          </span>
        )}
      </button>
      {canDelete && onDelete && (
        <button
          onClick={onDelete}
          className="text-xs text-ink-soft/50 hover:text-accent transition opacity-60 group-hover:opacity-100"
          title="删除"
        >
          ×
        </button>
      )}
    </div>
  )
}

// ============ 新建视图 (极简: title + description) ============
function NewView({
  admin,
  onCancel,
  onCreated,
}: {
  admin: boolean
  onCancel: () => void
  onCreated: (id: number) => void
}) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) {
      alert('标题必填')
      return
    }
    setSubmitting(true)
    try {
      const { id } = await createWork({
        title: title.trim(),
        description: description.trim() || undefined,
      })
      onCreated(id)
    } catch (err: any) {
      alert('发布失败: ' + (err.message || err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="flex items-center justify-between mb-6">
        <div className="text-xs font-mono text-ink-soft/70">// 新发布</div>
        <button
          type="button"
          onClick={onCancel}
          className="text-sm text-ink-soft hover:text-ink transition"
        >
          ← 返回列表
        </button>
      </div>

      <div>
        <label className="block text-xs font-mono text-ink-soft mb-1.5 uppercase tracking-widest">
          标题 *
        </label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="例: i570 pppoe拨上号后network显示异常"
          disabled={submitting}
          autoFocus
          className="w-full px-4 py-2.5 text-sm bg-white border border-ink/10 rounded-md focus:outline-none focus:border-ink/30 disabled:opacity-50"
        />
      </div>

      <div>
        <label className="block text-xs font-mono text-ink-soft mb-1.5 uppercase tracking-widest">
          描述 (可选)
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={8}
          placeholder={'一句话描述这次要调查什么。\n详细调查过程去详情页用"添加说明"一条条追加。'}
          disabled={submitting}
          className="w-full px-4 py-2.5 text-sm bg-white border border-ink/10 rounded-md focus:outline-none focus:border-ink/30 resize-y disabled:opacity-50 font-mono"
        />
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <button
          type="submit"
          disabled={submitting}
          className="px-6 py-2 text-sm font-semibold text-white bg-accent rounded-md hover:bg-accent/90 transition disabled:opacity-50"
        >
          {submitting ? '发布中…' : '📤 发布'}
        </button>
      </div>
    </form>
  )
}

// ============ 详情视图 (只读 + 每条 note 可删) ============
function DetailView({
  work,
  loading,
  admin,
  onBack,
  onEdit,
  onDelete,
  onDeleteNote,
}: {
  work: Work | null
  loading: boolean
  admin: boolean
  onBack: () => void
  onEdit: () => void
  onDelete: (id: number) => void
  onDeleteNote: (workId: number, noteId: number) => void
}) {
  if (loading) {
    return <div className="text-center py-20 text-ink-soft/60">加载中…</div>
  }
  if (!work) {
    return (
      <div className="text-center py-20 text-ink-soft/60">
        <p>没找到这条 ticket</p>
        <button onClick={onBack} className="mt-4 text-sm text-accent hover:underline">
          ← 返回列表
        </button>
      </div>
    )
  }

  const ticketId = String(work.id).padStart(5, '0')

  return (
    <article className="border-l-2 border-ink/10 pl-6 hover:border-accent transition-colors">
      {/* 顶部: 返回 + 编辑 + 删除 */}
      <div className="flex items-center justify-between mb-5 gap-3 flex-wrap">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-sm text-ink-soft hover:text-accent transition"
        >
          ← 返回列表
        </button>
        {admin && (
          <div className="flex items-center gap-3">
            <button
              onClick={onEdit}
              className="text-xs text-ink-soft/70 hover:text-accent transition"
            >
              ✎ 编辑
            </button>
            <button
              onClick={() => onDelete(work.id)}
              className="text-xs text-ink-soft/50 hover:text-accent transition"
              title="删除整条 ticket"
            >
              × 删除
            </button>
          </div>
        )}
      </div>

      {/* ticket # + 日期 + 标题 */}
      <div className="flex items-baseline gap-2 mb-3 flex-wrap">
        <span className="font-mono text-xs text-white bg-rose-500 px-2 py-0.5 rounded tracking-wider">
          #{ticketId}
        </span>
        <span className="text-xs font-mono text-ink-soft/60">{work.date}</span>
      </div>
      <h2 className="text-2xl font-bold text-ink mb-5">{work.title}</h2>

      {/* 描述 */}
      {work.description && (
        <div className="mb-6 p-4 bg-bg-soft/40 border border-ink/5 rounded-xl">
          <div className="text-[11px] font-mono text-ink-soft/70 uppercase tracking-widest mb-2">
            // 描述
          </div>
          <pre className="text-sm text-ink whitespace-pre-wrap font-mono leading-relaxed">
            {work.description}
          </pre>
        </div>
      )}

      {/* 说明流 (notes) - 每条右边有 × 删除按钮 (admin) */}
      <div>
        <div className="text-[11px] font-mono text-ink-soft/70 uppercase tracking-widest mb-3 border-b border-ink/10 pb-2">
          // 说明 ({work.notes?.length ?? 0})
        </div>
        {work.notes && work.notes.length > 0 ? (
          <div className="space-y-4">
            {work.notes.map((n) => (
              <NoteCard
                key={n.id}
                note={n}
                canDelete={admin}
                onDelete={() => onDeleteNote(work.id, n.id)}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-ink-soft/50 text-sm">
            还没有说明。{admin ? '点 ✎ 编辑 添加第一条' : ''}
          </div>
        )}
      </div>
    </article>
  )
}

// ============ 编辑视图 (标题/描述可折叠编辑 + 说明只读 + 添加新说明) ============
function EditView({
  work,
  admin,
  onCancel,
  onSaved,
  onAddNote,
}: {
  work: Work | null
  admin: boolean
  onCancel: () => void
  onSaved: (id: number) => Promise<void> | void
  onAddNote: (id: number, payload: { content: string; files: File[] }) => Promise<void>
}) {
  if (!work) {
    return (
      <div className="text-center py-20 text-ink-soft/60">
        <p>没找到这条 ticket</p>
      </div>
    )
  }

  return (
    <>
      {/* 顶部: 取消 (改动作废) */}
      <div className="flex items-center justify-between mb-6">
        <div className="text-xs font-mono text-ink-soft/70">
          // 编辑 #{String(work.id).padStart(5, '0')} · 当前未保存的标题/描述改动,点取消会丢
        </div>
        <button
          onClick={onCancel}
          className="text-sm text-ink-soft hover:text-ink transition"
        >
          ← 取消编辑
        </button>
      </div>

      {/* 标题 (可点击折叠/展开编辑) */}
      <ClickToEditField
        label="标题"
        initial={work.title}
        multiline={false}
        onSave={async (newValue) => {
          await updateWork(work.id, { title: newValue })
          await onSaved(work.id)
        }}
      />

      {/* 描述 (可点击折叠/展开编辑) */}
      <ClickToEditField
        label="描述"
        initial={work.description || ''}
        multiline={true}
        placeholder="(空)"
        onSave={async (newValue) => {
          await updateWork(work.id, { description: newValue })
          await onSaved(work.id)
        }}
      />

      {/* 说明 (只读) */}
      <div className="mt-6">
        <div className="text-[11px] font-mono text-ink-soft/70 uppercase tracking-widest mb-3 border-b border-ink/10 pb-2">
          // 说明 ({work.notes?.length ?? 0}) · 只读,删除请回详情页
        </div>
        {work.notes && work.notes.length > 0 ? (
          <div className="space-y-4">
            {work.notes.map((n) => (
              <NoteCard key={n.id} note={n} canDelete={false} onDelete={() => {}} />
            ))}
          </div>
        ) : (
          <div className="text-center py-6 text-ink-soft/50 text-sm">
            还没有说明
          </div>
        )}
      </div>

      {/* 添加新说明表单 (admin only) */}
      {admin && (
        <div className="mt-6">
          <AddNoteForm
            onSubmit={async (content, files) => {
              await onAddNote(work.id, { content, files })
            }}
          />
        </div>
      )}
    </>
  )
}

// 点击展开/折叠的编辑字段 (标题/描述通用)
function ClickToEditField({
  label,
  initial,
  multiline,
  placeholder,
  onSave,
}: {
  label: string
  initial: string
  multiline: boolean
  placeholder?: string
  onSave: (value: string) => Promise<void>
}) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(initial)
  const [saving, setSaving] = useState(false)
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null)

  // 每次 initial 变化 (切换 work) 重置
  useEffect(() => {
    setValue(initial)
  }, [initial])

  function startEdit() {
    setValue(initial)  // 重置回原值 (丢弃之前可能的改)
    setEditing(true)
    // 下一帧 focus
    setTimeout(() => inputRef.current?.focus(), 0)
  }

  function cancelEdit() {
    setValue(initial)  // 恢复原值 (丢弃本次未保存的改)
    setEditing(false)
  }

  async function save() {
    if (value === initial) {
      // 没改,直接关闭
      setEditing(false)
      return
    }
    setSaving(true)
    try {
      await onSave(value)
      // 成功后 setEditing(false) - 但 onSave 完成后 work 重新 load, initial 变, useEffect 会 sync
      setEditing(false)
    } catch (err: any) {
      alert('保存失败: ' + (err.message || err))
    } finally {
      setSaving(false)
    }
  }

  function onKeyDown(e: React.KeyboardEvent) {
    // Ctrl+Enter (textarea) or Enter (input 不行) 保存
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault()
      save()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      cancelEdit()
    }
  }

  if (editing) {
    return (
      <div className="mb-4 p-4 bg-bg-soft/60 border border-ink/10 rounded-xl">
        <div className="text-[11px] font-mono text-ink-soft/70 uppercase tracking-widest mb-2 flex items-center justify-between">
          <span>▼ {label} · 编辑中</span>
          <span className="text-[10px] text-ink-soft/50 normal-case font-sans">
            Ctrl+Enter 保存 · Esc 取消
          </span>
        </div>
        {multiline ? (
          <textarea
            ref={inputRef as React.RefObject<HTMLTextAreaElement>}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={onKeyDown}
            rows={6}
            disabled={saving}
            placeholder={placeholder}
            className="w-full px-3 py-2 text-sm bg-white border border-ink/10 rounded-md focus:outline-none focus:border-ink/30 resize-y disabled:opacity-50 font-mono"
          />
        ) : (
          <input
            ref={inputRef as React.RefObject<HTMLInputElement>}
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={onKeyDown}
            disabled={saving}
            placeholder={placeholder}
            className="w-full px-3 py-2 text-sm bg-white border border-ink/10 rounded-md focus:outline-none focus:border-ink/30 disabled:opacity-50"
          />
        )}
        <div className="flex justify-end gap-2 mt-2">
          <button
            type="button"
            onClick={cancelEdit}
            disabled={saving}
            className="px-3 py-1.5 text-sm text-ink-soft hover:text-ink transition disabled:opacity-50"
          >
            取消
          </button>
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="px-4 py-1.5 text-sm font-semibold text-white bg-accent rounded-md hover:bg-accent/90 transition disabled:opacity-50"
          >
            {saving ? '保存中…' : '💾 保存'}
          </button>
        </div>
      </div>
    )
  }

  // 折叠态: 点击 label/内容 展开
  return (
    <div className="mb-4 group">
      <div className="text-[11px] font-mono text-ink-soft/70 uppercase tracking-widest mb-1.5">
        {label}
      </div>
      <button
        type="button"
        onClick={startEdit}
        className="w-full text-left px-3 py-2.5 bg-bg-soft/30 hover:bg-bg-soft/60 border border-transparent hover:border-ink/10 rounded-md transition flex items-center gap-2 group/btn"
        title="点击修改"
      >
        {initial ? (
          multiline ? (
            <pre className="text-sm text-ink whitespace-pre-wrap font-mono leading-relaxed flex-1 min-w-0">
              {initial}
            </pre>
          ) : (
            <span className="text-sm font-semibold text-ink flex-1 min-w-0 truncate">
              {initial}
            </span>
          )
        ) : (
          <span className="text-sm text-ink-soft/50 italic flex-1">
            {placeholder || '(空,点击添加)'}
          </span>
        )}
        <span className="text-xs text-ink-soft/50 group-hover/btn:text-accent transition shrink-0">
          ✎ 改
        </span>
      </button>
    </div>
  )
}

function NoteCard({
  note,
  canDelete,
  onDelete,
}: {
  note: WorkNote
  canDelete: boolean
  onDelete: () => void
}) {
  return (
    <article className="border-l-2 border-ink/10 pl-4 py-2">
      <div className="flex items-center justify-between mb-2 gap-2 flex-wrap">
        <div className="text-[11px] font-mono text-ink-soft/60">
          #{String(note.id).padStart(3, '0')} · {formatNoteTime(note.created_at)}
        </div>
        {canDelete && (
          <button
            onClick={onDelete}
            className="text-[11px] text-ink-soft/50 hover:text-accent transition"
            title="删除这条说明"
          >
            × 删除
          </button>
        )}
      </div>
      {note.content && (
        <pre className="text-sm text-ink whitespace-pre-wrap font-mono leading-relaxed mb-3">
          {note.content}
        </pre>
      )}
      {note.images.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {note.images.map((url, i) => (
            <a
              key={i}
              href={url}
              target="_blank"
              rel="noreferrer"
              className="block rounded-lg border border-ink/10 overflow-hidden hover:shadow-lg transition"
            >
              <img src={url} alt="" className="w-full h-auto" loading="lazy" />
            </a>
          ))}
        </div>
      )}
    </article>
  )
}

function AddNoteForm({
  onSubmit,
}: {
  onSubmit: (content: string, files: File[]) => Promise<void>
}) {
  const [content, setContent] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [previews, setPreviews] = useState<string[]>([])
  const [submitting, setSubmitting] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  function pickFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(e.target.files || [])
    if (picked.length === 0) return
    const valid: File[] = []
    const skipped: string[] = []
    for (const f of picked) {
      if (!/^image\//.test(f.type)) {
        skipped.push(f.name)
        continue
      }
      if (f.size > 5 * 1024 * 1024) {
        skipped.push(`${f.name} (超过 5MB)`)
        continue
      }
      valid.push(f)
    }
    if (skipped.length > 0) {
      alert('以下文件已跳过 (非图片或超过 5MB):\n' + skipped.join('\n'))
    }
    if (valid.length === 0) return
    setFiles((prev) => [...prev, ...valid])
    Promise.all(valid.map(fileToPreview)).then((p) => {
      setPreviews((prev) => [...prev, ...p])
    })
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  function removeFile(i: number) {
    setFiles((prev) => prev.filter((_, idx) => idx !== i))
    setPreviews((prev) => prev.filter((_, idx) => idx !== i))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!content.trim() && files.length === 0) {
      alert('内容或图片至少有一个')
      return
    }
    setSubmitting(true)
    try {
      await onSubmit(content.trim(), files)
      // 父组件成功后会自动跳回详情, 这里不用清表单
    } catch (err: any) {
      alert('提交失败: ' + (err.message || err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 p-5 bg-bg-soft/40 border border-ink/10 rounded-2xl">
      <div className="text-xs font-mono text-ink-soft/70">// 添加新说明 (提交后自动跳回详情)</div>

      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        rows={4}
        placeholder="这次又发现了什么? 写下来,以后翻。"
        disabled={submitting}
        className="w-full px-4 py-2.5 text-sm bg-white border border-ink/10 rounded-md focus:outline-none focus:border-ink/30 resize-y disabled:opacity-50 font-mono"
      />

      <div>
        <div className="flex items-baseline justify-between mb-1.5">
          <label className="text-xs font-mono text-ink-soft uppercase tracking-widest">
            截图 (可选,单张 ≤ 5MB)
          </label>
          {files.length > 0 && !submitting && (
            <button
              type="button"
              onClick={() => {
                setFiles([])
                setPreviews([])
              }}
              className="text-[11px] text-ink-soft hover:text-accent transition"
            >
              × 清空
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={submitting}
          className="w-full p-3 border-2 border-dashed border-ink/20 rounded-xl hover:border-accent/40 hover:bg-accent/5 transition flex flex-col items-center gap-1 disabled:opacity-50"
        >
          <div className="text-xl">📷</div>
          <div className="text-sm font-semibold text-ink">
            {files.length === 0 ? '选择截图' : '继续添加'}
          </div>
          <div className="text-[11px] text-ink-soft/70 font-mono">
            当前 {files.length} 张 · 可一次选多张
          </div>
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={pickFiles}
          className="hidden"
        />
        {previews.length > 0 && (
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 mt-3">
            {previews.map((p, i) => (
              <div
                key={i}
                className="relative aspect-square rounded-lg overflow-hidden border border-ink/10 group"
              >
                <img src={p} alt="" className="w-full h-full object-cover" />
                {!submitting && (
                  <button
                    type="button"
                    onClick={() => removeFile(i)}
                    className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/70 text-white text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition"
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex justify-end pt-1">
        <button
          type="submit"
          disabled={submitting}
          className="px-5 py-2 text-sm font-semibold text-white bg-accent rounded-md hover:bg-accent/90 transition disabled:opacity-50"
        >
          {submitting ? '提交中…' : '📤 提交说明'}
        </button>
      </div>
    </form>
  )
}
