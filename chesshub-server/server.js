// ChessHub 后端服务
// 启动: node server.js
// 依赖: express, better-sqlite3, multer, cors, jsonwebtoken, dotenv

import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import jwt from 'jsonwebtoken'
import multer from 'multer'
import Database from 'better-sqlite3'
import path from 'node:path'
import fs from 'node:fs'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'

// ---------- 配置 ----------
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const PORT = parseInt(process.env.PORT || '3000', 10)
const ADMIN_USER = process.env.ADMIN_USER || 'admin'
const ADMIN_PASS = process.env.ADMIN_PASS || 'admin'
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me'
const UPLOAD_DIR = process.env.UPLOAD_DIR || '/var/www/chesshub-data/figures'
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data')
const CORS_ORIGIN = process.env.CORS_ORIGIN || '*'
const PUBLIC_BASE_URL = process.env.PUBLIC_BASE_URL || 'http://159.75.97.172'

// ---------- 初始化 ----------
fs.mkdirSync(UPLOAD_DIR, { recursive: true })
fs.mkdirSync(DATA_DIR, { recursive: true })

const db = new Database(path.join(DATA_DIR, 'chesshub.db'))
db.pragma('journal_mode = WAL')

// 初始化表
db.exec(`
  CREATE TABLE IF NOT EXISTS figures (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT NOT NULL,
    brand       TEXT,
    description TEXT NOT NULL,
    images      TEXT NOT NULL,    -- JSON 数组,存文件名
    date        TEXT NOT NULL,
    created_at  INTEGER NOT NULL DEFAULT (strftime('%s','now'))
  );
  CREATE INDEX IF NOT EXISTS idx_figures_created ON figures(created_at DESC);
`)

const app = express()

// ---------- 中间件 ----------
app.use(cors({
  origin: CORS_ORIGIN === '*' ? true : CORS_ORIGIN.split(','),
  credentials: true,
}))
app.use(express.json({ limit: '2mb' }))

// JWT 校验
function requireAuth(req, res, next) {
  const auth = req.headers.authorization || ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null
  if (!token) return res.status(401).json({ error: '未登录' })

  try {
    const payload = jwt.verify(token, JWT_SECRET)
    if (payload.role !== 'admin') return res.status(403).json({ error: '权限不足' })
    req.user = payload
    next()
  } catch (e) {
    return res.status(401).json({ error: 'token 无效或已过期' })
  }
}

// ---------- multer 配置 ----------
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    // 随机文件名 + 原扩展名
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg'
    const hash = crypto.randomBytes(8).toString('hex')
    const ts = Date.now()
    cb(null, `${ts}-${hash}${ext}`)
  },
})

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    if (!/^image\/(jpe?g|png|webp|gif)$/i.test(file.mimetype)) {
      return cb(new Error('只支持图片文件 (jpg/png/webp/gif)'))
    }
    cb(null, true)
  },
})

// ---------- 路由 ----------

// 健康检查
app.get('/api/health', (req, res) => {
  res.json({ ok: true, time: new Date().toISOString() })
})

// 登录
app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body || {}
  if (username !== ADMIN_USER || password !== ADMIN_PASS) {
    return res.status(401).json({ error: '账号或密码错误' })
  }
  const token = jwt.sign(
    { sub: username, role: 'admin' },
    JWT_SECRET,
    { expiresIn: '7d' }
  )
  res.json({ token, role: 'admin', username })
})

// 游客登录 (不需要账号密码,直接发一个 guest 角色的 token)
app.post('/api/auth/guest', (req, res) => {
  const token = jwt.sign(
    { sub: 'guest', role: 'guest' },
    JWT_SECRET,
    { expiresIn: '7d' }
  )
  res.json({ token, role: 'guest', username: '游客' })
})

// 验证 token 是否还有效
app.get('/api/auth/me', requireAuth, (req, res) => {
  res.json({ username: req.user.sub, role: req.user.role })
})

// 列出所有手办 (公开)
app.get('/api/figures', (req, res) => {
  const rows = db.prepare(`
    SELECT id, name, brand, description, images, date, created_at
    FROM figures
    ORDER BY created_at DESC
  `).all()

  const figures = rows.map((r) => ({
    id: r.id,
    name: r.name,
    brand: r.brand || undefined,
    description: r.description,
    date: r.date,
    images: JSON.parse(r.images).map((fn) => `${PUBLIC_BASE_URL}/data/figures/${fn}`),
  }))
  res.json({ figures })
})

// 新建手办 (admin)
app.post('/api/figures', requireAuth, (req, res) => {
  const { name, brand, description, images, date } = req.body || {}
  if (!name || !description || !Array.isArray(images) || images.length === 0) {
    return res.status(400).json({ error: 'name, description, images 必填' })
  }

  const result = db.prepare(`
    INSERT INTO figures (name, brand, description, images, date)
    VALUES (?, ?, ?, ?, ?)
  `).run(
    name.trim(),
    brand?.trim() || null,
    description.trim(),
    JSON.stringify(images),
    date || new Date().toISOString().slice(0, 7).replace('-', '.')
  )

  res.json({ id: result.lastInsertRowid })
})

