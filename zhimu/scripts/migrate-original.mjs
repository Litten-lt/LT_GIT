// Explicit one-time import. The original site is read only; this writes Zhimu only.
import fs from 'node:fs'
import path from 'node:path'
import {createHash} from 'node:crypto'
import {fileURLToPath} from 'node:url'
import {createApp} from '../src/app.js'

const hash=value=>createHash('sha256').update(value).digest('hex')
const assert=(condition,message)=>{if(!condition)throw new Error(message)}
const json=value=>typeof value==='string'?JSON.parse(value):value||[]
export async function migrateOriginal({snapshot,manifest,filename,sourceImages,replaceTestData=false}){
  const selected=manifest.notes.filter(n=>n.content_kind==='实质内容'||n.content_kind==='待补充条目')
  assert(selected.length===187,'Expected exactly 187 selected source notes')
  assert(selected.filter(n=>n.content_kind==='实质内容').length===9,'Expected 9 substantive notes')
  const contents=new Map(snapshot.data.contents.map(n=>[String(n.id),n]))
  const rawRecords=new Map(snapshot.data.content_notes_v2.map(r=>[r.id,r]))
  const plannedRecords=selected.flatMap(n=>n.records)
  assert(plannedRecords.length===27,'Expected exactly 27 process records')
  assert(new Set(selected.map(n=>n.source_id)).size===187,'Duplicate source notes')
  const assets=new Map()
  for(const n of selected){
    const c=contents.get(n.source_id)
    assert(c&&c.title===n.title&&hash(c.body||'')===n.body_sha256,'Source note changed: '+n.source_id)
    assert(!c.deleted_at,'Deleted source note selected')
    assert(n.proposed_branch_path.split(' / ').length===2,'Missing classification')
    for(const r of n.records){
      const raw=rawRecords.get(r.source_record_id)
      assert(raw&&String(raw.content_id)===n.source_id&&hash(raw.body||'')===r.body_sha256,'Source record changed: '+r.source_record_id)
    }
    for(const image of [...json(c.images),...n.records.flatMap(r=>json(rawRecords.get(r.source_record_id).images))]){
      assert(path.basename(image)===image,'Unsafe image path')
      const expected=manifest.images.find(i=>i.name===image)
      const bytes=fs.readFileSync(path.join(sourceImages,image))
      assert(expected&&hash(bytes)===expected.sha256,'Image checksum mismatch: '+image)
      assets.set(image,{id:'legacy-'+expected.sha256+'.png',bytes})
    }
  }
  assert(assets.size===1,'Expected exactly one source image')
  const uploadDir=path.join(path.dirname(filename),'uploads')
  const {db}=createApp({filename,uploadDir})
  const receipt={source_captured_at:snapshot.captured_at,imported_at:new Date().toISOString(),notes:[],records:[],images:[],excluded_guides:manifest.notes.filter(n=>!selected.includes(n)).map(n=>n.source_id)}
  try{
    assert(replaceTestData||db.prepare('SELECT count(*) n FROM notes').get().n===0,'Target is not empty; explicit replace-test-data required')
    // Media is content addressed and copied before the SQL transaction. Old files are retained.
    for(const [original,asset] of assets){
      const target=path.join(uploadDir,asset.id)
      if(fs.existsSync(target))assert(hash(fs.readFileSync(target))===hash(asset.bytes),'Existing target image mismatch')
      else fs.writeFileSync(target,asset.bytes,{flag:'wx'})
      receipt.images.push({original,id:asset.id,sha256:hash(asset.bytes)})
    }
    const mapImages=value=>JSON.stringify(json(value).map(i=>assets.get(i).id))
    db.transaction(()=>{
      if(replaceTestData)db.exec('DELETE FROM record_drafts; DELETE FROM records; DELETE FROM notes; DELETE FROM branches; DELETE FROM images;')
      const branchIds=new Map()
      const mainOrder=['编程基础','网络与系统','无线协议与组网','驱动与平台','工程实践与调试','标准与行业']
      for(const root of mainOrder){
        const id=Number(db.prepare('INSERT INTO branches(name,sort_order) VALUES(?,?)').run(root,mainOrder.indexOf(root)*10).lastInsertRowid)
        branchIds.set(root,id)
      }
      for(const branch of new Set(selected.map(n=>n.proposed_branch_path))){
        const [root,name]=branch.split(' / ')
        assert(branchIds.has(root),'Unknown main branch')
        branchIds.set(branch,Number(db.prepare('INSERT INTO branches(parent_id,name,sort_order) VALUES(?,?,?)').run(branchIds.get(root),name,branchIds.size*10).lastInsertRowid))
      }
      for(const asset of assets.values())db.prepare('INSERT INTO images(id,mime) VALUES(?,?)').run(asset.id,'image/png')
      for(const n of selected){
        const c=contents.get(n.source_id)
        const id=Number(db.prepare('INSERT INTO notes(branch_id,title,summary,body,tags,status,created_at,updated_at,source_system,source_id,images) VALUES(?,?,?,?,?,?,?,?,?,?,?)').run(branchIds.get(n.proposed_branch_path),c.title,c.subtitle||'',c.body||'',JSON.stringify(json(c.tags)),c.status,c.created_at,c.updated_at,'longteng',String(c.id),mapImages(c.images)).lastInsertRowid)
        receipt.notes.push({source_id:String(c.id),id,body_sha256:hash(c.body||'')})
        for(const planned of n.records){
          const r=rawRecords.get(planned.source_record_id)
          const rid=Number(db.prepare('INSERT INTO records(note_id,body,images,created_at,updated_at) VALUES(?,?,?,?,?)').run(id,r.body||'',mapImages(r.images),r.created_at,r.updated_at).lastInsertRowid)
          receipt.records.push({source_record_id:r.id,id:rid,note_id:id,body_sha256:hash(r.body||'')})
        }
      }
      assert(db.prepare('PRAGMA foreign_key_check').all().length===0,'Foreign key validation failed')
      assert(db.prepare('SELECT count(*) n FROM branches').get().n===25,'Expected 25 branches')
      assert(db.prepare('SELECT count(*) n FROM notes').get().n===187,'Note count mismatch')
      assert(db.prepare('SELECT count(*) n FROM records').get().n===27,'Record count mismatch')
      for(const n of receipt.notes)assert(hash(db.prepare('SELECT body FROM notes WHERE id=?').get(n.id).body)===n.body_sha256,'Imported note checksum mismatch')
      for(const r of receipt.records)assert(hash(db.prepare('SELECT body FROM records WHERE id=?').get(r.id).body)===r.body_sha256,'Imported record checksum mismatch')
    })()
    return receipt
  }finally{db.close()}
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const [folder,filename,flag]=process.argv.slice(2)
  if(!folder||!filename)throw new Error('Usage: node scripts/migrate-original.mjs SOURCE_FOLDER TARGET_DB [--replace-test-data]')
  const receipt=await migrateOriginal({snapshot:JSON.parse(fs.readFileSync(path.join(folder,'snapshot.json'),'utf8')),manifest:JSON.parse(fs.readFileSync(path.join(folder,'migration-manifest.json'),'utf8')),filename:path.resolve(filename),sourceImages:path.join(folder,'images'),replaceTestData:flag==='--replace-test-data'})
  fs.writeFileSync(path.join(folder,'migration-receipt.json'),JSON.stringify(receipt,null,2))
  console.log(JSON.stringify({notes:receipt.notes.length,records:receipt.records.length,images:receipt.images.length,excluded_guides:receipt.excluded_guides.length}))
}
