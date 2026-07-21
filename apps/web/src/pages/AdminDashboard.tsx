import { useEffect, useMemo, useState } from 'react'
import App from '../App'
import CategoryManager from '../components/CategoryManager'
import { deleteFigure, deleteNote, deleteStudy, deleteTravel, deleteWork, listAdminContent, listTaxonomy, updateContentCategories, updateContentState, type AdminContentItem, type Channel, type ContentType } from '../api'
import { ensureLoggedIn, isAdmin } from '../auth'

const labels: Record<ContentType, string> = { work: '工作', study: '学习', figure: '模型', travel: '旅行', note: '随笔' }
const publicPages: Record<ContentType, string> = { work: '/journal.html?type=work&id=', study: '/journal.html?type=study&id=', figure: '/life.html?type=figure&id=', travel: '/life.html?type=travel&id=', note: '/life.html?type=note&id=' }
const keyOf = (item: AdminContentItem) => `${item.type}-${item.id}`

export default function AdminDashboard() {
  const initialType = new URLSearchParams(window.location.search).get('type') as ContentType | null
  const [items, setItems] = useState<AdminContentItem[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [query, setQuery] = useState('')
  const [type, setType] = useState<'all' | ContentType>(initialType && labels[initialType] ? initialType : 'all')
  const [status, setStatus] = useState<'all' | 'draft' | 'published' | 'featured'>('all')
  const [channels, setChannels] = useState<Channel[]>([])
  const [category, setCategory] = useState('all')
  const [moveTo, setMoveTo] = useState('')
  const returnTarget = initialType === 'work' || initialType === 'study'
    ? { href: '/journal.html', label: '返回工作与学习' }
    : initialType === 'figure' || initialType === 'travel' || initialType === 'note'
      ? { href: '/life.html', label: '返回生活分享' }
      : { href: '/', label: '返回主页' }

  async function load() { setLoading(true); try { const [content, taxonomy] = await Promise.all([listAdminContent(), listTaxonomy()]); setItems(content.items); setChannels(taxonomy.channels) } finally { setLoading(false) } }
  useEffect(() => { if (!ensureLoggedIn()) return; if (!isAdmin()) { window.location.replace('/'); return }; load().catch((reason) => alert(reason.message || '读取内容失败')) }, [])

  const filtered = useMemo(() => items.filter((item) => {
    const q = query.trim().toLowerCase()
    const categoryMatch = category === 'all' || (category === 'none' ? item.category_id == null : item.category_id === Number(category))
    return (!q || item.title.toLowerCase().includes(q)) && (type === 'all' || item.type === type) && categoryMatch && (status === 'all' || (status === 'featured' ? Boolean(item.featured) : item.status === status))
  }), [items, query, type, category, status])
  const counts = useMemo(() => ({ total: items.length, published: items.filter((item) => item.status === 'published').length, draft: items.filter((item) => item.status === 'draft').length, featured: items.filter((item) => item.featured).length }), [items])
  const selectedItems = items.filter((item) => selected.has(keyOf(item)))

  async function patch(item: AdminContentItem, change: Partial<Pick<AdminContentItem, 'status' | 'featured' | 'pinned' | 'category_id'>>) {
    const key = keyOf(item); setSaving(key)
    try { const next = await updateContentState(item.type, item.id, change); setItems((current) => current.map((entry) => keyOf(entry) === key ? { ...entry, ...next } : entry)) }
    catch (reason: any) { alert(reason.message || '保存失败') } finally { setSaving('') }
  }
  async function remove(item: AdminContentItem, ask = true) {
    if (ask && !confirm(`确认永久删除“${item.title}”？${['figure','travel','note'].includes(item.type) ? '\n关联图片也会一起删除。' : ''}`)) return false
    if (item.type === 'work') await deleteWork(item.id); else if (item.type === 'study') await deleteStudy(item.id); else if (item.type === 'figure') await deleteFigure(item.id); else if (item.type === 'travel') await deleteTravel(item.id); else await deleteNote(item.id)
    setItems((current) => current.filter((entry) => keyOf(entry) !== keyOf(item))); setSelected((current) => { const next = new Set(current); next.delete(keyOf(item)); return next }); return true
  }
  async function batchStatus(nextStatus: 'draft' | 'published') {
    if (!selectedItems.length) return
    setSaving('batch')
    try { for (const item of selectedItems) await updateContentState(item.type, item.id, { status: nextStatus, ...(nextStatus === 'draft' ? { featured: 0, pinned: 0 } : {}) }); await load(); setSelected(new Set()) }
    catch (reason: any) { alert(reason.message || '批量操作失败') } finally { setSaving('') }
  }
  async function batchDelete() {
    if (!selectedItems.length || !confirm(`确认永久删除选中的 ${selectedItems.length} 条内容？\n图片类内容的关联图片也会删除，此操作不可撤销。`)) return
    setSaving('batch')
    try { for (const item of selectedItems) await remove(item, false); setSelected(new Set()) }
    catch (reason: any) { alert(reason.message || '部分内容删除失败，请刷新确认') } finally { setSaving('') }
  }
  async function batchCategory() {
    if (!selectedItems.length || !moveTo) return
    const categoryId = moveTo === 'none' ? null : Number(moveTo)
    setSaving('batch')
    try { await updateContentCategories(selectedItems.map(({ type, id }) => ({ type, id })), categoryId); await load(); setSelected(new Set()); setMoveTo('') }
    catch (reason: any) { alert(reason.message || '内容与目标分类不在同一频道') } finally { setSaving('') }
  }
  function toggle(key: string) { setSelected((current) => { const next = new Set(current); next.has(key) ? next.delete(key) : next.add(key); return next }) }
  function toggleAll() { const keys = filtered.map(keyOf); setSelected(keys.every((key) => selected.has(key)) ? new Set() : new Set(keys)) }

  return <App current="admin"><div className="admin-dashboard">
    <a className="dashboard-back" href={returnTarget.href}>← {returnTarget.label}</a>
    <section className="dashboard-hero"><div><p>/ CONTENT STUDIO</p><h1>内容控制台<span>。</span></h1><p className="dashboard-lead">公开页面只负责阅读，创作、编辑、状态与删除全部在这里完成。</p></div><div className="dashboard-total"><strong>{loading ? '—' : counts.total}</strong><span>全部内容</span></div></section>
    <section className="content-stats"><button onClick={() => setStatus('all')} className={status === 'all' ? 'active' : ''}><strong>{counts.total}</strong><span>全部</span></button><button onClick={() => setStatus('published')} className={status === 'published' ? 'active' : ''}><strong>{counts.published}</strong><span>已发布</span></button><button onClick={() => setStatus('draft')} className={status === 'draft' ? 'active' : ''}><strong>{counts.draft}</strong><span>草稿</span></button><button onClick={() => setStatus('featured')} className={status === 'featured' ? 'active' : ''}><strong>{counts.featured}</strong><span>精选</span></button></section>
    <CategoryManager channels={channels} reload={load} />
    <section className="content-manager">
      <div className="content-toolbar"><label><span>搜索</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="输入标题…" /></label><label><span>内容格式</span><select value={type} onChange={(event) => setType(event.target.value as typeof type)}><option value="all">全部格式</option>{Object.entries(labels).map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></label><label><span>分类</span><select value={category} onChange={(event) => setCategory(event.target.value)}><option value="all">全部分类</option><option value="none">其他（未分类）</option>{channels.map((channel) => <optgroup key={channel.id} label={channel.name}>{channel.categories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</optgroup>)}</select></label><a href="/compose.html" className="content-new">＋ 新建内容</a></div>
      <div className="batch-toolbar"><label><input type="checkbox" checked={filtered.length > 0 && filtered.every((item) => selected.has(keyOf(item)))} onChange={toggleAll} />选择当前结果</label><span>已选 {selected.size} 条</span><select value={moveTo} onChange={(event) => setMoveTo(event.target.value)}><option value="">转移分类…</option><option value="none">其他（未分类）</option>{channels.map((channel) => <optgroup key={channel.id} label={channel.name}>{channel.categories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</optgroup>)}</select><button disabled={!selected.size || !moveTo || saving === 'batch'} onClick={batchCategory}>转移</button><button disabled={!selected.size || saving === 'batch'} onClick={() => batchStatus('published')}>发布</button><button disabled={!selected.size || saving === 'batch'} onClick={() => batchStatus('draft')}>撤回</button><button disabled={!selected.size || saving === 'batch'} className="danger" onClick={batchDelete}>删除</button></div>
      <div className="content-table">{loading ? <p className="content-empty">正在读取内容…</p> : filtered.length === 0 ? <p className="content-empty">没有符合条件的内容</p> : filtered.map((item) => { const key=keyOf(item), busy=saving===key; return <article key={key} className={item.status === 'draft' ? 'is-draft' : ''}>
        <input className="content-check" type="checkbox" checked={selected.has(key)} onChange={() => toggle(key)} aria-label={`选择 ${item.title}`} />
        <div className="content-main"><span className={`content-kind kind-${item.type}`}>{item.category_name || '其他'}</span><div><h2>{item.title}</h2><p>{item.channel_name} · {labels[item.type]}格式 · {item.date} · #{String(item.id).padStart(3,'0')}</p></div></div>
        <div className="content-flags"><button disabled={busy} onClick={() => patch(item,{status:item.status==='published'?'draft':'published',...(item.status==='published'?{featured:0,pinned:0}:{})})} className={item.status==='published'?'on':''}>{item.status==='published'?'已发布':'草稿'}</button><button disabled={busy||item.status==='draft'} onClick={() => patch(item,{featured:item.featured?0:1})} className={item.featured?'on featured':''}>精选</button><button disabled={busy||item.status==='draft'} onClick={() => patch(item,{pinned:item.pinned?0:1})} className={item.pinned?'on':''}>置顶</button></div>
        <div className="content-links"><a href={`/compose.html?type=${item.type}&id=${item.id}`}>编辑</a>{item.status==='published'&&<a href={`${publicPages[item.type]}${item.id}`}>查看 ↗</a>}<button onClick={() => remove(item)} className="delete-link">删除</button></div>
      </article>})}</div>
    </section>
  </div></App>
}
