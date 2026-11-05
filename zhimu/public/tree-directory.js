import {escapeHtml as e,descendants} from './tree.js'

export function directoryHtml(branches,notes,{focus=null,selected=null,expanded=new Set(),query=''}={}){
  const term=query.trim().toLowerCase()
  const matches=n=>!term||[n.title,n.summary,...n.tags].join(' ').toLowerCase().includes(term)
  const sorted=[...branches].sort((a,b)=>a.sort_order-b.sort_order||a.id-b.id)
  function branchRow(b,depth){
    const ids=descendants(branches,b.id),scoped=notes.filter(n=>ids.has(n.branch_id))
    if(term&&!scoped.some(matches))return ''
    const children=sorted.filter(c=>c.parent_id===b.id),own=notes.filter(n=>n.branch_id===b.id&&matches(n))
    const open=term||expanded.has(b.id),panel='directory-branch-'+b.id
    return '<div class="directory-group" style="--directory-depth:'+Math.min(depth,6)+'"><button class="directory-branch '+(focus===b.id?'active':'')+'" data-directory="'+b.id+'" aria-expanded="'+Boolean(open)+'" aria-controls="'+panel+'"><span class="directory-chevron" aria-hidden="true">'+(open?'⌄':'›')+'</span><span class="directory-name">'+e(b.name)+'</span><small>'+scoped.length+'</small></button><div id="'+panel+'"'+(open?'':' hidden')+'>'+children.map(c=>branchRow(c,depth+1)).join('')+own.map(n=>'<button class="directory-leaf '+(selected===n.id?'selected':'')+'" style="--directory-depth:'+Math.min(depth+1,7)+'" data-directory-note="'+n.id+'" title="'+e(n.title)+'"><span aria-hidden="true">♧</span><span>'+e(n.title)+'</span></button>').join('')+'</div></div>'
  }
  const unassigned=notes.filter(n=>n.branch_id===null&&matches(n))
  return '<button data-focus="all" class="'+(focus===null?'active':'')+'">整棵树 <small>'+notes.length+'</small></button>'+sorted.filter(b=>b.parent_id===null).map(b=>branchRow(b,0)).join('')+(unassigned.length?'<div class="directory-unassigned"><button data-focus="0">待归枝 <small>'+unassigned.length+'</small></button>'+unassigned.map(n=>'<button class="directory-leaf" data-directory-note="'+n.id+'"><span>♧</span><span>'+e(n.title)+'</span></button>').join('')+'</div>':'')+(term&&!notes.some(matches)?'<p class="directory-empty">没有匹配的知识点</p>':'')
}
