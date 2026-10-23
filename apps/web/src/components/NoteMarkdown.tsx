import { Children, isValidElement, useState, type ReactNode } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

function CodeBlock({ children }: { children?: ReactNode }) {
  const [message, setMessage] = useState('复制')
  const child = Children.toArray(children)[0]
  const props = isValidElement(child) ? child.props as { children?: ReactNode; className?: string } : null
  const text = String(props?.children || '')
  return <div className="note-code"><div><span>{props?.className?.replace('language-', '') || '代码'}</span><button onClick={async () => { try { await navigator.clipboard.writeText(text); setMessage('已复制') } catch { setMessage('请选中代码复制') } }}>{message}</button></div><pre>{children}</pre></div>
}
export default function NoteMarkdown({ body }: { body: string }) {
  let heading = 0
  return <ReactMarkdown remarkPlugins={[remarkGfm]} components={{ pre: CodeBlock,
    h2: ({ children }) => <h2 id={`section-${heading++}`}>{children}</h2>,
    h3: ({ children }) => <h3 id={`section-${heading++}`}>{children}</h3>,
    img: ({ src, alt }) => <a href={src} target="_blank" rel="noreferrer" aria-label={`查看大图：${alt || '笔记图片'}`}><img src={src} alt={alt || '笔记配图'} loading="lazy" /></a>
  }}>{body}</ReactMarkdown>
}
