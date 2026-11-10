import {coverAccount} from './cover-ui.js'
import {authPage} from './auth-ui.js'
import {directoryHtml} from './tree-directory.js'
import {markdown,observeDiagrams} from './vendor/markdown.js'
import { escapeHtml as e, orderedBranches, descendants, treeSvg } from './tree.js'
const $=id=>document.getElementById(id),root=$('app'),dialog=$('editor')
let branches=[],notes=[],trashBranches=[],query='',branchFilter='',statusFilter='',page=0,selected=null,revision=0,dirty=false,subjectDirty=false,toastTimer,coverTimer
let sessionAdmin=null
const expandedBranches=new Set();let directoryRestored=false
let showTitles=false;try{showTitles=localStorage.getItem('zhimu:titles')==='true'}catch{}
const state=()=>new URLSearchParams(location.search),view=()=>state().get('view')||'tree'
const urlFor=(v,extra={})=>'?'+new URLSearchParams({view:v,...extra})
const optionList=(current=null,excluded=new Set())=>'<option value="">根部 / 待归枝</option>'+orderedBranches(branches).filter(b=>!excluded.has(b.id)).map(b=>'<option value="'+b.id+'" '+(b.id===current?'selected':'')+'>'+e('　'.repeat(Math.min(b.depth,6))+(b.depth?'↳ ':'')+b.name)+'</option>').join('')
const branchName=id=>branches.find(b=>b.id===id)?.name||'待归枝'
const date=value=>new Date(value*1000).toLocaleDateString('zh-CN')
async function api(path,method='GET',body){const response=await fetch('./api'+path,{method,headers:body&&!(body instanceof FormData)?{'Content-Type':'application/json'}:{},body:body instanceof FormData?body:body?JSON.stringify(body):undefined});let data;try{data=await response.json()}catch{throw new Error('服务响应异常，请稍后重试')}if(!response.ok)throw new Error(data.error||'操作失败');return data}
function toast(message){clearTimeout(toastTimer);$('toast').textContent=message; $('toast').classList.add('visible');toastTimer=setTimeout(()=>$('toast').classList.remove('visible'),4000)}
function navigate(v,extra={}){history.pushState(null,'',urlFor(v,extra));query='';branchFilter='';statusFilter='';page=0;selected=null;window.scrollTo(0,0);load()}
async function load(){
  const token=++revision
  document.body.classList.toggle('auth-screen',['login','account'].includes(view())||!sessionAdmin&&!['tree','read'].includes(view())||Boolean(sessionAdmin?.must_change))
  root.setAttribute('aria-busy','true')
  try{
    if(['login','account'].includes(view())||!sessionAdmin&&!['tree','read'].includes(view())||sessionAdmin?.must_change){root.innerHTML=authPage(sessionAdmin);return}
    if(view()==='read'){const [result,taxonomy]=await Promise.all([api('/notes/'+state().get('note')),api('/branches')]);if(token!==revision)return;branches=taxonomy.branches;renderRead(result.note);return}
    const isTree=view()==='tree',trash=view()==='trash'
    if(isTree){const result=await api('/tree');if(token!==revision)return;branches=result.branches;notes=result.notes;if(selected){const n=notes.find(n=>n.id===selected);if(n){const siblings=notes.filter(x=>x.branch_id===n.branch_id).sort((a,b)=>a.id-b.id);page=Math.max(0,Math.floor(siblings.findIndex(x=>x.id===selected)/10))}}}
    else{const result=await Promise.all([api('/branches'),api('/notes?'+new URLSearchParams({q:query,...(branchFilter?{branch:branchFilter}:{}),...(statusFilter?{status:statusFilter}:{}),...(trash?{trash:'1'}:{})})),trash?api('/branches?trash=1'):Promise.resolve({branches:[]})]);if(token!==revision)return;branches=result[0].branches;notes=result[1].notes;trashBranches=result[2].branches}
    render()
  }catch(error){if(token===revision){root.innerHTML='<main class="error-page" id="main"><span class="eyebrow">CONNECTION</span><h1>暂时没能打开手记。</h1><p>'+e(error.message)+'</p><button class="primary" data-action="retry">重新加载</button></main>'}}
  finally{if(token===revision)root.removeAttribute('aria-busy')}
}
function adminShell(content){
  const v=view()
  return '<div class="workspace"><aside class="admin-sidebar"><span class="eyebrow">GARDEN STUDIO</span><h1>培育知识，<br>整理思考。</h1><nav aria-label="管理导航">'+[['notes','枝叶管理','01'],['branches','分支目录','02'],['trash','回收站','03']].map(([id,name,no])=>'<a class="'+(v===id?'active':'')+'" href="'+urlFor(id)+'" data-route="'+id+'"><small>'+no+'</small>'+name+'<span>↗</span></a>').join('')+'</nav><div class="sidebar-footer"><span class="mini-tree">♧</span><p>整理每一片叶子，<br>为下一次理解留出空间。</p><a href="?view=tree" data-route="tree">回到知识树 →</a></div></aside><main class="admin-main" id="main">'+content+'</main></div>'
}
function render(){
  document.title=(view()==='tree'?'知木 · 知识生长的地方':'知木 · '+({notes:'枝叶管理',branches:'分支目录',trash:'回收站'}[view()]||'管理'))
  document.querySelectorAll('[data-route]').forEach(a=>a.classList.toggle('current',a.dataset.route===view()))
  if(view()==='tree'){renderTree();return}
  if(view()==='branches'){renderBranches();return}
  const trash=view()==='trash'
  root.innerHTML=adminShell('<div class="page-heading"><div><span class="eyebrow">'+(trash?'REST & RETURN':'LEAVES OF KNOWLEDGE')+'</span><h2>'+(trash?'给知识一个回来的机会。':'每一次理解，都值得留下。')+'</h2><p>'+(trash?'删除的枝叶保留在这里，恢复后可继续生长。':'建立知识点、调整归属，让你的知识树逐渐丰盈。')+'</p></div>'+(!trash?'<button class="primary" data-action="new-note">＋ 新增知识点</button>':'')+'</div><div class="stats"><div><strong>'+notes.length+'</strong><span>'+(trash?'回收的知识点':'当前知识点')+'</span></div><div><strong>'+branches.length+'</strong><span>生长中的分支</span></div><div><strong>'+(trash?trashBranches.length:notes.filter(n=>n.status==='published').length)+'</strong><span>'+(trash?'回收的分支':'当前已发布')+'</span></div></div><section class="content-panel"><div class="toolbar"><label class="search-label"><span>搜索知识点</span><input id="search" type="search" placeholder="搜索标题、正文或标签…" value="'+e(query)+'"></label><label>所属分支<select id="filter-branch"><option value="">全部分支</option><option value="0" '+(branchFilter==='0'?'selected':'')+'>待归枝</option>'+orderedBranches(branches).map(b=>'<option value="'+b.id+'" '+(branchFilter===String(b.id)?'selected':'')+'>'+e('↳ '.repeat(Math.min(b.depth,3))+b.name)+'</option>').join('')+'</select></label><label>状态<select id="filter-status"><option value="">全部状态</option><option value="draft" '+(statusFilter==='draft'?'selected':'')+'>草稿</option><option value="published" '+(statusFilter==='published'?'selected':'')+'>已发布</option></select></label></div><div class="panel-title"><span>标题 / 所属分支</span><span>'+notes.length+' 条结果</span></div><div class="note-list">'+(notes.length?notes.map(n=>'<article class="note-row"><span class="leaf-icon '+n.status+'">♧</span><div class="note-main"><div class="note-meta"><span>'+e(branchName(n.branch_id))+'</span><span>#'+String(n.id).padStart(3,'0')+'</span><span>'+(n.record_count||0)+' 次记录</span></div><h3>'+e(n.title)+'</h3><p>'+e(n.summary||'尚未填写摘要')+'</p><div class="tags">'+n.tags.map(t=>'<span>#'+e(t)+'</span>').join('')+'</div></div><div class="note-status"><span class="status-pill '+n.status+'">'+(n.status==='published'?'已发布':'草稿')+'</span><small>'+date(n.updated_at)+'</small></div><div class="row-actions">'+(trash?'<button data-action="restore-note" data-id="'+n.id+'">恢复 ↗</button>':'<button data-action="append-record" data-id="'+n.id+'">记录 / 编辑</button><a href="'+urlFor('read',{note:n.id,from:'notes'})+'">阅读 ↗</a><button class="muted-danger" data-action="delete-note" data-id="'+n.id+'">移入回收站</button>')+'</div></article>').join(''):empty(trash?'回收站里还没有知识点。':query?'没有找到匹配内容。':'让第一片叶子，从这里生长。',!trash&&!query?'<button class="primary" data-action="new-note">＋ 写下第一个知识点</button>':''))+'</div></section>'+(trash?'<section class="content-panel branch-trash"><div class="panel-title"><span>分支回收站</span><span>'+trashBranches.length+' 条</span></div>'+trashBranches.map(b=>'<div class="trash-row"><div><strong>'+e(b.name)+'</strong><small>删除于 '+date(b.deleted_at)+'</small></div><button data-action="restore-branch" data-id="'+b.id+'">恢复本批枝叶 ↗</button></div>').join('')+(!trashBranches.length?empty('没有被回收的分支。'):'')+'</section>':''))
}
function empty(title,action=''){return '<div class="empty"><span>♧</span><h3>'+title+'</h3><p>知识不必急于成林，从一个清楚的问题开始就好。</p>'+action+'</div>'}
function renderBranches(){
  root.innerHTML=adminShell('<div class="page-heading"><div><span class="eyebrow">ROOTS & BRANCHES</span><h2>让知识找到自己的方向。</h2><p>主枝组织主题，子分支持续生长。调整归属时，整条子分支会一起移动。</p></div><button class="primary" data-action="new-branch">＋ 新增主枝</button></div><div class="content-panel"><div class="panel-title"><span>分支结构</span><span>'+branches.length+' 个分支</span></div>'+orderedBranches(branches).map(b=>'<article class="branch-row" style="--depth:'+Math.min(b.depth,6)+'"><span class="branch-index">'+(b.depth?'↳':'◦')+'</span><div class="branch-main"><h3>'+e(b.name)+'</h3><p>'+e(b.description||'为这个方向写一句说明。')+'</p><small>'+b.note_count+' 片叶子 · 顺序 '+b.sort_order+'</small></div><div class="row-actions"><button data-action="new-child" data-id="'+b.id+'">＋ 子分支</button><button data-action="new-note" data-branch="'+b.id+'">＋ 叶片</button><button data-action="edit-branch" data-id="'+b.id+'">编辑 / 移动</button><button data-action="up-branch" data-id="'+b.id+'" aria-label="上移 '+e(b.name)+'">↑</button><button data-action="down-branch" data-id="'+b.id+'" aria-label="下移 '+e(b.name)+'">↓</button><button data-action="delete-branch" data-id="'+b.id+'" class="muted-danger">删除</button></div></article>').join('')+(!branches.length?empty('先种下一条主枝。','<button class="primary" data-action="new-branch">＋ 建立第一个分支</button>'):'')+'</div><div class="quiet-tip"><span>↳</span><p>“待归枝”接住尚未分类的知识点，不需要手动建立，也不会被删除。</p></div>')
}
function renderTree(){
  const directoryScroll=root.querySelector('.tree-sidebar nav')?.scrollTop||0
  const focus=state().has('branch')?Number(state().get('branch')):null,ids=focus===null?null:descendants(branches,focus)
  const scoped=notes.filter(n=>focus===0?n.branch_id===null:!ids||ids.has(n.branch_id))
  const matching=scoped.filter(n=>!query||[n.title,n.summary,...n.tags].join(' ').toLowerCase().includes(query.toLowerCase()))
  if(!directoryRestored){let b=branches.find(b=>b.id===focus);while(b){expandedBranches.add(b.id);b=branches.find(p=>p.id===b.parent_id)}directoryRestored=true}
  const drawing=treeSvg(branches,matching,focus,showTitles,page),note=notes.find(n=>n.id===selected)
  root.innerHTML='<div class="tree-workspace"><aside class="tree-sidebar"><span class="eyebrow">A GROWING COLLECTION</span><h1>知识有根<br>思考成林</h1><label class="tree-search"><span class="sr-only">寻找知识点</span><input id="tree-search" value="'+e(query)+'" placeholder="寻找一片叶子…"></label><nav aria-label="知识分支">'+directoryHtml(branches,notes,{focus,selected,expanded:expandedBranches,query})+'</nav></aside><main class="tree-stage" id="main"><div class="scene-top"><span>'+(focus===null?'全树':focus===0?'待归枝':e(branchName(focus)))+' · '+matching.length+' 片叶子</span><label class="title-toggle"><input id="titles" type="checkbox" role="switch" '+(showTitles?'checked':'')+'>显示枝叶标题</label></div>'+drawing.svg+'<div class="tree-ground">扎根 · 联结 · 生长</div>'+(!matching.length?'<div class="tree-empty"><p>'+(!notes.length?'这是一棵等待生长的树。创建并发布知识点后，它会长出叶片。':'这条分枝暂时没有匹配的叶片。')+'</p></div>':'')+(focus!==null&&drawing.pages>1?'<div class="pagination"><button data-action="prev-page" '+(page===0?'disabled':'')+'>上一组</button><span>'+(page+1)+' / '+drawing.pages+'</span><button data-action="next-page" '+(page>=drawing.pages-1?'disabled':'')+'>下一组</button></div>':'')+(drawing.overview?'<p class="tree-hint">全景保留所有分支，叶片仅作代表；点击分类或展开目录查看全部知识。</p>':'')+'<div class="tree-results '+(!query?'mobile-results':'')+'">'+matching.map(n=>'<button data-note="'+n.id+'">'+e(n.title)+' <span>↗</span></button>').join('')+'</div></main><aside id="tree-detail" class="tree-detail"><span class="eyebrow">A LEAF OF KNOWLEDGE</span>'+(note?'<div class="detail-number">'+String(note.id).padStart(2,'0')+'</div><small>知识树 / '+e(branchName(note.branch_id))+'</small><h2>'+e(note.title)+'</h2><p>'+e(note.summary||'打开全文，沿着这片叶子继续探索。')+'</p><div class="tags">'+note.tags.map(t=>'<span>#'+e(t)+'</span>').join('')+'</div><a class="outline-button" href="'+urlFor('read',{note:note.id,from:'tree',...(focus!==null?{branch:focus}:{}),leaf:note.id})+'">展开阅读全文 ↗</a>':'<div class="detail-number">♧</div><h2>选择一片叶子，<br>开始阅读。</h2><p>每一片叶子，都是一次理解。点击枝条聚焦方向，点击叶片展开知识。</p>')+'</aside></div>'
  if(root.querySelector('.tree-sidebar nav'))root.querySelector('.tree-sidebar nav').scrollTop=directoryScroll
  if(selected)root.querySelector('.leaf[data-note="'+selected+'"]')?.classList.add('selected');
  if(state().get('cover')==='1'||!sessionStorage.getItem('zhimu:opened')&&!state().has('branch')&&!state().has('leaf'))showCover()
}
function renderRead(n){
  document.title=n.title+' · 知木'
  const from=state().get('from')==='tree'?'tree':'notes',back=urlFor(from,from==='tree'?{...(state().has('branch')?{branch:state().get('branch')}:{}),leaf:n.id}:{})
  root.innerHTML='<main class="reading-page" id="main"><a class="back-link" href="'+back+'">← 返回'+(from==='tree'?'知识树':'枝叶管理')+'</a><div class="reading-meta"><span>'+e(branchName(n.branch_id))+'</span><span>'+date(n.updated_at)+' 更新</span><span class="status-pill '+n.status+'">'+(n.status==='published'?'已发布':'草稿')+'</span></div><h1>'+e(n.title)+'</h1>'+(n.summary?'<p class="reading-summary">'+e(n.summary)+'</p>':'')+'<div class="tags">'+n.tags.map(t=>'<span>#'+e(t)+'</span>').join('')+'</div><article class="markdown">'+markdown(n.body||'这片叶子还在酝酿中。')+'</article>'+gallery(n.images||[])+timeline(n)+'<div class="reading-end"><span>END OF NOTE</span></div></main>'
}
function modal(html){dialog.innerHTML=html;dialog.showModal();subjectDirty=false;dialog.querySelector('input,textarea,select,button')?.focus();dirty=false}
function closeEditor(){if(dirty&&!confirm($('note-form')?'尚未保存，确定关闭？当前编辑内容会保留在本机草稿中。':'尚未保存，确定关闭？'))return;dialog.close();dirty=false}
async function editNote(id=0,target=null){
  const note=id?(await api('/notes/'+id)).note:{title:'',summary:'',body:'',tags:[],status:'draft',branch_id:target}
  let backup;try{backup=JSON.parse(localStorage.getItem('zhimu:note:'+id)||'null')}catch{}
  const n=backup?{...note,...backup}:note; n.images=typeof n.images==='string'?JSON.parse(n.images):(n.images||[])
  modal('<div class="knowledge-editor-shell"><form id="note-form" class="note-editor" data-id="'+id+'"><div class="dialog-heading"><div><span class="eyebrow">NURTURE A LEAF</span><h2 id="editor-title">'+(id?'编辑知识点':'写下新的理解')+'</h2></div><button type="button" class="close-button" data-action="close" aria-label="关闭编辑器">×</button></div><div class="form-message" role="alert"></div>'+(backup?'<p class="backup-hint">已恢复本机未保存草稿。<button type="button" data-action="discard-backup" data-id="'+id+'">丢弃本机草稿</button></p>':'')+'<div class="editor-fields"><label>标题<input name="title" required maxlength="150" value="'+e(n.title)+'" placeholder="这次理解了什么？"></label><label>所属分支<select name="branch_id">'+optionList(n.branch_id)+'</select></label><label class="full">一句话摘要<textarea name="summary" maxlength="500" rows="2" placeholder="记录现象、关键思路或结论。">'+e(n.summary)+'</textarea></label><label class="full">标签<input name="tags" value="'+e(n.tags.join(', '))+'" placeholder="用逗号分隔，例如 OpenWrt, 调试"></label></div>'+attachmentFields(n.images)+'<div class="editor-body"><label>正文 <span>支持表格、Mermaid 图、标题、列表和代码块</span>'+formatTools()+'<textarea aria-label="知识点正文" name="body" rows="15" maxlength="200000" placeholder="从一个问题开始记录…">'+e(n.body)+'</textarea></label><section><span class="eyebrow">READING PREVIEW</span><div id="live-preview" class="markdown">'+markdown(n.body)+'</div></section></div><div class="dialog-actions"><span id="draft-hint">草稿保存在本机，点击保存后同步到服务。</span><button type="button" data-action="close">取消</button><button type="submit" name="intent" value="draft">保存草稿</button><button class="primary" type="submit" name="intent" value="published">保存并发布</button></div></form>'+(id?recordPanel(note):'<p class="new-record-hint">先保存知识点，随后即可追加多次过程记录。</p>')+'</div>')
}
function editBranch(id=0,parent=null){
  const b=id?branches.find(b=>b.id===id):{name:'',description:'',parent_id:parent,sort_order:0}
  modal('<form id="branch-form" data-id="'+id+'"><div class="dialog-heading"><div><span class="eyebrow">GROW A BRANCH</span><h2 id="editor-title">'+(id?'编辑分支':'新的生长方向')+'</h2></div><button type="button" class="close-button" data-action="close" aria-label="关闭编辑器">×</button></div><div class="form-message" role="alert"></div><div class="simple-fields"><label>分支名称<input name="name" required maxlength="40" value="'+e(b.name)+'" placeholder="例如 无线网络"></label><label>所属分支<select name="parent_id">'+optionList(b.parent_id,id?descendants(branches,id):new Set())+'</select></label><label>简介<textarea name="description" maxlength="1000" rows="4" placeholder="这个方向主要记录什么？">'+e(b.description)+'</textarea></label>'+(id?'<label>排序值<input name="sort_order" type="number" step="1" required value="'+b.sort_order+'"></label>':'')+'</div><div class="dialog-actions"><button type="button" data-action="close">取消</button><button class="primary" type="submit">保存分支</button></div></form>')
}
function deleteBranch(id){
  const b=branches.find(b=>b.id===id)
  modal('<form id="delete-branch-form" data-id="'+id+'"><div class="dialog-heading"><div><span class="eyebrow">PRUNE WITH CARE</span><h2 id="editor-title">回收“'+e(b.name)+'”</h2></div><button type="button" class="close-button" data-action="close" aria-label="关闭">×</button></div><div class="form-message" role="alert"></div><div class="simple-fields"><label class="radio-label"><input type="radio" name="mode" value="move" checked>迁移知识点和直接子分支，再回收当前分支</label><label class="radio-label"><input type="radio" name="mode" value="subtree">整条分支与其中的知识点一同回收</label><label id="move-choice">迁移到<select name="move_to">'+optionList(null,descendants(branches,id))+'</select></label><p class="form-help">整枝恢复仅恢复本次回收的数据；此前单独删除的知识点不会被恢复。迁移后恢复分支不会撤回已迁移内容。</p></div><div class="dialog-actions"><button type="button" data-action="close">取消</button><button class="primary" type="submit">确认移入回收站</button></div></form>')
}
let timer
document.addEventListener('input',event=>{
  const input=event.target
  if(input.id==='search'){query=input.value;clearTimeout(timer);timer=setTimeout(()=>{const start=input.selectionStart;load().then(()=>{const n=$('search');if(n){n.focus();try{n.setSelectionRange(start,start)}catch{}}})},280)}
  if(input.id==='tree-search'){query=input.value;clearTimeout(timer);timer=setTimeout(()=>{renderTree();const n=$('tree-search');n?.focus();n?.setSelectionRange(query.length,query.length)},220)}
  if(input.closest('#record-form')&&input.name==='body')$('record-preview').innerHTML=markdown(input.value);
  if(dialog.open&&input.closest('form')){dirty=true;if(input.closest('form').id==='note-form')subjectDirty=true;else if(input.closest('form').id==='record-form'&&!recordEditing){const f=input.closest('form');try{localStorage.setItem('zhimu:record:'+f.dataset.note,JSON.stringify({body:f.elements.body.value,images:JSON.parse(f.elements.images.value)}))}catch{}}const form=input.closest('form').id==='note-form'?$('note-form'):null;if(form){const values=Object.fromEntries(new FormData(form));try{localStorage.setItem('zhimu:note:'+form.dataset.id,JSON.stringify({...values,branch_id:values.branch_id?Number(values.branch_id):null,tags:values.tags.split(/[,，]/).map(t=>t.trim()).filter(Boolean)}));$('draft-hint').textContent='未保存内容已保留在本机草稿'}catch{}if(input.name==='body')$('live-preview').innerHTML=markdown(input.value)}}
})
document.addEventListener('change',event=>{
  const t=event.target
  if(t.id==='filter-branch'){branchFilter=t.value;load()}
  if(t.id==='filter-status'){statusFilter=t.value;load()}
  if(t.id==='titles'){showTitles=t.checked;try{localStorage.setItem('zhimu:titles',String(showTitles))}catch{}$('knowledge-tree')?.classList.toggle('titles-visible',showTitles)}
  if(t.name==='mode'&&$('move-choice'))$('move-choice').hidden=t.value!=='move'
})
document.addEventListener('click',async event=>{
  const route=event.target.closest('[data-route]');if(route){event.preventDefault();navigate(route.dataset.route);return}
  const directory=event.target.closest('[data-directory]');if(directory){const id=Number(directory.dataset.directory);if(expandedBranches.has(id))expandedBranches.delete(id);else expandedBranches.add(id);page=0;selected=null;history.pushState(null,'',urlFor('tree',{branch:id}));renderTree();return}
  const directoryLeaf=event.target.closest('[data-directory-note]');if(directoryLeaf){const n=notes.find(n=>n.id===Number(directoryLeaf.dataset.directoryNote));if(!n)return;page=0;selected=n.id;let b=branches.find(b=>b.id===n.branch_id);while(b){expandedBranches.add(b.id);b=branches.find(p=>p.id===b.parent_id)}history.pushState(null,'',urlFor('tree',{branch:n.branch_id??0,leaf:n.id}));const siblings=notes.filter(x=>x.branch_id===n.branch_id&&(!query||[x.title,x.summary,...x.tags].join(' ').toLowerCase().includes(query.toLowerCase()))).sort((a,b)=>a.id-b.id);page=Math.max(0,Math.floor(siblings.findIndex(x=>x.id===n.id)/10));renderTree();return}
  const focus=event.target.closest('[data-focus]');if(focus){let b=branches.find(b=>b.id===Number(focus.dataset.focus));while(b){expandedBranches.add(b.id);b=branches.find(p=>p.id===b.parent_id)}const extra=focus.dataset.focus==='all'?{}:{branch:focus.dataset.focus};page=0;selected=null;history.pushState(null,'',urlFor('tree',extra));renderTree();return}
  const leaf=event.target.closest('.leaf[data-note],.tree-results [data-note]');if(leaf){selected=Number(leaf.dataset.note);renderTree();if(matchMedia('(max-width:700px)').matches)$('tree-detail').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion:reduce)').matches?'auto':'smooth'});return}
  const button=event.target.closest('[data-action]');if(!button||button.disabled)return
  const id=Number(button.dataset.id),action=button.dataset.action
  try{
    if(action==='retry')return load()
    if(action==='close')return closeEditor()
    if(action==='new-note')return editNote(0,button.dataset.branch?Number(button.dataset.branch):null)
    if(action==='edit-note')return editNote(id)
    if(action==='new-branch')return editBranch()
    if(action==='new-child')return editBranch(0,id)
    if(action==='edit-branch')return editBranch(id)
    if(action==='delete-branch')return deleteBranch(id)
    if(action==='delete-note'){if(!confirm('将这个知识点移入回收站？之后仍可恢复。'))return;await api('/notes/'+id,'DELETE');toast('知识点已移入回收站');return load()}
    if(action==='restore-note'||action==='restore-branch'){button.disabled=true;await api('/'+(action==='restore-note'?'notes':'branches')+'/'+id+'/restore','POST');toast('已恢复，枝叶可以继续生长');return load()}
    if(action==='up-branch'||action==='down-branch'){button.disabled=true;const b=branches.find(b=>b.id===id);await api('/branches/'+id,'PATCH',{sort_order:b.sort_order+(action==='up-branch'?-11:11)});return load()}
    if(action==='discard-backup'){localStorage.removeItem('zhimu:note:'+id);dirty=false;dialog.close();return editNote(id)}
    if(action==='prev-page'){page=Math.max(0,page-1);renderTree()}
    if(action==='next-page'){page++;renderTree()}
    if(action==='replay')showCover(true)
  }catch(error){toast(error.message);button.disabled=false}
})
document.addEventListener('keydown',event=>{if(['Enter',' '].includes(event.key)&&event.target.matches('.leaf,.branch-node')){event.preventDefault();event.target.dispatchEvent(new MouseEvent('click',{bubbles:true}))}})
document.addEventListener('submit',async event=>{
  if(!event.target.closest('#editor'))return
  event.preventDefault();const form=event.target,values=Object.fromEntries(new FormData(form)),id=Number(form.dataset.id),buttons=[...form.querySelectorAll('button')],message=form.querySelector('.form-message');message.textContent=''
  try{
    buttons.forEach(b=>b.disabled=true)
    if(form.id==='note-form'){const payload={...values,images:JSON.parse(values.images||'[]'),branch_id:values.branch_id?Number(values.branch_id):null,tags:values.tags.split(/[,，]/).map(t=>t.trim()).filter(Boolean),status:event.submitter?.value||'draft'};const result=await api('/notes'+(id?'/'+id:''),id?'PUT':'POST',payload);if(!id&&payload.status==='draft')form.dataset.created=result.id;try{localStorage.removeItem('zhimu:note:'+id)}catch{}}
    if(form.id==='record-form'){await api('/notes/'+form.dataset.note+'/records'+(Number(form.dataset.record)?'/'+form.dataset.record:''),Number(form.dataset.record)?'PUT':'POST',{body:values.body,images:JSON.parse(values.images||'[]')});if(!Number(form.dataset.record)){try{localStorage.removeItem('zhimu:record:'+form.dataset.note)}catch{}}dirty=subjectDirty;if(subjectDirty)await refreshRecords();else dialog.close();toast('本次记录已保存');await load();return}
    if(form.id==='branch-form'){await api('/branches'+(id?'/'+id:''),id?'PATCH':'POST',{...values,parent_id:values.parent_id?Number(values.parent_id):null,...(id?{sort_order:Number(values.sort_order)}:{})})}
    if(form.id==='delete-branch-form')await api('/branches/'+id,'DELETE',{mode:values.mode,move_to:values.move_to?Number(values.move_to):null})
    dirty=false;dialog.close();toast(form.id==='delete-branch-form'?'已移入回收站':'已保存，新的理解已留下');await load();if(form.dataset.created)await editNote(Number(form.dataset.created))
  }catch(error){message.textContent=error.message}finally{buttons.forEach(b=>b.disabled=false)}
})
dialog.addEventListener('cancel',event=>{event.preventDefault();closeEditor()})
window.addEventListener('beforeunload',event=>{if(dirty){event.preventDefault();event.returnValue=''}})
window.addEventListener('popstate',()=>{query='';page=0;selected=Number(state().get('leaf'))||null;load()})
function showCover(force=false){
  if($('cover'))return;if(!force&&view()!=='tree')return
  const cover=document.createElement('section');cover.id='cover';cover.setAttribute('aria-label','知木封面');cover.innerHTML=coverAccount(sessionAdmin)+'<div class="cover-copy"><span class="eyebrow">EVERY IDEA STARTS WITH A SEED</span><h2>知木</h2><p>把每一次理解，长成一片叶子。</p><button id="enter-tree">让知识生长 ↗</button></div><div class="horizon"></div><div class="seed"></div><div class="cover-caption">ZHIMU</div><div id="phase" aria-live="polite"></div><button id="skip-intro" hidden>跳过动画 →</button>'
  document.body.append(cover);root.inert=true;root.style.opacity='0';const previousOverflow=document.body.style.overflow;document.body.style.overflow='hidden'
  let clone,animations=[],timers=[]
  const finish=()=>{clearTimeout(coverTimer);timers.forEach(clearTimeout);animations.forEach(a=>a.cancel());clone?.remove();cover.remove();if(state().has('cover')){const params=state();params.delete('cover');history.replaceState(null,'','?'+params)};document.body.style.overflow=previousOverflow;root.inert=false;root.style.opacity='1';try{sessionStorage.setItem('zhimu:opened','1')}catch{}}
  $('skip-intro').onclick=finish
  $('enter-tree').onclick=()=>{
    if(matchMedia('(prefers-reduced-motion:reduce)').matches){finish();return}
    const actual=$('knowledge-tree');if(!actual){finish();return}
    try{
      cover.classList.add('growing');$('enter-tree').disabled=true;$('skip-intro').hidden=false;$('phase').textContent='向下扎根'
      const rect=actual.getBoundingClientRect(),size=Math.min(innerWidth*1.05,900),height=size*730/760
      clone=actual.cloneNode(true);clone.removeAttribute('id');clone.setAttribute('aria-hidden','true');clone.querySelectorAll('[tabindex]').forEach(n=>n.removeAttribute('tabindex'));clone.classList.add('intro-tree');Object.assign(clone.style,{width:size+'px',height:height+'px',left:(innerWidth/2-size/2)+'px',top:(innerHeight*.73-height*665/730)+'px'});cover.append(clone)
      const animate=(node,frames,duration,delay=0)=>{animations.push(node.animate(frames,{duration,delay,fill:'both',easing:'cubic-bezier(.35,0,.25,1)'}))}
      clone.querySelectorAll('text').forEach(n=>n.style.opacity='0')
      const trunk=clone.querySelector('.trunk');animate(trunk,[{clipPath:'inset(100% 0 0 0)'},{clipPath:'inset(0% 0 0 0)'}],1800,100)
      clone.querySelectorAll('path[data-wood]:not(.trunk)').forEach(p=>{const len=p.getTotalLength();animate(p,[{strokeDasharray:String(len),strokeDashoffset:len,opacity:0},{strokeDasharray:String(len),strokeDashoffset:0,opacity:1}],1500,400+(650-p.getBBox().y)*1.7)})
      clone.querySelectorAll('.leaf').forEach(l=>{l.style.transformBox='fill-box';l.style.transformOrigin='50% 80%';animate(l,[{opacity:0,transform:'scale(.02)'},{opacity:1,transform:'scale(1)'}],800,1500+(600-Number(l.dataset.y))*1.2)})
      animate(clone,[{width:size+'px',height:height+'px',left:clone.style.left,top:clone.style.top},{width:rect.width+'px',height:rect.height+'px',left:rect.left+'px',top:rect.top+'px'}],3000,400)
      timers.push(setTimeout(()=>$('phase').textContent='向上探索，让理解分出枝条',1000),setTimeout(()=>$('phase').textContent='每一片叶子，都是新的理解',2200),setTimeout(()=>{root.style.opacity='1';animate(clone,[{opacity:1},{opacity:0}],600)},3300));coverTimer=setTimeout(finish,4000)
    }catch(error){console.error(error);finish()}
  }
}

