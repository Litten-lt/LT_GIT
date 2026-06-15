type ContactItem = {
  label: string
  value: string
  href: string
  copy?: boolean
  emoji: string
}

const contacts: ContactItem[] = [
  {
    label: 'GitHub',
    value: 'Litten-lt',
    href: 'https://github.com/Litten-lt',
    emoji: '🐙',
  },
  {
    label: 'Email',
    value: 'tenglong436@gmail.com',
    href: 'mailto:tenglong436@gmail.com',
    copy: true,
    emoji: '✉️',
  },
  {
    label: 'WeChat',
    value: 'LT2698752310',
    href: '#',
    copy: true,
    emoji: '💬',
  },
  {
    label: 'Server',
    value: 'chesshub.fun',
    href: 'https://chesshub.fun',
    emoji: '🌐',
  },
]

function copyToClipboard(text: string) {
  navigator.clipboard?.writeText(text).catch(() => {})
}

export default function Contact() {
  return (
    <section id="contact" className="relative max-w-6xl mx-auto px-6 py-16">
      <div className="flex items-center gap-3 mb-8">
        <span className="text-cyber-purple font-mono text-sm">04 /</span>
        <h2 className="text-3xl md:text-4xl font-bold">找我聊聊</h2>
        <div className="flex-1 h-px bg-gradient-to-r from-cyber-purple/30 to-transparent ml-2" />
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {contacts.map((c) => {
          const inner = (
            <>
              <div className="text-3xl mb-3">{c.emoji}</div>
              <div className="text-xs text-slate-400 font-mono uppercase tracking-wider">
                {c.label}
              </div>
              <div className="text-sm text-slate-100 mt-1 break-all font-mono">
                {c.value}
              </div>
              {c.copy && (
                <div className="text-[10px] text-cyber-accent/70 mt-2 font-mono">
                  // 点击复制
                </div>
              )}
            </>
          )

          if (c.copy) {
            return (
              <button
                key={c.label}
                onClick={() => copyToClipboard(c.value)}
                className="glass rounded-2xl p-5 text-left hover:border-cyber-accent/40 transition"
              >
                {inner}
              </button>
            )
          }
          return (
            <a
              key={c.label}
              href={c.href}
              target="_blank"
              rel="noreferrer"
              className="glass rounded-2xl p-5 block hover:border-cyber-accent/40 transition"
            >
              {inner}
            </a>
          )
        })}
      </div>

      <div className="mt-10 glass rounded-2xl p-6 text-center">
        <p className="text-slate-300">
          想聊 <span className="text-cyber-accent">嵌入式 / AI / Blender / 卡牌</span>？
          <br />
          或者只是想吐槽一下工作？欢迎随时联系 ✨
        </p>
      </div>
    </section>
  )
}