import { useEffect, useRef, useState } from 'react'
import App from '../App'
import {
  listWorks,
  createWork,
  updateWork,
  deleteWork,
  uploadImage,
  type Work,
} from '../api'
import { isAdmin, ensureLoggedIn, clearAuth } from '../auth'

// 待发布图片
type PendingImage = {
  key: string
  url?: string
  file?: File
  preview: string
}

// 把 "openwrt, 嵌入式,  Linux " 解析成 ["OpenWrt", "嵌入式", "Linux"]
function parseTags(input: string): string[] {
  const seen = new Set<string>()
  const result: string[] = []
  for (const raw of input.split(/[,，]/)) {
    const t = raw.trim()
    if (!t) continue
    const key = t.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    // 保留用户原始大小写(中文不受 toLowerCase 影响)
    result.push(t)
  }
  return result
}

// 把数组渲染成 "OpenWrt, 嵌入式, Linux"
function joinTags(tags: string[]): string {
  return tags.join(', ')
}

export default function WorkPage() {
  const [works, setWorks] = useState<Work[]>([])
  const [loading, setLoading] = useState(true)
  const [admin, setAdmin] = useState(false)

  const [formMode, setFormMode] = useState<'create' | 'edit' | null>(null)
  const [editingId, setEditingId] = useState<number | null>(null)

  const [title, setTitle] = useState('')
  const [problem, setProblem] = useState('')
  const [analysis, setAnalysis] = useState('')
  const [solution, setSolution] = useState('')
  const [tagsInput, setTagsInput] = useState('')
  const [pendingImages, setPendingImages] = useState<PendingImage[]>([])

  const [submitting, setSubmitting] = useState(false)
  const [uploadProgress, setUploadProgress] = useState({ done: 0, total: 0, currentName: '' })

  const fileInputRef = useRef<HTMLInputElement>(null)

  // 守卫 + 初次加载
  useEffect(() => {
    if (!ensureLoggedIn()) return
    setAdmin(isAdmin())
    loadWorks()
  }, [])

  async function loadWorks() {
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

  // ===== 表单操作 =====
  function openCreate() {
    resetForm()
    setEditingId(null)
    setFormMode('create')
  }

  function openEdit(w: Work) {
    setTitle(w.title)
    setProblem(w.problem || '')
    setAnalysis(w.analysis || '')
    setSolution(w.solution || '')
    setTagsInput(joinTags(w.tags))
    setPendingImages(
      w.images.map((url) => ({
        key: url,
        url,
        preview: url,
      })),
    )
    setEditingId(w.id)
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
    if (
      title.trim() ||
      problem.trim() ||
      analysis.trim() ||
      solution.trim() ||
      tagsInput.trim()
    )
      return true
    if (formMode === 'create' && pendingImages.length > 0) return true
    return false
  }

  function resetForm() {
    setTitle('')
    setProblem('')
    setAnalysis('')
    setSolution('')
    setTagsInput('')
    setPendingImages([])
    setUploadProgress({ done: 0, total: 0, currentName: '' })
  }

  // ===== 图片管理(同 Travel/Life) =====
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
    if (!title.trim()) {
      alert('标题必填')
      return
    }
    if (!problem.trim() && !analysis.trim() && !solution.trim()) {
      alert('现象 / 排查 / 解决 至少写一段')
      return
    }
    if (pendingImages.length === 0) {
      alert('至少上传一张截图')
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

      const tags = parseTags(tagsInput)
      const payload = {
        title: title.trim(),
        problem: problem.trim() || undefined,
        analysis: analysis.trim() || undefined,
        solution: solution.trim() || undefined,
        tags,
        images: finalImages,
      }

      if (formMode === 'create') {
        await createWork({
          ...payload,
          date: new Date().toISOString().slice(0, 7).replace('-', '.'),
        })
        alert(`发布成功!共 ${finalImages.length} 张截图`)
      } else if (formMode === 'edit' && editingId) {
        await updateWork(editingId, payload)
        alert('修改已保存!')
      }

      resetForm()
      setFormMode(null)
      setEditingId(null)
      await loadWorks()
    } catch (err: any) {
      alert((formMode === 'edit' ? '保存失败: ' : '发布失败: ') + (err.message || err))
    } finally {
      setSubmitting(false)
      setUploadProgress({ done: 0, total: 0, currentName: '' })
    }
  }

  // ===== 列表操作 =====
  async function handleDelete(id: number) {
    if (!confirm('确认删除这条? (截图也会一起删)')) return
    try {
      await deleteWork(id)
      await loadWorks()
    } catch (err: any) {
      alert('删除失败: ' + (err.message || err))
    }
  }

  return (
    <App current="work">
      <div className="max-w-3xl mx-auto px-6 pt-12 pb-24">
        {/* 顶部介绍 */}
        <div className="text-center mb-10">
          <p className="text-xs font-mono text-accent mb-3 tracking-widest">/ WORK</p>
          <h1 className="text-4xl md:text-5xl font-extrabold text-ink">
            工作<span className="text-accent">.</span>
          </h1>
          <p className="mt-4 text-ink-soft max-w-xl mx-auto leading-relaxed">
            调试踩坑笔记。每条按 <span className="font-mono text-ink">现象 → 排查 → 解决</span> 三段写,
            打 tag 方便以后翻。
          </p>
        </div>

        {/* 登录状态 + 操作栏 */}
        <div className="flex items-center justify-between mb-8 border-b border-ink/10 pb-4 gap-3 flex-wrap">
          <span className="text-sm text-ink-soft">
            共 <span className="text-ink font-semibold">{works.length}</span> 条
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
                placeholder="例:OpenWrt 启动卡在 switching to clocksource tsc"
                disabled={submitting}
                className="w-full px-4 py-2.5 text-sm bg-white border border-ink/10 rounded-md focus:outline-none focus:border-ink/30 disabled:opacity-50"
              />
            </div>

            <div>
              <label className="block text-xs font-mono text-ink-soft mb-1.5 uppercase tracking-widest">
                现象 / 问题
              </label>
              <textarea
                value={problem}
                onChange={(e) => setProblem(e.target.value)}
                rows={3}
                placeholder="看到了什么现象、报错信息、能复现吗..."
                disabled={submitting}
                className="w-full px-4 py-2.5 text-sm bg-white border border-ink/10 rounded-md focus:outline-none focus:border-ink/30 resize-none disabled:opacity-50 font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-mono text-ink-soft mb-1.5 uppercase tracking-widest">
                排查过程
              </label>
              <textarea
                value={analysis}
                onChange={(e) => setAnalysis(e.target.value)}
                rows={5}
                placeholder={`试过的方向、命令、查到的资料...
例:
1. dmesg | tail -50 → 看到 mtd partition 扫描卡住
2. mount -t debugfs none /sys/kernel/debug → 失败
3. ...`}
                disabled={submitting}
                className="w-full px-4 py-2.5 text-sm bg-white border border-ink/10 rounded-md focus:outline-none focus:border-ink/30 resize-none disabled:opacity-50 font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-mono text-ink-soft mb-1.5 uppercase tracking-widest">
                解决方法
              </label>
              <textarea
                value={solution}
                onChange={(e) => setSolution(e.target.value)}
                rows={4}
                placeholder="最终怎么搞定的,留个验证步骤..."
                disabled={submitting}
                className="w-full px-4 py-2.5 text-sm bg-white border border-ink/10 rounded-md focus:outline-none focus:border-ink/30 resize-none disabled:opacity-50 font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-mono text-ink-soft mb-1.5 uppercase tracking-widest">
                Tags (用逗号分隔)
              </label>
              <input
                type="text"
                value={tagsInput}
                onChange={(e) => setTagsInput(e.target.value)}
                placeholder="例:OpenWrt, 嵌入式, 启动"
                disabled={submitting}
                className="w-full px-4 py-2.5 text-sm bg-white border border-ink/10 rounded-md focus:outline-none focus:border-ink/30 disabled:opacity-50"
              />
              <div className="mt-1.5 text-[11px] font-mono text-ink-soft/60">
                // 当前解析到: {parseTags(tagsInput).length === 0 ? '(无)' : parseTags(tagsInput).map((t) => `#${t}`).join(' ')}
              </div>
            </div>

            {/* 照片区 */}
            <div>
              <div className="flex items-baseline justify-between mb-1.5">
                <label className="text-xs font-mono text-ink-soft uppercase tracking-widest">
                  截图 * <span className="text-ink-soft/50 normal-case">(必填,单张≤5MB)</span>
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
                  {pendingImages.length === 0 ? '上传截图' : '继续添加截图'}
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
                    : `📤 发布 (${pendingImages.length} 张截图)`}
              </button>
            </div>
          </form>
        )}

        {/* 列表 */}
        {loading ? (
          <div className="text-center py-20 text-ink-soft/60">加载中…</div>
        ) : works.length === 0 ? (
          <div className="text-center py-20 text-ink-soft/60">
            还没发布,{admin ? '点 + 发布 发上第一条吧' : '请联系管理员发布'}
          </div>
        ) : (
          <div className="space-y-12">
            {works.map((w) => (
              <WorkCard
                key={w.id}
                work={w}
                canEdit={admin}
                canDelete={admin}
                onEdit={() => openEdit(w)}
                onDelete={() => handleDelete(w.id)}
              />
            ))}
          </div>
        )}

        <div className="mt-16 text-center text-xs font-mono text-ink-soft/40">
          // 数据由后端 SQLite 存储 · 清理浏览器数据不影响
        </div>
      </div>
    </App>
  )
}

