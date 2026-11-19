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
test('all knowledge and attachments require admin, including published content',async t=>{
  const {db,request,login}=await setup(t),cookie=await login()
  const published=Number(db.prepare("INSERT INTO notes(title,body,status) VALUES('public','body','published')").run().lastInsertRowid)
  const draft=Number(db.prepare("INSERT INTO notes(title,body,status,images) VALUES('secret','private','draft','[\"secret.png\"]')").run().lastInsertRowid)
  db.prepare("INSERT INTO images(id,mime) VALUES('secret.png','image/png')").run()
  db.prepare("INSERT INTO record_drafts(note_id,body) VALUES(?,'private draft')").run(published)
  for(const route of ['/api/tree','/api/branches','/api/notes','/api/notes/'+draft,'/api/notes/'+published]){
    assert.equal((await request(route)).status,401)
  }
  assert.equal((await request('/api/tree','GET',null,cookie)).status,200)
  assert.equal((await request('/media/secret.png')).status,404)
  assert.equal((await request('/api/notes?trash=1')).status,401)
  for(const route of ['/api/notes','/api/branches','/api/images','/api/notes/'+published+'/records','/api/notes/'+published+'/restore'])assert.equal((await request(route,'POST',{})).status,401)
  assert.equal((await request('/api/notes/'+published,'DELETE')).status,401)
  assert.equal((await request('/api/notes/'+draft,'GET',null,cookie)).status,200)
  assert.equal((await request('/api/branches','POST',{name:'test'},cookie)).status,201)
  assert.equal((await request('/api/branches','POST',{name:'bad'},cookie,{Origin:'https://attacker.invalid'})).status,403)
})
test('chess guests can create and join rooms but cannot access notes',async t=>{
  const {db,request}=await setup(t,{basePath:'/zhimu'})
  assert.equal((await request('/chess.html')).status,200)
  const created=await request('/api/chess/rooms','POST',{name:'周末桌',game:'mahjong',rule:'长沙麻将',password:'room-test'})
  assert.equal(created.status,201)
  const {roomId}=await created.json()
  const header=created.headers.get('set-cookie')
  assert.match(header,/HttpOnly/)
  assert.match(header,/Path=\/zhimu\/api\/chess/)
  const cookie=header.split(';')[0], join='/api/chess/rooms/'+roomId+'/join'
  assert.equal((await request('/api/tree','GET',null,cookie)).status,401)
  assert.equal((await request(join,'POST',{password:'room-test'},cookie)).status,200)
  assert.equal((await request(join,'POST',{})).status,403)
  assert.equal((await request(join,'POST',{password:'wrong'})).status,403)
  const results=await Promise.all(Array.from({length:4},()=>request(join,'POST',{password:'room-test'})))
  assert.deepEqual(results.map(r=>r.status).sort(),[200,200,200,409])
  const lobby=async(cookie='')=>(await request('/api/chess','GET',null,cookie)).json()
  const [{members,...listed}]=(await lobby(cookie)).rooms
  assert.deepEqual(listed,{id:roomId,name:'周末桌',rule:'长沙麻将',game:'麻将',players:4,capacity:4})
  assert.equal(members[0].name,(await lobby(cookie)).playerNumber)
  assert.equal(members.length,4)
  assert.equal((await lobby(cookie)).roomId,roomId)
  await request('/api/chess/leave','POST',{},cookie)
  assert.equal((await lobby(cookie)).roomId,null)
  assert.equal((await lobby()).rooms[0].players,3)
  db.prepare('UPDATE chess_seats SET seen_at=unixepoch()-301').run()
  assert.deepEqual((await lobby()).rooms,[])
})
test('chess nicknames persist and only the current owner can kick room members',async t=>{
  const {request}=await setup(t)
  const cookieOf=response=>response.headers.get('set-cookie').split(';')[0]
  const owner=cookieOf(await request('/api/chess/name','POST',{name:'东风'}))
  const guest=cookieOf(await request('/api/chess/name','POST',{name:'南风'}))
  const room=(await (await request('/api/chess/rooms','POST',{name:'好友桌',game:'mahjong',rule:'红中麻将',password:'room-test'},owner)).json()).roomId
  const join='/api/chess/rooms/'+room+'/join'
  await request(join,'POST',{password:'room-test'},guest)
  const lobby=async cookie=>(await (await request('/api/chess','GET',null,cookie)).json())
  const leader=await lobby(owner),member=await lobby(guest)
  assert.equal(leader.isOwner,true)
  assert.equal(member.isOwner,false)
  assert.deepEqual(member.rooms[0].members.map(player=>player.name),['东风','南风'])
  assert.ok(member.rooms[0].members.every(player=>!player.id))
  assert.ok((await lobby('')).rooms[0].members.every(player=>!player.id))
  const kick='/api/chess/rooms/'+room+'/kick/'+leader.rooms[0].members[1].id
  assert.equal((await request(kick,'POST',{},guest)).status,403)
  assert.equal((await request(kick,'POST',{},owner)).status,200)
  assert.equal((await lobby(guest)).roomId,null)
  assert.equal((await lobby(guest)).name,'南风')
  await request(join,'POST',{password:'room-test'},guest)
  await request('/api/chess/leave','POST',{},owner)
  assert.equal((await lobby(guest)).isOwner,true)
})
test('room owner starts a bot match, refreshes it, plays a full round and can start again',async t=>{
  const {db,request}=await setup(t)
  const created=await request('/api/chess/rooms','POST',{name:'练习桌',game:'mahjong',rule:'红中麻将',password:'room-test'})
  const cookie=created.headers.get('set-cookie').split(';')[0]
  const roomId=(await created.json()).roomId
  const base='/api/chess/rooms/'+roomId
  const post=(path,body={})=>request(base+path,'POST',body,cookie)
  assert.equal((await post('/start')).status,409)
  for(let i=0;i<3;i++)assert.equal((await post('/bots')).status,200)
  const first=await (await post('/start')).json()
  assert.equal((await request(base+'/match')).status,403)
  assert.equal((await (await post('/start')).json()).id,first.id)
  let state=await (await request(base+'/match','GET',null,cookie)).json()
  assert.equal(state.id,first.id)
  assert.equal(state.players.filter(player=>player.bot).length,3)
  assert.equal(state.hands,undefined)
  assert.equal(state.wall,undefined)
  if(state.phase!=='ended'){
    const rejected=await post('/match',{id:state.id,version:state.version-1,move:state.moves[0]})
    assert.equal(rejected.status,409)
  }
  for(let i=0;state.phase!=='ended'&&i<120;i++){
    if(!state.moves.length){
      db.prepare("UPDATE chess_matches SET state=json_set(state,'$.botAt',0) WHERE room_id=?").run(roomId)
      const next=await (await request(base+'/match','GET',null,cookie)).json()
      assert.equal(next.version,state.version+1)
      state=next
      continue
    }
    const move=state.moves.find(option=>option.type==='win')??state.moves[0]
    assert.ok(move)
    const response=await post('/match',{id:state.id,version:state.version,move})
    assert.equal(response.status,200)
    state=await response.json()
  }
  assert.equal(state.phase,'ended')
  assert.equal(state.scores.reduce((sum,score)=>sum+score,0),0)
  assert.notEqual((await (await post('/start')).json()).id,first.id)
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
