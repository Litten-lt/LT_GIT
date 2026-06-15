type Post = {
  date: string
  title: string
  category: string
  href?: string
  bg: string
  external?: boolean
}

const posts: Post[] = [
  {
    date: '2026.06',
    title: '搭建了个人主页',
    category: '笔记',
    bg: 'linear-gradient(135deg, #c58582 0%, #b87a8a 100%)',
  },
  {
    date: '2026.05',
    title: 'Blender 学习 30 天',
    category: '学习',
    bg: 'linear-gradient(135deg, #9d8090 0%, #7a5d6a 100%)',
  },
  {
    date: '2026.04',
    title: 'OpenWrt 调试踩坑',
    category: '工作',
    bg: 'linear-gradient(135deg, #b89c7a 0%, #8a7560 100%)',
  },
]

const figureCard = {
  date: '2026.06',
  title: '模型手办',
  category: '收藏',
  href: '/figures/',
  bg: 'linear-gradient(135deg, #4a5b6a 0%, #2b3a4a 100%)',
}

export default function Blog() {
  return (
    <section id="blog">
      <div className="text-center mb-10">
        <p className="text-xs font-mono text-accent mb-3 tracking-widest">/ BLOG</p>
        <h2 className="text-3xl md:text-4xl font-extrabold text-ink">
          博客<span className="text-accent">.</span>
        </h2>
        <p className="mt-3 text-ink-soft">成长记录 · 工作笔记 · 折腾事</p>
      </div>

      <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4">
        {posts.map((p) => (
          <a
            key={p.title}
            href="#"
            className="group relative aspect-square rounded-2xl overflow-hidden block lift"
          >
            <div className="absolute inset-0" style={{ background: p.bg }} />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
            <div className="absolute top-3 left-3">
              <span className="text-xs px-2.5 py-1 rounded bg-sky-200/80 text-slate-800 font-medium">
                {p.category}
              </span>
            </div>
            <div className="absolute bottom-4 left-4 right-4 text-white">
              <h3 className="text-base font-bold leading-snug drop-shadow">{p.title}</h3>
              <p className="mt-1 text-xs opacity-80 font-mono">{p.date}</p>
            </div>
          </a>
        ))}

        {/* 模型手办入口卡 */}
        <a
          href={figureCard.href}
          className="group relative aspect-square rounded-2xl overflow-hidden block lift"
        >
          <div className="absolute inset-0" style={{ background: figureCard.bg }} />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
          <div className="absolute top-3 left-3">
            <span className="text-xs px-2.5 py-1 rounded bg-amber-200/80 text-slate-800 font-medium">
              {figureCard.category}
            </span>
          </div>
          <div className="absolute inset-0 flex items-center justify-center text-6xl opacity-20 group-hover:opacity-30 transition">
            🗡️
          </div>
          <div className="absolute bottom-4 left-4 right-4 text-white">
            <h3 className="text-base font-bold leading-snug drop-shadow">{figureCard.title}</h3>
            <p className="mt-1 text-xs opacity-80 font-mono">
              {figureCard.date} · → 进入
            </p>
          </div>
        </a>
      </div>

      <div className="mt-6 text-center text-xs font-mono text-ink-soft/50">
        // 持续更新
      </div>
    </section>
  )
}