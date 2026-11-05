import multer from 'multer'
import { fileTypeFromBuffer } from 'file-type'
import { randomUUID } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

export function registerRecords(router,db,uploadDir){
  fs.mkdirSync(uploadDir,{recursive:true})
  if(!db.prepare('PRAGMA table_info(notes)').all().some(c=>c.name==='images'))db.exec("ALTER TABLE notes ADD COLUMN images TEXT NOT NULL DEFAULT '[]'")
  db.exec(`CREATE TABLE IF NOT EXISTS images(id TEXT PRIMARY KEY,mime TEXT NOT NULL,created_at INTEGER NOT NULL DEFAULT(unixepoch()));
    CREATE TABLE IF NOT EXISTS records(id INTEGER PRIMARY KEY AUTOINCREMENT,note_id INTEGER NOT NULL REFERENCES notes(id) ON DELETE CASCADE,body TEXT NOT NULL DEFAULT '',images TEXT NOT NULL DEFAULT '[]',created_at INTEGER NOT NULL DEFAULT(unixepoch()),updated_at INTEGER NOT NULL DEFAULT(unixepoch()),deleted_at INTEGER);
    CREATE INDEX IF NOT EXISTS records_parent ON records(note_id,created_at,id);
    CREATE TABLE IF NOT EXISTS record_drafts(note_id INTEGER PRIMARY KEY REFERENCES notes(id) ON DELETE CASCADE,body TEXT NOT NULL DEFAULT '',images TEXT NOT NULL DEFAULT '[]',updated_at INTEGER NOT NULL DEFAULT(unixepoch()));`)
  const error=(message,status=400)=>{throw Object.assign(new Error(message),{status})}
  const parent=id=>{if(!Number.isSafeInteger(Number(id))||!db.prepare('SELECT id FROM notes WHERE id=? AND deleted_at IS NULL').get(Number(id)))error('知识点不存在',404);return Number(id)}
  const wrap=fn=>(req,res,next)=>{try{fn(req,res)}catch(e){next(e)}}
  const validateImages=value=>{
    if(!Array.isArray(value)||value.length>10||value.some(id=>typeof id!=='string'||!db.prepare('SELECT id FROM images WHERE id=?').get(id)))error('图片无效或超过 10 张，请先上传图片')
    return JSON.stringify([...new Set(value)])
  }
  const payload=body=>{if(typeof body?.body!=='string'||body.body.length>200000)error('记录正文需为文字，且不超过 20 万字');const images=validateImages(body.images??[]),content=body.body.trim();if(!content&&images==='[]')error('请填写记录内容或添加图片');return {body:content,images}}
  const bump=id=>db.prepare('UPDATE notes SET updated_at=unixepoch() WHERE id=?').run(id)
  const uploader=multer({storage:multer.memoryStorage(),limits:{fileSize:5*1024*1024,files:5,fields:0}}).array('images',5)
  router.post('/api/images',(req,res,next)=>uploader(req,res,async err=>{
    if(err)return res.status(400).json({error:err.code==='LIMIT_FILE_SIZE'?'每张图片最大 5 MB':'每次最多上传 5 张图片'})
    const written=[]
    try{
      if(!req.files?.length)error('请选择图片')
      const accepted=[]
      for(const f of req.files){const type=await fileTypeFromBuffer(f.buffer);if(!type||!['image/png','image/jpeg','image/gif','image/webp'].includes(type.mime))error('仅支持真实的 PNG、JPEG、GIF、WebP 图片');accepted.push({f,type})}
      const images=[]
      for(const {f,type} of accepted){const id=randomUUID()+'.'+type.ext;fs.writeFileSync(path.join(uploadDir,id),f.buffer,{flag:'wx'});written.push(id);images.push({id,mime:type.mime})}
      db.transaction(()=>{for(const image of images)db.prepare('INSERT INTO images(id,mime) VALUES(?,?)').run(image.id,image.mime)})()
      res.status(201).json({images})
    }catch(e){for(const id of written)fs.rmSync(path.join(uploadDir,id),{force:true});next(e)}
  }))
  router.get('/media/:id',wrap((req,res)=>{if(!req.admin&&!db.prepare("SELECT 1 FROM notes n WHERE n.status='published' AND n.deleted_at IS NULL AND (EXISTS(SELECT 1 FROM json_each(n.images) WHERE value=?) OR EXISTS(SELECT 1 FROM records r,json_each(r.images) i WHERE r.note_id=n.id AND r.deleted_at IS NULL AND i.value=?))").get(req.params.id,req.params.id))error('图片不存在',404);const image=db.prepare('SELECT * FROM images WHERE id=?').get(req.params.id);if(!image)error('图片不存在',404);res.type(image.mime).set('Cache-Control','public, max-age=86400').sendFile(path.join(uploadDir,image.id))}))
  const read=row=>({...row,images:JSON.parse(row.images)})
  const recordsFor=id=>db.prepare('SELECT * FROM records WHERE note_id=? AND deleted_at IS NULL ORDER BY created_at,id').all(id).map(read)
  const draftFor=id=>{const row=db.prepare('SELECT * FROM record_drafts WHERE note_id=?').get(id);return row?read(row):null}
  router.post('/api/notes/:id/records',wrap((req,res)=>{const id=parent(req.params.id),p=payload(req.body);const r=db.transaction(()=>{const r=db.prepare('INSERT INTO records(note_id,body,images) VALUES(?,?,?)').run(id,p.body,p.images);db.prepare('DELETE FROM record_drafts WHERE note_id=?').run(id);bump(id);return r})();res.status(201).json({id:Number(r.lastInsertRowid)})}))
  router.put('/api/notes/:id/records/:recordId',wrap((req,res)=>{const id=parent(req.params.id),p=payload(req.body);const r=db.transaction(()=>{const r=db.prepare('UPDATE records SET body=?,images=?,updated_at=unixepoch() WHERE id=? AND note_id=? AND deleted_at IS NULL').run(p.body,p.images,Number(req.params.recordId),id);if(!r.changes)error('记录不存在',404);bump(id);return r})();res.json({ok:Boolean(r.changes)})}))
  router.delete('/api/notes/:id/records/:recordId',wrap((req,res)=>{const id=parent(req.params.id);db.transaction(()=>{const r=db.prepare('UPDATE records SET deleted_at=unixepoch() WHERE id=? AND note_id=? AND deleted_at IS NULL').run(Number(req.params.recordId),id);if(!r.changes)error('记录不存在',404);bump(id)})();res.json({ok:true})}))
  router.put('/api/notes/:id/record-draft',wrap((req,res)=>{const id=parent(req.params.id),p=payload(req.body);db.prepare('INSERT INTO record_drafts(note_id,body,images) VALUES(?,?,?) ON CONFLICT(note_id) DO UPDATE SET body=excluded.body,images=excluded.images,updated_at=unixepoch()').run(id,p.body,p.images);res.json({draft:draftFor(id)})}))
  router.delete('/api/notes/:id/record-draft',wrap((req,res)=>{db.prepare('DELETE FROM record_drafts WHERE note_id=?').run(parent(req.params.id));res.json({ok:true})}))
  return {validateImages,recordsFor,draftFor}
}
