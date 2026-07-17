import { useEffect, useState } from 'react'
import { listStudies, listWorks, type Study, type Work } from '../api'

type ProjectCard = {
  index: string
  type: string
  title: string
  description: string
  meta: string
  href: string
  tone: string
}

const fallbackCards: ProjectCard[] = [
  {
    index: '01',
    type: 'PRODUCT ENGINEERING',
    title: 'WiFi / OpenWrt 产品开发',
    description: '围绕无线接入、网络配置与设备稳定性，持续打磨可落地、可维护的嵌入式产品能力。',
    meta: 'C · Lua · OpenWrt · Shell',
    href: '/work.html',
    tone: 'project-warm',
  },
  {
    index: '02',
    type: 'KNOWLEDGE SYSTEM',
    title: '工程学习与问题沉淀',
    description: '把调试记录、技术原理和实践经验整理成可检索的长期知识。',
    meta: 'Linux · Network · Notes',
    href: '/study.html',
    tone: 'project-olive',
  },
  {
    index: '03',
    type: 'PLAYGROUND',
    title: 'AI 与创意实验',
    description: '用 AI、Blender 和 Web 技术验证小想法，探索更具表达性的作品形态。',
    meta: 'AI · Blender · React',
    href: '/blog.html',
    tone: 'project-plum',
  },
]

function cleanDescription(value?: string) {
  if (!value) return '打开查看完整记录与过程。'
  return value.replace(/[#*_>\[\]]/g, '').replace(/\s+/g, ' ').trim().slice(0, 90)
}

function cardsFromContent(works: Work[], studies: Study[]): ProjectCard[] {
  const recentWorks = works.slice(0, 2).map((work, index): ProjectCard => ({
    index: String(index + 1).padStart(2, '0'),
    type: 'FIELD NOTE / WORK',
    title: work.title,
    description: cleanDescription(work.description),
    meta: work.note_count + ' 条过程记录 · ' + work.date,
    href: '/work.html?id=' + work.id,
    tone: index === 0 ? 'project-warm' : 'project-olive',
  }))
  const latestStudy = studies[0]
  if (latestStudy) {
    recentWorks.push({
      index: String(recentWorks.length + 1).padStart(2, '0'),
      type: 'LEARNING NOTE',
      title: latestStudy.title,
      description: cleanDescription(latestStudy.description),
      meta: latestStudy.note_count + ' 条学习记录 · ' + latestStudy.date,
      href: '/study.html?id=' + latestStudy.id,
      tone: 'project-plum',
    })
  }
  return recentWorks.length >= 2 ? recentWorks : fallbackCards
}

export default function FeaturedProjects() {
  const [cards, setCards] = useState<ProjectCard[]>(fallbackCards)
  const [usingLiveContent, setUsingLiveContent] = useState(false)

  useEffect(() => {
    let cancelled = false
    Promise.all([listWorks(), listStudies()])
      .then(([workData, studyData]) => {
        if (cancelled) return
        const next = cardsFromContent(workData.works, studyData.studies)
        setCards(next)
        setUsingLiveContent(next !== fallbackCards)
      })
      .catch(() => {
        // Keep the curated fallback so the homepage remains complete offline.
      })
    return () => { cancelled = true }
  }, [])

  return (
    <section id="projects" className="scroll-mt-24">
      <div className="section-heading">
        <div>
          <p>/ SELECTED WORK</p>
          <h2>最近在做什么<span>。</span></h2>
        </div>
        <p className="section-intro">
          {usingLiveContent
            ? '从工作记录与学习笔记中自动选出的最近内容，持续更新。'
            : '我更关心技术最终解决了什么问题，以及它能否被稳定使用和持续维护。'}
        </p>
      </div>

      <div className="project-showcase mt-12">
        {cards.slice(0, 3).map((project) => (
          <a key={project.type + project.index} href={project.href} className={['project-card', project.tone, 'focus-ring'].join(' ')}>
            <div className="flex items-start justify-between gap-4">
              <span className="font-mono text-xs tracking-widest opacity-70">{project.type}</span>
              <span className="font-serif text-3xl opacity-30">{project.index}</span>
            </div>
            <div className="mt-20">
              <h3>{project.title}</h3>
              <p>{project.description}</p>
              <div className="mt-6">
                <span>{project.meta}</span>
              </div>
            </div>
            <span className="project-arrow" aria-hidden="true">↗</span>
          </a>
        ))}
      </div>

    </section>
  )
}


