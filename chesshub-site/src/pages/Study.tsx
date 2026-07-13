import { useEffect, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import App from '../App'
import {
  listStudies,
  getStudy,
  createStudy,
  updateStudy,
  deleteStudy,
  addStudyNote,
  updateStudyNote,
  deleteStudyNote,
  type Study,
  type StudyNote,
} from '../api'
import { isAdmin, ensureLoggedIn, clearAuth } from '../auth'

function formatNoteTime(unix: number): string {
  const d = new Date(unix * 1000)
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  const hh = String(d.getHours()).padStart(2, '0')
  const mi = String(d.getMinutes()).padStart(2, '0')
  return `${mm}-${dd} ${hh}:${mi}`
}

export default function StudyPage() {
  const [view, setView] = useState<'list' | 'new' | 'detail' | 'edit'>('list')
  const [studies, setStudies] = useState<Study[]>([])
  const [current, setCurrent] = useState<Study | null>(null)
  const [loading, setLoading] = useState(true)
  const [admin, setAdmin] = useState(false)
  const [detailLoading, setDetailLoading] = useState(false)

  // 守卫 + 初次加载
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

  const toDetail = (id: number) => {
    const url = new URL(window.location.href)
    url.searchParams.set('id', String(id))
    url.searchParams.delete('new')
    history.pushState({}, '', url.toString())
    loadDetail(id)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const toEdit = () => {
    setView('edit')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function loadList() {
    setLoading(true)
    try {
      const { studies } = await listStudies()
      setStudies(studies)
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
      const { study } = await getStudy(id)
      setCurrent(study)
    } catch (e: any) {
      console.error('loadDetail error:', e)
      if (e.message?.includes('404')) setCurrent(null)
    } finally {
      setDetailLoading(false)
    }
  }

  return (
    <App current="study">
      <div className="max-w-3xl md:max-w-4xl xl:max-w-5xl mx-auto px-6 pt-12 pb-24">
        {view === 'list' && (
          <ListView
            studies={studies}
            loading={loading}
            admin={admin}
            onOpenDetail={openDetail}
            onOpenNew={openNew}
            onDelete={async (id) => {
              if (!confirm('确认删除这条笔记? (所有说明和图片都会一起删)')) return
              await deleteStudy(id)
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
            study={current}
            loading={detailLoading}
            admin={admin}
            onBack={closeToList}
            onDelete={async (id) => {
              if (!confirm('确认删除这条笔记? (所有说明和图片都会一起删)')) return
              await deleteStudy(id)
              await loadList()
              closeToList()
            }}
            onEdit={toEdit}
            onDeleteNote={async (workId, noteId) => {
              if (!confirm('确认删除这条说明?')) return
              await deleteStudyNote(workId, noteId)
              await loadDetail(workId)
              await loadList()
            }}
            onEditNote={async (workId, noteId, payload) => {
              await updateStudyNote(workId, noteId, { content: payload })
              await loadDetail(workId)
              await loadList()
            }}
          />
        )}

        {view === 'edit' && (
          <EditView
            study={current}
            admin={admin}
            onCancel={() => current && toDetail(current.id)}
            onSaved={async (id) => {
              await loadDetail(id)
              await loadList()
            }}
            onAddNote={async (id, content) => {
              await addStudyNote(id, { content })
              await loadList()
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
  studies,
  loading,
  admin,
  onOpenDetail,
  onOpenNew,
  onDelete,
}: {
  studies: Study[]
  loading: boolean
  admin: boolean
  onOpenDetail: (id: number) => void
  onOpenNew: () => void
  onDelete: (id: number) => void
}) {
  return (
    <>
      <div className="text-center mb-10">
        <p className="text-xs font-mono text-accent mb-3 tracking-widest">/ STUDY</p>
        <h1 className="text-4xl md:text-5xl font-extrabold text-ink">
          学习<span className="text-accent">.</span>
        </h1>
        <p className="mt-4 text-ink-soft max-w-xl mx-auto leading-relaxed">
          学的过程笔记。每条一行,点进去看详情 + 反思/收获。
        </p>
      </div>

      <div className="flex items-center justify-between mb-8 border-b border-ink/10 pb-4 gap-3 flex-wrap">
        <span className="text-sm text-ink-soft">
          共 <span className="text-ink font-semibold">{studies.length}</span> 条
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
      ) : studies.length === 0 ? (
        <div className="text-center py-20 text-ink-soft/60">
          还没发布,{admin ? '点 + 发布 发上第一条吧' : '请联系管理员发布'}
        </div>
      ) : (
        <div className="border-y border-ink/10 divide-y divide-ink/10">
          {studies.map((w) => (
            <StudySummaryRow
              key={w.id}
              study={w}
              canDelete={admin}
              onOpen={() => onOpenDetail(w.id)}
              onDelete={() => onDelete(w.id)}
            />
          ))}
        </div>
      )}

    </>
  )
}

function StudySummaryRow({
  study,
  canDelete,
  onOpen,
  onDelete,
}: {
  study: Study
  canDelete: boolean
  onOpen: () => void
  onDelete?: () => void
}) {
  const ticketId = String(study.id).padStart(5, '0')
  return (
    <div className="group flex items-center gap-3 py-3 hover:bg-bg-soft/40 transition px-2 -mx-2 rounded-lg">
      <button
        type="button"
        onClick={onOpen}
        className="flex items-center gap-3 flex-1 min-w-0 text-left"
        aria-label={`查看 ${study.title}`}
      >
        <span className="font-mono text-[11px] text-white bg-rose-500 px-2 py-0.5 rounded shrink-0 tracking-wider">
          #{ticketId}
        </span>
        <span className="text-sm font-semibold text-ink truncate group-hover:text-accent transition">
          {study.title}
        </span>
        {study.note_count > 0 && (
          <span className="text-[11px] font-mono text-ink-soft/60 shrink-0">
            · {study.note_count} 说明
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

// ============ 新建视图 (title + markdown 描述) ============
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
      const { id } = await createStudy({
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

      <MarkdownFieldEditor
        label="描述 (可选) · 提交后自动跳回详情"
        value={description}
        onChange={setDescription}
        submitting={submitting}
        placeholder={'一句话描述这次要调查什么。\n详细调查过程去详情页用"添加说明"一条条追加。'}
      />

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

// ============ 通用 markdown 字段编辑器 (toolbar + textarea + 预览,不带 onSave) ============
// 给 NewView 的 description 等独立字段用。提交按钮在父级 form。
function MarkdownFieldEditor({
  label,
  value,
  onChange,
  submitting,
  placeholder,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  submitting: boolean
  placeholder: string
}) {
  const [showPreview, setShowPreview] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <label className="text-xs font-mono text-ink-soft uppercase tracking-widest">
          {label}
        </label>
        <button
          type="button"
          onClick={() => setShowPreview(!showPreview)}
          className="text-[11px] text-ink-soft hover:text-accent transition"
        >
          {showPreview ? '✎ 写' : '👁 预览'}
        </button>
      </div>
      {showPreview ? (
        <div className="min-h-[120px] px-4 py-3 bg-white border border-ink/10 rounded-md">
          {value.trim() ? (
            <MarkdownRender content={value} />
          ) : (
            <div className="text-ink-soft/50 text-sm italic">还没内容</div>
          )}
        </div>
      ) : (
        <>
          <MarkdownToolbar textareaRef={textareaRef} value={value} onChange={onChange} />
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            rows={6}
            disabled={submitting}
            placeholder={placeholder}
            className="w-full px-4 py-2.5 text-sm bg-white border border-ink/10 rounded-b-md focus:outline-none focus:border-ink/30 resize-y disabled:opacity-50 font-mono"
          />
        </>
      )}
    </div>
  )
}

// ============ note 卡片 (详情只读 + 可选 inline 编辑) ============
function NoteCard({
  note,
  canDelete,
  canEdit,
  onDelete,
  onEdit,
}: {
  note: StudyNote
  canDelete: boolean
  canEdit: boolean
  onDelete: () => void
  onEdit: (content: string) => Promise<void>
}) {
  const [editing, setEditing] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  if (editing) {
    return (
      <article className="border-l-2 border-accent pl-4 py-2 bg-accent/5 -ml-2 pl-4">
        <div className="flex items-center justify-between mb-2 gap-2 flex-wrap">
          <div className="text-[11px] font-mono text-accent">
            #{String(note.id).padStart(3, '0')} · 编辑中
          </div>
          <div className="flex items-center gap-2">
            {canDelete && !submitting && (
              <button
                onClick={onDelete}
                className="text-[11px] text-ink-soft/50 hover:text-accent transition"
                title="删除这条说明"
              >
                × 删除
              </button>
            )}
          </div>
        </div>
        <NoteEditor
          initialContent={note.content || ''}
          submitting={submitting}
          label="// 编辑这条说明 · 保存后留在原地"
          submitLabel="💾 保存修改"
          showCancel
          onSave={async (content) => {
            setSubmitting(true)
            try {
              await onEdit(content)
              setEditing(false)
            } catch (err: any) {
              alert('保存失败: ' + (err.message || err))
            } finally {
              setSubmitting(false)
            }
          }}
          onCancel={() => setEditing(false)}
        />
      </article>
    )
  }

  return (
    <article className="border-l-2 border-ink/10 pl-4 py-2">
      <div className="flex items-center justify-between mb-2 gap-2 flex-wrap">
        <div className="text-[11px] font-mono text-ink-soft/60">
          #{String(note.id).padStart(3, '0')} · {formatNoteTime(note.created_at)}
        </div>
        <div className="flex items-center gap-2">
          {canEdit && (
            <button
              onClick={() => setEditing(true)}
              className="text-[11px] text-ink-soft/70 hover:text-accent transition"
              title="编辑这条说明"
            >
              ✎ 编辑
            </button>
          )}
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
      </div>
      {note.content && (
        <MarkdownRender content={note.content} />
      )}
    </article>
  )
}

// ============ Note 编辑器 (创建/编辑共用: toolbar + textarea + 预览 + 取消/保存) ============
// 学习笔记不带图片 (用户 2026-07-10 拍板: 去掉截图上传)
function NoteEditor({
  initialContent,
  onSave,
  onCancel,
  submitting,
  label,
  submitLabel,
  showCancel,
}: {
  initialContent: string
  onSave: (content: string) => Promise<void>
  onCancel: () => void
  submitting: boolean
  label: string
  submitLabel: string
  showCancel: boolean
}) {
  const [content, setContent] = useState(initialContent)
  const [showPreview, setShowPreview] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  async function handleSubmit(e?: React.FormEvent) {
    if (e) e.preventDefault()
    if (!content.trim()) {
      alert('说明内容不能为空')
      return
    }
    await onSave(content.trim())
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-xs font-mono text-ink-soft/70">{label}</div>
        <button
          type="button"
          onClick={() => setShowPreview(!showPreview)}
          className="text-[11px] text-ink-soft hover:text-accent transition"
        >
          {showPreview ? '✎ 写' : '👁 预览'}
        </button>
      </div>

      {showPreview ? (
        <div className="min-h-[120px] px-4 py-3 bg-white border border-ink/10 rounded-md">
          {content.trim() ? (
            <MarkdownRender content={content} />
          ) : (
            <div className="text-ink-soft/50 text-sm italic">还没内容</div>
          )}
        </div>
      ) : (
        <>
          <MarkdownToolbar
            textareaRef={textareaRef}
            value={content}
            onChange={setContent}
          />
          <textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={6}
            disabled={submitting}
            className="w-full px-4 py-2.5 text-sm bg-white border border-ink/10 rounded-b-md focus:outline-none focus:border-ink/30 resize-y disabled:opacity-50 font-mono"
          />
        </>
      )}

      <div className="flex justify-end gap-2 pt-1">
        {showCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={submitting}
            className="px-3 py-1.5 text-sm text-ink-soft hover:text-ink transition disabled:opacity-50"
          >
            取消
          </button>
        )}
        <button
          type="submit"
          disabled={submitting}
          className="px-5 py-2 text-sm font-semibold text-white bg-accent rounded-md hover:bg-accent/90 transition disabled:opacity-50"
        >
          {submitting ? '保存中…' : submitLabel}
        </button>
      </div>
    </form>
  )
}
function DetailView({
  study,
  loading,
  admin,
  onBack,
  onEdit,
  onDelete,
  onDeleteNote,
  onEditNote,
}: {
  study: Study | null
  loading: boolean
  admin: boolean
  onBack: () => void
  onEdit: () => void
  onDelete: (id: number) => void
  onDeleteNote: (workId: number, noteId: number) => void
  onEditNote: (workId: number, noteId: number, content: string) => Promise<void>
}) {
  if (loading) {
    return <div className="text-center py-20 text-ink-soft/60">加载中…</div>
  }
  if (!study) {
    return (
      <div className="text-center py-20 text-ink-soft/60">
        <p>没找到这条笔记</p>
        <button onClick={onBack} className="mt-4 text-sm text-accent hover:underline">
          ← 返回列表
        </button>
      </div>
    )
  }

  const ticketId = String(study.id).padStart(5, '0')

  return (
    <article className="border-l-2 border-ink/10 pl-6 hover:border-accent transition-colors">
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
              onClick={() => onDelete(study.id)}
              className="text-xs text-ink-soft/50 hover:text-accent transition"
              title="删除整条笔记"
            >
              × 删除
            </button>
          </div>
        )}
      </div>

      <div className="flex items-baseline gap-2 mb-3 flex-wrap">
        <span className="font-mono text-xs text-white bg-rose-500 px-2 py-0.5 rounded tracking-wider">
          #{ticketId}
        </span>
        <span className="text-xs font-mono text-ink-soft/60">{study.date}</span>
      </div>
      <h2 className="text-2xl font-bold text-ink mb-5">{study.title}</h2>

      {study.description && (
        <div className="mb-6 p-4 bg-bg-soft/40 border border-ink/5 rounded-xl">
          <div className="text-[11px] font-mono text-ink-soft/70 uppercase tracking-widest mb-2">
            描述
          </div>
          <MarkdownRender content={study.description} />
        </div>
      )}

      <div>
        <div className="text-[11px] font-mono text-ink-soft/70 uppercase tracking-widest mb-3 border-b border-ink/10 pb-2">
          说明 ({study.notes?.length ?? 0})
        </div>
        {study.notes && study.notes.length > 0 ? (
          <div className="space-y-4">
            {study.notes.map((n) => (
              <NoteCard
                key={n.id}
                note={n}
                canDelete={admin}
                canEdit={admin}
                onDelete={() => onDeleteNote(study.id, n.id)}
                onEdit={async (content) => {
                  await onEditNote(study.id, n.id, content)
                }}
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

// ============ 编辑视图 (标题/描述可折叠 + 说明折叠 + 添加新说明 markdown toolbar) ============
function EditView({
  study,
  admin,
  onCancel,
  onSaved,
  onAddNote,
}: {
  study: Study | null
  admin: boolean
  onCancel: () => void
  onSaved: (id: number) => Promise<void> | void
  onAddNote: (id: number, content: string) => Promise<void>
}) {
  if (!study) {
    return (
      <div className="text-center py-20 text-ink-soft/60">
        <p>没找到这条笔记</p>
      </div>
    )
  }

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <div className="text-xs font-mono text-ink-soft/70">
          // 编辑 #{String(study.id).padStart(5, '0')} · 当前未保存的标题/描述改动,点取消会丢
        </div>
        <button
          onClick={onCancel}
          className="text-sm text-ink-soft hover:text-ink transition"
        >
          ← 取消编辑
        </button>
      </div>

      <ClickToEditField
        label="标题"
        initial={study.title}
        multiline={false}
        onSave={async (newValue) => {
          await updateStudy(study.id, { title: newValue })
          await onSaved(study.id)
        }}
      />

      <ClickToEditField
        label="描述"
        initial={study.description || ''}
        multiline={true}
        placeholder="(空)"
        onSave={async (newValue) => {
          await updateStudy(study.id, { description: newValue })
          await onSaved(study.id)
        }}
      />

      {/* 说明 (默认折叠, 点击展开看历史) */}
      <details className="mt-6 group/notes">
        <summary className="cursor-pointer text-[11px] font-mono text-ink-soft/70 uppercase tracking-widest border-b border-ink/10 pb-2 mb-3 flex items-center gap-2 select-none hover:text-ink transition">
          <span className="transition group-open/notes:rotate-90 inline-block">▸</span>
          <span>说明 ({study.notes?.length ?? 0}) · 点击展开历史</span>
        </summary>
        <div className="space-y-4">
          {study.notes && study.notes.length > 0 ? (
            study.notes.map((n) => (
              <NoteCard
                key={n.id}
                note={n}
                canDelete={false}
                canEdit={false}
                onDelete={() => {}}
                onEdit={async () => {}}
              />
            ))
          ) : (
            <div className="text-center py-6 text-ink-soft/50 text-sm">
              还没有说明
            </div>
          )}
        </div>
      </details>

      {admin && (
        <div className="mt-6">
          <AddNoteForm
            onSubmit={async (content) => {
              await onAddNote(study.id, content)
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

  useEffect(() => {
    setValue(initial)
  }, [initial])

  function startEdit() {
    setValue(initial)
    setEditing(true)
    setTimeout(() => inputRef.current?.focus(), 0)
  }

  function cancelEdit() {
    setValue(initial)
    setEditing(false)
  }

  async function save() {
    if (value === initial) {
      setEditing(false)
      return
    }
    setSaving(true)
    try {
      await onSave(value)
      setEditing(false)
    } catch (err: any) {
      alert('保存失败: ' + (err.message || err))
    } finally {
      setSaving(false)
    }
  }

  function onKeyDown(e: React.KeyboardEvent) {
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



// ============ Markdown 渲染 ============
function MarkdownRender({ content }: { content: string }) {
  if (!content.trim()) return null
  return (
    <div className="md text-sm leading-relaxed">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          // 链接新窗口打开
          a: ({ node, ...props }) => (
            <a {...props} target="_blank" rel="noreferrer" className="text-accent hover:underline" />
          ),
          // 表格样式
          table: ({ node, ...props }) => (
            <div className="my-2 overflow-x-auto">
              <table {...props} className="text-sm border-collapse border border-ink/20" />
            </div>
          ),
          th: ({ node, ...props }) => (
            <th {...props} className="border border-ink/20 px-2 py-1 bg-bg-soft/60 text-left font-semibold" />
          ),
          td: ({ node, ...props }) => (
            <td {...props} className="border border-ink/20 px-2 py-1" />
          ),
          // 标题
          h1: ({ node, ...props }) => (
            <h1 {...props} className="text-xl font-bold text-ink mt-4 mb-2 first:mt-0" />
          ),
          h2: ({ node, ...props }) => (
            <h2 {...props} className="text-lg font-bold text-ink mt-3 mb-2 first:mt-0" />
          ),
          h3: ({ node, ...props }) => (
            <h3 {...props} className="text-base font-bold text-ink mt-3 mb-1 first:mt-0" />
          ),
          // 段落
          p: ({ node, ...props }) => (
            <p {...props} className="my-2 first:mt-0 last:mb-0" />
          ),
          // 列表
          ul: ({ node, ...props }) => (
            <ul {...props} className="list-disc list-outside ml-5 my-2 space-y-1" />
          ),
          ol: ({ node, ...props }) => (
            <ol {...props} className="list-decimal list-outside ml-5 my-2 space-y-1" />
          ),
          // 引用
          blockquote: ({ node, ...props }) => (
            <blockquote {...props} className="border-l-4 border-ink/20 pl-3 my-2 text-ink-soft italic" />
          ),
          // 代码块
          code: ({ node, className, children, ...props }) => {
            const isBlock = className?.includes('language-')
            return isBlock ? (
              <code {...props} className="block bg-bg-soft/60 p-2 rounded text-xs font-mono overflow-x-auto my-2">
                {children}
              </code>
            ) : (
              <code {...props} className="px-1 py-0.5 bg-bg-soft/60 rounded text-xs font-mono">
                {children}
              </code>
            )
          },
          // 分隔线
          hr: ({ node, ...props }) => <hr {...props} className="my-3 border-ink/10" />,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}

// ============ Markdown 工具栏 (参考公司 ticket 风格: 段落下拉 + 格式按钮) ============
type BlockType = 'p' | 'h1' | 'h2' | 'h3'

function MarkdownToolbar({
  textareaRef,
  value,
  onChange,
}: {
  textareaRef: React.RefObject<HTMLTextAreaElement>
  value: string
  onChange: (v: string) => void
}) {
  const [blockOpen, setBlockOpen] = useState(false)

  // 在光标位置插入文本
  function insertAtCursor(text: string, cursorOffset = 0) {
    const ta = textareaRef.current
    if (!ta) return
    const start = ta.selectionStart
    const end = ta.selectionEnd
    const before = value.substring(0, start)
    const after = value.substring(end)
    const newVal = before + text + after
    onChange(newVal)
    // 下一帧 focus + 设光标
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus()
        textareaRef.current.selectionStart = textareaRef.current.selectionEnd = start + text.length + cursorOffset
      }
    }, 0)
  }

  // 包住选中文本 (粗体/斜体/代码)
  function wrapSelection(prefix: string, suffix: string, placeholder: string) {
    const ta = textareaRef.current
    if (!ta) return
    const start = ta.selectionStart
    const end = ta.selectionEnd
    const selected = value.substring(start, end) || placeholder
    const text = prefix + selected + suffix
    insertAtCursor(text)
  }

  // 在新行插入 (列表/引用)
  function insertLinePrefix(prefix: string) {
    const ta = textareaRef.current
    if (!ta) return
    const start = ta.selectionStart
    // 找到当前行首
    const before = value.substring(0, start)
    const lineStart = before.lastIndexOf('\n') + 1
    const linePrefix = value.substring(lineStart, start)
    // 如果当前行已有内容, prefix 加在行首
    if (linePrefix.length === 0) {
      insertAtCursor(prefix)
    } else {
      // 在行首插 prefix
      const newVal = value.substring(0, lineStart) + prefix + value.substring(lineStart)
      onChange(newVal)
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.focus()
          textareaRef.current.selectionStart = textareaRef.current.selectionEnd = start + prefix.length
        }
      }, 0)
    }
  }

  // 块级 (段落 / 标题)
  function insertBlock(type: BlockType) {
    const ta = textareaRef.current
    if (!ta) return
    const start = ta.selectionStart
    const before = value.substring(0, start)
    const after = value.substring(start)
    const lineStart = before.lastIndexOf('\n') + 1
    const lineEnd = after.indexOf('\n')
    const currentLine = after.substring(0, lineEnd === -1 ? after.length : lineEnd)
    // 去掉当前行已有的 # 前缀
    const cleanedLine = currentLine.replace(/^#+\s*/, '')
    const newPrefix = type === 'p' ? '' : '#'.repeat(type === 'h1' ? 1 : type === 'h2' ? 2 : 3) + ' '
    const newCurrentLine = newPrefix + cleanedLine
    const newVal = value.substring(0, lineStart) + newCurrentLine + after.substring(currentLine.length)
    onChange(newVal)
    setBlockOpen(false)
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus()
        textareaRef.current.selectionStart = textareaRef.current.selectionEnd = lineStart + newCurrentLine.length
      }
    }, 0)
  }

  // 表格: 3x3 模板
  function insertTable() {
    const template = `
| 列1 | 列2 | 列3 |
| --- | --- | --- |
|  |  |  |
|  |  |  |
`
    insertAtCursor(template)
  }

  // 代码块
  function insertCodeBlock() {
    const template = '\n```\n\n```\n'
    insertAtCursor(template, -4)  // 光标在 ``` 中间
  }

  // 链接
  function insertLink() {
    const ta = textareaRef.current
    if (!ta) return
    const start = ta.selectionStart
    const end = ta.selectionEnd
    const selected = value.substring(start, end) || '链接文字'
    insertAtCursor(`[${selected}](https://)`, -1)  // 光标在 url 末尾
  }

  return (
    <div className="flex flex-wrap items-center gap-0.5 px-2 py-1.5 bg-bg-soft/60 border border-ink/10 rounded-t-md border-b-0">
      {/* 段落下拉 (参考公司 ticket 风格) */}
      <div className="relative">
        <button
          type="button"
          onClick={() => setBlockOpen(!blockOpen)}
          className="px-2.5 py-1 text-xs font-semibold text-ink-soft hover:bg-bg-soft rounded transition flex items-center gap-1 min-w-[60px] justify-between"
        >
          <span>段落</span>
          <span className="text-[10px]">▾</span>
        </button>
        {blockOpen && (
          <>
            <div
              className="fixed inset-0 z-10"
              onClick={() => setBlockOpen(false)}
            />
            <div className="absolute left-0 top-full mt-0.5 bg-white border border-ink/20 rounded shadow-lg z-20 min-w-[100px] py-1">
              <button
                type="button"
                onClick={() => insertBlock('p')}
                className="w-full text-left px-3 py-1 text-sm hover:bg-bg-soft text-ink"
              >
                段落
              </button>
              <button
                type="button"
                onClick={() => insertBlock('h1')}
                className="w-full text-left px-3 py-1 text-lg font-bold hover:bg-bg-soft text-ink"
              >
                标题 1
              </button>
              <button
                type="button"
                onClick={() => insertBlock('h2')}
                className="w-full text-left px-3 py-1 text-base font-bold hover:bg-bg-soft text-ink"
              >
                标题 2
              </button>
              <button
                type="button"
                onClick={() => insertBlock('h3')}
                className="w-full text-left px-3 py-1 text-sm font-bold hover:bg-bg-soft text-ink"
              >
                标题 3
              </button>
            </div>
          </>
        )}
      </div>

      <div className="w-px h-5 bg-ink/10 mx-1" />

      {/* 格式 */}
      <ToolbarButton title="粗体 (**)" onClick={() => wrapSelection('**', '**', '粗体')}>
        <span className="font-bold">B</span>
      </ToolbarButton>
      <ToolbarButton title="斜体 (*)" onClick={() => wrapSelection('*', '*', '斜体')}>
        <span className="italic">I</span>
      </ToolbarButton>
      <ToolbarButton title="删除线 (~~)" onClick={() => wrapSelection('~~', '~~', '删除线')}>
        <span className="line-through text-xs">S</span>
      </ToolbarButton>
      <ToolbarButton title="行内代码 (`)" onClick={() => wrapSelection('`', '`', 'code')}>
        <span className="font-mono text-xs">{'<>'}</span>
      </ToolbarButton>

      <div className="w-px h-5 bg-ink/10 mx-1" />

      {/* 列表 */}
      <ToolbarButton title="无序列表 (-)" onClick={() => insertLinePrefix('- ')}>
        <span className="text-base leading-none">•</span>
      </ToolbarButton>
      <ToolbarButton title="有序列表 (1.)" onClick={() => insertLinePrefix('1. ')}>
        <span className="text-xs">1.</span>
      </ToolbarButton>
      <ToolbarButton title="引用 (>)" onClick={() => insertLinePrefix('> ')}>
        <span className="text-base leading-none">❝</span>
      </ToolbarButton>

      <div className="w-px h-5 bg-ink/10 mx-1" />

      {/* 链接 / 代码块 / 表格 */}
      <ToolbarButton title="代码块 (```)" onClick={insertCodeBlock}>
        <span className="text-xs font-mono">{'</>'}</span>
      </ToolbarButton>
      <ToolbarButton title="链接 [text](url)" onClick={insertLink}>
        <span className="text-base leading-none">🔗</span>
      </ToolbarButton>
      <ToolbarButton title="插入表格" onClick={insertTable}>
        <span className="text-sm">⊞</span>
      </ToolbarButton>
    </div>
  )
}

function ToolbarButton({
  children,
  onClick,
  title,
}: {
  children: React.ReactNode
  onClick: () => void
  title: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className="w-7 h-7 text-ink-soft hover:bg-bg-soft hover:text-ink rounded flex items-center justify-center transition"
    >
      {children}
    </button>
  )
}

// ============ 添加新说明表单 (NoteEditor 的薄 wrapper, 提交后跳回详情) ============
function AddNoteForm({
  onSubmit,
}: {
  onSubmit: (content: string) => Promise<void>
}) {
  const [submitting, setSubmitting] = useState(false)
  return (
    <div className="p-5 bg-bg-soft/40 border border-ink/10 rounded-2xl">
      <NoteEditor
        initialContent=""
        submitting={submitting}
        label="// 添加新说明 (提交后自动跳回详情)"
        submitLabel="📤 提交说明"
        showCancel={false}
        onSave={async (content) => {
          setSubmitting(true)
          try {
            await onSubmit(content)
          } catch (err: any) {
            alert('提交失败: ' + (err.message || err))
            setSubmitting(false)
          }
        }}
        onCancel={() => {}}
      />
    </div>
  )
}
