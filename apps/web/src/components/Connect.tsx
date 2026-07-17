import { useState } from 'react'
import { GithubIcon } from './social-icons'

function copyText(text: string) {
  if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text)
  window.prompt('复制下面的内容：', text)
  return Promise.resolve()
}

export default function Connect() {
  const [copied, setCopied] = useState('')

  const copy = (label: string, value: string) => {
    copyText(value).then(() => {
      setCopied(label)
      window.setTimeout(() => setCopied(''), 1500)
    })
  }

  return (
    <section id="contact" className="connect-panel">
      <div>
        <p className="text-xs font-mono text-accent tracking-[0.18em]">/ KEEP IN TOUCH</p>
        <h2 className="mt-4 text-4xl md:text-5xl font-extrabold tracking-tight text-ink">
          有想法，来聊聊<span className="text-accent">。</span>
        </h2>
        <p className="mt-5 max-w-xl text-ink-soft leading-relaxed">
          技术合作、产品讨论，或者只是想交换一些关于 AI、模型和生活的有趣发现，都欢迎联系。
        </p>
      </div>
      <div className="connect-links">
        <button onClick={() => copy('email', 'tenglong436@gmail.com')} className="focus-ring">
          <span>Email</span><strong>{copied === 'email' ? '已复制 ✓' : 'tenglong436@gmail.com'}</strong>
        </button>
        <button onClick={() => copy('wechat', 'LT2698752310')} className="focus-ring">
          <span>微信</span><strong>{copied === 'wechat' ? '已复制 ✓' : 'LT2698752310'}</strong>
        </button>
        <a href="https://github.com/Litten-lt" target="_blank" rel="noreferrer" className="focus-ring">
          <span>GitHub</span><strong className="inline-flex items-center gap-2"><GithubIcon className="w-4 h-4" /> Litten-lt ↗</strong>
        </a>
        <div><span>位置</span><strong>深圳，中国</strong></div>
      </div>
    </section>
  )
}
