export type ReadingChannel = 'journal'

export function currentReturnPath() {
  return `${window.location.pathname}${window.location.search}`
}

export function readingHref(channel: ReadingChannel, id: number, returnTo = currentReturnPath()) {
  const params = new URLSearchParams({ id: String(id), return: returnTo })
  return `/${channel}.html?${params}`
}

export function readingReturn(channel: ReadingChannel, rawReturn: string | null, legacyFilter: string | null, categoryName?: string | null) {
  const fallback = { href: '/journal.html', label: '返回工作笔记' }
  const candidate = rawReturn || (legacyFilter ? `/${channel}.html?filter=${encodeURIComponent(legacyFilter)}` : '')
  if (!candidate.startsWith('/') || candidate.startsWith('//')) return fallback
  const target = new URL(candidate, window.location.origin)
  if (target.origin !== window.location.origin) return fallback
  if (target.pathname === '/admin.html') return { href: `${target.pathname}${target.search}`, label: '返回管理中心' }
  if (target.pathname === '/search.html') return { href: `${target.pathname}${target.search}`, label: '返回搜索结果' }
  if (target.pathname === '/') return { href: '/', label: '返回主页' }
  if (target.pathname === `/${channel}.html`) {
    const filter = target.searchParams.get('filter')
    const label = filter && filter !== 'all' ? `返回${filter === 'none' ? '其他' : categoryName || fallback.label.replace('返回', '')}` : fallback.label
    return { href: `${target.pathname}${target.search}`, label }
  }
  return fallback
}
