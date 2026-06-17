import App from '../App'
import Avatar from '../components/Avatar'
import Nav from '../components/Nav'
import About from '../components/About'
import Blog from '../components/Blog'
import Contact from '../components/Contact'
import Follow from '../components/Follow'
import { useHeroBg } from '../heroBgContext'
import { bgToStyle } from '../background'

export default function Home() {
  const { heroBg } = useHeroBg()
  const { background, isImage } = bgToStyle(heroBg)

  return (
    <App>
      {/* 顶部头像 + 标题 - 独立可换背景 */}
      <section
        id="top"
        className="relative pt-20 pb-12"
        style={{ background }}
      >
        {/* 图片模式下加 20% 白蒙版,保证文字可读 */}
        {isImage && (
          <div className="absolute inset-0 bg-white/20 pointer-events-none" />
        )}
        <div className="relative z-10 text-center max-w-2xl mx-auto px-6">
          <Avatar />
          <p className="mt-6 text-xs font-mono text-ink-soft/60 tracking-widest">
            PORTFOLIO / 2026
          </p>
          <h1 className="mt-3 text-4xl md:text-5xl font-extrabold text-ink tracking-tight">
            LongTeng<span className="text-accent">.</span>
          </h1>
          <p
            className="mt-3 text-xl md:text-2xl text-ink-soft italic"
            style={{ fontFamily: 'Fraunces, "Source Han Serif SC", Georgia, serif' }}
          >
            嵌入式 · AI · 二次元
          </p>
        </div>
      </section>

      {/* 区块导航 */}
      <Nav />

      <div className="max-w-3xl mx-auto px-6 space-y-24 pb-24">
        <About />
        <Blog />
        <Contact />
        <Follow />
      </div>
    </App>
  )
}