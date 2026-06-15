import App from '../App'

type Trip = {
  date: string
  title: string
  location: string
  note: string
  cover?: string
  photos?: string[]
}

const trips: Trip[] = [
  {
    date: '2025.10',
    title: '示例旅行 · 大理',
    location: '云南 · 大理',
    note: '苍山洱海,风很慢。点进来这条等之后你写入真实旅行记录时会被替换。',
  },
  {
    date: '2025.05',
    title: '示例旅行 · 长沙',
    location: '湖南 · 长沙',
    note: '喝茶颜、嗦粉、爬岳麓山,夏天就该这么过。',
  },
]

export default function Travel() {
  return (
    <App current="travel">
      <div className="max-w-3xl mx-auto px-6 pt-16 pb-24">
        <div className="text-center mb-16">
          <p className="text-xs font-mono text-ink-soft/60 mb-4">/ TRAVEL</p>
          <h1 className="text-4xl md:text-5xl font-extrabold text-ink">
            去过的地方<span className="text-accent">.</span>
          </h1>
          <p className="mt-4 text-ink-soft">
            把走过的路慢慢记下来。
          </p>
        </div>

        {trips.length === 0 ? (
          <div className="text-center py-20 text-ink-soft/60">
            还没有记录,先出发吧。
          </div>
        ) : (
          <div className="space-y-12">
            {trips.map((t, i) => (
              <article
                key={i}
                className="border-l-2 border-ink/10 pl-6 hover:border-accent transition-colors"
              >
                <div className="text-xs font-mono text-ink-soft/60 mb-2">{t.date}</div>
                <h2 className="text-2xl font-bold text-ink mb-1">{t.title}</h2>
                <div className="text-sm text-ink-soft mb-3">📍 {t.location}</div>
                <p className="text-ink-soft leading-relaxed">{t.note}</p>

                {/* 照片占位 */}
                {t.photos && t.photos.length > 0 && (
                  <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {t.photos.map((p, j) => (
                      <div
                        key={j}
                        className="aspect-square bg-bg-soft rounded-lg border border-ink/5"
                      />
                    ))}
                  </div>
                )}
                {!t.photos && (
                  <div className="mt-4 text-xs font-mono text-ink-soft/40">
                    // 照片区,等添加图片
                  </div>
                )}
              </article>
            ))}
          </div>
        )}

        <div className="mt-16 text-center text-xs font-mono text-ink-soft/40">
          // 持续更新中
        </div>
      </div>
    </App>
  )
}