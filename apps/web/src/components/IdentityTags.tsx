type Identity = {
  emoji: string
  title: string
  desc: string
  tags: string[]
  variant?: 'pink' | 'purple' | 'cyan'
}

const identities: Identity[] = [
  {
    emoji: '🔧',
    title: '嵌入式软件工程师',
    desc: '从 UI 到内核驱动，WiFi 产品全栈。日常 C / Lua / Shell，让路由器乖乖听话。',
    tags: ['C', 'Lua', 'OpenWrt', 'WiFi', 'Linux'],
    variant: 'cyan',
  },
  {
    emoji: '🤖',
    title: 'AI 玩家',
    desc: '把 LLM 当瑞士军刀，工作流里到处塞。正在研究怎么让 AI 帮我写更多代码。',
    tags: ['LLM', 'Prompt', 'RAG', 'Agent'],
    variant: 'purple',
  },
  {
    emoji: '🎨',
    title: 'Blender 学习者',
    desc: '为了做手办入了坑。建模 / 材质 / 渲染一路踩，希望有一天能 3D 打印出实物。',
    tags: ['Blender', '3D', '建模', '打印'],
    variant: 'pink',
  },
  {
    emoji: '🌸',
    title: '二次元玩家',
    desc: 'ACG 文化重度使用者。手办太贵 → 自己做，这条路通向自由。',
    tags: ['Anime', '手办', 'Gal', 'Moe'],
    variant: 'pink',
  },
  {
    emoji: '🎲',
    title: '桌游 / 卡牌爱好者',
    desc: '游戏王出身。Hybrid 实体卡 + 数字 Hub 是我的下一个野心。',
    tags: ['游戏王', 'TCG', 'OCG', 'Hybrid'],
    variant: 'cyan',
  },
  {
    emoji: '⌨️',
    title: '折腾者',
    desc: '机械键盘 / 客制化 / Linux 桌面 / NAS，能折腾的绝不将就。',
    tags: ['客制化键盘', 'NAS', '自部署'],
    variant: 'purple',
  },
]

const variantClass = {
  cyan: 'chip',
  purple: 'chip chip-purple',
  pink: 'chip chip-pink',
}

export default function IdentityTags() {
  return (
    <section className="relative max-w-6xl mx-auto px-6 py-16">
      <div className="flex items-center gap-3 mb-8">
        <span className="text-cyber-accent font-mono text-sm">02 /</span>
        <h2 className="text-3xl md:text-4xl font-bold">我是什么</h2>
        <div className="flex-1 h-px bg-gradient-to-r from-cyber-accent/30 to-transparent ml-2" />
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {identities.map((it) => (
          <div
            key={it.title}
            className="glass rounded-2xl p-6 hover:translate-y-[-2px] transition-transform"
          >
            <div className="text-4xl mb-3">{it.emoji}</div>
            <h3 className="text-xl font-bold mb-2 text-slate-100">{it.title}</h3>
            <p className="text-sm text-slate-300/80 leading-relaxed mb-4">{it.desc}</p>
            <div className="flex flex-wrap gap-2">
              {it.tags.map((t) => (
                <span key={t} className={variantClass[it.variant || 'cyan']}>
                  {t}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}