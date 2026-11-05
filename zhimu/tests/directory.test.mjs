import test from 'node:test'
import assert from 'node:assert/strict'
import {directoryHtml} from '../public/tree-directory.js'
import {treeSvg} from '../public/tree.js'

const branches=[{id:1,parent_id:null,name:'编程基础',sort_order:0},{id:2,parent_id:1,name:'C 语言',sort_order:0},{id:3,parent_id:null,name:'网络',sort_order:1}]
const notes=[{id:10,branch_id:2,title:'const <test>',tags:[]},{id:11,branch_id:3,title:'TCP',tags:[]}]
test('directory exposes nested branches and actual leaf titles with accessible collapse state',()=>{
  const closed=directoryHtml(branches,notes)
  assert.match(closed,/aria-expanded="false" aria-controls="directory-branch-1"/)
  assert.match(closed,/id="directory-branch-1" hidden/)
  const open=directoryHtml(branches,notes,{expanded:new Set([1,2]),selected:10})
  assert.match(open,/aria-expanded="true" aria-controls="directory-branch-1"/)
  assert.match(open,/class="directory-leaf selected"/)
  assert.match(open,/data-directory-note="10"/)
  assert.match(open,/const &lt;test&gt;/)
  const search=directoryHtml(branches,notes,{query:'const'})
  assert.match(search,/aria-expanded="true"/)
  assert.ok(!search.includes('data-directory="3"'))
})
test('large trees limit overview density and show every leaf through focused pagination',()=>{
  const taxonomy=Array.from({length:6},(_,i)=>({id:i+1,parent_id:null,name:'主枝'+i,sort_order:i}))
  taxonomy.push(...Array.from({length:18},(_,i)=>({id:7+i,parent_id:1+i%6,name:'分类'+i,sort_order:i})))
  const data=Array.from({length:187},(_,i)=>({id:i+1,branch_id:7+i%18,title:'知识'+i,tags:[]}))
  assert.equal((treeSvg(taxonomy,data).svg.match(/class="leaf"/g)||[]).length,18)
  const full=treeSvg(taxonomy,data).svg
  for(const branch of taxonomy){assert.ok(full.includes('data-branch="'+branch.id+'"'));assert.ok(full.includes('data-focus="'+branch.id+'"'))}
  const emptyBranch={id:100,parent_id:7,name:'尚未长叶的分支',sort_order:0}
  assert.ok(treeSvg([...taxonomy,emptyBranch],data).svg.includes('data-branch="100"'))
  assert.equal((treeSvg(taxonomy,data,1).svg.match(/class="leaf"/g)||[]).length,9)
  const scoped=data.filter(n=>n.branch_id===7),ids=new Set()
  const pages=treeSvg(taxonomy,scoped,7).pages
  for(let page=0;page<pages;page++)for(const [,id] of treeSvg(taxonomy,scoped,7,false,page).svg.matchAll(/data-note="(\d+)"/g))ids.add(Number(id))
  assert.deepEqual([...ids].sort((a,b)=>a-b),scoped.map(n=>n.id))
})
