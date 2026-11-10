import {registerAuth} from './auth.js'
import express from 'express'
import { registerRecords } from './records.js'
import Database from 'better-sqlite3'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { randomUUID } from 'node:crypto'

const publicDir=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../public')
const fail=(message,status=400)=>{throw Object.assign(new Error(message),{status})}
const idOf=value=>{const id=Number(value);if(!Number.isSafeInteger(id)||id<=0)fail('编号无效');return id}
const nullableId=value=>value==null||value===''?null:idOf(value)
const text=(value,max,label,trim=true)=>{if(typeof value!=='string'||value.length>max)fail(`${label}需为文字，且不超过 ${max} 字`);return trim?value.trim():value}

export function createApp({filename=':memory:',basePath='',secureCookies=false,backupFile,uploadDir=path.join(path.dirname(filename===':memory:'?path.join(publicDir,'../data/zhimu.db'):filename),'uploads')}={}) {
  if(basePath && !/^\/[a-z0-9-]+$/.test(basePath))throw new Error('BASE_PATH 格式无效')
  if(filename!==':memory:')fs.mkdirSync(path.dirname(filename),{recursive:true})
  const db=new Database(filename);db.pragma('foreign_keys=ON');db.pragma('journal_mode=WAL')
  db.exec(`CREATE TABLE IF NOT EXISTS branches(
    id INTEGER PRIMARY KEY AUTOINCREMENT,parent_id INTEGER REFERENCES branches(id) ON DELETE SET NULL,
    name TEXT NOT NULL,description TEXT NOT NULL DEFAULT '',sort_order INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL DEFAULT(unixepoch()),updated_at INTEGER NOT NULL DEFAULT(unixepoch()),deleted_at INTEGER,trash_group TEXT);
    CREATE INDEX IF NOT EXISTS branch_parent ON branches(parent_id,sort_order,id);
    CREATE TABLE IF NOT EXISTS notes(
    id INTEGER PRIMARY KEY AUTOINCREMENT,branch_id INTEGER REFERENCES branches(id) ON DELETE SET NULL,
    title TEXT NOT NULL,summary TEXT NOT NULL DEFAULT '',body TEXT NOT NULL DEFAULT '',tags TEXT NOT NULL DEFAULT '[]',
    status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','published')),
    created_at INTEGER NOT NULL DEFAULT(unixepoch()),updated_at INTEGER NOT NULL DEFAULT(unixepoch()),deleted_at INTEGER,trash_group TEXT,
    source_system TEXT,source_id TEXT,UNIQUE(source_system,source_id));
    CREATE INDEX IF NOT EXISTS note_branch ON notes(branch_id,deleted_at,status,id);`)
  const app=express(),router=express.Router();app.disable('x-powered-by');app.set('trust proxy','loopback')
  app.use((req,res,next)=>{res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','same-origin');res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; object-src 'none'; base-uri 'self'; frame-ancestors 'self'");next()})
  router.use('/api',(req,res,next)=>{res.setHeader('Cache-Control','no-store');if(!['GET','HEAD'].includes(req.method)&&req.get('origin')){try{if(new URL(req.get('origin')).host!==req.get('host'))return res.status(403).json({error:'请从本站管理界面提交修改'})}catch{return res.status(403).json({error:'来源无效'})}}next()})
  router.use(express.json({limit:'600kb'}))
  registerAuth(router,db,{basePath,secureCookies,backupFile})
  const {validateImages,recordsFor,draftFor}=registerRecords(router,db,uploadDir)
  const branch=id=>db.prepare('SELECT * FROM branches WHERE id=?').get(id)
  const descendants=id=>db.prepare('WITH RECURSIVE sub(id) AS(SELECT id FROM branches WHERE id=? UNION SELECT b.id FROM branches b JOIN sub s ON b.parent_id=s.id) SELECT id FROM sub').all(id).map(b=>b.id)
  const liveBranch=id=>{if(id!==null&&!db.prepare('SELECT id FROM branches WHERE id=? AND deleted_at IS NULL').get(id))fail('所属分支不存在或已删除')}
  const checkParent=(id,parent)=>{liveBranch(parent);if(parent!==null&&descendants(id).includes(parent))fail('不能移动到自身或子分支内')}
  const notes=rows=>rows.map(row=>({...row,record_count:db.prepare('SELECT count(*) n FROM records WHERE note_id=? AND deleted_at IS NULL').get(row.id).n,tags:JSON.parse(row.tags),...(row.images?{images:JSON.parse(row.images)}:{})}))
  const getBranches=trash=>db.prepare(`SELECT b.*,(SELECT count(*) FROM notes n WHERE n.branch_id=b.id AND n.deleted_at IS NULL) AS note_count FROM branches b WHERE b.deleted_at IS ${trash?'NOT ':''}NULL ORDER BY sort_order,id`).all()
  const route=fn=>(req,res,next)=>{try{fn(req,res)}catch(error){next(error)}}
  router.get('/api/health',(_req,res)=>res.json({ok:true,app:'zhimu',version:'0.1.0'}))
  router.get('/api/tree',(_req,res)=>res.json({branches:getBranches(false),notes:notes(db.prepare("SELECT id,branch_id,title,summary,tags,status,created_at,updated_at FROM notes WHERE deleted_at IS NULL AND status='published' ORDER BY id").all())}))
  router.get('/api/branches',(req,res)=>res.json({branches:getBranches(req.query.trash==='1')}))
  router.post('/api/branches',route((req,res)=>{
    const name=text(req.body?.name,40,'分支名称'),description=text(req.body?.description??'',1000,'简介'),parent=nullableId(req.body?.parent_id)
    if(!name)fail('请填写分支名称');liveBranch(parent)
    const order=db.prepare('SELECT coalesce(max(sort_order),0)+10 n FROM branches WHERE parent_id IS ? AND deleted_at IS NULL').get(parent).n
    const result=db.prepare('INSERT INTO branches(name,description,parent_id,sort_order) VALUES(?,?,?,?)').run(name,description,parent,order)
    res.status(201).json({branch:branch(Number(result.lastInsertRowid))})
  }))
  router.patch('/api/branches/:id',route((req,res)=>{
    const id=idOf(req.params.id),current=branch(id);if(!current||current.deleted_at)fail('分支不存在',404)
    const name=text(req.body?.name??current.name,40,'分支名称'),description=text(req.body?.description??current.description,1000,'简介')
    const parent=Object.hasOwn(req.body||{},'parent_id')?nullableId(req.body.parent_id):current.parent_id,order=req.body?.sort_order??current.sort_order
    if(!name||!Number.isSafeInteger(order))fail('名称或排序值无效');checkParent(id,parent)
    db.prepare('UPDATE branches SET name=?,description=?,parent_id=?,sort_order=?,updated_at=unixepoch() WHERE id=?').run(name,description,parent,order,id)
    res.json({branch:branch(id)})
  }))
  router.delete('/api/branches/:id',route((req,res)=>{
    const id=idOf(req.params.id),current=branch(id);if(!current||current.deleted_at)fail('分支不存在',404)
    const mode=req.body?.mode,target=nullableId(req.body?.move_to),group=randomUUID()
    if(!['move','subtree'].includes(mode))fail('请选择迁移内容或整枝回收');if(mode==='move')checkParent(id,target)
    db.transaction(()=>{
      if(mode==='move'){
        db.prepare('UPDATE notes SET branch_id=?,updated_at=unixepoch() WHERE branch_id=?').run(target,id)
        db.prepare('UPDATE branches SET parent_id=?,updated_at=unixepoch() WHERE parent_id=?').run(target,id)
        db.prepare('UPDATE branches SET deleted_at=unixepoch(),trash_group=? WHERE id=?').run(group,id)
      }else for(const child of descendants(id)){
        if(branch(child).deleted_at)continue
        db.prepare('UPDATE notes SET deleted_at=unixepoch(),trash_group=? WHERE branch_id=? AND deleted_at IS NULL').run(group,child)
        db.prepare('UPDATE branches SET deleted_at=unixepoch(),trash_group=? WHERE id=?').run(group,child)
      }
    })();res.json({ok:true})
  }))
  router.post('/api/branches/:id/restore',route((req,res)=>{
    const current=branch(idOf(req.params.id));if(!current?.deleted_at)fail('回收站中没有此分支',404)
    db.transaction(()=>{
      const batch=db.prepare('SELECT id,parent_id FROM branches WHERE trash_group=?').all(current.trash_group),ids=new Set(batch.map(b=>b.id))
      for(const b of batch){const parent=b.parent_id===null||ids.has(b.parent_id)||branch(b.parent_id)&&!branch(b.parent_id).deleted_at?b.parent_id:null;db.prepare('UPDATE branches SET parent_id=?,deleted_at=NULL,trash_group=NULL,updated_at=unixepoch() WHERE id=?').run(parent,b.id)}
      db.prepare('UPDATE notes SET deleted_at=NULL,trash_group=NULL,updated_at=unixepoch() WHERE trash_group=?').run(current.trash_group)
    })();res.json({ok:true})
  }))
  router.get('/api/notes',route((req,res)=>{
    const conditions=[req.query.trash==='1'?'deleted_at IS NOT NULL':'deleted_at IS NULL'],params=[]
    if(!req.admin)conditions.push("status='published'")
    if(req.query.branch){const id=Number(req.query.branch);if(id===0)conditions.push('branch_id IS NULL');else{const ids=descendants(idOf(req.query.branch));conditions.push(`branch_id IN (${ids.map(()=>'?').join(',')||'NULL'})`);params.push(...ids)}}
    if(req.query.status){if(!['draft','published'].includes(req.query.status))fail('状态无效');conditions.push('status=?');params.push(req.query.status)}
    for(const word of String(req.query.q||'').trim().toLowerCase().split(/\s+/).filter(Boolean).slice(0,10)){conditions.push("(instr(lower(title||' '||summary||' '||body||' '||tags),?)>0 OR EXISTS(SELECT 1 FROM records r WHERE r.note_id=notes.id AND r.deleted_at IS NULL AND instr(lower(r.body),?)>0))");params.push(word,word)}
    res.json({notes:notes(db.prepare(`SELECT id,branch_id,title,summary,tags,status,created_at,updated_at,deleted_at FROM notes WHERE ${conditions.join(' AND ')} ORDER BY updated_at DESC,id DESC`).all(...params))})
  }))
  router.get('/api/notes/:id',route((req,res)=>{const n=db.prepare('SELECT * FROM notes WHERE id=? AND deleted_at IS NULL').get(idOf(req.params.id));if(!n||!req.admin&&n.status!=='published')fail('知识点不存在',404);res.json({note:{...notes([n])[0],records:recordsFor(n.id),record_draft:req.admin?draftFor(n.id):null}})}))
  function notePayload(body,current={}){
    const value={...{title:'',summary:'',body:'',tags:[],images:[],status:'draft',branch_id:null},...current,...body}
    const title=text(value.title,150,'标题'),summary=text(value.summary,500,'摘要'),content=text(value.body,200000,'正文',false),target=nullableId(value.branch_id)
    if(!title)fail('请填写知识点标题');if(!['draft','published'].includes(value.status))fail('状态无效');if(value.status==='published'&&!content.trim()&&!value.images?.length)fail('发布前请填写正文或添加图片')
    if(!Array.isArray(value.tags)||value.tags.length>12||value.tags.some(t=>typeof t!=='string'||t.length>30))fail('最多 12 个标签，每个不超过 30 字')
    liveBranch(target);return {title,summary,body:content,branch_id:target,status:value.status,images:validateImages(value.images),tags:JSON.stringify([...new Set(value.tags.map(t=>t.trim()).filter(Boolean))])}
  }
  router.post('/api/notes',route((req,res)=>{const n=notePayload(req.body);const r=db.prepare('INSERT INTO notes(title,summary,body,branch_id,status,tags,images) VALUES(@title,@summary,@body,@branch_id,@status,@tags,@images)').run(n);res.status(201).json({id:Number(r.lastInsertRowid)})}))
  router.put('/api/notes/:id',route((req,res)=>{const id=idOf(req.params.id),current=db.prepare('SELECT * FROM notes WHERE id=? AND deleted_at IS NULL').get(id);if(!current)fail('知识点不存在',404);const n=notePayload(req.body,{...current,tags:JSON.parse(current.tags),images:JSON.parse(current.images)});db.prepare('UPDATE notes SET title=@title,summary=@summary,body=@body,branch_id=@branch_id,status=@status,tags=@tags,images=@images,updated_at=unixepoch() WHERE id=@id').run({...n,id});res.json({ok:true})}))
  router.delete('/api/notes/:id',route((req,res)=>{const r=db.prepare('UPDATE notes SET deleted_at=unixepoch(),trash_group=NULL,updated_at=unixepoch() WHERE id=? AND deleted_at IS NULL').run(idOf(req.params.id));if(!r.changes)fail('知识点不存在',404);res.json({ok:true})}))
  router.post('/api/notes/:id/restore',route((req,res)=>{const id=idOf(req.params.id),n=db.prepare('SELECT * FROM notes WHERE id=? AND deleted_at IS NOT NULL').get(id);if(!n)fail('回收站中没有此知识点',404);const parent=n.branch_id!==null&&branch(n.branch_id)&&!branch(n.branch_id).deleted_at?n.branch_id:null;db.prepare('UPDATE notes SET branch_id=?,deleted_at=NULL,trash_group=NULL,updated_at=unixepoch() WHERE id=?').run(parent,id);res.json({ok:true})}))
  router.use('/api',(_req,res)=>res.status(404).json({error:'接口不存在'}))
  router.use(express.static(publicDir,{etag:true,setHeaders:(res,file)=>{if(file.endsWith('.html'))res.setHeader('Cache-Control','no-store');else res.setHeader('Cache-Control','no-cache')}}))
  app.use(basePath||'/',router)
  app.use((_req,res)=>res.status(404).json({error:'页面不存在'}))
  app.use((error,_req,res,_next)=>{if(!error.status)console.error(error);res.status(error.status||500).json({error:error.type==='entity.too.large'?'内容太长':error.status&&error.status<500?error.message:'服务暂时不可用，请重试'})})
  return {app,db}
}
