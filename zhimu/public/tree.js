export function leafLabel(note){const label=note.tags?.filter(Boolean).join(' · ')||note.title;return label.length>16?label.slice(0,16)+'…':label}
export const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))
export function descendants(branches,id){const ids=new Set([id]);let change=true;while(change){change=false;for(const b of branches)if(ids.has(b.parent_id)&&!ids.has(b.id)){ids.add(b.id);change=true}}return ids}
export function orderedBranches(branches){const result=[],seen=new Set();function visit(parent,depth){for(const b of [...branches].sort((a,b)=>a.sort_order-b.sort_order||a.id-b.id)){if((b.parent_id??null)!==parent||seen.has(b.id))continue;seen.add(b.id);result.push({...b,depth});visit(b.id,depth+1)}}visit(null,0);return result}
// Sample the actual cubic branch, then align the petiole with the leaf's base.
export function leafGeometry(curve,t,side,length=27){
  const [a,b,c,d]=curve,u=1-t
  const joint={x:u*u*u*a.x+3*u*u*t*b.x+3*u*t*t*c.x+t*t*t*d.x,y:u*u*u*a.y+3*u*u*t*b.y+3*u*t*t*c.y+t*t*t*d.y}
  const dx=3*u*u*(b.x-a.x)+6*u*t*(c.x-b.x)+3*t*t*(d.x-c.x),dy=3*u*u*(b.y-a.y)+6*u*t*(c.y-b.y)+3*t*t*(d.y-c.y)
  const magnitude=Math.hypot(dx,dy)||1,tx=dx/magnitude,ty=dy/magnitude
  let vx=tx*.45-ty*side*.85,vy=ty*.45+tx*side*.85
  const norm=Math.hypot(vx,vy);vx/=norm;vy/=norm
  return {joint,base:{x:joint.x+vx*length,y:joint.y+vy*length},direction:{x:vx,y:vy},angle:Math.atan2(vx,-vy)*180/Math.PI}
}
// A full tree is an overview, a category is a readable set of ten leaves.
export function treeSvg(branches,notes,focus=null,titles=false,page=0){
  const order=(a,b)=>a.sort_order-b.sort_order||a.id-b.id
  const focused=branches.find(b=>b.id===focus)
  const children=branches.filter(b=>b.parent_id===focus).sort(order)
  const overview=focus===null||children.length>0
  const paths=[],nodes=[],leaves=[],colors=['#799a69','#68916d','#a1af72','#85a176']
  let pages=1
  function limb(b,start,end,list,color,{depth=0,compact=false}={}){
    const curve=[start,{x:start.x+(end.x-start.x)*.18,y:start.y-(start.y-end.y)*.55},{x:end.x-(end.x-start.x)*.25,y:end.y+25},end]
    paths.push('<path data-wood'+(b?' data-branch="'+b.id+'"':'')+' d="M'+start.x+' '+start.y+' C'+curve[1].x+' '+curve[1].y+','+curve[2].x+' '+curve[2].y+','+end.x+' '+end.y+'" stroke-width="'+(depth?Math.max(1.5,3.6-depth*.6):overview?6:5)+'"/>')
    if(b)nodes.push('<g class="branch-node" data-depth="'+depth+'" role="button" tabindex="0" data-focus="'+b.id+'" aria-label="聚焦 '+escapeHtml(b.name)+'"><title>'+escapeHtml(b.name)+'</title><circle cx="'+end.x+'" cy="'+end.y+'" r="25" fill="transparent"/><circle cx="'+end.x+'" cy="'+end.y+'" r="4" fill="#a3af86"/><text x="'+end.x+'" y="'+(end.y-18)+'" text-anchor="middle">'+escapeHtml(b.name)+'</text></g>')
    list.forEach((n,i)=>{
      const t=compact?.66:overview?.35+i*.22:.22+i*.155
      const g=leafGeometry(curve,t,i%2===0?-1:1,compact?16:overview?30:34)
      const {x:tx,y:ty}=g.joint,{x:lx,y:ly}=g.base
      leaves.push('<g class="leaf" data-note="'+n.id+'" data-y="'+ly+'" role="button" tabindex="0" aria-label="'+escapeHtml(n.title)+'"><title>'+escapeHtml(n.title)+'</title><path data-wood class="twig" d="M'+tx+' '+ty+' Q'+(tx+(lx-tx)*.48)+' '+(ty+(ly-ty)*.48)+' '+lx+' '+ly+'"/><circle cx="'+lx+'" cy="'+(ly-10)+'" r="'+(compact?16:24)+'" fill="transparent"/><g transform="translate('+lx+' '+ly+') rotate('+g.angle+')'+(compact?' scale(.65)':'')+'"><path class="blade" d="M0 0 C-22 -9 -21 -29 0 -43 C21 -29 22 -9 0 0Z" fill="'+colors[color%4]+'"/><path d="M0 0 V-38 M0 -12 L-10 -22 M0 -23 L9 -32" stroke="#e6efc6" stroke-width=".7" opacity=".5"/></g>'+(compact?'':'<text x="'+lx+'" y="'+(ly+26)+'" text-anchor="middle">'+escapeHtml(leafLabel(n))+'</text>')+'</g>')
    })
    return curve
  }
  if(focus===null){
    const roots=branches.filter(b=>b.parent_id===null).sort(order)
    if(notes.some(n=>n.branch_id===null))roots.push({id:0,name:'待归枝'})
    roots.forEach((b,i)=>{
      const spread=[60,175,290,480,595,710]
      const x=roots.length===6?spread[i]:roots.length===1?185:60+i*650/(roots.length-1),side=x<385?-1:1
      const y=510+(i%3)*20,endY=105+Math.abs(x-385)*.34+(i%2)*20
      function grow(branch,start,end,depth,ancestry=new Set()){
        if(ancestry.has(branch.id))return
        const next=new Set([...ancestry,branch.id]),children=branches.filter(c=>c.parent_id===branch.id).sort(order)
        const own=notes.filter(n=>branch.id===0?n.branch_id===null:n.branch_id===branch.id).sort((a,b)=>a.id-b.id)
        const curve=limb(branch,start,end,own.slice(0,children.length?1:depth?1:3),i,{depth,compact:depth>0})
        children.forEach((child,j)=>{
          const t=children.length===1?.62:.28+j*.6/(children.length-1)
          const joint=leafGeometry(curve,t,1,0).joint
          grow(child,joint,{x:joint.x+side*(depth?24:42)+(j-(children.length-1)/2)*18,y:joint.y-(depth?32:44)-(j%2)*22},depth+1,next)
        })
      }
      grow(b,{x:385+(i%2)*3,y},{x,y:endY},0)
    })
  }else if(children.length){
    const groups=[...(notes.some(n=>n.branch_id===focus)?[focused]:[]),...children].filter(Boolean)
    groups.forEach((b,i)=>{
      const x=groups.length===1?380:85+i*590/(groups.length-1),y=175+Math.abs(x-380)*.3
      const ids=b.id===focus?new Set([focus]):descendants(branches,b.id)
      const list=notes.filter(n=>ids.has(n.branch_id)).sort((a,b)=>a.id-b.id)
      limb(b,{x:385,y:535},{x,y},list.slice(0,3),i)
    })
  }else{
    const ids=descendants(branches,focus)
    const list=notes.filter(n=>focus===0?n.branch_id===null:ids.has(n.branch_id)).sort((a,b)=>a.id-b.id)
    pages=Math.max(1,Math.ceil(list.length/10))
    const shown=list.slice(Math.min(page,pages-1)*10,(Math.min(page,pages-1)+1)*10)
    limb(null,{x:385,y:565},{x:140,y:155},shown.filter((_,i)=>i%2===0),0)
    limb(null,{x:385,y:535},{x:625,y:155},shown.filter((_,i)=>i%2===1),1)
  }
  return {pages,overview,svg:'<svg id="knowledge-tree" class="knowledge-tree '+(titles?'titles-visible':'')+'" viewBox="0 0 760 730" role="group" aria-label="可交互知识树"><ellipse cx="380" cy="667" rx="140" ry="11" fill="#c1cbb0" opacity=".18"/><path data-wood class="trunk" d="M370 665 Q387 592 379 510 Q374 390 389 125 L396 125 Q386 390 392 513 Q396 593 401 665Z"/><g class="wood"><path data-wood d="M380 642 Q345 675 285 680 M393 643 Q435 680 482 679 M380 655 Q374 689 349 701" stroke-width="3"/>'+paths.join('')+'</g>'+nodes.join('')+leaves.join('')+'</svg>'}
}
