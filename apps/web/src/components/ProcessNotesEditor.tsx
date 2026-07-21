import { useEffect, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import {
  addContentNote, deleteContentNote, getContent, updateContentNote, type UnifiedNote,
} from '../api'

type ProcessNote = UnifiedNote

function formatTimestamp(value: number) {
  const milliseconds = value < 1_000_000_000_000 ? value * 1000 : value
  return new Date(milliseconds).toLocaleDateString('zh-CN')
}

export default function ProcessNotesEditor({ parentId, initialNotes }: {
  parentId: number
  initialNotes: ProcessNote[]
}) {
  const [notes, setNotes] = useState<ProcessNote[]>(initialNotes)
  const [content, setContent] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [editingId, setEditingId] = useState(0)
  const [saving, setSaving] = useState(false)

  useEffect(() => setNotes(initialNotes), [initialNotes])

  async function reload() {
    setNotes((await getContent(parentId)).content.notes || [])
  }

  function reset() {
    setContent('')
    setFiles([])
    setEditingId(0)
  }

  function beginEdit(note: ProcessNote) {
    setEditingId(note.id)
    setContent(note.body || '')
    setFiles([])
    document.querySelector('.process-note-compose')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  async function save() {
    if (!content.trim() && files.length === 0) return alert('请填写说明内容或选择图片')
    setSaving(true)
    try {
      if (editingId) await updateContentNote(parentId, editingId, content.trim())
      else await addContentNote(parentId, content.trim(), files)
      await reload()
      reset()
    } catch (reason: any) {
      alert(reason.message || '说明保存失败')
    } finally {
      setSaving(false)
    }
  }

  async function remove(note: ProcessNote) {
    if (!confirm('确认删除这条说明？此操作不可撤销。')) return
    try {
      await deleteContentNote(parentId, note.id)
      await reload()
      if (editingId === note.id) reset()
    } catch (reason: any) {
      alert(reason.message || '说明删除失败')
    }
  }

  return <section className="process-notes-editor">
    <header><div><span>/ PROCESS NOTES</span><h2>过程说明</h2></div><strong>{notes.length} 条记录</strong></header>
    <div className="process-note-compose">
      <div className="process-note-compose-head"><strong>{editingId ? `编辑说明 #${editingId}` : '添加一条说明'}</strong><span>支持 Markdown</span></div>
      <textarea value={content} onChange={(event) => setContent(event.target.value)} placeholder="记录现象、排查过程、关键代码或最终结论…" />
      {!editingId && <label className="process-note-upload"><input type="file" accept="image/*" multiple onChange={(event) => setFiles(Array.from(event.target.files || []))} /><span>添加图片</span><small>{files.length ? `已选择 ${files.length} 张` : '最多 5 张'}</small></label>}
      <div className="process-note-actions">{editingId > 0 && <button onClick={reset}>取消编辑</button>}<button disabled={saving} className="primary" onClick={save}>{saving ? '保存中…' : editingId ? '保存修改' : '发布说明'}</button></div>
    </div>
    <div className="process-note-list">
      {notes.length === 0 ? <p className="process-note-empty">还没有过程说明，从上方添加第一条。</p> : notes.map((note, index) => <article key={note.id}>
        <div className="process-note-meta"><span>{String(index + 1).padStart(2, '0')}</span><time>{formatTimestamp(note.created_at)}</time><div><button onClick={() => beginEdit(note)}>编辑</button><button className="danger" onClick={() => remove(note)}>删除</button></div></div>
        {note.body && <div className="md"><ReactMarkdown remarkPlugins={[remarkGfm]}>{note.body}</ReactMarkdown></div>}
        {note.images?.length > 0 && <div className="process-note-images">{note.images.map((src) => <img key={src} src={src} alt="" />)}</div>}
      </article>)}
    </div>
  </section>
}