// 删除手办 (admin)
app.delete('/api/figures/:id', requireAuth, (req, res) => {
  const id = parseInt(req.params.id, 10)
  const row = db.prepare('SELECT images FROM figures WHERE id = ?').get(id)
  if (!row) return res.status(404).json({ error: '手办不存在' })

  // 删数据库
  db.prepare('DELETE FROM figures WHERE id = ?').run(id)

  // 删图片文件
  const images = JSON.parse(row.images)
  for (const fn of images) {
    const fp = path.join(UPLOAD_DIR, fn)
    fs.unlink(fp, () => {})
  }
  res.json({ ok: true })
})

// 更新手办 (admin) - 局部更新,只改提供的字段
// body 可包含: name?, brand?, description?, images?: string[]
// 如果提供 images,则完全替换图片数组,**并清理被删除的图片文件**
app.put('/api/figures/:id', requireAuth, (req, res) => {
  const id = parseInt(req.params.id, 10)
  const row = db.prepare('SELECT images FROM figures WHERE id = ?').get(id)
  if (!row) return res.status(404).json({ error: '手办不存在' })

  const { name, brand, description, images } = req.body || {}
  const oldImages = JSON.parse(row.images)

  // 校验
  if (name !== undefined && !name.trim()) {
    return res.status(400).json({ error: '名称不能为空' })
  }
  if (description !== undefined && !description.trim()) {
    return res.status(400).json({ error: '说明不能为空' })
  }
  if (images !== undefined && (!Array.isArray(images) || images.length === 0)) {
    return res.status(400).json({ error: 'images 必须是非空数组' })
  }

  // 计算 diff: 被删除的文件
  let imagesToDelete = []
  if (images !== undefined) {
    const newSet = new Set(images)
    imagesToDelete = oldImages.filter((fn) => !newSet.has(fn))
  }

  // 动态 UPDATE
  const sets = []
  const args = []
  if (name !== undefined) { sets.push('name = ?'); args.push(name.trim()) }
  if (brand !== undefined) { sets.push('brand = ?'); args.push(brand.trim() || null) }
  if (description !== undefined) { sets.push('description = ?'); args.push(description.trim()) }
  if (images !== undefined) { sets.push('images = ?'); args.push(JSON.stringify(images)) }

  if (sets.length === 0) {
    return res.status(400).json({ error: '没有要更新的字段' })
  }

  args.push(id)
  db.prepare(`UPDATE figures SET ${sets.join(', ')} WHERE id = ?`).run(...args)

  // 删除被替换掉的图片文件
  for (const fn of imagesToDelete) {
    const fp = path.join(UPLOAD_DIR, fn)
    fs.unlink(fp, () => {})
  }

  res.json({ ok: true, deletedFiles: imagesToDelete.length })
})

// 上传图片 (admin) - 接收 multipart/form-data, 字段名 'file'
// 返回 { url, filename }
app.post('/api/upload', requireAuth, (req, res) => {
  upload.single('file')(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message || '上传失败' })
    if (!req.file) return res.status(400).json({ error: '没有文件' })

    const url = `${PUBLIC_BASE_URL}/data/figures/${req.file.filename}`
    res.json({ url, filename: req.file.filename, size: req.file.size })
  })
})

// 错误处理
app.use((err, req, res, next) => {
  console.error('[error]', err.message)
  res.status(500).json({ error: '服务器内部错误' })
})

// ---------- 启动 ----------

// 首次启动:如果数据库是空的,自动 seed 一条示例(摩动核 敖丙)
// seed 图从 dist 目录复制到 UPLOAD_DIR(避免额外 scp)
function seedIfEmpty() {
  const count = db.prepare('SELECT COUNT(*) AS n FROM figures').get().n
  if (count > 0) return

  // 候选源:从 /var/www/chesshub/figures/ 读(dist 自带的示例图)
  const sources = [
    '/var/www/chesshub/figures/aobing.jpg',
    path.join(UPLOAD_DIR, 'aobing.jpg'),
  ]
  const src = sources.find((p) => fs.existsSync(p))
  if (!src) {
    console.log('[seed] figures 表为空且找不到 aobing.jpg,跳过 seed')
    return
  }

  // 复制到 UPLOAD_DIR(覆盖)
  const dest = path.join(UPLOAD_DIR, 'aobing.jpg')
  try {
    fs.copyFileSync(src, dest)
    console.log(`[seed] 复制 ${src} -> ${dest}`)
  } catch (e) {
    console.error('[seed] 复制失败:', e.message)
    return
  }

  db.prepare(`
    INSERT INTO figures (name, brand, description, images, date)
    VALUES (?, ?, ?, ?, ?)
  `).run(
    '摩动核 敖丙（白龙）',
    '摩动核 / 星甲魂将传',
    `威远式·剑圣 敖丙,摩动核爆款。白色 + 金属黑底,搭配冰紫透明件,自带机械龙 + 冷龙寒霜枪,气场拉满。

多支架悬浮展示,镇宅属性极强。

入手渠道:TB 摩动核旗舰店
购入时间:2026.06
当前摆位:玻璃展示柜第二层`,
    JSON.stringify(['aobing.jpg']),
    '2026.06'
  )
  console.log('[seed] 插入示例手办:摩动核 敖丙(白龙)')
}

app.listen(PORT, '127.0.0.1', () => {
  console.log(`[chesshub-server] listening on http://127.0.0.1:${PORT}`)
  console.log(`[chesshub-server] admin: ${ADMIN_USER} / ${ADMIN_PASS}`)
  console.log(`[chesshub-server] upload dir: ${UPLOAD_DIR}`)
  console.log(`[chesshub-server] data dir:   ${DATA_DIR}`)
  seedIfEmpty()
})