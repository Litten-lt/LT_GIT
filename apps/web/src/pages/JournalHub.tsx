import { useEffect, useMemo, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import App from '../App'
import { getStudy, getWork, listStudies, listWorks, type Study, type Work } from '../api'
import { isAdmin } from '../auth'
import ReadingProgress from '../components/ReadingProgress'

type Entry = {
  id: string
  rawId: number
  kind: 'work' | 'study'
  title: string
  description?: string
  date: string
  updated: number
  noteCount: number
}

type Detail = { kind: 'work'; item: Work } | { kind: 'study'; item: Study }

export default function JournalHub() {
  const params = new URLSearchParams(window.location.search)
  const requestedKind = params.get('type') as 'work' | 'study' | null
  const requestedId = Number(params.get('id'))
  const returnFilter = params.get('from')
  const initialFilter = params.get('filter')
  const [entries, setEntries] = useState<Entry[]>([])
  const [filter, setFilter] = useState<'all' | 'work' | 'study'>(
    initialFilter === 'work' || initialFilter === 'study' ? initialFilter : 'all',
  )
  const [detail, setDetail] = useState<Detail | null>(null)
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')

  useEffect(() => {
    if (requestedKind && requestedId) {
      const loader = requestedKind === 'work' ? getWork(requestedId) : getStudy(requestedId)
      loader
        .then((data) => {
          if (requestedKind === 'work' && 'work' in data) setDetail({ kind: 'work', item: data.work })
          if (requestedKind === 'study' && 'study' in data) setDetail({ kind: 'study', item: data.study })
        })
        .finally(() => setLoading(false))
      return
    }

    Promise.all([listWorks(), listStudies()])
      .then(([workData, studyData]) => {
        const works = workData.works.map((item): Entry => ({
          id: 'work-' + item.id, rawId: item.id, kind: 'work', title: item.title,
          description: item.description, date: item.date, updated: item.updated_at, noteCount: item.note_count,
        }))
        const studies = studyData.studies.map((item): Entry => ({
          id: 'study-' + item.id, rawId: item.id, kind: 'study', title: item.title,
          description: item.description, date: item.date, updated: item.updated_at, noteCount: item.note_count,
        }))
        setEntries([...works, ...studies].sort((a, b) => b.updated - a.updated))
      })
      .finally(() => setLoading(false))
  }, [])

  const visible = useMemo(() => {
    const keyword = query.trim().toLowerCase()
    return entries.filter((entry) => {
      const matchesFilter = filter === 'all' || entry.kind === filter
      const matchesQuery = !keyword || (entry.title + ' ' + (entry.description || '')).toLowerCase().includes(keyword)
      return matchesFilter && matchesQuery
    })
  }, [entries, filter, query])

  if (requestedKind && requestedId) {
    return <App><JournalDetail detail={detail} loading={loading} returnFilter={returnFilter} /></App>
  }

  return (
    <App>
      <main className="hub-page">
        <header className="hub-hero">
          <a href="/" className="hub-back">← LongTeng.</a>
          <p>/ FIELD NOTES</p>
          <h1>工作与学习<span>。</span></h1>
          <div className="hub-hero-copy">
            <p>把调试现场、项目复盘和学习过程放进同一条专业时间线。</p>
            <strong>{entries.length || '—'} 篇记录</strong>
          </div>
        </header>

        <div className="hub-toolbar" role="group" aria-label="内容筛选">
          {[['all', '全部'], ['work', '调试与项目'], ['study', '学习与原理']].map(([value, label]) => (
            <button key={value} onClick={() => setFilter(value as typeof filter)} className={filter === value ? 'active' : ''}>{label}</button>
          ))}
          {isAdmin() && (
            <div className="ml-auto flex gap-4 text-xs">
              <a href="/work.html">管理工作</a><a href="/study.html">管理学习</a>
            </div>
          )}
        </div>

<label className="hub-search">
          <span>搜索</span>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索标题或摘要…" />
          {query && <button onClick={() => setQuery('')} aria-label="清除搜索">×</button>}
        </label>

        <section className="journal-list">
          {loading && <p className="hub-empty">正在整理记录…</p>}
          {!loading && visible.length === 0 && <p className="hub-empty">这个分类暂时还没有内容。</p>}
          {visible.map((entry, index) => (
            <a key={entry.id} href={'/journal.html?type=' + entry.kind + '&id=' + entry.rawId + '&from=' + filter} className="journal-row focus-ring">
              <span className="journal-number">{String(index + 1).padStart(2, '0')}</span>
              <div>
                <span className={['kind-pill', entry.kind].join(' ')}>{entry.kind === 'work' ? 'FIELD / WORK' : 'LEARN / STUDY'}</span>
                <h2>{entry.title}</h2>
                {entry.description && <p>{entry.description.slice(0, 130)}</p>}
              </div>
              <div className="journal-meta"><span>{entry.date}</span><span>{entry.noteCount} 条记录</span><b>↗</b></div>
            </a>
          ))}
        </section>
      </main>
    </App>
  )
}

function JournalDetail({ detail, loading, returnFilter }: { detail: Detail | null; loading: boolean; returnFilter: string | null }) {
  const backHref = returnFilter === 'work' || returnFilter === 'study' ? '/journal.html?filter=' + returnFilter : '/journal.html'
  if (loading) return <main className="hub-page"><p className="hub-empty">正在打开记录…</p></main>
  if (!detail) return <main className="hub-page"><a href={backHref} className="hub-back">← 返回工作与学习</a><p className="hub-empty">没有找到这条记录。</p></main>

  const item = detail.item
  return (
    <main className="hub-page reading-page">
      <ReadingProgress />
      <a href={backHref} className="hub-back">← 返回工作与学习</a>
      <header className="reading-header">
        <span className={['kind-pill', detail.kind].join(' ')}>{detail.kind === 'work' ? 'FIELD / WORK' : 'LEARN / STUDY'}</span>
        <h1>{item.title}</h1>
        <div><time>{item.date}</time><span>{item.note_count} 条过程记录</span></div>
      </header>
      {item.description && <article className="reading-body"><ReactMarkdown remarkPlugins={[remarkGfm]}>{item.description}</ReactMarkdown></article>}
      <section className="reading-notes">
        {item.notes?.map((note, index) => (
          <article key={note.id} className="reading-note">
            <div><span>{String(index + 1).padStart(2, '0')}</span><time>{new Date(note.created_at < 1_000_000_000_000 ? note.created_at * 1000 : note.created_at).toLocaleDateString('zh-CN')}</time></div>
            {note.content && <div className="reading-body"><ReactMarkdown remarkPlugins={[remarkGfm]}>{note.content}</ReactMarkdown></div>}
            {'images' in note && note.images?.length > 0 && (
              <div className="reading-images">{note.images.map((src) => <img key={src} src={src} alt="" loading="lazy" />)}</div>
            )}
          </article>
        ))}
      </section>
    </main>
  )
}


