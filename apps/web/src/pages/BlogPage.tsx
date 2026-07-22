import App from '../App'

type Post = {
  date: string
  title: string
  excerpt?: string
  href?: string
}

const posts: Post[] = [
  {
    date: '2026.06',
    title: '搭建了个人主页',
    excerpt: '把个人网站重新设计成米色简约风。先放骨架，内容慢慢加。',
  },
]

export default function Blog() {
  return (
    <App current="blog">
      <div className="max-w-3xl mx-auto px-6 pt-16 pb-24">
        <div className="text-center mb-16">
          <p className="text-xs font-mono text-ink-soft/60 mb-4">/ BLOG</p>
          <h1 className="text-4xl md:text-5xl font-extrabold text-ink">
            成长记录<span className="text-accent">.</span>
          </h1>
          <p className="mt-4 text-ink-soft">
            工作笔记、折腾事、生活切片。
          </p>
        </div>

        {posts.length === 0 ? (
          <div className="text-center py-20 text-ink-soft/60">
            还没有文章,先写第一篇吧。
          </div>
        ) : (
          <div className="divide-y divide-ink/8 border-y border-ink/8">
            {posts.map((p, i) => (
              <a
                key={i}
                href={p.href || '#'}
                className="block py-6 group hover:bg-bg-soft/30 -mx-2 px-2 rounded transition"
              >
                <div className="flex items-baseline justify-between gap-4">
                  <h2 className="text-xl font-semibold text-ink group-hover:text-accent transition">
                    {p.title}
                  </h2>
                  <span className="text-xs font-mono text-ink-soft/60 shrink-0">
                    {p.date}
                  </span>
                </div>
                {p.excerpt && (
                  <p className="mt-2 text-sm text-ink-soft leading-relaxed">
                    {p.excerpt}
                  </p>
                )}
              </a>
            ))}
          </div>
        )}

        <div className="mt-16 text-center text-xs font-mono text-ink-soft/40">
          // 等你写
        </div>
      </div>
    </App>
  )
}
