import Database from 'better-sqlite3'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {execFileSync} from 'node:child_process'
const source=process.env.DATA_DIR||'/opt/zhimu-data',target=process.env.BACKUP_DIR||'/var/backups/zhimu/automatic'
fs.mkdirSync(target,{recursive:true,mode:0o700})
const stage=fs.mkdtempSync(path.join(os.tmpdir(),'zhimu-backup-'))
const day=new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Shanghai'}),archive=path.join(target,'daily-'+day+'.tar.gz'),partial=archive+'.partial'
try{
  const db=new Database(path.join(source,'zhimu.db'),{readonly:true});await db.backup(path.join(stage,'zhimu.db'));db.close()
  fs.cpSync(path.join(source,'uploads'),path.join(stage,'uploads'),{recursive:true})
  fs.writeFileSync(path.join(stage,'manifest.json'),JSON.stringify({created_at:new Date().toISOString(),format:1,includes:['zhimu.db','uploads']},null,2))
  // Restore the archive into an isolated directory and verify the database and every active image.
  execFileSync('tar',['-czf',partial,'-C',stage,'.']);fs.chmodSync(partial,0o600)
  const restore=path.join(stage,'restore');fs.mkdirSync(restore);execFileSync('tar',['-xzf',partial,'-C',restore])
  const check=new Database(path.join(restore,'zhimu.db'),{readonly:true})
  try{
    if(check.pragma('integrity_check',{simple:true})!=='ok'||check.pragma('foreign_key_check').length)throw new Error('Backup restore integrity failed')
    for(const {id} of check.prepare('SELECT id FROM images').all())if(!fs.existsSync(path.join(restore,'uploads',id)))throw new Error('Backup image missing: '+id)
  }finally{check.close()}
  fs.renameSync(partial,archive)
  fs.copyFileSync(archive,path.join(target,'latest.tar.gz.partial'));fs.renameSync(path.join(target,'latest.tar.gz.partial'),path.join(target,'latest.tar.gz'))
  if(process.env.OFFSITE_FILE){fs.mkdirSync(path.dirname(process.env.OFFSITE_FILE),{recursive:true});fs.copyFileSync(archive,process.env.OFFSITE_FILE+'.partial');fs.chmodSync(process.env.OFFSITE_FILE+'.partial',0o644);fs.renameSync(process.env.OFFSITE_FILE+'.partial',process.env.OFFSITE_FILE)}
  const week=new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Shanghai',weekday:'short'}).format(new Date())==='Sun'
  if(week)fs.copyFileSync(archive,path.join(target,'weekly-'+day+'.tar.gz'))
  for(const [prefix,keep] of [['daily-',7],['weekly-',4]]){
    const files=fs.readdirSync(target).filter(n=>n.startsWith(prefix)&&/^\w+-\d{4}-\d{2}-\d{2}\.tar\.gz$/.test(n)).sort().reverse()
    for(const file of files.slice(keep))fs.unlinkSync(path.join(target,file))
  }
  fs.writeFileSync(path.join(target,'status.json'),JSON.stringify({last_success:new Date().toISOString(),archive,restore_verified:true},null,2),{mode:0o600})
  console.log(JSON.stringify({archive,restore_verified:true}))
}finally{fs.rmSync(stage,{recursive:true,force:true});fs.rmSync(partial,{force:true})}
