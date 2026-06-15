export default function Hero() {
  return (
    <section id="about" className="relative max-w-6xl mx-auto px-6 pt-12 pb-20">
      <div className="grid md:grid-cols-[1.4fr_1fr] gap-10 items-center">
        {/* 左：自我介绍 */}
        <div>
          <div className="inline-flex items-center gap-2 chip mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-cyber-accent animate-pulse" />
            <span>深圳 · 嵌入式软件工程师</span>
          </div>

          <h1 className="text-5xl md:text-7xl font-extrabold leading-[1.05] tracking-tight">
            <span className="text-gradient">LongTeng</span>
            <br />
            <span className="text-slate-100">在造点有意思的</span>
            <span className="inline-block animate-float ml-2">⚡</span>
          </h1>

          <p className="mt-6 text-lg text-slate-300/90 leading-relaxed max-w-2xl">
            白天写 C / Lua 驱动 WiFi 产品，晚上切二次元折腾 Blender 和 AI。
            <br />
            相信 <span className="text-cyber-accent">硬核技术</span> 和{' '}
            <span className="text-cyber-pink">好玩的东西</span> 不该是反义词。
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-4">
            <a
              href="/gobang/"
              className="btn-glow px-6 py-3 rounded-xl font-semibold text-white shadow-lg"
            >
              玩五子棋 →
            </a>
            <a
              href="https://github.com/Litten-lt"
              target="_blank"
              rel="noreferrer"
              className="glass px-6 py-3 rounded-xl font-semibold text-slate-200 hover:text-cyber-accent transition"
            >
              GitHub 主页
            </a>
          </div>

          {/* 数据条 */}
          <div className="mt-10 grid grid-cols-3 gap-4 max-w-xl">
            <Stat label="主语言" value="C / TS" />
            <Stat label="在搞" value="Blender + AI" />
            <Stat label="常驻地" value="深圳" />
          </div>
        </div>

        {/* 右：角色立绘占位 */}
        <div className="relative">
          <div className="relative aspect-[3/4] rounded-3xl overflow-hidden glass">
            <div className="grid-bg absolute inset-0" />
            <div className="scanline" />
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-6">
              <div className="text-7xl mb-4 animate-float">🎮</div>
              <div className="text-cyber-accent font-mono text-sm tracking-widest">
                AVATAR_SLOT
              </div>
              <div className="text-slate-400 text-xs mt-2">
                把你的 Blender 渲染图<br />放到 public/avatar.png
              </div>
              <div className="mt-6 text-xs text-slate-500 font-mono">
                1024 × 1366 · PNG / JPG
              </div>
            </div>
            {/* 装饰角标 */}
            <div className="absolute top-3 left-3 text-xs font-mono text-cyber-accent/70">
              [ID] 0315
            </div>
            <div className="absolute bottom-3 right-3 text-xs font-mono text-cyber-pink/70">
              LV.∞
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="glass rounded-xl px-4 py-3">
      <div className="text-xs text-slate-400 font-mono">{label}</div>
      <div className="text-base font-semibold text-slate-100 mt-0.5">{value}</div>
    </div>
  )
}