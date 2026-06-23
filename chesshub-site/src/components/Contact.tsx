import { useState } from 'react'

type Icon = (props: { className?: string }) => JSX.Element

const PinIcon: Icon = (p) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className={p.className}>
    <path d="M12 22s7-6.5 7-12a7 7 0 1 0-14 0c0 5.5 7 12 7 12Z" />
    <circle cx="12" cy="10" r="2.5" />
  </svg>
)

const MailIcon: Icon = (p) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className={p.className}>
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <path d="m3 7 9 6 9-6" />
  </svg>
)

const PhoneIcon: Icon = (p) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className={p.className}>
    <rect x="6" y="2" width="12" height="20" rx="3" />
    <line x1="11" y1="18" x2="13" y2="18" />
  </svg>
)

// 兼容 HTTP 的复制:优先 Clipboard API,失败时用 textarea fallback
function copyText(text: string): boolean {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text)
      return true
    }
  } catch {}
  // Fallback: 用临时 textarea
  try {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    ta.style.pointerEvents = 'none'
    document.body.appendChild(ta)
    ta.focus()
    ta.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(ta)
    return ok
  } catch {
    return false
  }
}

export default function Contact() {
  return (
    <section id="contact">
      <div className="text-center mb-10">
        <p className="text-xs font-mono text-accent mb-3 tracking-widest">/ CONTACT</p>
        <h2 className="text-3xl md:text-4xl font-extrabold text-ink">
          联络我<span className="text-accent">.</span>
        </h2>
        <p className="mt-3 text-ink-soft">让我们合作 · 一起折腾</p>
      </div>

      <div className="max-w-sm mx-auto w-full">
        <div className="space-y-5">
          <ContactItem
            icon={<PinIcon className="w-5 h-5 text-ink" />}
            label="位置"
            value="中国 · 深圳"
          />
          <ContactItem
            icon={<MailIcon className="w-5 h-5 text-ink" />}
            label="Email"
            value="tenglong436@gmail.com"
            copy
          />
          <ContactItem
            icon={<PhoneIcon className="w-5 h-5 text-ink" />}
            label="微信"
            value="LT2698752310"
            copy
          />
        </div>
      </div>
    </section>
  )
}

function ContactItem({
  icon,
  label,
  value,
  copy,
}: {
  icon: JSX.Element
  label: string
  value: string
  copy?: boolean
}) {
  const [copied, setCopied] = useState(false)

  const handleClick = async () => {
    if (!copy) return
    const ok = copyText(value)
    if (ok) {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } else {
      // 终极兜底:弹个 prompt 让用户手动复制
      window.prompt('复制下面的内容:', value)
    }
  }

  return (
    <button
      onClick={handleClick}
      type="button"
      className="text-left w-full group cursor-pointer"
    >
      <div className="flex items-start gap-4">
        <div className="shrink-0 mt-0.5">{icon}</div>
        <div className="min-w-0 flex-1">
          <div className="text-xs text-ink-soft/60 font-mono uppercase tracking-widest">
            {label}
          </div>
          <div
            className={`text-sm font-medium break-all mt-0.5 transition ${
              copied ? 'text-accent' : 'text-ink group-hover:text-accent'
            }`}
          >
            {copied ? '✓ 已复制' : value}
          </div>
          {copy && !copied && (
            <div className="text-[10px] text-accent/70 font-mono mt-0.5">点击复制</div>
          )}
        </div>
      </div>
    </button>
  )
}