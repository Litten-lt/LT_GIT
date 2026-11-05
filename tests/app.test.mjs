import {setAdminPassword} from '../src/auth.js'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { createApp } from '../src/app.js'
import { descendants, orderedBranches, treeSvg, escapeHtml, leafGeometry, leafLabel } from '../public/tree.js'

async function setup(t,options={}) {
  const uploadDir=await mkdtemp(path.join(tmpdir(),'zhimu-images-'))
  const {app,db}=createApp({...options,uploadDir})
  const server=await new Promise(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s))})
  const base=`http://127.0.0.1:${server.address().port}${options.basePath||''}`
  t.after(async()=>{await new Promise(r=>server.close(r));db.close();await rm(uploadDir,{recursive:true,force:true})})
  await setAdminPassword(db,'testadmin','test-password-12345')
  const login=await fetch(base+'/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:'testadmin',password:'test-password-12345'})});const adminCookie=login.headers.get('set-cookie').split(';')[0]
  const request=async(route,method='GET',body,headers={})=>{const response=await fetch(base+'/api'+route,{method,headers:{Cookie:adminCookie,...(body?{'Content-Type':'application/json'}:{}),...headers},body:body?JSON.stringify(body):undefined});return {status:response.status,data:await response.json()}}
  const branch=async(name,parent_id=null)=>{const r=await request('/branches','POST',{name,parent_id});assert.equal(r.status,201);return r.data.branch}
  const note=async(change={})=>{const r=await request('/notes','POST',{title:'知识点',body:'## 原理\n正文',status:'published',...change});assert.equal(r.status,201,JSON.stringify(r.data));return r.data.id}
  return {request,branch,note,base,db,adminCookie}
}
test('independent empty project, nested base path and static assets work',async t=>{
  const {request,base}=await setup(t,{basePath:'/zhimu'})
  assert.equal((await request('/health')).data.app,'zhimu')
  assert.deepEqual((await request('/tree')).data,{branches:[],notes:[]})
  for(const asset of ['/','/app.js','/style.css','/tree.js'])assert.equal((await fetch(base+asset)).status,200)
})
test('branch CRUD validates parents, cycles, names and ordering',async t=>{
  const {request,branch}=await setup(t),parent=await branch('网络'),child=await branch('WiFi',parent.id)
  assert.equal((await request('/branches/'+child.id,'PATCH',{name:'无线',sort_order:23})).data.branch.name,'无线')
  for(const parent_id of [parent.id,child.id])assert.equal((await request('/branches/'+parent.id,'PATCH',{parent_id})).status,400)
  assert.equal((await request('/branches','POST',{name:'',parent_id:null})).status,400)
  assert.equal((await request('/branches','POST',{name:'错误',parent_id:12345})).status,400)
  assert.equal((await request('/branches/'+child.id,'PATCH',{parent_id:null})).status,200)
})
test('notes support create, full-text search, patch, publication and individual recovery',async t=>{
  const {request,branch,note}=await setup(t),b=await branch('系统'),id=await note({branch_id:b.id,title:'网络',body:'排查 DHCP',tags:['Linux']})
  assert.equal((await request('/notes?q=DHCP')).data.notes[0].id,id)
  assert.equal((await request('/notes/'+id,'PUT',{title:'网络复盘',status:'draft'})).status,200)
  assert.equal((await request('/tree')).data.notes.length,0)
  assert.equal((await request('/notes/'+id,'PUT',{status:'published'})).status,200)
  assert.equal((await request('/tree')).data.notes[0].title,'网络复盘')
  assert.equal((await request('/notes/'+id,'DELETE')).status,200)
  assert.equal((await request('/notes/'+id)).status,404)
  assert.equal((await request('/notes?trash=1')).data.notes.length,1)
  assert.equal((await request('/notes/'+id+'/restore','POST')).status,200)
  assert.deepEqual((await request('/notes/'+id)).data.note.tags,['Linux'])
})
test('invalid note payloads and cross-origin writes are rejected',async t=>{
  const {request,note}=await setup(t),id=await note()
  for(const body of [{title:''},{status:'invalid'},{tags:[42]},{body:'',status:'published'},{branch_id:444}])assert.equal((await request('/notes/'+id,'PUT',body)).status,400)
  assert.equal((await request('/branches','POST',{name:'恶意来源'},{origin:'https://other.example'})).status,403)
  assert.equal((await request('/notes/not-a-number')).status,400)
})
test('subtree trash and restoration preserve earlier independent trash',async t=>{
  const {request,branch,note}=await setup(t),root=await branch('根'),child=await branch('子',root.id)
  const live=await note({branch_id:child.id}),draft=await note({branch_id:child.id,status:'draft'}),old=await note({branch_id:child.id})
  await request('/notes/'+old,'DELETE')
  assert.equal((await request('/branches/'+root.id,'DELETE',{mode:'subtree'})).status,200)
  assert.equal((await request('/tree')).data.notes.length,0)
  assert.equal((await request('/branches/'+root.id+'/restore','POST')).status,200)
  assert.equal((await request('/notes/'+live)).status,200)
  assert.equal((await request('/notes/'+draft)).data.note.status,'draft')
  assert.equal((await request('/notes/'+old)).status,404)
})
test('branch migration is atomic and rejects descendant targets',async t=>{
  const {request,branch,note}=await setup(t),a=await branch('A'),b=await branch('B',a.id),target=await branch('目标'),id=await note({branch_id:a.id})
  assert.equal((await request('/branches/'+a.id,'DELETE',{mode:'move',move_to:b.id})).status,400)
  assert.equal((await request('/notes/'+id)).data.note.branch_id,a.id)
  await request('/branches/'+a.id,'DELETE',{mode:'move',move_to:target.id})
  assert.equal((await request('/notes/'+id)).data.note.branch_id,target.id)
  assert.equal((await request('/branches')).data.branches.find(x=>x.id===b.id).parent_id,target.id)
})
test('restoring one leaf from a trashed branch moves it to unassigned',async t=>{
  const {request,branch,note}=await setup(t),b=await branch('树枝'),id=await note({branch_id:b.id})
  await request('/branches/'+b.id,'DELETE',{mode:'subtree'})
  await request('/notes/'+id+'/restore','POST')
  assert.equal((await request('/notes/'+id)).data.note.branch_id,null)
  await request('/branches/'+b.id+'/restore','POST')
  assert.equal((await request('/notes/'+id)).data.note.branch_id,null)
})
test('database survives restart with hierarchy and note content',async()=>{
  const folder=await mkdtemp(path.join(tmpdir(),'zhimu-')),filename=path.join(folder,'notes.db')
  try{const first=createApp({filename});first.db.prepare("INSERT INTO branches(name) VALUES('持久分支')").run();first.db.prepare("INSERT INTO notes(title,body,branch_id) VALUES('持久笔记','正文',1)").run();first.db.close();const second=createApp({filename});assert.equal(second.db.prepare('SELECT body FROM notes').get().body,'正文');assert.equal(second.db.prepare('SELECT branch_id FROM notes').get().branch_id,1);second.db.close()}finally{await rm(folder,{recursive:true,force:true})}
})
test('tree layout, pagination and escaping remain deterministic',()=>{
  const branches=[{id:1,name:'主枝',parent_id:null,sort_order:0},{id:2,name:'子枝',parent_id:1,sort_order:0}],notes=Array.from({length:30},(_,i)=>({id:i+1,title:'叶子'+i,branch_id:2}))
  assert.equal(descendants(branches,1).size,2);assert.equal(orderedBranches(branches)[1].depth,1)
  const overview=treeSvg(branches,notes),detail=treeSvg(branches,notes,2,false,1)
  assert.equal((overview.svg.match(/class="leaf"/g)||[]).length,1)
  assert.equal(detail.pages,3);assert.equal((detail.svg.match(/class="leaf"/g)||[]).length,10)
  assert.ok(detail.svg.includes('data-note="11"'))
  assert.ok(!detail.svg.includes('data-note="1"'))
  assert.equal(overview.svg,treeSvg(branches,notes).svg)
  assert.ok(!escapeHtml('<script>').includes('<'))
})

