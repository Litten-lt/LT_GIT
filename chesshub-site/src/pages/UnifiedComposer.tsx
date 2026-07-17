import { useEffect, useMemo, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import App from '../App'
import { createFigure, createNote, createStudy, createTravel, createWork, updateContentState, uploadImage, type ContentType } from '../api'
import { ensureLoggedIn, isAdmin } from '../auth'

const DRAFT_KEY = 'chesshub:composer-draft:v1'
const types: { value: ContentType; label: string; hint: string; image: boolean }[] = [
  { value: 'work', label: '工作记录', hint: '调试问题、过程与工程结论', image: false },
  { value: 'study', label: '学习笔记', hint: '原理、方法和知识沉淀', image: false },
  { value: 'figure', label: '模型手办', hint: '收藏档案、照片与心得', image: true },
  { value: 'travel', label: '旅行记录', hint: '地点、见闻与途中影像', image: true },
  { value: 'note', label: '生活随笔', hint: '日常片段、想法和随手拍', image: true },
]

type Draft = { type: ContentType; title: string; subtitle: string; body: string }
const emptyDraft: Draft = { type: 'work', title: '', subtitle: '', body: '' }

export default function UnifiedComposer() {
  const [draft, setDraft] = useState<Draft>(emptyDraft)
  const [files, setFiles] = useState<File[]>([])
  const [savedAt, setSavedAt] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [mode, setMode] = useState<'edit' | 'preview'>('edit')

  useEffect(() => {
    if (!ensureLoggedIn()) return
    if (!isAdmin()) { window.location.replace('/'); return }
    try { const saved = localStorage.getItem(DRAFT_KEY); if (saved) setDraft({ ...emptyDraft, ...JSON.parse(saved) }) } catch {}
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (draft.title || draft.subtitle || draft.body) localStorage.setItem(DRAFT_KEY, JSON.stringify(draft))
      else localStorage.removeItem(DRAFT_KEY)
      setSavedAt(new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }))
    }, 500)
    return () => window.clearTimeout(timer)
  }, [draft])

  const config = useMemo(() => types.find((item) => item.value === draft.type)!, [draft.type])
  const previews = useMemo(() => files.map((file) => ({ file, url: URL.createObjectURL(file) })), [files])
  useEffect(() => () => previews.forEach((item) => URL.revokeObjectURL(item.url)), [previews])

  function update<K extends keyof Draft>(key: K, value: Draft[K]) { setDraft((current) => ({ ...current, [key]: value })) }
  function clearDraft() { if (!confirm('清空当前草稿？')) return; setDraft(emptyDraft); setFiles([]); localStorage.removeItem(DRAFT_KEY) }

  async function submit(status: 'draft' | 'published') {
    if (!draft.title.trim()) return alert('请填写标题')
    if (!draft.body.trim()) return alert('请填写正文')
    if (config.image && files.length === 0) return alert('这类内容至少需要一张图片')
    setSubmitting(true)
    try {
      const filenames: string[] = []
      for (const file of files) filenames.push((await uploadImage(file)).filename)
      let id: number
      if (draft.type === 'work') id = (await createWork({ title: draft.title.trim(), description: draft.body.trim() })).id
      else if (draft.type === 'study') id = (await createStudy({ title: draft.title.trim(), description: draft.body.trim() })).id
      else if (draft.type === 'figure') id = (await createFigure({ name: draft.title.trim(), brand: draft.subtitle.trim() || undefined, description: draft.body.trim(), images: filenames })).id
      else if (draft.type === 'travel') id = (await createTravel({ title: draft.title.trim(), location: draft.subtitle.trim() || undefined, description: draft.body.trim(), images: filenames })).id
      else id = (await createNote({ title: draft.title.trim(), scene: draft.subtitle.trim() || undefined, description: draft.body.trim(), images: filenames })).id
      if (status === 'draft') await updateContentState(draft.type, id, { status: 'draft' })
      localStorage.removeItem(DRAFT_KEY)
      window.location.href = `/admin.html?created=${draft.type}-${id}`
    } catch (reason: any) { alert(reason.message || '保存失败') }
    finally { setSubmitting(false) }
  }

  return <App current="admin"><div className="composer-shell">
    <header className="composer-heading"><div><p>/ NEW CONTENT</p><h1>统一创作台<span>。</span></h1></div><div className="composer-save-state"><span className="save-dot" />{savedAt ? `${savedAt} 已自动保存` : '等待输入'}</div></header>
    <div className="composer-layout">
      <aside className="composer-types"><p>选择内容类型</p>{types.map((item) => <button key={item.value} onClick={() => update('type', item.value)} className={draft.type === item.value ? 'active' : ''}><strong>{item.label}</strong><span>{item.hint}</span></button>)}</aside>
      <main className="composer-editor">
        <div className="composer-topbar"><div><span>{config.label}</span><small>{config.hint}</small></div><div className="composer-tabs"><button className={mode === 'edit' ? 'active' : ''} onClick={() => setMode('edit')}>编辑</button><button className={mode === 'preview' ? 'active' : ''} onClick={() => setMode('preview')}>预览</button></div></div>
        <div className={`composer-pane ${mode === 'preview' ? 'show-preview' : ''}`}>
          <section className="composer-fields">
            <label><span>标题 *</span><input value={draft.title} onChange={(event) => update('title', event.target.value)} placeholder="给这篇内容一个清晰的标题" autoFocus /></label>
            {config.image && <label><span>{draft.type === 'figure' ? '品牌 / 系列' : draft.type === 'travel' ? '地点' : '场景'}</span><input value={draft.subtitle} onChange={(event) => update('subtitle', event.target.value)} placeholder="可选" /></label>}
            <label className="body-field"><span>正文 * <em>支持 Markdown</em></span><textarea value={draft.body} onChange={(event) => update('body', event.target.value)} placeholder={'从这里开始写…\n\n支持标题、列表、引用、表格和代码块。'} /></label>
            {config.image && <label className="composer-upload"><input type="file" accept="image/*" multiple onChange={(event) => setFiles(Array.from(event.target.files || []))} /><strong>选择图片</strong><span>可多选，单张不超过 5MB · 已选 {files.length} 张</span></label>}
            {previews.length > 0 && <div className="composer-images">{previews.map(({ file, url }, index) => <div key={url}><img src={url} alt="" /><button onClick={() => setFiles((current) => current.filter((_, i) => i !== index))}>×</button><span>{file.name}</span></div>)}</div>}
          </section>
          <section className="composer-preview"><p>/ LIVE PREVIEW</p><h1>{draft.title || '尚未填写标题'}</h1>{draft.subtitle && <div className="preview-meta">{draft.subtitle}</div>}<div className="md"><ReactMarkdown remarkPlugins={[remarkGfm]}>{draft.body || '正文内容会实时显示在这里。'}</ReactMarkdown></div>{previews.length > 0 && <div className="preview-images">{previews.map(({ url }) => <img key={url} src={url} alt="" />)}</div>}</section>
        </div>
        <footer className="composer-actions"><button onClick={clearDraft} className="quiet">清空</button><a href="/admin.html">取消</a><button disabled={submitting} onClick={() => submit('draft')}>保存为草稿</button><button disabled={submitting} onClick={() => submit('published')} className="publish">{submitting ? '处理中…' : '直接发布'}</button></footer>
      </main>
    </div>
  </div></App>
}

