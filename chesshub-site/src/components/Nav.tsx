const items = [
  { label: '关于', href: '#about' },
  { label: '博客', href: '#blog' },
  { label: '联络我', href: '#contact' },
  { label: '关注我', href: '#follow' },
]

export default function Nav() {
  return (
    <nav className="border-y border-ink/10 bg-bg-soft/40">
      <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-center gap-8 md:gap-12 text-sm font-medium text-ink-soft">
        {items.map((it, i) => (
          <a key={it.label} href={it.href} className="link-anim">
            {it.label}
            {i === 0 && <span className="ml-1 text-accent">_</span>}
          </a>
        ))}
      </div>
    </nav>
  )
}