test('petioles originate on the curved branch and end at the rotated leaf base',()=>{
  const curve=[{x:380,y:570},{x:330,y:465},{x:235,y:450},{x:200,y:425}]
  for(const side of [-1,1]){
    const g=leafGeometry(curve,.5,side,27)
    assert.equal(g.joint.x,(380+3*330+3*235+200)/8)
    assert.equal(g.joint.y,(570+3*465+3*450+425)/8)
    assert.ok(Math.abs(Math.hypot(g.base.x-g.joint.x,g.base.y-g.joint.y)-27)<1e-9)
    const angle=g.angle*Math.PI/180
    assert.ok(Math.abs(Math.sin(angle)-g.direction.x)<1e-9)
    assert.ok(Math.abs(-Math.cos(angle)-g.direction.y)<1e-9)
    const dx=.75*(330-380)+1.5*(235-330)+.75*(200-235)
    const dy=.75*(465-570)+1.5*(450-465)+.75*(425-450)
    assert.ok((dx*g.direction.y-dy*g.direction.x)*side>0)
  }
})

test('leaf labels prefer tags, keep title fallback and never duplicate knowledge for records',()=>{
  assert.equal(leafLabel({title:'RCU 原理',tags:['RCU']}),'RCU')
  assert.equal(leafLabel({title:'RCU 原理',tags:[]}),'RCU 原理')
})