function mediaUrl(id){return './media/'+encodeURIComponent(id)}
function gallery(images=[]){return images.length?'<div class="image-gallery">'+images.map(id=>'<a href="'+mediaUrl(id)+'" target="_blank" rel="noopener"><img loading="lazy" src="'+mediaUrl(id)+'" alt="记录图片"></a>').join('')+'</div>':''}
function attachmentFields(images=[]){return '<section class="attachments"><input type="hidden" name="images" value="'+e(JSON.stringify(images))+'"><label class="image-upload">添加图片<input type="file" class="image-files" accept="image/png,image/jpeg,image/gif,image/webp" multiple><small>每次最多 5 张，每张 5 MB；每条内容最多 10 张</small></label><div class="image-selection">'+images.map(id=>'<div><img src="'+mediaUrl(id)+'" alt="待保存图片"><button type="button" data-action="remove-image" data-image="'+e(id)+'">移除</button></div>').join('')+'</div><p class="upload-status" role="status"></p></section>'}
function timeline(note,manage=false){return '<section class="record-timeline"><header><span class="eyebrow">PROCESS NOTES</span><h2>过程记录</h2><small>'+note.records.length+' 次积累 · 同一片叶子</small></header>'+note.records.map((r,i)=>'<article><div class="record-meta"><span>'+String(i+1).padStart(2,'0')+' / '+new Date(r.created_at*1000).toLocaleString('zh-CN')+'</span>'+(manage?'<div><button type="button" data-action="edit-record" data-id="'+r.id+'">编辑</button><button type="button" data-action="delete-record" data-id="'+r.id+'">删除本次记录</button></div>':'')+'</div><div class="markdown">'+markdown(r.body)+'</div>'+gallery(r.images)+'</article>').join('')+(!note.records.length?'<p>还没有过程记录。从一次观察、实验或新的理解开始追加。</p>':'')+'</section>'}
let currentKnowledge=null,recordEditing=0
function recordPanel(note){currentKnowledge=note;recordEditing=0;let local;try{local=JSON.parse(localStorage.getItem('zhimu:record:'+note.id)||'null')}catch{}const d=local||note.record_draft||{body:'',images:[]};return '<section id="record-panel" data-note="'+note.id+'">'+timeline(note,true)+'<form id="record-form" data-note="'+note.id+'" data-record="0"><h3 id="record-form-title">追加一次记录</h3><div class="form-message" role="alert"></div><label>记录正文'+formatTools()+'<textarea aria-label="本次记录正文" name="body" rows="7" maxlength="200000" placeholder="记录现象、排查过程、关键代码或新的结论…">'+e(d.body)+'</textarea></label><div class="record-live-preview"><span class="eyebrow">READING PREVIEW</span><div id="record-preview" class="markdown">'+markdown(d.body)+'</div></div>'+attachmentFields(d.images)+'<div class="record-actions"><button type="button" data-action="save-record-draft">保存记录草稿到服务器</button><button type="button" data-action="delete-record-draft">清除记录草稿</button><button type="button" data-action="cancel-record-edit" hidden>取消修改</button><button type="submit" class="primary">发布本次记录</button></div><p class="form-help">每次记录独立保存，可单独修改或删除，不改变知识点主体。</p></form></section>'}
async function refreshRecords(){const {note}=await api('/notes/'+currentKnowledge.id);$('record-panel').outerHTML=recordPanel(note)}
function startRecordEdit(id){const r=currentKnowledge.records.find(r=>r.id===id),form=$('record-form');if(!r)return;recordEditing=id;form.dataset.record=id;form.elements.body.value=r.body;$('record-preview').innerHTML=markdown(r.body);form.querySelector('.attachments').outerHTML=attachmentFields(r.images);$('record-form-title').textContent='修改记录 #'+id;form.querySelector('[type=submit]').textContent='保存本次修改';form.querySelector('[data-action=save-record-draft]').hidden=true;form.querySelector('[data-action=delete-record-draft]').hidden=true;form.querySelector('[data-action=cancel-record-edit]').hidden=false;form.scrollIntoView({behavior:'smooth',block:'start'})}
document.addEventListener('change',async event=>{
  const input=event.target;if(!input.matches('.image-files'))return
  const attachment=input.closest('.attachments'),form=input.closest('form'),status=attachment.querySelector('.upload-status'),hidden=attachment.querySelector('[name=images]'),existing=JSON.parse(hidden.value)
  if(input.files.length>5||existing.length+input.files.length>10){status.textContent='每次最多上传 5 张，每条内容最多 10 张';input.value='';return}
  const files=[...input.files];if(!files.length)return
  if(files.some(f=>f.size>5*1024*1024)){status.textContent='每张图片最大 5 MB';input.value='';return}
  const buttons=[...form.querySelectorAll('button')];buttons.forEach(b=>b.disabled=true);input.disabled=true;status.textContent='正在上传图片…'
  try{const data=new FormData();files.forEach(f=>data.append('images',f));const result=await api('/images','POST',data);attachment.outerHTML=attachmentFields([...existing,...result.images.map(x=>x.id)]);dirty=true;(form.id==='note-form'?form.elements.title:form.elements.body).dispatchEvent(new Event('input',{bubbles:true}));toast('图片已上传，保存内容后建立关联')}catch(error){status.textContent=error.message}finally{buttons.forEach(b=>b.disabled=false);input.disabled=false;input.value=''}
})
document.addEventListener('click',async event=>{
  const b=event.target.closest('[data-action]');if(!b)return
  const action=b.dataset.action,id=Number(b.dataset.id)
  try{
    if(action==='remove-image'){const attachment=b.closest('.attachments'),ids=JSON.parse(attachment.querySelector('[name=images]').value).filter(x=>x!==b.dataset.image);const form=attachment.closest('form');attachment.outerHTML=attachmentFields(ids);dirty=true;(form.id==='note-form'?form.elements.title:form.elements.body).dispatchEvent(new Event('input',{bubbles:true}));return}
    if(action==='edit-record')return startRecordEdit(id)
    if(action==='cancel-record-edit')return refreshRecords()
    if(action==='delete-record'){if(!confirm('删除这一次过程记录？知识点主体和其他记录会保留。'))return;await api('/notes/'+currentKnowledge.id+'/records/'+id,'DELETE');await refreshRecords();await load();toast('本次记录已删除');return}
    if(action==='save-record-draft'){const form=$('record-form');await api('/notes/'+currentKnowledge.id+'/record-draft','PUT',{body:form.elements.body.value,images:JSON.parse(form.elements.images.value)});toast('记录草稿已保存至服务器');return}
    if(action==='delete-record-draft'){if(!confirm('清除这份记录草稿？'))return;await api('/notes/'+currentKnowledge.id+'/record-draft','DELETE');localStorage.removeItem('zhimu:record:'+currentKnowledge.id);dirty=subjectDirty;await refreshRecords();toast('记录草稿已清除')}
    if(action==='append-record'){await editNote(id);$('record-panel')?.scrollIntoView({behavior:'smooth',block:'start'})}
  }catch(error){toast(error.message)}
})


