import { useEffect, useMemo, useState } from 'react'
import App from '../App'
import { listFigures, listNotes, listStudies, listTravels, listWorks } from '../api'
import { ensureLoggedIn, isAdmin } from '../auth'

type Section = {
  key: string; eyebrow: string; title: string; description: string
  href: string; newHref: string; publicHref: string; count: number
  recent: string[]; tone: string
}

export default function AdminDashboard() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [counts, setCounts] = useState([0, 0, 0, 0, 0])
  const [recent, setRecent] = useState<string[][]>([[], [], [], [], []])

  useEffect(() => {
    if (!ensureLoggedIn()) return
    if (!isAdmin()) { window.location.replace('/'); return }
    Promise.all([listWorks(), listStudies(), listFigures(), listTravels(), listNotes()])
      .then(([works, studies, figures, travels, notes]) => {
        const groups = [works.works, studies.studies, figures.figures, travels.travels, notes.notes]
        setCounts(groups.map((items) => items.length))
        setRecent([
          works.works.slice(0, 3).map((item) => item.title),
          studies.studies.slice(0, 3).map((item) => item.title),
          figures.figures.slice(0, 3).map((item) => item.name),
          travels.travels.slice(0, 3).map((item) => item.title),
          notes.notes.slice(0, 3).map((item) => item.title),
        ])
      })
      .catch((reason) => setError(reason.message || '读取内容失败'))
      .finally(() => setLoading(false))
  }, [])

  const sections = useMemo<Section[]>(() => [
    { key: 'work', eyebrow: 'FIELD NOTES', title: '工作记录', description: '问题、调试过程与工程结论。', href: '/work.html', newHref: '/work.html?new=1', publicHref: '/journal.html?filter=work', count: counts[0], recent: recent[0], tone: 'dashboard-rust' },
    { key: 'study', eyebrow: 'KNOWLEDGE', title: '学习笔记', description: '原理、方法和长期知识沉淀。', href: '/study.html', newHref: '/study.html?new=1', publicHref: '/journal.html?filter=study', count: counts[1], recent: recent[1], tone: 'dashboard-olive' },
    { key: 'figure', eyebrow: 'COLLECTION', title: '模型手办', description: '收藏档案、照片与入手心得。', href: '/figures.html', newHref: '/figures.html?new=1', publicHref: '/life.html?filter=figure', count: counts[2], recent: recent[2], tone: 'dashboard-plum' },
    { key: 'travel', eyebrow: 'JOURNEY', title: '旅行记录', description: '地点、见闻与途中影像。', href: '/travel.html', newHref: '/travel.html?new=1', publicHref: '/life.html?filter=travel', count: counts[3], recent: recent[3], tone: 'dashboard-sand' },
    { key: 'note', eyebrow: 'DAILY LIFE', title: '生活随笔', description: '日常片段、想法和随手拍。', href: '/notes.html', newHref: '/notes.html?new=1', publicHref: '/life.html?filter=note', count: counts[4], recent: recent[4], tone: 'dashboard-blue' },
  ], [counts, recent])
  const total = counts.reduce((sum, value) => sum + value, 0)

  return (
    <App current="admin">
      <div className="admin-dashboard">
        <section className="dashboard-hero">
          <div><p>/ CONTENT STUDIO</p><h1>管理中心<span>。</span></h1><p className="dashboard-lead">从一个地方维护工作学习与生活分享。先选择内容类型，再进入对应编辑器。</p></div>
          <div className="dashboard-total"><strong>{loading ? '—' : total}</strong><span>全部内容</span></div>
        </section>
        {error && <p className="dashboard-error">{error}</p>}
        <section className="dashboard-grid" aria-busy={loading}>
          {sections.map((section) => (
            <article key={section.key} className={`dashboard-card ${section.tone}`}>
              <div className="dashboard-card-head"><p>{section.eyebrow}</p><strong>{loading ? '—' : String(section.count).padStart(2, '0')}</strong></div>
              <h2>{section.title}</h2><p className="dashboard-card-copy">{section.description}</p>
              <div className="dashboard-recent"><span>最近更新</span>{loading ? <p>正在读取…</p> : section.recent.length ? <ul>{section.recent.map((title) => <li key={title}>{title}</li>)}</ul> : <p>还没有内容</p>}</div>
              <div className="dashboard-actions"><a href={section.href}>管理内容</a><a href={section.newHref} className="primary">新建</a><a href={section.publicHref} className="quiet">查看前台 ↗</a></div>
            </article>
          ))}
        </section>
      </div>
    </App>
  )
}

