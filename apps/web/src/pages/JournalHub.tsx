import { useEffect, useMemo, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import App from '../App'
import { getContent, listContents, listTaxonomy, type Category, type UnifiedContent } from '../api'
import { isAdmin } from '../auth'
import ReadingProgress from '../components/ReadingProgress'

export default function JournalHub() {
  const params = new URLSearchParams(window.location.search)
  const requestedId = Number(params.get('id'))
  const legacyType = params.get('type')
  const returnFilter = params.get('from')
  const [entries, setEntries] = useState<UnifiedContent[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [filter, setFilter] = useState(params.get('filter') || 'all')
  const [detail, setDetail] = useState<UnifiedContent | null>(null)
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')

  useEffect(() => {
    if (requestedId) { (legacyType ? listContents('journal').then(({ contents }) => { const match = contents.find((item) => item.legacy_type === legacyType && item.legacy_id === requestedId); if (!match) throw new Error('not found'); return getContent(match.id) }) : getContent(requestedId)).then(({ content }) => setDetail(content)).finally(() => setLoading(false)); return }
    Promise.all([listContents('journal'), listTaxonomy()]).then(([data, taxonomy]) => { setEntries(data.contents); setCategories(taxonomy.channels.find((channel) => channel.id === 'journal')?.categories || []) }).finally(() => setLoading(false))
  }, [])
  const visible = useMemo(() => { const keyword = query.trim().toLowerCase(); return entries.filter((entry) => (filter === 'all' || (filter === 'none' ? entry.category_id === null : entry.category_id === Number(filter))) && (!keyword || `${entry.title} ${entry.body}`.toLowerCase().includes(keyword))) }, [entries, filter, query])
  if (requestedId) return <App><JournalDetail item={detail} loading={loading} returnFilter={returnFilter} /></App>
  return <App><main className="hub-page"><header className="hub-hero"><a href="/" className="hub-back">← LongTeng.</a><p>/ FIELD NOTES</p><h1>工作与学习<span>。</span></h1><div className="hub-hero-copy"><p>把调试现场、项目复盘和学习过程放进同一条专业时间线。</p><strong>{entries.length || '—'} 篇记录</strong></div></header>
    <div className="hub-toolbar" role="group" aria-label="内容筛选"><button onClick={() => setFilter('all')} className={filter === 'all' ? 'active' : ''}>全部</button>{categories.map((category) => <button key={category.id} onClick={() => setFilter(String(category.id))} className={filter === String(category.id) ? 'active' : ''}>{category.name}</button>)}<button onClick={() => setFilter('none')} className={filter === 'none' ? 'active' : ''}>其他</button>{isAdmin() && <div className="ml-auto text-xs"><a href="/admin.html">进入管理中心</a></div>}</div>
    <label className="hub-search"><span>搜索</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索标题或正文…" />{query && <button onClick={() => setQuery('')}>×</button>}</label>
    <section className="journal-list">{loading && <p className="hub-empty">正在整理记录…</p>}{!loading && !visible.length && <p className="hub-empty">这个分类暂时还没有内容。</p>}{visible.map((entry, index) => <a key={entry.id} href={`/journal.html?id=${entry.id}&from=${filter}`} className="journal-row focus-ring"><span className="journal-number">{String(index + 1).padStart(2,'0')}</span><div><span className="kind-pill work">{entry.category_name || '其他'}</span><h2>{entry.title}</h2><p>{entry.body.slice(0,130)}</p></div><div className="journal-meta"><span>{entry.date}</span><span>{entry.note_count} 条记录</span><b>↗</b></div></a>)}</section>
  </main></App>
}

function JournalDetail({ item, loading, returnFilter }: { item: UnifiedContent | null; loading: boolean; returnFilter: string | null }) {
  const back = returnFilter ? `/journal.html?filter=${encodeURIComponent(returnFilter)}` : '/journal.html'
  if (loading) return <main className="hub-page"><p className="hub-empty">正在打开记录…</p></main>
  if (!item) return <main className="hub-page"><a href={back} className="hub-back">← 返回工作与学习</a><p className="hub-empty">没有找到这条记录。</p></main>
  return <main className="hub-page reading-page"><ReadingProgress/><a href={back} className="hub-back">← 返回工作与学习</a><header className="reading-header"><span className="kind-pill work">{item.category_name || '其他'}</span><h1>{item.title}</h1><div><time>{item.date}</time><span>{item.note_count} 条过程记录</span></div></header><article className="reading-body"><ReactMarkdown remarkPlugins={[remarkGfm]}>{item.body}</ReactMarkdown></article><section className="reading-notes">{item.notes?.map((note,index) => <article key={note.id} className="reading-note"><div><span>{String(index+1).padStart(2,'0')}</span><time>{new Date(note.created_at*1000).toLocaleDateString('zh-CN')}</time></div>{note.body && <div className="reading-body"><ReactMarkdown remarkPlugins={[remarkGfm]}>{note.body}</ReactMarkdown></div>}{note.images.length>0 && <div className="reading-images">{note.images.map((src)=><img key={src} src={src} alt="" loading="lazy"/>)}</div>}</article>)}</section></main>
}