function formatTools(){return '<span class="format-tools" role="toolbar" aria-label="正文格式">'+[['h2','标题'],['bold','粗体'],['list','列表'],['quote','引用'],['code','代码块'],['table','表格'],['mermaid','Mermaid 图']].map(([id,label])=>'<button type="button" aria-label="'+label+'" data-format="'+id+'">'+label+'</button>').join('')+'</span>'}
document.addEventListener('click',event=>{const b=event.target.closest('[data-format]');if(!b)return;const area=b.closest('form').elements.body,start=area.selectionStart,end=area.selectionEnd,selected=area.value.slice(start,end);const templates={table:'\n| 项目 | 说明 |\n| --- | --- |\n| 内容 | 描述 |\n',mermaid:'\n```mermaid\nflowchart LR\n  A[\"问题\"] --> B[\"分析\"] --> C[\"结论\"]\n```\n',h2:'\n## '+(selected||'标题')+'\n',bold:'**'+(selected||'重点')+'**',list:'\n- '+(selected||'条目')+'\n',quote:'\n> '+(selected||'引用')+'\n',code:'\n```\n'+(selected||'代码')+'\n```\n'};area.setRangeText(templates[b.dataset.format],start,end,'end');area.focus();area.dispatchEvent(new Event('input',{bubbles:true}))})

