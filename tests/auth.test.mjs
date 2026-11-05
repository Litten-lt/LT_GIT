import test from 'node:test'
import assert from 'node:assert/strict'
import {createApp} from '../src/app.js'
import {setAdminPassword} from '../src/auth.js'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
async function setup(t,options={}){
  const folder=fs.mkdtempSync(path.join(os.tmpdir(),'zhimu-auth-'))
  const {app,db}=createApp({uploadDir:folder,...options});await setAdminPassword(db,'allen','a-good-test-password')
  const server=await new Promise(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s))})
  const base='http://127.0.0.1:'+server.address().port+(options.basePath||'')
  t.after(async()=>{await new Promise(r=>server.close(r));db.close();fs.rmSync(folder,{recursive:true,force:true})})
  const request=(url,method='GET',body,cookie='',headers={})=>fetch(base+url,{method,headers:{'Content-Type':'application/json',Cookie:cookie,...headers},body:body?JSON.stringify(body):undefined})
  const login=async()=>{const r=await request('/api/auth/login','POST',{username:'allen',password:'a-good-test-password'});assert.equal(r.status,200);return r.headers.get('set-cookie').split(';')[0]}
  return {db,request,login}
}
test('visitors read published knowledge only; all mutations and private attachments require admin',async t=>{
  const {db,request,login}=await setup(t),cookie=await login()
  const published=Number(db.prepare("INSERT INTO notes(title,body,status) VALUES('public','body','published')").run().lastInsertRowid)
  const draft=Number(db.prepare("INSERT INTO notes(title,body,status,images) VALUES('secret','private','draft','[\"secret.png\"]')").run().lastInsertRowid)
  db.prepare("INSERT INTO images(id,mime) VALUES('secret.png','image/png')").run()
  db.prepare("INSERT INTO record_drafts(note_id,body) VALUES(?,'private draft')").run(published)
  assert.equal((await request('/api/tree')).status,200)
  assert.equal((await (await request('/api/notes')).json()).notes.length,1)
  assert.equal((await request('/api/notes/'+draft)).status,404)
  assert.equal((await (await request('/api/notes/'+published)).json()).note.record_draft,null)
  assert.equal((await request('/media/secret.png')).status,404)
  assert.equal((await request('/api/notes?trash=1')).status,403)
  for(const route of ['/api/notes','/api/branches','/api/images','/api/notes/'+published+'/records','/api/notes/'+published+'/restore'])assert.equal((await request(route,'POST',{})).status,401)
  assert.equal((await request('/api/notes/'+published,'DELETE')).status,401)
  assert.equal((await request('/api/notes/'+draft,'GET',null,cookie)).status,200)
  assert.equal((await request('/api/branches','POST',{name:'test'},cookie)).status,201)
  assert.equal((await request('/api/branches','POST',{name:'bad'},cookie,{Origin:'https://attacker.invalid'})).status,403)
})
test('password change revokes all sessions, logout revokes its session, and repeated login failures are limited',async t=>{
  const {request,login}=await setup(t),a=await login(),b=await login()
  assert.equal((await request('/api/auth/password','POST',{current_password:'a-good-test-password',password:'a-better-test-password'},a)).status,200)
  assert.equal((await (await request('/api/auth/session','GET',null,b)).json()).admin,null)
  assert.equal((await request('/api/auth/login','POST',{username:'allen',password:'a-good-test-password'})).status,401)
  const r=await request('/api/auth/login','POST',{username:'allen',password:'a-better-test-password'}),cookie=r.headers.get('set-cookie').split(';')[0]
  await request('/api/auth/logout','POST',{},cookie)
  assert.equal((await (await request('/api/auth/session','GET',null,cookie)).json()).admin,null)
  for(let i=0;i<10;i++)await request('/api/auth/login','POST',{username:'allen',password:'wrong'})
  assert.equal((await request('/api/auth/login','POST',{username:'allen',password:'wrong'})).status,429)
})
test('production login enforces HTTPS and secure scoped cookies; initial password must be changed',async t=>{
  const {db,request}=await setup(t,{secureCookies:true,basePath:'/zhimu'})
  assert.equal((await request('/api/auth/login','POST',{username:'allen',password:'a-good-test-password'})).status,400)
  db.prepare('UPDATE admin SET must_change=1').run()
  const r=await request('/api/auth/login','POST',{username:'allen',password:'a-good-test-password'},'',{'X-Forwarded-Proto':'https'})
  const header=r.headers.get('set-cookie');assert.match(header,/HttpOnly/);assert.match(header,/Secure/);assert.match(header,/SameSite=Strict/);assert.match(header,/Path=\/zhimu/)
  assert.equal((await request('/api/branches','POST',{name:'test'},header.split(';')[0])).status,403)
})
