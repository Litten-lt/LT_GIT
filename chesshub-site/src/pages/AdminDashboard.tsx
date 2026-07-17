import { useEffect, useMemo, useState } from 'react'
import App from '../App'
import { listAdminContent, updateContentState, type AdminContentItem, type ContentType } from '../api'
import { ensureLoggedIn, isAdmin } from '../auth'

const labels: Record<ContentType, string> = { work: '工作', study: '学习', figure: '模型', travel: '旅行', note: '随笔' }
const editPages: Record<ContentType, string> = { work: '/work.html', study: '/study.html', figure: '/figures.html', travel: '/travel.html', note: '/notes.html' }
const publicPages: Record<ContentType, string> = { work: '/journal.html?type=work&id=', study: '/journal.html?type=study&id=', figure: '/life.html?type=figure&id=', travel: '/life.html?type=travel&id=', note: '/life.html?type=note&id=' }

export default function AdminDashboard() {
  const [items, setItems] = useState<AdminContentItem[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState('')
  const [query, setQuery] = useState('')
  const [type, setType] = useState<'all' | ContentType>('all')
  const [status, setStatus] = useState<'all' | 'draft' | 'published' | 'featured'>('all')

  async function load() {
    setLoading(true)
    try { setItems((await listAdminContent()).items) }
    finally { setLoading(false) }
  }

  useEffect(() => {
    if (!ensureLoggedIn()) return
    if (!isAdmin()) { window.location.replace('/'); return }
    load().catch((reason) => alert(reason.message || '读取内容失败'))
  }, [])

  const filtered = useMemo(() => items.filter((item) => {
    const q = query.trim().toLowerCase()
    return (!q || item.title.toLowerCase().includes(q)) &&
      (type === 'all' || item.type === type) &&
      (status === 'all' || (status === 'featured' ? Boolean(item.featured) : item.status === status))
  }), [items, query, type, status])

  const counts = useMemo(() => ({
    total: items.length,
    published: items.filter((item) => item.status === 'published').length,
    draft: items.filter((item) => item.status === 'draft').length,
    featured: items.filter((item) => item.featured).length,
  }), [items])

  async function patch(item: AdminContentItem, change: Partial<Pick<AdminContentItem, 'status' | 'featured' | 'pinned'>>) {
    const key = `${item.type}-${item.id}`
    setSaving(key)
    try {
      const next = await updateContentState(item.type, item.id, change)
      setItems((current) => current.map((entry) => entry.type === item.type && entry.id === item.id ? { ...entry, ...next } : entry))
    } catch (reason: any) { alert(reason.message || '保存失败') }
    finally { setSaving('') }
  }

  return (
    <App current="admin">
      <div className="admin-dashboard">
        <section className="dashboard-hero">
          <div><p>/ CONTENT STUDIO</p><h1>内容控制台<span>。</span></h1><p className="dashboard-lead">统一管理公开状态、主页精选与栏目置顶。草稿只在这里可见。</p></div>
          <div className="dashboard-total"><strong>{loading ? '—' : counts.total}</strong><span>全部内容</span></div>
        </section>

        <section className="content-stats">
          <button onClick={() => setStatus('all')} className={status === 'all' ? 'active' : ''}><strong>{counts.total}</strong><span>全部</span></button>
          <button onClick={() => setStatus('published')} className={status === 'published' ? 'active' : ''}><strong>{counts.published}</strong><span>已发布</span></button>
          <button onClick={() => setStatus('draft')} className={status === 'draft' ? 'active' : ''}><strong>{counts.draft}</strong><span>草稿</span></button>
          <button onClick={() => setStatus('featured')} className={status === 'featured' ? 'active' : ''}><strong>{counts.featured}</strong><span>精选</span></button>
        </section>

        <section className="content-manager">
          <div className="content-toolbar">
            <label><span>搜索</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="输入标题…" /></label>
            <label><span>栏目</span><select value={type} onChange={(event) => setType(event.target.value as typeof type)}><option value="all">全部栏目</option>{Object.entries(labels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            <a href="/work.html?new=1" className="content-new">＋ 新建内容</a>
          </div>

          <div className="content-table">
            {loading ? <p className="content-empty">正在读取内容…</p> : filtered.length === 0 ? <p className="content-empty">没有符合条件的内容</p> : filtered.map((item) => {
              const key = `${item.type}-${item.id}`; const busy = saving === key
              return <article key={key} className={item.status === 'draft' ? 'is-draft' : ''}>
                <div className="content-main"><span className={`content-kind kind-${item.type}`}>{labels[item.type]}</span><div><h2>{item.title}</h2><p>{item.date} · #{String(item.id).padStart(3, '0')}</p></div></div>
                <div className="content-flags">
                  <button disabled={busy} onClick={() => patch(item, { status: item.status === 'published' ? 'draft' : 'published' })} className={item.status === 'published' ? 'on' : ''}>{item.status === 'published' ? '已发布' : '草稿'}</button>
                  <button disabled={busy || item.status === 'draft'} onClick={() => patch(item, { featured: item.featured ? 0 : 1 })} className={item.featured ? 'on featured' : ''}>精选</button>
                  <button disabled={busy || item.status === 'draft'} onClick={() => patch(item, { pinned: item.pinned ? 0 : 1 })} className={item.pinned ? 'on' : ''}>置顶</button>
                </div>
                <div className="content-links"><a href={`${editPages[item.type]}?id=${item.id}`}>编辑</a>{item.status === 'published' && <a href={`${publicPages[item.type]}${item.id}`}>查看 ↗</a>}</div>
              </article>
            })}
          </div>
        </section>
      </div>
    </App>
  )
}
