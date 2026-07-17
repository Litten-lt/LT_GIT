import { isAdmin } from './auth'

type LegacySection = 'work' | 'study' | 'figure' | 'travel' | 'note'
const target: Record<LegacySection, { hub: string; type: string }> = {
  work: { hub: '/journal.html', type: 'work' }, study: { hub: '/journal.html', type: 'study' },
  figure: { hub: '/life.html', type: 'figure' }, travel: { hub: '/life.html', type: 'travel' }, note: { hub: '/life.html', type: 'note' },
}

export function redirectLegacyVisitor(section: LegacySection) {
  const config = target[section]
  const current = new URL(window.location.href)
  const id = current.searchParams.get('id')
  if (isAdmin()) {
    const next = new URL(id ? '/compose.html' : '/admin.html', window.location.origin)
    if (id) { next.searchParams.set('type', config.type); next.searchParams.set('id', id) }
    else next.searchParams.set('type', config.type)
    window.location.replace(next.toString())
    return true
  }
  const next = new URL(config.hub, window.location.origin)
  if (id) { next.searchParams.set('type', config.type); next.searchParams.set('id', id) }
  else next.searchParams.set('filter', config.type)
  window.location.replace(next.toString())
  return true
}
