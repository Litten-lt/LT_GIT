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
    if (requestedId) { const all = listContents('journal'); Promise.all([legacyType ? all.then(({ contents }) => { const match = contents.find((item) => item.legacy_type === legacyType && item.legacy_id === requestedId); if (!match) throw new Error('not found'); return getContent(match.id) }) : getContent(requestedId), all]).then(([{ content }, { contents }]) => { setDetail(content); setEntries(contents) }).finally(() => setLoading(false)); return }
    Promise.all([listContents('journal'), listTaxonomy()]).then(([data, taxonomy]) => { setEntries(data.contents); setCategories(taxonomy.channels.find((channel) => channel.id === 'journal')?.categories || []) }).finally(() => setLoading(false))
  }, [])
  const visible = useMemo(() => { const keyword = query.trim().toLowerCase(); return entries.filter((entry) => (filter === 'all' || (filter === 'none' ? entry.category_id === null : entry.category_id === Number(filter))) && (!keyword || `${entry.title} ${entry.body}`.toLowerCase().includes(keyword))) }, [entries, filter, query])
  if (requestedId) return <App><JournalDetail item={detail} entries={entries} loading={loading} returnFilter={returnFilter} /></App>
  return <App><main className="hub-page"><header className="hub-hero"><a href="/" className="hub-back">← LongTeng.</a><p>/ FIELD NOTES</p><h1>工作与学习<span>。</span></h1><div className="hub-hero-copy"><p>把调试现场、项目复盘和学习过程放进同一条专业时间线。</p><strong>{entries.length || '—'} 篇记录</strong></div></header>
    <div className="hub-toolbar" role="group" aria-label="内容筛选"><button onClick={() => setFilter('all')} className={filter === 'all' ? 'active' : ''}>全部</button>{categories.map((category) => <button key={category.id} onClick={() => setFilter(String(category.id))} className={filter === String(category.id) ? 'active' : ''}>{category.name}</button>)}<button onClick={() => setFilter('none')} className={filter === 'none' ? 'active' : ''}>其他</button>{isAdmin() && <div className="ml-auto text-xs"><a href="/admin.html">进入管理中心</a></div>}</div>
    <label className="hub-search"><span>搜索</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索标题或正文…" />{query && <button onClick={() => setQuery('')}>×</button>}</label>
    <section className="journal-list">{loading && <p className="hub-empty">正在整理记录…</p>}{!loading && !visible.length && <p className="hub-empty">这个分类暂时还没有内容。</p>}{visible.map((entry, index) => <a key={entry.id} href={`/journal.html?id=${entry.id}&from=${filter}`} className="journal-row focus-ring"><span className="journal-number">{String(index + 1).padStart(2,'0')}</span><div><span className="kind-pill work">{entry.category_name || '其他'}</span><h2>{entry.title}</h2><p>{entry.body.slice(0,130)}</p></div><div className="journal-meta"><span>{entry.date}</span><span>{entry.note_count} 条记录</span><b>↗</b></div></a>)}</section>
  </main></App>
}

function JournalDetail({ item, entries, loading, returnFilter }: { item: UnifiedContent | null; entries: UnifiedContent[]; loading: boolean; returnFilter: string | null }) {
  const back = returnFilter ? `/journal.html?filter=${encodeURIComponent(returnFilter)}` : '/journal.html'
  useEffect(() => { if (!item) return; document.title = `${item.title} · LongTeng`; const meta = document.querySelector('meta[name="description"]'); meta?.setAttribute('content', item.body.replace(/[#*`>\n]/g, ' ').trim().slice(0, 150)); const script = document.createElement('script'); script.type = 'application/ld+json'; script.text = JSON.stringify({ '@context': 'https://schema.org', '@type': 'Article', headline: item.title, description: item.body.replace(/[#*`>\n]/g, ' ').trim().slice(0, 150), author: { '@type': 'Person', name: 'LongTeng' }, dateModified: new Date(item.updated_at * 1000).toISOString(), mainEntityOfPage: window.location.href }); document.head.appendChild(script); return () => { document.title = '工作与学习 · LongTeng'; script.remove() } }, [item])
  if (loading) return <main className="hub-page"><p className="hub-empty">正在打开记录…</p></main>
  if (!item) return <main className="hub-page"><a href={back} className="hub-back">← 返回工作与学习</a><p className="hub-empty">没有找到这条记录。</p></main>
  const peers = entries.filter((entry) => entry.id !== item.id && entry.category_id === item.category_id).slice(0, 3)
  const index = entries.findIndex((entry) => entry.id === item.id), previous = entries[index + 1], next = index > 0 ? entries[index - 1] : null
  return <main className="hub-page reading-page"><ReadingProgress/><a href={back} className="hub-back">← 返回工作与学习</a><header className="reading-header"><span className="kind-pill work">{item.category_name || '其他'}</span><h1>{item.title}</h1><div><time>{item.date}</time><span>{item.note_count} 条过程记录</span></div></header><article className="reading-body"><ReactMarkdown remarkPlugins={[remarkGfm]}>{item.body}</ReactMarkdown></article><section className="reading-notes">{item.notes?.map((note,index) => <article key={note.id} className="reading-note"><div><span>{String(index+1).padStart(2,'0')}</span><time>{new Date(note.created_at*1000).toLocaleDateString('zh-CN')}</time></div>{note.body && <div className="reading-body"><ReactMarkdown remarkPlugins={[remarkGfm]}>{note.body}</ReactMarkdown></div>}{note.images.length>0 && <div className="reading-images">{note.images.map((src)=><img key={src} src={src} alt="" loading="lazy"/>)}</div>}</article>)}</section><ReadingFooter channel="journal" previous={previous} next={next} peers={peers}/></main>
}

function ReadingFooter({ channel, previous, next, peers }: { channel: 'journal' | 'life'; previous?: UnifiedContent; next?: UnifiedContent | null; peers: UnifiedContent[] }) { return <footer className="reading-footer"><nav>{previous ? <a href={`/${channel}.html?id=${previous.id}`}><span>上一篇</span><strong>{previous.title}</strong></a> : <span/>}{next && <a href={`/${channel}.html?id=${next.id}`}><span>下一篇</span><strong>{next.title}</strong></a>}</nav>{peers.length > 0 && <section><p>/ RELATED</p><h2>继续阅读</h2><div>{peers.map((entry) => <a key={entry.id} href={`/${channel}.html?id=${entry.id}`}><span>{entry.category_name || '其他'}</span><strong>{entry.title}</strong></a>)}</div></section>}</footer> }
export { ReadingFooter }
