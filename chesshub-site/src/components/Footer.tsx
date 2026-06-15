export default function Footer() {
  return (
    <footer className="relative z-10 mt-12 border-t border-white/5">
      <div className="max-w-6xl mx-auto px-6 py-8 flex flex-col md:flex-row items-center justify-between gap-3 text-sm text-slate-500">
        <div className="font-mono">
          © 2026 LongTeng · chesshub.fun
        </div>
        <div className="font-mono text-xs">
          built with <span className="text-cyber-pink">♥</span> · React · Vite · Tailwind
        </div>
      </div>
    </footer>
  )
}