test('image upload validates bytes and images persist on knowledge and individual records',async t=>{
  const {request,note,base,adminCookie}=await setup(t,{basePath:'/zhimu'})
  const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX1sAAAAASUVORK5CYII=','base64')
  const form=new FormData();form.append('images',new Blob([png],{type:'image/png'}),'pixel.png')
  const upload=await fetch(base+'/api/images',{method:'POST',headers:{Cookie:adminCookie},body:form});assert.equal(upload.status,201)
  const image=(await upload.json()).images[0].id
  const file=await fetch(base+'/media/'+image,{headers:{Cookie:adminCookie}});assert.equal(file.headers.get('content-type'),'image/png');assert.deepEqual(Buffer.from(await file.arrayBuffer()),png)
  const bad=new FormData();bad.append('images',new Blob(['<script>alert(1)</script>'],{type:'image/png'}),'fake.png')
  assert.equal((await fetch(base+'/api/images',{method:'POST',headers:{Cookie:adminCookie},body:bad})).status,400)
  const id=await note({images:[image]}),other=await note()
  assert.deepEqual((await request('/notes/'+id)).data.note.images,[image])
  await request('/notes/'+id+'/record-draft','PUT',{body:'暂存观察',images:[image]})
  assert.deepEqual((await request('/notes/'+id)).data.note.record_draft.images,[image])
  const first=await request('/notes/'+id+'/records','POST',{body:'第一次排查 DHCP',images:[image]})
  const second=await request('/notes/'+id+'/records','POST',{body:'第二次实验',images:[]})
  assert.equal(first.status,201);assert.equal(second.status,201)
  let content=(await request('/notes/'+id)).data.note
  assert.equal(content.records.length,2);assert.equal(content.record_draft,null)
  assert.deepEqual(content.records[0].images,[image])
  assert.equal((await request('/notes/'+other+'/records/'+first.data.id,'PUT',{body:'错误修改'})).status,404)
  await request('/notes/'+id+'/records/'+first.data.id,'PUT',{body:'修订为 RCU 证据',images:[image]})
  assert.equal((await request('/notes?q=RCU')).data.notes[0].id,id)
  await request('/notes/'+id+'/records/'+second.data.id,'DELETE')
  content=(await request('/notes/'+id)).data.note
  assert.equal(content.records.length,1);assert.equal(content.title,'知识点');assert.equal(content.records[0].body,'修订为 RCU 证据')
  assert.equal((await request('/tree')).data.notes.length,2)
  await request('/notes/'+id,'DELETE')
  assert.equal((await request('/notes/'+id+'/records','POST',{body:'错误追加'})).status,404)
  await request('/notes/'+id+'/restore','POST')
  assert.equal((await request('/notes/'+id)).data.note.records.length,1)
  assert.equal((await request('/notes/'+id,'PUT',{images:['../../missing']})).status,400)
})
