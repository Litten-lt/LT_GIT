type Identity = {
  emoji: string
  title: string
  desc: string
  tags: string[]
}

const identities: Identity[] = [
  {
    emoji: '🔧',
    title: '嵌入式软件工程师',
    desc: '从 UI 到内核驱动,WiFi 产品全栈。日常 C / Lua / Shell,让路由器乖乖听话。',
    tags: ['C', 'Lua', 'OpenWrt', 'WiFi', 'Linux'],
  },
  {
    emoji: '🤖',
    title: 'AI 玩家',
    desc: '把 LLM 当瑞士军刀,工作流里到处塞。正在研究怎么让 AI 帮我写更多代码。',
    tags: ['LLM', 'Prompt', 'RAG', 'Agent'],
  },
  {
    emoji: '🎨',
    title: 'Blender 学习者',
    desc: '为了做手办入了坑。建模 / 材质 / 渲染一路踩,希望有一天能 3D 打印出实物。',
    tags: ['Blender', '3D', '建模', '打印'],
  },
  {
    emoji: '🌸',
    title: '二次元玩家',
    desc: 'ACG 文化重度使用者。手办太贵 → 自己做,这条路通向自由。',
    tags: ['Anime', '手办', 'Gal', 'Moe'],
  },
  {
    emoji: '🎲',
    title: '桌游 / 卡牌爱好者',
    desc: '游戏王出身。Hybrid 实体卡 + 数字 Hub 是我的下一个野心。',
    tags: ['游戏王', 'TCG', 'OCG', 'Hybrid'],
  },
  {
    emoji: '⌨️',
    title: '折腾者',
    desc: '机械键盘 / 客制化 / Linux 桌面 / NAS,能折腾的绝不将就。',
    tags: ['客制化键盘', 'NAS', '自部署'],
  },
]

export default function Identity() {
  return (
    <section id="identity" className="relative py-24 lg:py-32 bg-bg-soft/40">
      <div className="max-w-6xl mx-auto px-6 lg:px-10">
        {/* 标题区 */}
        <div className="max-w-2xl mb-16">
          <p className="text-xs font-mono text-accent mb-4 tracking-widest">/ 02 · IDENTITY</p>
          <h2 className="text-4xl md:text-5xl font-extrabold text-ink leading-tight dot-accent">
            我是什么
          </h2>
          <p className="mt-5 text-ink-soft text-lg leading-relaxed">
            不是单一标签。白天是工程师,晚上是玩家。
            几个身份叠在一起,才是完整的我。
          </p>
        </div>

        {/* 卡片网格 */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {identities.map((it) => (
            <div key={it.title} className="tag-card">
              <div className="tag-icon-wrap">{it.emoji}</div>
              <h3 className="text-lg font-bold text-ink mb-2">{it.title}</h3>
              <p className="text-sm text-ink-soft leading-relaxed mb-4">{it.desc}</p>
              <div className="flex flex-wrap gap-1.5">
                {it.tags.map((t) => (
                  <span key={t} className="chip">{t}</span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}