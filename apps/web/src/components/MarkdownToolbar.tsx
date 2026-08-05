import type { RefObject } from 'react'

type Props = {
  textareaRef: RefObject<HTMLTextAreaElement>
  value: string
  onChange: (value: string) => void
}

type Tool = { label: string; title: string; before: string; after?: string; placeholder?: string; block?: boolean }

const tools: Tool[] = [
  { label: 'H1', title: '一级标题（最大）', before: '# ', block: true },
  { label: 'H2', title: '二级标题', before: '## ', block: true },
  { label: 'H3', title: '三级标题', before: '### ', block: true },
  { label: 'B', title: '粗体', before: '**', after: '**', placeholder: '粗体文字' },
  { label: 'I', title: '斜体', before: '*', after: '*', placeholder: '斜体文字' },
  { label: 'S', title: '删除线', before: '~~', after: '~~', placeholder: '删除文字' },
  { label: '“”', title: '引用', before: '> ', block: true },
  { label: '•', title: '无序列表', before: '- ', block: true },
  { label: '1.', title: '有序列表', before: '1. ', block: true },
  { label: '☑', title: '任务清单', before: '- [ ] ', block: true },
  { label: '`</>`', title: '行内代码', before: '`', after: '`', placeholder: '代码' },
  { label: '链接', title: '插入链接', before: '[', after: '](https://)', placeholder: '链接文字' },
]

const tableTemplate = `| 列 1 | 列 2 | 列 3 |
| --- | --- | --- |
| 内容 | 内容 | 内容 |
| 内容 | 内容 | 内容 |`

export default function MarkdownToolbar({ textareaRef, value, onChange }: Props) {
  function insert(tool: Tool) {
    const textarea = textareaRef.current
    if (!textarea) return
    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const rawSelection = value.slice(start, end)
    const selected = rawSelection || tool.placeholder || ''
    const prefix = tool.block && start > 0 && value[start - 1] !== '\n' ? '\n' : ''
    const formatted = tool.block && rawSelection
      ? rawSelection.split('\n').map((line) => `${tool.before}${line}`).join('\n')
      : `${tool.before}${selected}${tool.after || ''}`
    const replacement = prefix + formatted
    onChange(value.slice(0, start) + replacement + value.slice(end))
    window.requestAnimationFrame(() => {
      textarea.focus()
      const selectionStart = start + prefix.length + tool.before.length
      textarea.setSelectionRange(selectionStart, selectionStart + selected.length)
    })
  }

  function insertBlock(content: string) {
    const textarea = textareaRef.current
    if (!textarea) return
    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const beforeBreak = start > 0 && value[start - 1] !== '\n' ? '\n\n' : ''
    const afterBreak = end < value.length && value[end] !== '\n' ? '\n\n' : '\n'
    onChange(value.slice(0, start) + beforeBreak + content + afterBreak + value.slice(end))
    window.requestAnimationFrame(() => textarea.focus())
  }

  return <div className="markdown-toolbar" role="toolbar" aria-label="Markdown 格式工具">
    {tools.map((tool) => <button key={tool.title} type="button" title={tool.title} aria-label={tool.title} onClick={() => insert(tool)}>{tool.label}</button>)}
    <button type="button" title="插入代码块" onClick={() => insertBlock('```text\n在这里粘贴代码\n```')}>代码块</button>
    <button type="button" title="插入表格模板" className="toolbar-accent" onClick={() => insertBlock(tableTemplate)}>表格</button>
    <button type="button" title="插入分隔线" onClick={() => insertBlock('---')}>分隔线</button>
  </div>
}