selected=Number(state().get('leaf'))||null
syncAuth().then(load).catch(error=>{root.textContent=error.message})


observeDiagrams()

async function syncAuth(){
  sessionAdmin=(await api('/auth/session')).admin
  document.body.classList.toggle('visitor',!sessionAdmin)
  const entry=$('auth-entry');entry.textContent=sessionAdmin?sessionAdmin.username:'登录';entry.href=urlFor(sessionAdmin?'account':'login',{return:'cover'});entry.title=sessionAdmin?'账号设置':''
}
document.addEventListener('submit',async event=>{
  if(event.target.id!=='auth-form')return
  event.preventDefault();const form=event.target,values=Object.fromEntries(new FormData(form)),button=form.querySelector('[type=submit]'),message=form.querySelector('.form-message');message.textContent='';button.disabled=true
  try{
    if(form.dataset.mode==='password'&&values.password!==values.confirm_password)throw new Error('两次输入的新密码不一致')
    await api('/auth/'+form.dataset.mode,'POST',values)
    await syncAuth()
    if(form.dataset.mode==='password'){navigate('login',{return:'cover'});toast('密码已更新，请重新登录')}else if(sessionAdmin.must_change)navigate('account',{return:'cover'});else navigate('tree',{cover:'1'})
  }catch(error){message.textContent=error.message}finally{button.disabled=false}
})
document.addEventListener('click',async event=>{if(!['logout-button','cover-logout'].includes(event.target.id))return;try{await api('/auth/logout','POST');dialog.close();dirty=false;await syncAuth();$('cover')?.remove();root.inert=false;root.style.opacity='1';document.body.style.overflow='';navigate('tree',{cover:'1'})}catch(error){toast(error.message)}})
