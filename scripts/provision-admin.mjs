import fs from 'node:fs'
import path from 'node:path'
import {randomBytes} from 'node:crypto'
import {createApp} from '../src/app.js'
import {setAdminPassword} from '../src/auth.js'
const data=process.env.DATA_DIR||path.resolve('data'),output=process.argv[2]
if(!output)throw new Error('Specify a private credential output file')
const {db}=createApp({filename:path.join(data,'zhimu.db')})
try{
  if(db.prepare('SELECT 1 FROM admin').get())throw new Error('Admin already exists; refusing to replace credentials')
  const password=randomBytes(24).toString('base64url')
  await setAdminPassword(db,'allen',password,true)
  fs.writeFileSync(output,JSON.stringify({username:'allen',initial_password:password},null,2),{mode:0o600,flag:'wx'})
  console.log('Administrator provisioned; credentials written to private file')
}finally{db.close()}
