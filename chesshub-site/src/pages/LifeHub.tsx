import { useEffect, useMemo, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import App from '../App'
import { listFigures, listNotes, listTravels, type Figure, type Note, type Travel } from '../api'
import { isAdmin } from '../auth'

type LifeKind = 'figure' | 'travel' | 'note'
type LifeEntry = {
  id: string
  rawId: number
  kind: LifeKind
  title: string
  description: string
  date: string
  images: string[]
  eyebrow: string
}

export default function LifeHub() {
  const params = new URLSearchParams(window.location.search)
  const requestedKind = params.get('type') as LifeKind | null
  const requestedId = Number(params.get('id'))
  const returnFilter = params.get('from')
  const initialFilter = params.get('filter')
  const [entries, setEntries] = useState<LifeEntry[]>([])
  const [filter, setFilter] = useState<'all' | LifeKind>(
    initialFilter === 'figure' || initialFilter === 'travel' || initialFilter === 'note' ? initialFilter : 'all',
  )
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([listFigures(), listTravels(), listNotes()])
      .then(([figureData, travelData, noteData]) => {
        const figures = figureData.figures.map((item: Figure): LifeEntry => ({
          id: 'figure-' + item.id, rawId: item.id, kind: 'figure', title: item.name,
          description: item.description, date: item.date, images: item.images, eyebrow: item.brand || '模型收藏',
        }))
        const travels = travelData.travels.map((item: Travel): LifeEntry => ({
          id: 'travel-' + item.id, rawId: item.id, kind: 'travel', title: item.title,
          description: item.description, date: item.date, images: item.images, eyebrow: item.location || '旅行记录',
        }))
        const notes = noteData.notes.map((item: Note): LifeEntry => ({
          id: 'note-' + item.id, rawId: item.id, kind: 'note', title: item.title,
          description: item.description, date: item.date, images: item.images, eyebrow: item.scene || '生活随笔',
        }))
        setEntries([...figures, ...travels, ...notes].sort((a, b) => b.date.localeCompare(a.date)))
      })
      .finally(() => setLoading(false))
  }, [])

  const requested = requestedKind && requestedId
    ? entries.find((entry) => entry.kind === requestedKind && entry.rawId === requestedId)
    : null
  const visible = useMemo(
    () => filter === 'all' ? entries : entries.filter((entry) => entry.kind === filter),
    [entries, filter],
  )

  if (requestedKind && requestedId) return <App><LifeDetail entry={requested || null} loading={loading} returnFilter={returnFilter} /></App>

  return (
    <App>
      <main className="hub-page">
        <header className="hub-hero life-hero">
          <a href="/" className="hub-back">← LongTeng.</a>
          <p>/ LIFE ARCHIVE</p>
          <h1>生活分享<span>。</span></h1>
          <div className="hub-hero-copy"><p>旅行、模型和零碎日常。技术之外，也认真收藏生活。</p><strong>{entries.length || '—'} 个片段</strong></div>
        </header>
        <div className="hub-toolbar" role="group" aria-label="生活内容筛选">
          {[['all', '全部'], ['figure', '模型收藏'], ['travel', '旅行'], ['note', '生活随笔']].map(([value, label]) => (
            <button key={value} onClick={() => setFilter(value as typeof filter)} className={filter === value ? 'active' : ''}>{label}</button>
          ))}
          {isAdmin() && <div className="ml-auto flex gap-4 text-xs"><a href="/figures.html">管理模型</a><a href="/travel.html">管理旅行</a><a href="/notes.html">管理随笔</a></div>}
        </div>
        {loading && <p className="hub-empty">正在整理生活片段…</p>}
        {!loading && visible.length === 0 && <p className="hub-empty">这个分类暂时还没有内容。</p>}
        <section className="life-grid">
          {visible.map((entry, index) => (
            <a key={entry.id} href={'/life.html?type=' + entry.kind + '&id=' + entry.rawId + '&from=' + filter} className={['life-card', index === 0 ? 'featured' : '', 'focus-ring'].join(' ')}>
              <div className="life-media">
                {entry.images[0] ? <img src={entry.images[0]} alt="" loading="lazy" /> : <div className={['life-placeholder', entry.kind].join(' ')}><span>{entry.kind === 'figure' ? 'COLLECT' : entry.kind === 'travel' ? 'JOURNEY' : 'MOMENT'}</span></div>}
              </div>
              <div className="life-card-copy"><div><span>{entry.eyebrow}</span><time>{entry.date}</time></div><h2>{entry.title}</h2><p>{entry.description.slice(0, 110)}</p></div>
            </a>
          ))}
        </section>
      </main>
    </App>
  )
}

function LifeDetail({ entry, loading, returnFilter }: { entry: LifeEntry | null; loading: boolean; returnFilter: string | null }) {
  const backHref = returnFilter === 'figure' || returnFilter === 'travel' || returnFilter === 'note' ? '/life.html?filter=' + returnFilter : '/life.html'
  if (loading) return <main className="hub-page"><p className="hub-empty">正在打开生活片段…</p></main>
  if (!entry) return <main className="hub-page"><a href={backHref} className="hub-back">← 返回生活分享</a><p className="hub-empty">没有找到这条内容。</p></main>
  return (
    <main className="hub-page reading-page life-reading">
      <a href={backHref} className="hub-back">← 返回生活分享</a>
      <header className="reading-header">
        <span className="kind-pill">{entry.eyebrow}</span><h1>{entry.title}</h1>
        <div><time>{entry.date}</time><span>{entry.kind === 'figure' ? '模型收藏' : entry.kind === 'travel' ? '旅行记录' : '生活随笔'}</span></div>
      </header>
      {entry.images.length > 0 && <div className="life-detail-images">{entry.images.map((src, index) => <img key={src} src={src} alt={entry.title + ' ' + (index + 1)} loading={index === 0 ? 'eager' : 'lazy'} />)}</div>}
      <article className="reading-body"><ReactMarkdown remarkPlugins={[remarkGfm]}>{entry.description}</ReactMarkdown></article>
    </main>
  )
}