function WorkCard({
  work,
  canEdit,
  canDelete,
  onEdit,
  onDelete,
}: {
  work: Work
  canEdit: boolean
  canDelete: boolean
  onEdit?: () => void
  onDelete?: () => void
}) {
  return (
    <article className="border-l-2 border-ink/10 pl-6 hover:border-accent transition-colors">
      {/* 日期 + tags + 操作 */}
      <div className="flex items-baseline justify-between mb-3 gap-2 flex-wrap">
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className="text-xs font-mono text-ink-soft/60">{work.date}</span>
          {work.tags.length > 0 && (
            <span className="flex flex-wrap gap-1.5">
              {work.tags.map((t) => (
                <span
                  key={t}
                  className="text-[11px] font-mono px-2 py-0.5 bg-bg-soft border border-ink/10 rounded text-ink-soft"
                >
                  #{t}
                </span>
              ))}
            </span>
          )}
        </div>
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

      <h2 className="text-2xl font-bold text-ink mb-4">{work.title}</h2>

      {/* 三段式: 现象 / 排查 / 解决 */}
      <div className="space-y-3 mb-4">
        {work.problem && (
          <div>
            <div className="text-[11px] font-mono text-ink-soft/70 uppercase tracking-widest mb-1">
              // 现象
            </div>
            <pre className="text-sm text-ink-soft whitespace-pre-wrap font-mono leading-relaxed bg-bg-soft/40 px-3 py-2 rounded border border-ink/5">
              {work.problem}
            </pre>
          </div>
        )}
        {work.analysis && (
          <div>
            <div className="text-[11px] font-mono text-ink-soft/70 uppercase tracking-widest mb-1">
              // 排查
            </div>
            <pre className="text-sm text-ink-soft whitespace-pre-wrap font-mono leading-relaxed bg-bg-soft/40 px-3 py-2 rounded border border-ink/5">
              {work.analysis}
            </pre>
          </div>
        )}
        {work.solution && (
          <div>
            <div className="text-[11px] font-mono text-accent/80 uppercase tracking-widest mb-1">
              // 解决
            </div>
            <pre className="text-sm text-ink whitespace-pre-wrap font-mono leading-relaxed bg-accent/5 px-3 py-2 rounded border border-accent/20">
              {work.solution}
            </pre>
          </div>
        )}
      </div>

      {work.images.length > 0 && (
        <div className="columns-1 sm:columns-2 gap-3">
          {work.images.map((url, i) => (
            <a
              key={i}
              href={url}
              target="_blank"
              rel="noreferrer"
              className="block mb-3 break-inside-avoid rounded-2xl border border-ink/10 overflow-hidden hover:shadow-lg transition"
            >
              <img
                src={url}
                alt={`${work.title} ${i + 1}`}
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
