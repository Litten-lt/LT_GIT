import { Marked } from 'marked'
import DOMPurify from 'dompurify'

const escape = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))

// Compatibility is display-only: imported source text is never rewritten.
export function normalizeLegacy(source) {
  let fenced = false
  return String(source || '').replace(/\r\n?/g, '\n').split('\n').map(line => {
    if (/^\s*(```|~~~)/.test(line)) { fenced = !fenced; return line }
    if (fenced) return line
    return line.replace(/<\/?notextile>/gi, '').replace(/\|_\.\s*/g, '| ').replace(/@([^@\n]+)@/g, '`$1`')
  }).join('\n')
}

const marked = new Marked({
  extensions: [{
    name: 'numberedParagraphBoundary',
    level: 'block',
    // Let the built-in list tokenizer handle a numbered line after prose.
    start(source) {
      const match = /\n(?= {0,3}\d{1,9}[.)][ \t]+\S)/.exec(source)
      return match && match.index + 1
    },
    tokenizer() { return undefined }
  }]
})

const renderer = new marked.Renderer()
renderer.html = ({text}) => escape(text)
renderer.link = function ({tokens}) { return this.parser.parseInline(tokens) }
renderer.image = ({text}) => escape(text) // Attachments use the existing validated image API.
renderer.code = ({text,lang}) => /^mermaid(?:\s|$)/i.test(lang || '')
  ? '<figure class="diagram" data-mermaid="pending"><figcaption>知识图解</figcaption><div class="diagram-canvas"></div><details><summary>查看图表源码</summary><pre><code>'+escape(text)+'</code></pre></details></figure>'
  : '<pre><code>'+escape(text)+'</code></pre>'

export function markdown(source) {
  return DOMPurify.sanitize(marked.parse(normalizeLegacy(source), {renderer,gfm:true,breaks:true}), {ADD_ATTR:['data-mermaid'],FORBID_TAGS:['style','script','iframe','form','input']})
}

let mermaidPromise, nextId = 0
async function drawDiagrams() {
  const items = [...document.querySelectorAll('[data-mermaid="pending"]')]
  if (!items.length) return
  for (const item of items) item.dataset.mermaid = 'queued'
  try {
    mermaidPromise ||= import('mermaid').then(({default:m}) => {
      m.initialize({startOnLoad:false,securityLevel:'strict',htmlLabels:false,theme:'base',suppressErrorRendering:true,maxTextSize:100000,
        themeVariables:{primaryColor:'#edf2df',primaryTextColor:'#304a38',primaryBorderColor:'#82986e',lineColor:'#7d9068',fontFamily:'system-ui, sans-serif'},
        flowchart:{htmlLabels:false,useMaxWidth:true},sequence:{useMaxWidth:true}})
      return m
    })
    const m = await mermaidPromise
    for (const item of items) {
      if (!item.isConnected) continue
      try {
        const {svg} = await m.render('zhimu-diagram-'+(++nextId), item.querySelector('code').textContent)
        if (!item.isConnected) continue
        const clean = DOMPurify.sanitize(svg, {USE_PROFILES:{svg:true,svgFilters:true}})
        item.querySelector('.diagram-canvas').innerHTML = clean
        item.dataset.mermaid = 'done'
      } catch {
        if (!item.isConnected) continue
        item.dataset.mermaid = 'error'
        item.querySelector('.diagram-canvas').textContent = '图表暂时无法绘制，请检查 Mermaid 语法。'
        item.querySelector('details').open = true
      }
    }
  } catch {
    for (const item of items) {
      item.dataset.mermaid = 'error'
      item.querySelector('.diagram-canvas').textContent = '图表组件加载失败，重新加载后可重试。'
      item.querySelector('details').open = true
    }
  }
}

let timer
export function observeDiagrams() {
  const schedule = () => { clearTimeout(timer); timer = setTimeout(drawDiagrams,180) }
  new MutationObserver(schedule).observe(document.getElementById('app'), {childList:true,subtree:true})
  new MutationObserver(schedule).observe(document.getElementById('editor'), {childList:true,subtree:true})
  schedule()
}
