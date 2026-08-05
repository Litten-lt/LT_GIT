import { Children, isValidElement, type ReactNode, useEffect, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

let mermaidInitialized = false

function MermaidDiagram({ chart }: { chart: string }) {
  const [svg, setSvg] = useState('')
  const [error, setError] = useState('')
  const diagramId = useRef(`mermaid-${Math.random().toString(36).slice(2)}`)

  useEffect(() => {
    let active = true
    setSvg('')
    setError('')
    import('mermaid').then(({ default: mermaid }) => {
      if (!mermaidInitialized) {
        mermaid.initialize({
          startOnLoad: false,
          securityLevel: 'strict',
          theme: 'base',
          themeVariables: {
            background: '#f3ede3',
            primaryColor: '#e4d8ca',
            primaryTextColor: '#2b2a28',
            primaryBorderColor: '#8a7568',
            lineColor: '#765f53',
            fontFamily: 'system-ui, sans-serif',
          },
        })
        mermaidInitialized = true
      }
      return mermaid.render(diagramId.current, chart)
    }).then(({ svg: rendered }) => {
      if (active) setSvg(rendered)
    }).catch(() => {
      if (active) setError('图表语法有误，请检查 Mermaid 代码。')
    })
    return () => { active = false }
  }, [chart])

  if (error) return <div className="mermaid-error"><strong>{error}</strong><pre><code>{chart}</code></pre></div>
  return <div className="mermaid-diagram" aria-label="Mermaid 图表" dangerouslySetInnerHTML={{ __html: svg }} />
}

function MarkdownPre({ children }: { children?: ReactNode }) {
  const child = Children.toArray(children)[0]
  if (isValidElement(child) && (child.props as { className?: string }).className === 'language-mermaid') {
    return <MermaidDiagram chart={String((child.props as { children?: ReactNode }).children || '').trim()} />
  }
  return <pre>{children}</pre>
}

function renderableMarkdown(value: string) {
  const source = value.split('\n')
  const output: string[] = []
  let inList = false

  source.forEach((line) => {
    const trimmed = line.trim()
    const isList = /^[-*+]\s+\S/.test(trimmed)
    const isChineseHeading = /^[一二三四五六七八九十百]+[、.．]\s*\S/.test(trimmed)

    if (isList && !inList && output.length && output[output.length - 1] !== '') output.push('')
    if (!isList && inList && trimmed) output.push('')
    output.push(isChineseHeading ? `### ${trimmed}` : line)
    inList = isList
  })

  return output.join('\n')
}

export default function ProcessMarkdown({ children }: { children: string }) {
  return <div className="md process-markdown"><ReactMarkdown remarkPlugins={[remarkGfm]} components={{ pre: MarkdownPre }}>{renderableMarkdown(children)}</ReactMarkdown></div>
}