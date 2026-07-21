import { useEffect, useMemo, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import App from '../App'
import ProcessNotesEditor from '../components/ProcessNotesEditor'
import { createContent, filenameFromUrl, getContent, listContents, listTaxonomy, updateContent, uploadImage, type Channel, type UnifiedNote } from '../api'
import { ensureLoggedIn, isAdmin } from '../auth'

type Draft = { channel_id: 'journal' | 'life'; category_id: number | null; title: string; subtitle: string; body: string; status: 'draft' | 'published'; featured: number; pinned: number }
type ImageItem = { key: string; url?: string; file?: File; preview: string }
const emptyDraft: Draft = { channel_id: 'journal', category_id: null, title: '', subtitle: '', body: '', status: 'draft', featured: 0, pinned: 0 }
const directions = [
  { id: 'journal' as const, label: '工作与学习', hint: '技术记录、项目复盘与知识沉淀' },
  { id: 'life' as const, label: '生活分享', hint: '生活文章，可选配图片' },
]

export default function UnifiedComposer() {
  const params = useMemo(() => new URLSearchParams(window.location.search), [])
  const requestedId = Number(params.get('id')) || 0
  const legacyType = params.get('type')
  const legacyId = Number(params.get('legacyId') || params.get('id')) || 0
  const [contentId, setContentId] = useState(requestedId)
  const [editing, setEditing] = useState(Boolean(requestedId))
  const [draft, setDraft] = useState<Draft>(emptyDraft)
  const [images, setImages] = useState<ImageItem[]>([])
  const [notes, setNotes] = useState<UnifiedNote[]>([])
  const [channels, setChannels] = useState<Channel[]>([])
  const [loading, setLoading] = useState(true)
  const [savedAt, setSavedAt] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [mode, setMode] = useState<'edit' | 'preview'>('edit')
  const storageKey = editing ? `chesshub:content-edit:${contentId}` : 'chesshub:composer-unified:v1'

  useEffect(() => {
    if (!ensureLoggedIn()) return
    if (!isAdmin()) { window.location.replace('/'); return }
    ;(async () => {
      try {
        const taxonomy = await listTaxonomy(); setChannels(taxonomy.channels)
        let id = requestedId
        if (legacyType && legacyId) {
          const match = (await listContents()).contents.find((item) => item.legacy_type === legacyType && item.legacy_id === legacyId)
          if (!match) throw new Error('旧内容尚未迁移')
          id = match.id; setContentId(id); setEditing(true)
        }
        if (id) {
          const item = (await getContent(id)).content
          setDraft({ channel_id: item.channel_id, category_id: item.category_id, title: item.title, subtitle: item.subtitle || '', body: item.body, status: item.status, featured: item.featured, pinned: item.pinned })
          setImages(item.images.map((url) => ({ key: url, url, preview: url }))); setNotes(item.notes || [])
        } else {
          const saved = localStorage.getItem('chesshub:composer-unified:v1')
          const restored = saved ? { ...emptyDraft, ...JSON.parse(saved) } : emptyDraft
          const first = taxonomy.channels.find((channel) => channel.id === restored.channel_id)?.categories[0]?.id ?? null
          setDraft({ ...restored, category_id: restored.category_id ?? first })
        }
      } catch (reason: any) { alert(reason.message || '加载失败'); window.location.href = '/admin.html' }
      finally { setLoading(false) }
    })()
  }, [])

  useEffect(() => { if (loading || editing) return; const timer = window.setTimeout(() => { localStorage.setItem(storageKey, JSON.stringify(draft)); setSavedAt(new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })) }, 500); return () => clearTimeout(timer) }, [draft, loading, editing, storageKey])

  const direction = directions.find((item) => item.id === draft.channel_id)!
  const categories = channels.find((channel) => channel.id === draft.channel_id)?.categories || []
  function update<K extends keyof Draft>(key: K, value: Draft[K]) { setDraft((current) => ({ ...current, [key]: value })) }
  function changeDirection(channel_id: 'journal' | 'life') { setDraft((current) => ({ ...current, channel_id, category_id: channels.find((channel) => channel.id === channel_id)?.categories[0]?.id ?? null, subtitle: '' })); setImages([]) }
  function pickFiles(files: File[]) { setImages((current) => [...current, ...files.map((file, index) => ({ key: `new-${Date.now()}-${index}`, file, preview: URL.createObjectURL(file) }))]) }
  function removeImage(index: number) { setImages((current) => current.filter((_, i) => i !== index)) }
  function moveImage(index: number, delta: number) { setImages((current) => { const target = index + delta; if (target < 0 || target >= current.length) return current; const next = [...current]; [next[index], next[target]] = [next[target], next[index]]; return next }) }

  async function save(status: 'draft' | 'published') {
    if (!draft.title.trim() || !draft.body.trim()) return alert('请填写标题和正文')
    setSubmitting(true)
    try {
      const filenames: string[] = []
      for (const image of images) filenames.push(image.file ? (await uploadImage(image.file)).filename : filenameFromUrl(image.url || ''))
      const payload = { ...draft, title: draft.title.trim(), subtitle: draft.subtitle.trim(), body: draft.body.trim(), images: filenames, format: draft.channel_id === 'journal' ? 'article' as const : 'gallery' as const, status, featured: status === 'published' ? draft.featured : 0, pinned: status === 'published' ? draft.pinned : 0 }
      let id = contentId
      if (editing) await updateContent(id, payload)
      else { id = (await createContent(payload)).id; setContentId(id); setEditing(true) }
      localStorage.removeItem('chesshub:composer-unified:v1')
      window.location.href = draft.channel_id === 'journal' ? `/compose.html?id=${id}&saved=1` : `/admin.html?saved=${id}`
    } catch (reason: any) { alert(reason.message || '保存失败') } finally { setSubmitting(false) }
  }

  if (loading) return <App current="admin"><div className="content-empty">正在加载创作台…</div></App>
  return <App current="admin"><div className="composer-shell">
    <header className="composer-heading"><div><p>{editing ? '/ EDIT CONTENT' : '/ NEW CONTENT'}</p><h1>{editing ? '编辑内容' : '统一创作台'}<span>。</span></h1></div><div className="composer-save-state"><span className="save-dot" />{editing ? '统一内容模型' : savedAt ? `${savedAt} 已自动保存` : '等待输入'}</div></header>
    <div className="composer-layout"><aside className="composer-types"><p>发布方向</p>{directions.map((item) => <button key={item.id} disabled={editing} onClick={() => changeDirection(item.id)} className={draft.channel_id === item.id ? 'active' : ''}><strong>{item.label}</strong><span>{item.hint}</span></button>)}</aside>
      <main className="composer-editor"><div className="composer-topbar"><div><span>{direction.label}</span><small>{editing ? `统一内容 #${contentId}` : direction.hint}</small></div><div className="composer-tabs"><button className={mode === 'edit' ? 'active' : ''} onClick={() => setMode('edit')}>编辑</button><button className={mode === 'preview' ? 'active' : ''} onClick={() => setMode('preview')}>预览</button></div></div>
        <div className={`composer-pane ${mode === 'preview' ? 'show-preview' : ''}`}><section className="composer-fields">
          <label><span>发布分类</span><select value={draft.category_id ?? ''} onChange={(event) => update('category_id', event.target.value ? Number(event.target.value) : null)}><option value="">其他（未分类）</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
          <label><span>标题 *</span><input value={draft.title} onChange={(event) => update('title', event.target.value)} /></label>
          {draft.channel_id === 'life' && <label><span>补充说明</span><input value={draft.subtitle} onChange={(event) => update('subtitle', event.target.value)} /></label>}
          <label className="body-field"><span>正文 * <em>支持 Markdown</em></span><textarea value={draft.body} onChange={(event) => update('body', event.target.value)} /></label>
          {draft.channel_id === 'life' && <><label className="composer-upload"><input type="file" accept="image/*" multiple onChange={(event) => pickFiles(Array.from(event.target.files || []))} /><strong>{images.length ? '继续添加图片' : '添加图片（可选）'}</strong><span>已选 {images.length} 张 · 可调整顺序</span></label>{images.length > 0 && <div className="composer-images">{images.map((image, index) => <div key={image.key}><img src={image.preview} alt="" /><button className="image-remove" onClick={() => removeImage(index)}>×</button><div className="image-order"><button disabled={index === 0} onClick={() => moveImage(index, -1)}>←</button><button disabled={index === images.length - 1} onClick={() => moveImage(index, 1)}>→</button></div><span>{index === 0 ? '封面 · ' : ''}{image.file?.name || filenameFromUrl(image.url || '')}</span></div>)}</div>}</>}
          <div className="composer-state"><span>发布设置</span><label><input type="checkbox" checked={Boolean(draft.featured)} onChange={(event) => update('featured', Number(event.target.checked))} />主页精选</label><label><input type="checkbox" checked={Boolean(draft.pinned)} onChange={(event) => update('pinned', Number(event.target.checked))} />栏目置顶</label></div>
        </section><section className="composer-preview"><p>/ LIVE PREVIEW</p><h1>{draft.title || '尚未填写标题'}</h1>{draft.subtitle && <div className="preview-meta">{draft.subtitle}</div>}<div className="md"><ReactMarkdown remarkPlugins={[remarkGfm]}>{draft.body || '正文内容会实时显示在这里。'}</ReactMarkdown></div>{images.length > 0 && <div className="preview-images">{images.map((image) => <img key={image.key} src={image.preview} alt="" />)}</div>}</section></div>
        {editing && draft.channel_id === 'journal' && <ProcessNotesEditor parentId={contentId} initialNotes={notes} />}
        {!editing && draft.channel_id === 'journal' && <div className="process-note-hint"><strong>过程说明将在保存后添加</strong><span>先建立正文，随后会自动进入说明编辑。</span></div>}
        <footer className="composer-actions"><a href="/admin.html">取消</a><button disabled={submitting} onClick={() => save('draft')}>保存草稿</button><button disabled={submitting} onClick={() => save('published')} className="publish">{submitting ? '处理中…' : '保存并发布'}</button></footer>
      </main></div>
  </div></App>
}
