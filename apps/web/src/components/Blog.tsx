type EntranceCard = {
  date: string
  title: string
  category: string
  href: string
  bg: string
  emoji: string
}

const entranceCards: EntranceCard[] = [
  {
    date: '2026.06',
    title: '模型手办',
    category: '收藏',
    href: '/figures/',
    bg: 'linear-gradient(135deg, #4a5b6a 0%, #2b3a4a 100%)',
    emoji: '🗡️',
  },
  {
    date: '2026.06',
    title: '调试笔记',
    category: '工作',
    href: '/work/',
    bg: 'linear-gradient(135deg, #b89c7a 0%, #8a7560 100%)',
    emoji: '🔧',
  },
  {
    date: '2026.06',
    title: '生活随笔',
    category: '生活',
    href: '/travel/',
    bg: 'linear-gradient(135deg, #6a8a6a 0%, #4a6a4a 100%)',
    emoji: '🏔️',
  },
  {
    date: '2026.07',
    title: '学习笔记',
    category: '技能',
    href: '/study/',
    bg: 'linear-gradient(135deg, #7a6a9a 0%, #5a4a7a 100%)',
    emoji: '📚',
  },
]

export default function Blog() {
  return (
    <section id="blog">
      <div className="text-center mb-10">
        <p className="text-xs font-mono text-accent mb-3 tracking-widest">/ BLOG</p>
        <h2 className="text-3xl md:text-4xl font-extrabold text-ink">
          博客<span className="text-accent">.</span>
        </h2>
        <p className="mt-3 text-ink-soft">收藏 · 工作 · 生活 · 技能</p>
      </div>

      <div className="grid sm:grid-cols-2 md:grid-cols-2 gap-4 max-w-2xl mx-auto">
        {entranceCards.map((c) => (
          <a
            key={c.href}
            href={c.href}
            className="group relative aspect-square rounded-2xl overflow-hidden block lift"
          >
            <div className="absolute inset-0" style={{ background: c.bg }} />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
            <div className="absolute top-3 left-3">
              <span className="text-xs px-2.5 py-1 rounded bg-amber-200/80 text-slate-800 font-medium">
                {c.category}
              </span>
            </div>
            <div className="absolute inset-0 flex items-center justify-center text-6xl opacity-20 group-hover:opacity-30 transition">
              {c.emoji}
            </div>
            <div className="absolute bottom-4 left-4 right-4 text-white">
              <h3 className="text-base font-bold leading-snug drop-shadow">{c.title}</h3>
            </div>
          </a>
        ))}
      </div>
    </section>
  )
}
