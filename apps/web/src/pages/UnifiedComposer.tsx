import { useEffect, useMemo, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import App from '../App'
import ProcessNotesEditor from '../components/ProcessNotesEditor'
import {
  createFigure, createNote, createStudy, createTravel, createWork, filenameFromUrl,
  getStudy, getWork, listAdminContent, listFigures, listNotes, listTaxonomy, listTravels, updateContentState,
  updateFigure, updateNote, updateStudy, updateTravel, updateWork, uploadImage,
  type Channel, type ContentType, type StudyNote, type WorkNote,
} from '../api'
import { ensureLoggedIn, isAdmin } from '../auth'

const types: { value: ContentType; label: string; hint: string; image: boolean }[] = [
  { value: 'work', label: '工作记录', hint: '调试问题、过程与工程结论', image: false },
  { value: 'study', label: '学习笔记', hint: '原理、方法和知识沉淀', image: false },
  { value: 'figure', label: '模型手办', hint: '收藏档案、照片与心得', image: true },
  { value: 'travel', label: '旅行记录', hint: '地点、见闻与途中影像', image: true },
  { value: 'note', label: '生活随笔', hint: '日常片段、想法和随手拍', image: true },
]
type Draft = { type: ContentType; category_id: number | null; title: string; subtitle: string; body: string; status: 'draft' | 'published'; featured: number; pinned: number }
type ImageItem = { key: string; url?: string; file?: File; preview: string }
const emptyDraft: Draft = { type: 'work', category_id: null, title: '', subtitle: '', body: '', status: 'draft', featured: 0, pinned: 0 }

export default function UnifiedComposer() {
  const params = useMemo(() => new URLSearchParams(window.location.search), [])
  const editType = params.get('type') as ContentType | null
  const editId = Number(params.get('id')) || 0
  const editing = Boolean(editType && types.some((item) => item.value === editType) && editId)
  const storageKey = editing ? `chesshub:composer-edit:${editType}:${editId}` : 'chesshub:composer-draft:v2'
  const [draft, setDraft] = useState<Draft>(editing && editType ? { ...emptyDraft, type: editType } : emptyDraft)
  const [images, setImages] = useState<ImageItem[]>([])
  const [loading, setLoading] = useState(true)
  const [savedAt, setSavedAt] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [mode, setMode] = useState<'edit' | 'preview'>('edit')
  const [processNotes, setProcessNotes] = useState<(WorkNote | StudyNote)[]>([])
  const [channels, setChannels] = useState<Channel[]>([])

  useEffect(() => {
    if (!ensureLoggedIn()) return
    if (!isAdmin()) { window.location.replace('/'); return }
    ;(async () => {
      try {
        const taxonomy = await listTaxonomy()
        setChannels(taxonomy.channels)
        if (editing && editType) {
          const meta = (await listAdminContent()).items.find((item) => item.type === editType && item.id === editId)
          if (!meta) throw new Error('内容不存在')
          const base = { type: editType, category_id: meta.category_id ?? null, status: meta.status, featured: meta.featured, pinned: meta.pinned }
          if (editType === 'work') { const { work } = await getWork(editId); setDraft({ ...base, title: work.title, subtitle: '', body: work.description || '' }); setProcessNotes(work.notes || []) }
          else if (editType === 'study') { const { study } = await getStudy(editId); setDraft({ ...base, title: study.title, subtitle: '', body: study.description || '' }); setProcessNotes(study.notes || []) }
          else if (editType === 'figure') { const item = (await listFigures()).figures.find((entry) => entry.id === editId); if (!item) throw new Error('内容不存在'); setDraft({ ...base, title: item.name, subtitle: item.brand || '', body: item.description }); setImages(item.images.map((url) => ({ key: url, url, preview: url }))) }
          else if (editType === 'travel') { const item = (await listTravels()).travels.find((entry) => entry.id === editId); if (!item) throw new Error('内容不存在'); setDraft({ ...base, title: item.title, subtitle: item.location || '', body: item.description }); setImages(item.images.map((url) => ({ key: url, url, preview: url }))) }
          else { const item = (await listNotes()).notes.find((entry) => entry.id === editId); if (!item) throw new Error('内容不存在'); setDraft({ ...base, title: item.title, subtitle: item.scene || '', body: item.description }); setImages(item.images.map((url) => ({ key: url, url, preview: url }))) }
        } else {
          const saved = localStorage.getItem(storageKey)
          const restored = saved ? { ...emptyDraft, ...JSON.parse(saved) } : emptyDraft
          const defaultCategory = taxonomy.channels.flatMap((channel) => channel.categories).find((item) => item.legacy_type === restored.type)?.id ?? null
          setDraft({ ...restored, category_id: restored.category_id ?? defaultCategory })
        }
      } catch (reason: any) { alert(reason.message || '加载失败'); window.location.href = '/admin.html' }
      finally { setLoading(false) }
    })()
  }, [])

  useEffect(() => {
    if (loading) return
    const timer = window.setTimeout(() => {
      if (draft.title || draft.subtitle || draft.body) localStorage.setItem(storageKey, JSON.stringify(draft))
      else localStorage.removeItem(storageKey)
      setSavedAt(new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }))
    }, 500)
    return () => window.clearTimeout(timer)
  }, [draft, loading, storageKey])

  const config = useMemo(() => types.find((item) => item.value === draft.type)!, [draft.type])
  const channelId = draft.type === 'work' || draft.type === 'study' ? 'journal' : 'life'
  const categories = channels.find((channel) => channel.id === channelId)?.categories || []
  function update<K extends keyof Draft>(key: K, value: Draft[K]) { setDraft((current) => ({ ...current, [key]: value })) }
  function updateType(type: ContentType) { const categoryId = channels.flatMap((channel) => channel.categories).find((item) => item.legacy_type === type)?.id ?? null; setDraft((current) => ({ ...current, type, category_id: categoryId })) }
  function pickFiles(files: File[]) { setImages((current) => [...current, ...files.map((file, index) => ({ key: `new-${Date.now()}-${index}`, file, preview: URL.createObjectURL(file) }))]) }
  function removeImage(index: number) { setImages((current) => current.filter((_, i) => i !== index)) }
  function moveImage(index: number, delta: number) { setImages((current) => { const target = index + delta; if (target < 0 || target >= current.length) return current; const next = [...current]; [next[index], next[target]] = [next[target], next[index]]; return next }) }
  function clearDraft() { if (!confirm('清空当前内容？')) return; setDraft({ ...emptyDraft, type: draft.type }); setImages([]); localStorage.removeItem(storageKey) }

  async function save(requestedStatus: 'draft' | 'published') {
    if (!draft.title.trim()) return alert('请填写标题')
    if (!draft.body.trim()) return alert('请填写正文')
    if (config.image && images.length === 0) return alert('这类内容至少需要一张图片')
    setSubmitting(true)
    try {
      const filenames: string[] = []
      for (const image of images) filenames.push(image.file ? (await uploadImage(image.file)).filename : filenameFromUrl(image.url || ''))
      let id = editId
      if (editing) {
        if (draft.type === 'work') await updateWork(id, { title: draft.title.trim(), description: draft.body.trim() })
        else if (draft.type === 'study') await updateStudy(id, { title: draft.title.trim(), description: draft.body.trim() })
        else if (draft.type === 'figure') await updateFigure(id, { name: draft.title.trim(), brand: editing ? draft.subtitle.trim() : draft.subtitle.trim() || undefined, description: draft.body.trim(), images: filenames })
        else if (draft.type === 'travel') await updateTravel(id, { title: draft.title.trim(), location: editing ? draft.subtitle.trim() : draft.subtitle.trim() || undefined, description: draft.body.trim(), images: filenames })
        else await updateNote(id, { title: draft.title.trim(), scene: editing ? draft.subtitle.trim() : draft.subtitle.trim() || undefined, description: draft.body.trim(), images: filenames })
      } else {
        if (draft.type === 'work') id = (await createWork({ title: draft.title.trim(), description: draft.body.trim() })).id
        else if (draft.type === 'study') id = (await createStudy({ title: draft.title.trim(), description: draft.body.trim() })).id
        else if (draft.type === 'figure') id = (await createFigure({ name: draft.title.trim(), brand: editing ? draft.subtitle.trim() : draft.subtitle.trim() || undefined, description: draft.body.trim(), images: filenames })).id
        else if (draft.type === 'travel') id = (await createTravel({ title: draft.title.trim(), location: editing ? draft.subtitle.trim() : draft.subtitle.trim() || undefined, description: draft.body.trim(), images: filenames })).id
        else id = (await createNote({ title: draft.title.trim(), scene: editing ? draft.subtitle.trim() : draft.subtitle.trim() || undefined, description: draft.body.trim(), images: filenames })).id
      }
      await updateContentState(draft.type, id, { status: requestedStatus, featured: requestedStatus === 'published' ? draft.featured : 0, pinned: requestedStatus === 'published' ? draft.pinned : 0, category_id: draft.category_id })
      localStorage.removeItem(storageKey)
      window.location.href = !editing && (draft.type === 'work' || draft.type === 'study')
        ? `/compose.html?type=${draft.type}&id=${id}&saved=1`
        : `/admin.html?saved=${draft.type}-${id}`
    } catch (reason: any) { alert(reason.message || '保存失败') }
    finally { setSubmitting(false) }
  }

  if (loading) return <App current="admin"><div className="content-empty">正在加载创作台…</div></App>
  return <App current="admin"><div className="composer-shell">
    <header className="composer-heading"><div><p>{editing ? '/ EDIT CONTENT' : '/ NEW CONTENT'}</p><h1>{editing ? '编辑内容' : '统一创作台'}<span>。</span></h1></div><div className="composer-save-state"><span className="save-dot" />{savedAt ? `${savedAt} 已自动保存` : '等待输入'}</div></header>
    <div className="composer-layout">
      <aside className="composer-types"><p>{editing ? '内容格式' : '选择内容格式'}</p>{types.map((item) => <button key={item.value} disabled={editing} onClick={() => updateType(item.value)} className={draft.type === item.value ? 'active' : ''}><strong>{item.label}</strong><span>{item.hint}</span></button>)}</aside>
      <main className="composer-editor">
        <div className="composer-topbar"><div><span>{config.label}</span><small>{editing ? `正在编辑 #${editId}` : config.hint}</small></div><div className="composer-tabs"><button className={mode === 'edit' ? 'active' : ''} onClick={() => setMode('edit')}>编辑</button><button className={mode === 'preview' ? 'active' : ''} onClick={() => setMode('preview')}>预览</button></div></div>
        <div className={`composer-pane ${mode === 'preview' ? 'show-preview' : ''}`}>
          <section className="composer-fields">
            <label><span>发布分类</span><select value={draft.category_id ?? ''} onChange={(event) => update('category_id', event.target.value ? Number(event.target.value) : null)}><option value="">其他（未分类）</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
            <label><span>标题 *</span><input value={draft.title} onChange={(event) => update('title', event.target.value)} /></label>
            {config.image && <label><span>{draft.type === 'figure' ? '品牌 / 系列' : draft.type === 'travel' ? '地点' : '场景'}</span><input value={draft.subtitle} onChange={(event) => update('subtitle', event.target.value)} /></label>}
            <label className="body-field"><span>正文 * <em>支持 Markdown</em></span><textarea value={draft.body} onChange={(event) => update('body', event.target.value)} /></label>
            {config.image && <><label className="composer-upload"><input type="file" accept="image/*" multiple onChange={(event) => pickFiles(Array.from(event.target.files || []))} /><strong>继续添加图片</strong><span>已选 {images.length} 张 · 可调整顺序</span></label>{images.length > 0 && <div className="composer-images">{images.map((image, index) => <div key={image.key}><img src={image.preview} alt="" /><button className="image-remove" onClick={() => removeImage(index)}>×</button><div className="image-order"><button disabled={index === 0} onClick={() => moveImage(index, -1)}>←</button><button disabled={index === images.length - 1} onClick={() => moveImage(index, 1)}>→</button></div><span>{index === 0 ? '封面 · ' : ''}{image.file?.name || filenameFromUrl(image.url || '')}</span></div>)}</div>}</>}
            <div className="composer-state"><span>发布设置</span><label><input type="checkbox" checked={Boolean(draft.featured)} onChange={(event) => update('featured', Number(event.target.checked))} />主页精选</label><label><input type="checkbox" checked={Boolean(draft.pinned)} onChange={(event) => update('pinned', Number(event.target.checked))} />栏目置顶</label></div>
          </section>
          <section className="composer-preview"><p>/ LIVE PREVIEW</p><h1>{draft.title || '尚未填写标题'}</h1>{draft.subtitle && <div className="preview-meta">{draft.subtitle}</div>}<div className="md"><ReactMarkdown remarkPlugins={[remarkGfm]}>{draft.body || '正文内容会实时显示在这里。'}</ReactMarkdown></div>{images.length > 0 && <div className="preview-images">{images.map((image) => <img key={image.key} src={image.preview} alt="" />)}</div>}</section>
        </div>
        {editing && (draft.type === 'work' || draft.type === 'study') && <ProcessNotesEditor type={draft.type} parentId={editId} initialNotes={processNotes} />}
        {!editing && (draft.type === 'work' || draft.type === 'study') && <div className="process-note-hint"><strong>过程说明将在保存后添加</strong><span>先建立标题与摘要，随后会自动进入说明编辑。</span></div>}
        <footer className="composer-actions"><button onClick={clearDraft} className="quiet">清空</button><a href="/admin.html">取消</a><button disabled={submitting} onClick={() => save('draft')}>{!editing && (draft.type === 'work' || draft.type === 'study') ? '保存草稿并添加说明' : '保存为草稿'}</button><button disabled={submitting} onClick={() => save('published')} className="publish">{submitting ? '处理中…' : editing ? '保存并发布' : draft.type === 'work' || draft.type === 'study' ? '发布并添加说明' : '直接发布'}</button></footer>
      </main>
    </div>
  </div></App>
}

