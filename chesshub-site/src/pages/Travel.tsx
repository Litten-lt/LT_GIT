import { useEffect, useRef, useState } from 'react'
import App from '../App'
import {
  listTravels,
  createTravel,
  updateTravel,
  deleteTravel,
  uploadImage,
  type Travel,
} from '../api'
import { isAdmin, isGuest, ensureLoggedIn, clearAuth } from '../auth'

// 待发布图片: 来源可以是已上传的 URL,或本地 File
type PendingImage = {
  key: string
  url?: string
  file?: File
  preview: string
}

export default function TravelPage() {
  const [travels, setTravels] = useState<Travel[]>([])
  const [loading, setLoading] = useState(true)
  const [admin, setAdmin] = useState(false)
  const [guest, setGuest] = useState(false)

  const [formMode, setFormMode] = useState<'create' | 'edit' | null>(null)
  const [editingId, setEditingId] = useState<number | null>(null)

  const [title, setTitle] = useState('')
  const [location, setLocation] = useState('')
  const [description, setDescription] = useState('')
  const [pendingImages, setPendingImages] = useState<PendingImage[]>([])

  const [submitting, setSubmitting] = useState(false)
  const [uploadProgress, setUploadProgress] = useState({ done: 0, total: 0, currentName: '' })

  const fileInputRef = useRef<HTMLInputElement>(null)

  // 守卫 + 初次加载
  useEffect(() => {
    if (!ensureLoggedIn()) return
    setAdmin(isAdmin())
    setGuest(isGuest())
    loadTravels()
    if (new URLSearchParams(window.location.search).get('new') === '1' && isAdmin()) openCreate()
  }, [])

  async function loadTravels() {
    setLoading(true)
    try {
      const { travels } = await listTravels()
      setTravels(travels)
    } catch (e: any) {
      console.error('loadTravels error:', e)
      if (e.message?.includes('token')) {
        clearAuth()
        window.location.href = '/login.html'
      }
    } finally {
      setLoading(false)
    }
  }

  // ===== 表单操作 =====
  function openCreate() {
    resetForm()
    setEditingId(null)
    setFormMode('create')
  }

  function openEdit(t: Travel) {
    setTitle(t.title)
    setLocation(t.location || '')
    setDescription(t.description)
    setPendingImages(
      t.images.map((url) => ({
        key: url,
        url,
        preview: url,
      })),
    )
    setEditingId(t.id)
    setFormMode('edit')
  }

  function closeForm() {
    if (submitting) return
    if (hasUnsavedChanges() && !confirm('关闭后未保存的修改会丢失,确定?')) return
    resetForm()
    setFormMode(null)
    setEditingId(null)
  }

  function hasUnsavedChanges(): boolean {
    if (!formMode) return false
    if (title.trim() || location.trim() || description.trim()) return true
    if (formMode === 'create' && pendingImages.length > 0) return true
    return false
  }

  function resetForm() {
    setTitle('')
    setLocation('')
    setDescription('')
    setPendingImages([])
    setUploadProgress({ done: 0, total: 0, currentName: '' })
  }

  // ===== 图片管理 =====
  function openFilePicker() {
    if (submitting) return
    fileInputRef.current?.click()
  }

  function handlePickFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || [])
    if (files.length === 0) return

    const valid: File[] = []
    const skipped: string[] = []
    for (const f of files) {
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

    Promise.all(
      valid.map(
        (f) =>
          new Promise<string>((resolve) => {
            const r = new FileReader()
            r.onload = () => resolve(r.result as string)
            r.readAsDataURL(f)
          }),
      ),
    ).then((previews) => {
      const newImgs: PendingImage[] = valid.map((f, i) => ({
        key: `local-${Date.now()}-${i}-${f.name}`,
        file: f,
        preview: previews[i],
      }))
      setPendingImages((prev) => [...prev, ...newImgs])
    })

    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  function removeImage(key: string) {
    if (submitting) return
    setPendingImages((prev) => prev.filter((p) => p.key !== key))
  }

  function clearAllImages() {
    if (submitting) return
    if (!confirm('清空所有图片?')) return
    setPendingImages([])
  }

  // ===== 提交 =====
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim() || !description.trim() || pendingImages.length === 0) {
      alert('标题、描述、图片都得填哦')
      return
    }
    if (!isAdmin()) {
      alert('需要管理员权限')
      return
    }

    setSubmitting(true)

    try {
      const localFiles = pendingImages.filter((p) => p.file)
      setUploadProgress({ done: 0, total: localFiles.length, currentName: '' })

      const uploadedMap = new Map<string, string>()
      for (let i = 0; i < localFiles.length; i++) {
        const item = localFiles[i]
        setUploadProgress({
          done: i,
          total: localFiles.length,
          currentName: item.file!.name,
        })
        const res = await uploadImage(item.file!)
        uploadedMap.set(item.key, res.url.split('/').pop()!)
      }
      setUploadProgress({ done: localFiles.length, total: localFiles.length, currentName: '' })

      const finalImages: string[] = pendingImages.map((p) => {
        if (p.file) return uploadedMap.get(p.key)!
        return p.url!.split('/').pop()!
      })

      if (formMode === 'create') {
        await createTravel({
          title: title.trim(),
          location: location.trim() || undefined,
          description: description.trim(),
          images: finalImages,
          date: new Date().toISOString().slice(0, 7).replace('-', '.'),
        })
        alert(`发布成功!共 ${finalImages.length} 张照片`)
      } else if (formMode === 'edit' && editingId) {
        await updateTravel(editingId, {
          title: title.trim(),
          location: location.trim() || undefined,
          description: description.trim(),
          images: finalImages,
        })
        alert('修改已保存!')
      }

      resetForm()
      setFormMode(null)
      setEditingId(null)
      await loadTravels()
    } catch (err: any) {
      alert((formMode === 'edit' ? '保存失败: ' : '发布失败: ') + (err.message || err))
    } finally {
      setSubmitting(false)
      setUploadProgress({ done: 0, total: 0, currentName: '' })
    }
  }

  // ===== 列表操作 =====
  async function handleDelete(id: number) {
    if (!confirm('确认删除这条? (图片也会一起删)')) return
    try {
      await deleteTravel(id)
      await loadTravels()
    } catch (err: any) {
      alert('删除失败: ' + (err.message || err))
    }
  }

  return (
    <App current="travel">
      <div className="max-w-3xl mx-auto px-6 pt-12 pb-24">
        {/* 顶部介绍 */}
        <div className="text-center mb-10">
          <p className="text-xs font-mono text-accent mb-3 tracking-widest">/ TRAVEL</p>
          <h1 className="text-4xl md:text-5xl font-extrabold text-ink">
            旅行管理<span className="text-accent">.</span>
          </h1>
          <p className="mt-4 text-ink-soft max-w-xl mx-auto leading-relaxed">
            日常随便记。
            想到啥写啥,随手拍的照片都收在这。
          </p>
        </div>

        {/* 登录状态 + 操作栏 */}
        <div className="flex items-center justify-between mb-8 border-b border-ink/10 pb-4 gap-3 flex-wrap">
          <span className="text-sm text-ink-soft">
            共 <span className="text-ink font-semibold">{travels.length}</span> 条
            {loading && <span className="ml-2 text-xs text-ink-soft/60">加载中…</span>}
          </span>
          <div className="flex items-center gap-2">
            {admin && (
              <button
                onClick={() => {
                  if (formMode === 'create') closeForm()
                  else openCreate()
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-ink rounded-full hover:bg-ink/85 transition"
              >
                {formMode === 'create' ? '× 取消' : '+ 发布'}
              </button>
            )}
            {!admin && (
              <span className="text-xs font-mono text-amber-600">
                // 游客模式 · 发布功能已锁定
              </span>
            )}
          </div>
        </div>

        {/* 表单 */}
        {admin && formMode && (
          <form
            onSubmit={handleSubmit}
            className="mb-10 p-6 bg-bg-soft/60 border border-ink/10 rounded-2xl space-y-4"
          >
            <div className="text-xs font-mono text-ink-soft/70 mb-1">
              {formMode === 'create' ? '// 新发布' : `// 编辑模式 · ID #${editingId}`}
            </div>

            <div>
              <label className="block text-xs font-mono text-ink-soft mb-1.5 uppercase tracking-widest">
                标题 *
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="例:大理 · 苍山下的四天"
                disabled={submitting}
                className="w-full px-4 py-2.5 text-sm bg-white border border-ink/10 rounded-md focus:outline-none focus:border-ink/30 disabled:opacity-50"
              />
            </div>

            <div>
              <label className="block text-xs font-mono text-ink-soft mb-1.5 uppercase tracking-widest">
                地点 (可选)
              </label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="例:云南 · 大理"
                disabled={submitting}
                className="w-full px-4 py-2.5 text-sm bg-white border border-ink/10 rounded-md focus:outline-none focus:border-ink/30 disabled:opacity-50"
              />
            </div>

            <div>
              <label className="block text-xs font-mono text-ink-soft mb-1.5 uppercase tracking-widest">
                描述 / 心得 *
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={5}
                placeholder="行程、吃了什么、遇到的人、有意思的细节..."
                disabled={submitting}
                className="w-full px-4 py-2.5 text-sm bg-white border border-ink/10 rounded-md focus:outline-none focus:border-ink/30 resize-none disabled:opacity-50"
              />
            </div>

            {/* 照片区 */}
            <div>
              <div className="flex items-baseline justify-between mb-1.5">
                <label className="text-xs font-mono text-ink-soft uppercase tracking-widest">
                  照片 * <span className="text-ink-soft/50 normal-case">(必填,单张≤5MB)</span>
                </label>
                {pendingImages.length > 0 && !submitting && (
                  <button
                    type="button"
                    onClick={clearAllImages}
                    className="text-[11px] text-ink-soft hover:text-accent transition"
                  >
                    × 清空全部
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={openFilePicker}
                disabled={submitting}
                className="w-full p-4 border-2 border-dashed border-ink/20 rounded-xl hover:border-accent/40 hover:bg-accent/5 transition flex flex-col items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed group"
              >
                <div className="text-2xl group-hover:scale-110 transition">📷</div>
                <div className="text-sm font-semibold text-ink">
                  {pendingImages.length === 0 ? '上传图片' : '继续添加图片'}
                </div>
                <div className="text-[11px] text-ink-soft/70 font-mono">
                  // 可一次选多张 · 当前 {pendingImages.length} 张
                </div>
              </button>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={handlePickFiles}
                className="hidden"
              />

              {pendingImages.length > 0 && (
                <div className="mt-4">
                  <div className="text-[11px] font-mono text-ink-soft/70 mb-2">
                    // 当前图片 ({pendingImages.length} 张 · 点击 × 移除)
                  </div>
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                    {pendingImages.map((img, i) => (
                      <div
                        key={img.key}
                        className="relative aspect-square rounded-lg overflow-hidden border border-ink/10 group"
                      >
                        <img src={img.preview} alt="" className="w-full h-full object-cover" />
                        {!submitting && (
                          <button
                            type="button"
                            onClick={() => removeImage(img.key)}
                            className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/70 text-white text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition"
                            title="移除"
                          >
                            ×
                          </button>
                        )}
                        {img.file && (
                          <div className="absolute bottom-1 left-1 text-[10px] font-mono text-white bg-emerald-600/80 px-1.5 py-0.5 rounded">
                            新
                          </div>
                        )}
                        {!img.file && (
                          <div className="absolute bottom-1 left-1 text-[10px] font-mono text-white/80 bg-black/50 px-1.5 py-0.5 rounded">
                            {i + 1}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {submitting && uploadProgress.total > 0 && (
                <div className="mt-4">
                  <div className="text-xs font-mono text-ink-soft mb-1.5">
                    上传中 {uploadProgress.done}/{uploadProgress.total}
                    {uploadProgress.currentName && ` · ${uploadProgress.currentName}`}
                  </div>
                  <div className="h-1.5 bg-ink/10 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-accent transition-all"
                      style={{
                        width: `${(uploadProgress.done / uploadProgress.total) * 100}%`,
                      }}
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={closeForm}
                disabled={submitting}
                className="px-4 py-2 text-sm text-ink-soft hover:text-ink transition disabled:opacity-50"
              >
                取消
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-6 py-2 text-sm font-semibold text-white bg-accent rounded-md hover:bg-accent/90 transition disabled:opacity-50"
              >
                {submitting
                  ? `${formMode === 'edit' ? '保存中' : '发布中'} ${uploadProgress.done}/${uploadProgress.total}`
                  : formMode === 'edit'
                    ? `💾 保存修改 (${pendingImages.length} 张)`
                    : `📤 发布 (${pendingImages.length} 张照片)`}
              </button>
            </div>
          </form>
        )}

        {/* 列表 */}
        {loading ? (
          <div className="text-center py-20 text-ink-soft/60">加载中…</div>
        ) : travels.length === 0 ? (
          <div className="text-center py-20 text-ink-soft/60">
            还没发布,{admin ? '点 + 发布 发上第一条吧' : '请联系管理员发布'}
          </div>
        ) : (
          <div className="space-y-12">
            {travels.map((t) => (
              <TravelCard
                key={t.id}
                travel={t}
                canEdit={admin}
                canDelete={admin}
                onEdit={() => openEdit(t)}
                onDelete={() => handleDelete(t.id)}
              />
            ))}
          </div>
        )}

      </div>
    </App>
  )
}

function TravelCard({
  travel,
  canEdit,
  canDelete,
  onEdit,
  onDelete,
}: {
  travel: Travel
  canEdit: boolean
  canDelete: boolean
  onEdit?: () => void
  onDelete?: () => void
}) {
  return (
    <article className="border-l-2 border-ink/10 pl-6 hover:border-accent transition-colors">
      <div className="flex items-baseline justify-between mb-2 gap-2 flex-wrap">
        <div className="text-xs font-mono text-ink-soft/60">{travel.date}</div>
        {(canEdit || canDelete) && (
          <div className="flex items-center gap-3">
            {canEdit && onEdit && (
              <button
                onClick={onEdit}
                className="text-xs text-ink-soft/70 hover:text-accent transition"
              >
                ✎ 编辑
              </button>
            )}
            {canDelete && onDelete && (
              <button
                onClick={onDelete}
                className="text-xs text-ink-soft/50 hover:text-accent transition"
              >
                × 删除
              </button>
            )}
          </div>
        )}
      </div>
      <h2 className="text-2xl font-bold text-ink mb-1">{travel.title}</h2>
      {travel.location && (
        <div className="text-sm text-ink-soft/80 mb-3">📍 {travel.location}</div>
      )}
      <p className="text-ink-soft leading-relaxed whitespace-pre-wrap mb-4">
        {travel.description}
      </p>
      {travel.images.length > 0 && (
        <div className="columns-1 sm:columns-2 gap-3">
          {travel.images.map((url, i) => (
            <a
              key={i}
              href={url}
              target="_blank"
              rel="noreferrer"
              className="block mb-3 break-inside-avoid rounded-2xl border border-ink/10 overflow-hidden hover:shadow-lg transition"
            >
              <img
                src={url}
                alt={`${travel.title} ${i + 1}`}
                className="w-full h-auto"
                loading="lazy"
              />
            </a>
          ))}
        </div>
      )}
    </article>
  )
}

