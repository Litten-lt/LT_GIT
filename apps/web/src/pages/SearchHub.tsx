import { useEffect, useMemo, useState } from 'react'
import App from '../App'
import { listContents, type UnifiedContent } from '../api'

export default function SearchHub() {
  const params = new URLSearchParams(window.location.search)
  const [items, setItems] = useState<UnifiedContent[]>([])
  const [query, setQuery] = useState(params.get('q') || '')
  const [channel, setChannel] = useState<'all' | 'journal' | 'life'>('all')
  const [loading, setLoading] = useState(true)
  useEffect(() => { listContents().then(({ contents }) => setItems(contents)).finally(() => setLoading(false)) }, [])
  useEffect(() => { const url = new URL(window.location.href); query.trim() ? url.searchParams.set('q', query.trim()) : url.searchParams.delete('q'); history.replaceState(null, '', url) }, [query])
  const results = useMemo(() => { const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean); if (!words.length) return []; return items.filter((item) => (channel === 'all' || item.channel_id === channel) && words.every((word) => `${item.title} ${item.subtitle || ''} ${item.body} ${item.category_name || ''}`.toLowerCase().includes(word))) }, [items, query, channel])
  return <App><main className="hub-page search-page"><header className="hub-hero"><a href="/" className="hub-back">← LongTeng.</a><p>/ SEARCH ARCHIVE</p><h1>搜索全站<span>。</span></h1><div className="hub-hero-copy"><p>从工作学习和生活分享中，找到曾经记录过的关键词。</p><strong>{items.length || '—'} 篇内容</strong></div></header><label className="site-search"><span>⌕</span><input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="输入多个关键词，例如 OpenWrt VLAN" />{query && <button onClick={() => setQuery('')}>清除</button>}</label><div className="search-channels"><button className={channel === 'all' ? 'active' : ''} onClick={() => setChannel('all')}>全部</button><button className={channel === 'journal' ? 'active' : ''} onClick={() => setChannel('journal')}>工作与学习</button><button className={channel === 'life' ? 'active' : ''} onClick={() => setChannel('life')}>生活分享</button></div>{loading ? <p className="hub-empty">正在建立内容索引…</p> : !query.trim() ? <p className="search-prompt">输入关键词开始搜索，支持空格分隔多个关键词。</p> : <section className="search-results"><p>找到 {results.length} 条结果</p>{results.map((item) => <a key={item.id} href={`/${item.channel_id}.html?id=${item.id}`}><div><span>{item.channel_name} · {item.category_name || '其他'}</span><time>{item.date}</time></div><h2>{item.title}</h2><p>{item.body.replace(/[#*`>\n]/g, ' ').slice(0, 150)}</p></a>)}{!results.length && <div className="hub-empty">没有找到匹配内容，试试减少关键词。</div>}</section>}</main></App>
}
