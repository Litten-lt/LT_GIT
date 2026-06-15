import { useEffect, useState } from 'react'
import Hero from './components/Hero'
import IdentityTags from './components/IdentityTags'
import Projects from './components/Projects'
import Contact from './components/Contact'
import Footer from './components/Footer'
import Sakura from './components/Sakura'

export default function App() {
  const [time, setTime] = useState('')

  useEffect(() => {
    const tick = () => {
      const d = new Date()
      const fmt = d.toLocaleString('zh-CN', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      })
      setTime(fmt)
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [])

  return (
    <div className="relative min-h-screen text-slate-100">
      <Sakura count={18} />

      {/* 顶部状态栏 */}
      <header className="fixed top-0 left-0 right-0 z-30 glass">
        <div className="max-w-6xl mx-auto px-6 py-3 flex items-center justify-between text-sm">
          <div className="flex items-center gap-2 font-mono">
            <span className="w-2 h-2 rounded-full bg-cyber-accent animate-glow" />
            <span className="text-cyber-accent">chesshub.fun</span>
            <span className="text-slate-500 hidden sm:inline">// online</span>
          </div>
          <nav className="hidden md:flex items-center gap-6 text-slate-300">
            <a href="#about" className="link-anim hover:text-cyber-accent">关于</a>
            <a href="#projects" className="link-anim hover:text-cyber-accent">项目</a>
            <a href="#contact" className="link-anim hover:text-cyber-accent">联系</a>
            <a href="/gobang/" className="link-anim hover:text-cyber-pink">五子棋 ↗</a>
          </nav>
          <div className="font-mono text-cyber-accent/80">{time}</div>
        </div>
      </header>

      <main className="relative z-10 pt-24">
        <Hero />
        <IdentityTags />
        <Projects />
        <Contact />
      </main>

      <Footer />
    </div>
  )
}