import App from '../App'
import Avatar from '../components/Avatar'
import Nav from '../components/Nav'
import About from '../components/About'
import Blog from '../components/Blog'
import Contact from '../components/Contact'
import Follow from '../components/Follow'

export default function Home() {
  return (
    <App>
      {/* 顶部头像 + 标题 */}
      <section id="top" className="pt-20 pb-12">
        <div className="text-center max-w-2xl mx-auto px-6">
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