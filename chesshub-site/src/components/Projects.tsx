type Project = {
  name: string
  emoji: string
  desc: string
  year: string
  stack: string[]
  href: string
  status: 'live' | 'wip' | 'soon'
}

const projects: Project[] = [
  {
    name: 'Gobang 五子棋',
    emoji: '⚫',
    desc: '联机对战五子棋,Socket.io 实时通信,支持房间码邀请对战。',
    year: '2024',
    stack: ['React', 'TS', 'Socket.io'],
    href: '/gobang/',
    status: 'live',
  },
  {
    name: 'ChessHub 卡牌 Hub',
    emoji: '🃏',
    desc: 'Hybrid 实体卡 + Web 数字 Hub。游戏王风格对战平台(规划中)。',
    year: '2026',
    stack: ['Vue/React', 'WebSocket', 'OCR'],
    href: '#',
    status: 'wip',
  },
  {
    name: 'WiFi 工具箱',
    emoji: '📡',
    desc: '工作中沉淀的 OpenWrt / WiFi 调试脚本合集。',
    year: '2025',
    stack: ['Shell', 'Lua', 'C'],
    href: '#',
    status: 'soon',
  },
]

const statusMap = {
  live: { label: '已上线', color: 'text-emerald-600' },
  wip: { label: '开发中', color: 'text-accent' },
  soon: { label: '即将', color: 'text-ink-soft/60' },
}

export default function Projects() {
  return (
    <section id="projects" className="relative py-24 lg:py-32">
      <div className="max-w-6xl mx-auto px-6 lg:px-10">
        <div className="max-w-2xl mb-16">
          <p className="text-xs font-mono text-accent mb-4 tracking-widest">/ 03 · PROJECTS</p>
          <h2 className="text-4xl md:text-5xl font-extrabold text-ink leading-tight dot-accent">
            在做的东西
          </h2>
          <p className="mt-5 text-ink-soft text-lg leading-relaxed">
            业余时间的小玩意儿,不一定完美但都在用。
          </p>
        </div>

        <div className="divide-y divide-ink/8 border-y border-ink/8">
          {projects.map((p, i) => {
            const s = statusMap[p.status]
            return (
              <a
                key={p.name}
                href={p.href}
                className="group grid grid-cols-[auto_1fr_auto] items-center gap-6 py-7 px-2 -mx-2 rounded-lg hover:bg-bg-soft/40 transition lift"
              >
                {/* 编号 + emoji */}
                <div className="flex items-center gap-5">
                  <span className="font-mono text-xs text-ink-soft/50 w-6">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <span className="text-3xl">{p.emoji}</span>
                </div>

                {/* 中间内容 */}
                <div>
                  <div className="flex items-baseline gap-3 flex-wrap">
                    <h3 className="text-xl md:text-2xl font-bold text-ink group-hover:text-accent transition">
                      {p.name}
                    </h3>
                    <span className={`text-xs font-semibold ${s.color}`}>· {s.label}</span>
                  </div>
                  <p className="mt-1 text-ink-soft text-sm md:text-base max-w-2xl">
                    {p.desc}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-soft/70">
                    {p.stack.map((t) => (
                      <span key={t} className="font-mono">{t}</span>
                    ))}
                  </div>
                </div>

                {/* 右侧年份 + 箭头 */}
                <div className="hidden md:flex items-center gap-4">
                  <span className="font-mono text-sm text-ink-soft/60">{p.year}</span>
                  <span className="text-ink-soft/30 group-hover:text-accent group-hover:translate-x-1 transition">
                    →
                  </span>
                </div>
              </a>
            )
          })}
        </div>
      </div>
    </section>
  )
}