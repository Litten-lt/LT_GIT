import App from '../App'
import Nav from '../components/Nav'
import Connect from '../components/Connect'
import FeaturedProjects from '../components/FeaturedProjects'
import { useHeroBg } from '../heroBgContext'
import { bgToStyle } from '../background'

export default function Home() {
  const { heroBg } = useHeroBg()
  const { background, isImage } = bgToStyle(heroBg)

  return (
    <App>
      <section id="top" className="relative overflow-hidden py-20 md:py-28" style={{ background }}>
        <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-accent/10 blur-3xl" />
        {isImage && <div className="absolute inset-0 bg-bg/75 backdrop-blur-[2px] pointer-events-none" />}
        <div className="relative z-10 max-w-5xl mx-auto px-6 grid lg:grid-cols-[1fr_18rem] gap-12 items-end">
          <div>
            <div className="flex items-center gap-3 text-xs font-mono text-accent tracking-[0.18em]">
              <span className="h-px w-9 bg-accent" />
              ENGINEERING / LIFE / SHENZHEN
            </div>
            <h1 className="mt-7 max-w-3xl text-5xl sm:text-6xl md:text-7xl font-extrabold text-ink tracking-[-0.045em] leading-[1.02]">
              把底层技术做稳，<br />
              把有趣想法<span className="underline-scribble">做出来</span><span className="text-accent">。</span>
            </h1>
            <p className="mt-7 max-w-2xl text-lg md:text-xl text-ink-soft leading-relaxed">
              我是 LongTeng，专注 WiFi、OpenWrt 与嵌入式产品开发。
              这里记录工程现场，也收藏旅行、模型与日常生活。
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <a href="#projects" className="btn-primary">查看最近更新 <span aria-hidden="true">↘</span></a>
              <a href="/journal.html" className="btn-secondary">工作与学习</a>
              <a href="/life.html" className="btn-secondary">生活分享</a>
            </div>
          </div>
          <aside className="hero-note" aria-label="个人状态">
            <p className="font-serif text-2xl text-ink">LongTeng<span className="text-accent">.</span></p>
            <div className="mt-6 space-y-4 text-sm">
              <div><span>职业主线</span><strong>嵌入式开发</strong></div>
              <div><span>兴趣支线</span><strong>AI / Blender</strong></div>
              <div><span>所在地</span><strong>深圳，中国</strong></div>
            </div>
            <p className="mt-6 flex items-center gap-2 text-xs text-ink-soft">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              持续记录，偶尔折腾
            </p>
          </aside>
        </div>
      </section>

      <Nav />

      <div className="max-w-5xl mx-auto px-6 space-y-28 md:space-y-36 py-24 md:py-32">
        <FeaturedProjects />
        <Connect />
      </div>
    </App>
  )
}

