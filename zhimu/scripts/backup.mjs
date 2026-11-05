import Database from 'better-sqlite3'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import fs from 'node:fs'
import { execFileSync } from 'node:child_process'
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..')
const target=process.argv[2]
if(!target)throw new Error('请指定备份文件路径')
const database=path.join(process.env.DATA_DIR||path.join(root,'data'),'zhimu.db')
fs.mkdirSync(path.dirname(path.resolve(target)),{recursive:true})
const db=new Database(database,{readonly:true})
await db.backup(target);db.close();console.log('SQLite consistent backup created:',path.resolve(target))
const uploads=path.join(path.dirname(database),'uploads')
if(fs.existsSync(uploads)){
  execFileSync('tar',['-czf',path.resolve(target)+'.uploads.tar.gz','-C',uploads,'.'])
  console.log('Uploaded image archive created:',path.resolve(target)+'.uploads.tar.gz')
}
