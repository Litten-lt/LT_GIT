export default function About() {
  return (
    <section id="about" className="grid md:grid-cols-2 gap-10 items-center">
      {/* 左：圆角头像/插画占位 */}
      <div className="flex justify-center md:justify-end">
        <div
          className="w-full max-w-xs aspect-[3/4] rounded-3xl overflow-hidden"
          style={{
            background:
              'linear-gradient(135deg, #c58582 0%, #b87a8a 50%, #9d8090 100%)',
          }}
        >
          {/* 占位标签 */}
          <div className="w-full h-full flex items-center justify-center text-white/80 text-sm font-mono">
            // 你的照片
          </div>
        </div>
      </div>

      {/* 右：文字 */}
      <div className="text-center md:text-left">
        <p className="text-xs font-mono text-accent mb-3 tracking-widest">/ ABOUT</p>
        <h2 className="text-3xl md:text-4xl font-extrabold text-ink leading-tight">
          你好,我是 <span className="underline-scribble">LongTeng</span>
        </h2>
        <p className="mt-5 text-ink-soft leading-relaxed">
          嵌入式软件工程师,日常 C / Lua / Shell 写 WiFi 产品。
          业余折腾 Blender、AI 工具链、二次元手办。
        </p>
        <p className="mt-3 text-ink-soft leading-relaxed">
          相信<span className="text-ink font-semibold">硬核技术</span>和
          <span className="text-ink font-semibold">好玩的东西</span>不该是反义词。
        </p>

        {/* 几个小标签 */}
        <div className="mt-6 flex flex-wrap gap-2 justify-center md:justify-start">
          {['嵌入式', 'OpenWrt', 'AI', 'Blender', '二次元'].map((t) => (
            <span
              key={t}
              className="text-xs px-3 py-1 rounded-full border border-ink/15 text-ink-soft"
            >
              {t}
            </span>
          ))}
        </div>
      </div>
    </section>
  )
}