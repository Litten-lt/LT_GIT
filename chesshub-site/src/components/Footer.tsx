export default function Footer() {
  return (
    <footer className="border-t border-ink/8 py-10">
      <div className="max-w-6xl mx-auto px-6 lg:px-10 flex flex-col sm:flex-row items-center justify-between gap-3 text-sm text-ink-soft">
        <div className="font-mono">© 2026 LongTeng.</div>
        <div className="text-xs">
          built with <span className="text-accent">♥</span> · React · Vite · Tailwind
        </div>
      </div>
    </footer>
  )
}