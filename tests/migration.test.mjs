import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {createHash} from 'node:crypto'
import Database from 'better-sqlite3'
import {migrateOriginal} from '../scripts/migrate-original.mjs'

test('migration keeps one leaf per source, separate records, timestamps, media and refuses implicit replacement',async()=>{
  const folder=fs.mkdtempSync(path.join(os.tmpdir(),'zhimu-migrate-'))
  const hash=value=>createHash('sha256').update(value).digest('hex')
  const roots=['编程基础','网络与系统','无线协议与组网','驱动与平台','工程实践与调试','标准与行业']
  const branches=Array.from({length:19},(_,i)=>roots[i%6]+' / 测试分支'+i)
  const contents=Array.from({length:187},(_,i)=>({id:i+1,title:'知识'+i,body:i===183?'':'正文\r\n'+i,images:'[]',tags:'[]',status:'published',created_at:100+i,updated_at:200+i}))
  const records=Array.from({length:27},(_,i)=>({id:30-i,content_id:i%9+1,body:i===0?'':'记录'+i,images:i===0?'["original.png"]':'[]',created_at:300+i,updated_at:400+i}))
  const bytes=Buffer.from('test-image-bytes');fs.writeFileSync(path.join(folder,'original.png'),bytes)
  const manifest={notes:contents.map((n,i)=>({source_id:String(n.id),title:n.title,body_sha256:hash(n.body),content_kind:i<9?'实质内容':'待补充条目',proposed_branch_path:branches[i%19],records:records.filter(r=>r.content_id===n.id).map(r=>({source_record_id:r.id,body_sha256:hash(r.body)}))})),images:[{name:'original.png',sha256:hash(bytes)}]}
  const options={snapshot:{captured_at:'test',data:{contents,content_notes_v2:records}},manifest,filename:path.join(folder,'target.db'),sourceImages:folder}
  try{
    const receipt=await migrateOriginal(options)
    assert.equal(receipt.notes.length,187);assert.equal(receipt.records.length,27)
    const db=new Database(options.filename)
    assert.equal(db.prepare('SELECT count(*) n FROM branches').get().n,25)
    const first=db.prepare('SELECT * FROM records WHERE id=?').get(receipt.records.find(r=>r.source_record_id===30).id)
    assert.equal(first.body,'');assert.equal(first.created_at,300);assert.equal(first.updated_at,400)
    assert.equal(JSON.parse(first.images)[0],receipt.images[0].id)
    assert.deepEqual(db.prepare('SELECT body FROM notes ORDER BY id').all().map(n=>n.body),contents.map(n=>n.body))
    db.close()
    await assert.rejects(migrateOriginal(options),/explicit replace/)
    await migrateOriginal({...options,replaceTestData:true})
    const changed=structuredClone(options);changed.manifest.notes[0].body_sha256='changed'
    await assert.rejects(migrateOriginal({...changed,replaceTestData:true}),/Source note changed/)
    const verify=new Database(options.filename);assert.equal(verify.prepare('SELECT count(*) n FROM notes').get().n,187);verify.close()
  }finally{fs.rmSync(folder,{recursive:true,force:true})}
})
