import Database from 'better-sqlite3'
import fs from 'node:fs'
import path from 'node:path'
const filename=process.argv[2]
if(!filename)throw new Error('Database path required')
const db=new Database(filename);db.pragma('foreign_keys=ON')
try{
 const parent=db.prepare("SELECT * FROM branches WHERE name='标准与行业' AND parent_id IS NULL AND deleted_at IS NULL").get()
 if(!parent)throw new Error('Main branch missing')
 const child=db.prepare("SELECT * FROM branches WHERE name='标准、认证与行业' AND parent_id=? AND deleted_at IS NULL").get(parent.id)
 if(!child){console.log(JSON.stringify({already_flattened:true}));process.exitCode=0}
 else{
  const backup=path.resolve(filename+'.before-flatten-industry-'+Date.now()+'.db');await db.backup(backup)
  const before=db.prepare('SELECT count(*) n FROM notes WHERE deleted_at IS NULL').get().n
  const result=db.transaction(()=>{
   if(db.prepare('SELECT 1 FROM branches WHERE parent_id=? AND deleted_at IS NULL').get(child.id))throw new Error('Unexpected nested branches')
   const moved=db.prepare('UPDATE notes SET branch_id=? WHERE branch_id=?').run(parent.id,child.id).changes
   db.prepare('UPDATE branches SET deleted_at=unixepoch(),updated_at=unixepoch() WHERE id=?').run(child.id)
   if(db.prepare('PRAGMA foreign_key_check').all().length)throw new Error('Foreign key validation failed')
   if(db.prepare('SELECT count(*) n FROM notes WHERE deleted_at IS NULL').get().n!==before)throw new Error('Note count changed')
   return moved
  })()
  console.log(JSON.stringify({moved:result,notes:before,active_branches:db.prepare('SELECT count(*) n FROM branches WHERE deleted_at IS NULL').get().n,backup}))
 }
}finally{db.close()}
