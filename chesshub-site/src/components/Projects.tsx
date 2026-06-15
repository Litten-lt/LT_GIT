type Project = {
  name: string
  emoji: string
  desc: string
  stack: string[]
  href: string
  status: 'live' | 'wip' | 'soon'
}

const projects: Project[] = [
  {
    name: 'Gobang 五子棋',
    emoji: '⚫',
    desc: '联机对战五子棋，Socket.io 实时通信，支持房间码邀请对战。',
    stack: ['React', 'TS', 'Socket.io', 'Vite'],
    href: '/gobang/',
    status: 'live',
  },
  {
    name: 'ChessHub 卡牌 Hub',
    emoji: '🃏',
    desc: 'Hybrid 实体卡 + Web 数字 Hub。游戏王风格对战平台（规划中）。',
    stack: ['Vue/React', 'WebSocket', 'OCR'],
    href: '#',
    status: 'wip',
  },
  {
    name: 'WiFi 工具箱',
    emoji: '📡',
    desc: '工作中沉淀的 OpenWrt / WiFi 调试脚本合集。',
    stack: ['Shell', 'Lua', 'C'],
    href: '#',
    status: 'soon',
  },
]

const statusMap = {
  live: { text: 'LIVE', color: 'bg-emerald-400/20 text-emerald-300 border-emerald-400/30' },
  wip: { text: 'WIP', color: 'bg-cyber-accent/20 text-cyber-accent border-cyber-accent/30' },
  soon: { text: 'SOON', color: 'bg-slate-400/10 text-slate-400 border-slate-400/30' },
}

export default function Projects() {
  return (
    <section id="projects" className="relative max-w-6xl mx-auto px-6 py-16">
      <div className="flex items-center gap-3 mb-8">
        <span className="text-cyber-pink font-mono text-sm">03 /</span>
        <h2 className="text-3xl md:text-4xl font-bold">在做的东西</h2>
        <div className="flex-1 h-px bg-gradient-to-r from-cyber-pink/30 to-transparent ml-2" />
      </div>

      <div className="grid md:grid-cols-3 gap-5">
        {projects.map((p) => {
          const s = statusMap[p.status]
          const isLive = p.status === 'live'
          return (
            <a
              key={p.name}
              href={p.href}
              target={isLive ? '_self' : '_self'}
              className="glass rounded-2xl p-6 block hover:border-cyber-accent/40 transition group"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="text-4xl">{p.emoji}</div>
                <span
                  className={`text-[10px] font-mono px-2 py-1 rounded border ${s.color}`}
                >
                  {s.text}
                </span>
              </div>
              <h3 className="text-lg font-bold mb-2 group-hover:text-cyber-accent transition">
                {p.name}
              </h3>
              <p className="text-sm text-slate-300/80 leading-relaxed mb-4">{p.desc}</p>
              <div className="flex flex-wrap gap-1.5">
                {p.stack.map((t) => (
                  <span
                    key={t}
                    className="text-[11px] font-mono text-slate-400 px-2 py-0.5 rounded bg-white/5 border border-white/5"
                  >
                    {t}
                  </span>
                ))}
              </div>
            </a>
          )
        })}
      </div>

      <p className="mt-6 text-xs text-slate-500 font-mono text-center">
        // 更多项目正在搬过来，先把架子搭好
      </p>
    </section>
  )
}