
type Props = { current?: string; hideHeader?: boolean; children?: React.ReactNode }
const navigation = [
  { href: '/', label: '首页' },
]
export default function App({ children, hideHeader = false }: Props) {
  const path = window.location.pathname
  const active = path === '/index.html' ? '/' : path === '/work.html' || path === '/study.html' ? '/journal.html' : path
  return <div className="notebook-app min-h-screen flex flex-col text-ink">
    <a className="skip-link" href="#main-content">跳到正文</a>
    {!hideHeader && <header className="site-header"><div className="site-header-inner">
      <a className="site-brand" href="/" aria-label="LongTeng 首页">LongTeng<span>.</span></a>
      <div className="site-header-controls"><nav className="site-navigation" aria-label="主导航">
        {navigation.map(item => <a key={item.href} href={item.href} aria-current={active === item.href ? 'page' : undefined}>{item.label}</a>)}
      </nav><div className="site-admin-actions"><a href="/admin.html" aria-current={path === '/admin.html' ? 'page' : undefined}>管理中心</a></div></div>
    </div></header>}
    <div id="main-content" className="flex-1" tabIndex={-1}>{children}</div>
    <footer className="notebook-footer"><span>© 2026 LongTeng · 工作中的问题与解法</span><a href="/admin.html">管理中心</a></footer>
  </div>
}
