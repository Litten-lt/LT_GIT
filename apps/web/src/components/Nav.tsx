const items = [
  { label: '工作与学习', href: '/journal.html' },
  { label: '生活', href: '/life.html' },
  { label: '联系', href: '/#contact' },
]

export default function Nav() {
  return (
    <nav className="sticky top-0 z-30 border-y border-ink/10 bg-bg/90 backdrop-blur-md" aria-label="主要导航">
      <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-center gap-6 sm:gap-10 md:gap-14 text-sm font-medium text-ink-soft overflow-x-auto">
        {items.map((item) => (
          <a key={item.label} href={item.href} className="link-anim focus-ring rounded-sm whitespace-nowrap py-1">
            {item.label}
          </a>
        ))}
      </div>
    </nav>
  )
}
