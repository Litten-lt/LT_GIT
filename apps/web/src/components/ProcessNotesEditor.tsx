import { useEffect, useRef, useState } from 'react'
import {
  addContentNote, deleteContentNote, deleteContentNoteDraft, getContent, getContentNoteDraft,
  saveContentNoteDraft, updateContentNote, type UnifiedNote,
} from '../api'
import MarkdownToolbar from './MarkdownToolbar'
import ProcessMarkdown from './ProcessMarkdown'

type ProcessNote = UnifiedNote

function formatTimestamp(value: number) {
  const milliseconds = value < 1_000_000_000_000 ? value * 1000 : value
  return new Date(milliseconds).toLocaleDateString('zh-CN')
}
export default function ProcessNotesEditor({ parentId, initialNotes }: {
  parentId: number
  initialNotes: ProcessNote[]
}) {
  const temporaryKey = `longteng:process-note-temporary:${parentId}`
  const [notes, setNotes] = useState<ProcessNote[]>(initialNotes)
  const [content, setContent] = useState('')
  const [serverDraft, setServerDraft] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [editingId, setEditingId] = useState(0)
  const [saving, setSaving] = useState(false)
  const [draftLoaded, setDraftLoaded] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const newNoteBuffer = useRef('')

  useEffect(() => setNotes(initialNotes), [initialNotes])
  useEffect(() => {
    let cancelled = false
    setDraftLoaded(false)
    getContentNoteDraft(parentId).then(({ draft }) => {
      if (cancelled) return
      const saved = draft?.body || ''
      const temporary = localStorage.getItem(temporaryKey) || localStorage.getItem(`longteng:process-note-draft:${parentId}`) || ''
      let next = saved
      if (temporary && temporary !== saved) {
        if (confirm('发现一份未保存的临时过程说明，是否恢复？')) next = temporary
        else localStorage.removeItem(temporaryKey)
      }
      localStorage.removeItem(`longteng:process-note-draft:${parentId}`)
      setServerDraft(saved)
      setContent(next)
      newNoteBuffer.current = next
      setDraftLoaded(true)
    }).catch((reason) => alert(reason.message || '读取过程说明草稿失败'))
    return () => { cancelled = true }
  }, [parentId, temporaryKey])

  useEffect(() => {
    if (!draftLoaded || editingId) return
    newNoteBuffer.current = content
    const timer = window.setTimeout(() => {
      if (content && content !== serverDraft) localStorage.setItem(temporaryKey, content)
      else localStorage.removeItem(temporaryKey)
    }, 350)
    return () => window.clearTimeout(timer)
  }, [content, draftLoaded, editingId, serverDraft, temporaryKey])

  async function reload() {
    setNotes((await getContent(parentId)).content.notes || [])
  }

  function beginEdit(note: ProcessNote) {
    newNoteBuffer.current = content
    setEditingId(note.id)
    setContent(note.body || '')
    setFiles([])
    document.querySelector('.process-note-compose')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  function cancelEdit() {
    setEditingId(0)
    setContent(newNoteBuffer.current || serverDraft)
  }

  async function saveDraft() {
    if (!content.trim()) return alert('请先填写需要保存的草稿内容')
    setSaving(true)
    try {
      const { draft } = await saveContentNoteDraft(parentId, content.trim())
      setServerDraft(draft.body)
      setContent(draft.body)
      newNoteBuffer.current = draft.body
      localStorage.removeItem(temporaryKey)
    } catch (reason: any) {
      alert(reason.message || '保存草稿失败')
    } finally {
      setSaving(false)
    }
  }

  async function removeDraft() {
    if (!confirm('删除这份过程说明草稿？当前输入也会一起清空。')) return
    setSaving(true)
    try {
      await deleteContentNoteDraft(parentId)
      setServerDraft('')
      setContent('')
      setFiles([])
      newNoteBuffer.current = ''
      localStorage.removeItem(temporaryKey)
    } catch (reason: any) {
      alert(reason.message || '删除草稿失败')
    } finally {
      setSaving(false)
    }
  }

  async function publish() {
    if (!content.trim() && files.length === 0) return alert('请填写说明内容或选择图片')
    setSaving(true)
    try {
      if (editingId) await updateContentNote(parentId, editingId, content.trim())
      else await addContentNote(parentId, content.trim(), files)
      await reload()
      if (editingId) {
        setEditingId(0)
        setContent(newNoteBuffer.current || serverDraft)
      } else {
        setServerDraft('')
        setContent('')
        setFiles([])
        newNoteBuffer.current = ''
        localStorage.removeItem(temporaryKey)
      }
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
      if (editingId === note.id) cancelEdit()
    } catch (reason: any) {
      alert(reason.message || '说明删除失败')
    }
  }

  const draftChanged = !editingId && content.trim() !== serverDraft
  const statusText = !draftLoaded ? '正在读取草稿…' : editingId ? '正在修改已发布说明' : draftChanged ? '有未保存的临时修改' : serverDraft ? '草稿已保存至服务器' : '尚未保存草稿'

  return <section className="process-notes-editor">
    <header><div><span>/ PROCESS NOTES</span><h2>过程说明</h2></div><strong>{notes.length} 条记录</strong></header>
    <div className="process-note-compose">
      <div className="process-note-compose-head"><strong>{editingId ? `编辑说明 #${editingId}` : serverDraft ? '继续编辑草稿' : '添加一条说明'}</strong><span>{statusText}</span></div>
      <div className="process-note-writing">
        <div className="process-note-input">
          <MarkdownToolbar textareaRef={textareaRef} value={content} onChange={setContent} />
          <textarea ref={textareaRef} value={content} onChange={(event) => setContent(event.target.value)} placeholder="记录现象、排查过程、关键代码或最终结论…" />
        </div>
        <aside className="process-note-preview">
          <span>/ LIVE PREVIEW</span>
          <ProcessMarkdown>{content || '过程说明会实时显示在这里。'}</ProcessMarkdown>
        </aside>
      </div>
      {!editingId && <label className="process-note-upload"><input type="file" accept="image/*" multiple onChange={(event) => setFiles(Array.from(event.target.files || []))} /><span>添加图片</span><small>{files.length ? `已选择 ${files.length} 张（图片在发布时上传）` : '最多 5 张'}</small></label>}
      <div className="process-note-actions">
        {editingId ? <button onClick={cancelEdit}>取消编辑</button> : <>{serverDraft && <button disabled={saving} className="danger" onClick={removeDraft}>删除草稿</button>}<button disabled={saving || !draftChanged || !content.trim()} onClick={saveDraft}>保存草稿</button></>}
        <button disabled={saving} className="primary" onClick={publish}>{saving ? '处理中…' : editingId ? '保存修改' : '发布说明'}</button>
      </div>
    </div>
    <div className="process-note-list">
      {notes.length === 0 ? <p className="process-note-empty">还没有过程说明，从上方添加第一条。</p> : notes.map((note, index) => <article key={note.id}>
        <div className="process-note-meta"><span>{String(index + 1).padStart(2, '0')}</span><time>{formatTimestamp(note.created_at)}</time><div><button onClick={() => beginEdit(note)}>编辑</button><button className="danger" onClick={() => remove(note)}>删除</button></div></div>
        {note.body && <ProcessMarkdown>{note.body}</ProcessMarkdown>}
        {note.images?.length > 0 && <div className="process-note-images">{note.images.map((src) => <img key={src} src={src} alt="" />)}</div>}
      </article>)}
    </div>
  </section>
}
