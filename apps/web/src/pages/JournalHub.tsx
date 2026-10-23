import { useEffect, useMemo, useRef, useState } from 'react'
import NoteMarkdown from '../components/NoteMarkdown'
import App from '../App'
import { getContent, listContents, listTaxonomy, type Category, type UnifiedContent } from '../api'
import ReadingProgress from '../components/ReadingProgress'
import ProcessMarkdown from '../components/ProcessMarkdown'
import { readingHref, readingReturn } from '../readingNavigation'

const statusLabels = { record: '笔记', investigating: '排查中', resolved: '已解决', pending: '待验证' }
export default function JournalHub() {
  const params = new URLSearchParams(window.location.search)
  const requestedId = Number(params.get('id'))
  const legacyType = params.get('type')
  const returnFilter = params.get('from')
  const returnTo = params.get('return')
  const [entries, setEntries] = useState<UnifiedContent[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [filter, setFilter] = useState(params.get('filter') || 'all')
  const [detail, setDetail] = useState<UnifiedContent | null>(null)
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState(params.get('q') || '')

  const requestSequence = useRef(0)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  const [limit, setLimit] = useState(20)
  useEffect(() => setLimit(20), [filter, query])
  useEffect(() => {
    if (requestedId) return
    const url = new URL(window.location.href)
    filter === 'all' ? url.searchParams.delete('filter') : url.searchParams.set('filter', filter)
    query ? url.searchParams.set('q', query) : url.searchParams.delete('q')
    history.replaceState(null, '', url)
  }, [filter, query, requestedId])
  useEffect(() => {
    if (requestedId) return
    const key = `notes-scroll:${window.location.pathname}${window.location.search}`
    if (!loading) requestAnimationFrame(() => window.scrollTo(0, Number(sessionStorage.getItem(key) || 0)))
    const save = () => sessionStorage.setItem(key, String(window.scrollY))
    window.addEventListener('pagehide', save)
    window.addEventListener('click', save)
    return () => { window.removeEventListener('pagehide', save); window.removeEventListener('click', save) }
  }, [loading, filter, query, requestedId])
  useEffect(() => {
    const sequence = ++requestSequence.current
    setLoading(true); setError('')
    if (requestedId) { const all = listContents('journal', false, true); Promise.all([legacyType ? all.then(({ contents }) => { const match = contents.find((item) => item.legacy_type === legacyType && item.legacy_id === requestedId); if (!match) throw new Error('not found'); return getContent(match.id) }) : getContent(requestedId), all]).then(([{ content }, { contents }]) => { setDetail(content); setEntries(contents) }).catch(() => { if (sequence === requestSequence.current) setError('笔记加载失败，请检查网络后重试。') }).finally(() => { if (sequence === requestSequence.current) setLoading(false) }); return }
    Promise.all([listContents('journal', false, true, query), listTaxonomy()]).then(([data, taxonomy]) => { if (sequence !== requestSequence.current) return; setEntries(data.contents); setCategories(taxonomy.channels.find((channel) => channel.id === 'journal')?.categories || []); const legacyCategory = taxonomy.channels.find(channel => channel.id === 'journal')?.categories.find(category => category.slug === filter); if (legacyCategory) setFilter(String(legacyCategory.id)) }).catch(() => { if (sequence === requestSequence.current) setError('笔记加载失败，请检查网络后重试。') }).finally(() => { if (sequence === requestSequence.current) setLoading(false) })
  }, [attempt, query])
  const visible = useMemo(() => { return entries.filter((entry) => (filter === 'all' || (filter === 'none' ? entry.category_id === null : entry.category_id === Number(filter)))) }, [entries, filter, query])
  if (error) return <App hideHeader><main className="hub-page"><p role="alert" className="hub-empty">{error}</p><button className="retry-button" onClick={() => setAttempt(value => value + 1)}>重新加载</button></main></App>
  if (requestedId) return <App hideHeader><JournalDetail item={detail} entries={entries} loading={loading} returnFilter={returnFilter} returnTo={returnTo} /></App>
  return <App hideHeader><main className="hub-page"><a href="/" className="hub-back note-home-back">← 返回首页</a><header className="hub-hero"><p>/ FIELD NOTES</p><h1>工作笔记<span>。</span></h1><div className="hub-hero-copy"><p>记录工作中遇到的问题、排查过程与解决办法。</p><strong>{entries.length || '—'} 篇记录</strong></div></header>
    <div className="hub-toolbar" role="group" aria-label="内容筛选"><button onClick={() => setFilter('all')} className={filter === 'all' ? 'active' : ''}>全部</button>{categories.map((category) => <button key={category.id} onClick={() => setFilter(String(category.id))} className={filter === String(category.id) ? 'active' : ''}>{category.name}</button>)}<button onClick={() => setFilter('none')} className={filter === 'none' ? 'active' : ''}>其他</button>{<div className="ml-auto text-xs"><a href="/admin.html">进入管理中心</a></div>}</div>
    <label className="hub-search"><span>搜索</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索标题或正文…" />{query && <button onClick={() => setQuery('')}>×</button>}</label>
    <section className="journal-list">{loading && <p className="hub-empty">正在整理记录…</p>}{!loading && !visible.length && <p className="hub-empty">{query ? '没有找到匹配笔记，试试其他关键词。' : '这里还没有笔记。'}</p>}{visible.slice(0,limit).map((entry, index) => <a key={entry.id} href={readingHref('journal', entry.id)} className="journal-row focus-ring"><span className="journal-number">{String(index + 1).padStart(2,'0')}</span><div><span className="kind-pill work">{entry.category_name || '其他'}</span><h2>{entry.title}</h2><div className="note-tags"><span>{statusLabels[entry.problem_status || 'record']}</span>{entry.tags?.map(tag => <span key={tag}>#{tag}</span>)}</div><p>{entry.subtitle || entry.body.replace(/[#*`>\n]/g, ' ').slice(0,130)}</p></div><div className="journal-meta"><span>更新于 {new Date(entry.updated_at * 1000).toLocaleDateString('zh-CN')}</span>{Boolean(entry.pinned) && <span className="note-pinned">置顶</span>}<span>{entry.note_count} 条记录</span><b>↗</b></div></a>)}</section>{visible.length > limit && <button className="retry-button" onClick={() => setLimit(value => value + 20)}>继续加载（还有 {visible.length - limit} 篇）</button>}
  </main></App>
}

function JournalDetail({ item, entries, loading, returnFilter, returnTo }: { item: UnifiedContent | null; entries: UnifiedContent[]; loading: boolean; returnFilter: string | null; returnTo: string | null }) {
  const back = readingReturn('journal', returnTo, returnFilter, item?.category_name)
  useEffect(() => { if (!item) return; document.title = `${item.title} · LongTeng`; const meta = document.querySelector('meta[name="description"]'); meta?.setAttribute('content', item.body.replace(/[#*`>\n]/g, ' ').trim().slice(0, 150)); const script = document.createElement('script'); script.type = 'application/ld+json'; script.text = JSON.stringify({ '@context': 'https://schema.org', '@type': 'Article', headline: item.title, description: item.body.replace(/[#*`>\n]/g, ' ').trim().slice(0, 150), author: { '@type': 'Person', name: 'LongTeng' }, dateModified: new Date(item.updated_at * 1000).toISOString(), mainEntityOfPage: window.location.href }); document.head.appendChild(script); return () => { document.title = '工作笔记 · LongTeng'; script.remove() } }, [item])
  if (loading) return <main className="hub-page"><p className="hub-empty">正在打开记录…</p></main>
  if (!item) return <main className="hub-page"><a href={back.href} className="hub-back">← {back.label}</a><p className="hub-empty">没有找到这条记录。</p></main>
  const headings = item.body.replace(/```[\s\S]*?```/g, '').split('\n').filter(line => /^#{2,3}\s/.test(line)).map(line => line.replace(/^#+\s/, ''))
  const peers = entries.filter((entry) => entry.id !== item.id && entry.category_id === item.category_id).slice(0, 3)
  const index = entries.findIndex((entry) => entry.id === item.id), previous = entries[index + 1], next = index > 0 ? entries[index - 1] : null
  return <main className="hub-page reading-page"><ReadingProgress/><a href={back.href} className="hub-back">← {back.label}</a><header className="reading-header"><span className="kind-pill work">{item.category_name || '其他'}</span><h1>{item.title}</h1><div className="note-tags"><span>{statusLabels[item.problem_status || 'record']}</span>{item.tags?.map(tag => <a key={tag} href={`/?q=${encodeURIComponent(tag)}`}>#{tag}</a>)}</div><div><time>记录于 {item.date}</time><time>更新于 {new Date(item.updated_at * 1000).toLocaleDateString('zh-CN')}</time><span>{item.note_count} 条过程记录</span></div></header>{item.subtitle && <p className="note-summary">{item.subtitle}</p>}{headings.length > 1 && <details className="note-toc" open><summary>本篇目录</summary><nav>{headings.map((title, index) => <a key={index} href={`#section-${index}`}>{title}</a>)}</nav></details>}<article className="reading-body"><NoteMarkdown body={item.body} /></article><section className="reading-notes">{item.notes?.map((note,index) => <article key={note.id} className="reading-note"><div><span>{String(index+1).padStart(2,'0')}</span><time>{new Date(note.created_at*1000).toLocaleDateString('zh-CN')}</time></div>{note.body && <div className="reading-body"><ProcessMarkdown>{note.body}</ProcessMarkdown></div>}{note.images.length>0 && <div className="reading-images">{note.images.map((src)=><img key={src} src={src} alt="" loading="lazy"/>)}</div>}</article>)}</section><ReadingFooter channel="journal" previous={previous} next={next} peers={peers} returnTo={returnTo || back.href}/></main>
}

function ReadingFooter({ channel, previous, next, peers, returnTo }: { channel: 'journal'; previous?: UnifiedContent; next?: UnifiedContent | null; peers: UnifiedContent[]; returnTo: string }) { return <footer className="reading-footer"><nav>{previous ? <a href={readingHref(channel, previous.id, returnTo)}><span>上一篇</span><strong>{previous.title}</strong></a> : <span/>}{next && <a href={readingHref(channel, next.id, returnTo)}><span>下一篇</span><strong>{next.title}</strong></a>}</nav>{peers.length > 0 && <section><p>/ RELATED</p><h2>继续阅读</h2><div>{peers.map((entry) => <a key={entry.id} href={readingHref(channel, entry.id, returnTo)}><span>{entry.category_name || '其他'}</span><strong>{entry.title}</strong></a>)}</div></section>}</footer> }
export { ReadingFooter }
