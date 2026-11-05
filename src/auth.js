import {randomBytes,createHash,scrypt as derive,timingSafeEqual} from 'node:crypto'
import {promisify} from 'node:util'
import fs from 'node:fs'
const scrypt=promisify(derive)
export const digest=value=>createHash('sha256').update(value).digest('hex')
export async function setAdminPassword(db,username,password,mustChange=false){
  if(typeof username!=='string'||!/^[a-zA-Z0-9_.-]{3,40}$/.test(username))throw new Error('用户名需为 3–40 个英文字母、数字或 ._-')
  if(typeof password!=='string'||password.length<12||password.length>128)throw new Error('密码长度需为 12–128 位')
  const salt=randomBytes(16).toString('hex'),hash=Buffer.from(await scrypt(password,salt,64)).toString('hex')
  db.transaction(()=>{db.prepare('INSERT INTO admin(id,username,salt,password_hash,must_change) VALUES(1,?,?,?,?) ON CONFLICT(id) DO UPDATE SET username=excluded.username,salt=excluded.salt,password_hash=excluded.password_hash,must_change=excluded.must_change').run(username,salt,hash,Number(mustChange));db.prepare('DELETE FROM sessions').run()})()
}
export function registerAuth(router,db,{basePath='',secureCookies=false,backupFile}={}){
  db.exec(`CREATE TABLE IF NOT EXISTS admin(id INTEGER PRIMARY KEY CHECK(id=1),username TEXT NOT NULL,salt TEXT NOT NULL,password_hash TEXT NOT NULL,must_change INTEGER NOT NULL DEFAULT 0);
    CREATE TABLE IF NOT EXISTS sessions(token_hash TEXT PRIMARY KEY,expires_at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS auth_limits(key TEXT PRIMARY KEY,attempts INTEGER NOT NULL,expires_at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS backup_access(id INTEGER PRIMARY KEY CHECK(id=1),token_hash TEXT NOT NULL);`)
  const cookieName='zhimu_session',cookieOptions={httpOnly:true,secure:secureCookies,sameSite:'strict',path:basePath||'/',maxAge:7*86400*1000}
  const secure=(req,res)=>{if(secureCookies&&!req.secure){res.status(400).json({error:'请使用 HTTPS 登录'});return false}return true}
  const readToken=req=>(req.headers.cookie||'').split(';').map(c=>c.trim()).find(c=>c.startsWith(cookieName+'='))?.slice(cookieName.length+1)||''
  const clear=req=>db.prepare('DELETE FROM sessions WHERE token_hash=?').run(digest(readToken(req)))
  router.use((req,res,next)=>{
    const token=readToken(req),session=token.length===64?db.prepare('SELECT * FROM sessions WHERE token_hash=? AND expires_at>unixepoch()').get(digest(token)):null
    req.admin=session?db.prepare('SELECT username,must_change FROM admin WHERE id=1').get():null
    next()
  })
  router.get('/api/auth/session',(req,res)=>res.json({admin:req.admin?{username:req.admin.username,must_change:Boolean(req.admin.must_change)}:null}))
  router.post('/api/auth/login',async(req,res,next)=>{
    try{
      if(!secure(req,res))return
      const key='login:'+req.ip,now=Math.floor(Date.now()/1000)
      db.prepare('DELETE FROM auth_limits WHERE expires_at<=?').run(now)
      const limit=db.prepare('SELECT attempts FROM auth_limits WHERE key=?').get(key)
      if(limit?.attempts>=10)return res.status(429).json({error:'尝试过于频繁，请 15 分钟后重试'})
      const username=req.body?.username,password=req.body?.password
      if(typeof username!=='string'||typeof password!=='string'||password.length>128)return res.status(400).json({error:'请填写用户名和密码'})
      db.prepare('INSERT INTO auth_limits(key,attempts,expires_at) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET attempts=attempts+1').run(key,now+900)
      const admin=db.prepare('SELECT * FROM admin WHERE id=1').get()
      const candidate=Buffer.from(await scrypt(password,admin?.salt||'zhimu-dummy-salt',64))
      if(!admin||username!==admin.username||!timingSafeEqual(candidate,Buffer.from(admin.password_hash,'hex')))return res.status(401).json({error:'用户名或密码错误'})
      db.prepare('DELETE FROM auth_limits WHERE key=?').run(key)
      db.prepare('DELETE FROM sessions WHERE expires_at<=unixepoch()').run()
      const token=randomBytes(32).toString('hex')
      db.prepare('INSERT INTO sessions VALUES(?,?)').run(digest(token),now+7*86400)
      res.cookie(cookieName,token,cookieOptions).json({admin:{username:admin.username,must_change:Boolean(admin.must_change)}})
    }catch(e){next(e)}
  })
  router.post('/api/auth/logout',(req,res)=>{clear(req);res.clearCookie(cookieName,{httpOnly:true,secure:secureCookies,sameSite:'strict',path:basePath||'/'}).json({ok:true})})
  router.post('/api/auth/password',async(req,res,next)=>{
    try{
      if(!secure(req,res))return
      if(!req.admin)return res.status(401).json({error:'请先登录管理员账号'})
      const admin=db.prepare('SELECT * FROM admin WHERE id=1').get(),old=req.body?.current_password
      if(typeof old!=='string'||old.length>128)return res.status(400).json({error:'请输入当前密码'})
      const candidate=Buffer.from(await scrypt(old,admin.salt,64))
      if(!timingSafeEqual(candidate,Buffer.from(admin.password_hash,'hex')))return res.status(400).json({error:'当前密码不正确'})
      try{await setAdminPassword(db,admin.username,req.body?.password)}catch(e){return res.status(400).json({error:e.message})}
      res.clearCookie(cookieName,{httpOnly:true,secure:secureCookies,sameSite:'strict',path:basePath||'/'}).json({ok:true})
    }catch(e){next(e)}
  })
  router.use('/api',(req,res,next)=>{
    if(!['GET','HEAD'].includes(req.method)&&!req.admin)return res.status(401).json({error:'请先登录管理员账号'})
    if(req.admin?.must_change&&!['GET','HEAD'].includes(req.method))return res.status(403).json({error:'请先修改初始密码'})
    if(!req.admin&&(req.query.trash==='1'||req.query.status==='draft'))return res.status(403).json({error:'仅管理员可查看草稿和回收站'})
    next()
  })
}
