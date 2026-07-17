export default function Hero() {
  return (
    <section id="about" className="relative pt-20 pb-32 lg:pt-28 lg:pb-40">
      <div className="max-w-6xl mx-auto px-6 lg:px-10">
        {/* 顶部小标签 */}
        <div className="flex items-center gap-2 text-xs font-mono text-ink-soft/70 mb-8">
          <span className="inline-block w-8 h-px bg-accent" />
          <span>PORTFOLIO / 2026</span>
        </div>

        {/* 居中主标题 */}
        <div className="text-center max-w-4xl mx-auto">
          <p className="text-ink-soft text-base md:text-lg font-medium mb-6">
            你好,我是
          </p>
          <h1 className="font-extrabold text-ink text-6xl sm:text-7xl md:text-8xl lg:text-9xl leading-[0.95] tracking-tight">
            <span className="underline-scribble">LongTeng</span>
            <span className="text-accent">.</span>
          </h1>
          <p className="mt-8 text-2xl md:text-3xl font-semibold text-ink leading-snug">
            嵌入式软件工程师 · AI 玩家 · 二次元
          </p>
          <p className="mt-5 text-ink-soft text-base md:text-lg max-w-2xl mx-auto leading-relaxed">
            白天写 C / Lua 驱动 WiFi 产品,晚上切二次元折腾 Blender 和 AI。
            <br className="hidden sm:block" />
            相信<strong className="text-ink">硬核技术</strong>和<strong className="text-ink">好玩的东西</strong>不该是反义词。
          </p>

          {/* 按钮组 */}
          <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
            <a
              href="/gobang/"
              className="btn-solid"
            >
              玩五子棋
              <span>→</span>
            </a>
            <a
              href="https://github.com/Litten-lt"
              target="_blank"
              rel="noreferrer"
              className="btn-ghost"
            >
              GitHub 主页
            </a>
            <a
              href="#contact"
              className="btn-ghost"
            >
              联系我
            </a>
          </div>

          {/* 状态行 */}
          <div className="mt-16 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-sm text-ink-soft">
            <span className="inline-flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span>当前可接外包 / 合作</span>
            </span>
            <span className="hidden sm:inline text-ink/20">·</span>
            <span>深圳 · China</span>
            <span className="hidden sm:inline text-ink/20">·</span>
            <span className="font-mono">7+ 年写代码</span>
          </div>
        </div>

        {/* 向下滚动提示 */}
        <div className="mt-20 flex justify-center">
          <div className="scroll-hint" />
        </div>
      </div>
    </section>
  )
}