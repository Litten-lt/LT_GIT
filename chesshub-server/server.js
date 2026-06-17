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

  CREATE TABLE IF NOT EXISTS travels (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    title       TEXT NOT NULL,
    location    TEXT,
    description TEXT NOT NULL,
    images      TEXT NOT NULL,    -- JSON 数组,存文件名
    date        TEXT NOT NULL,
    created_at  INTEGER NOT NULL DEFAULT (strftime('%s','now'))
  );
  CREATE INDEX IF NOT EXISTS idx_travels_created ON travels(created_at DESC);

  CREATE TABLE IF NOT EXISTS notes (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    title       TEXT NOT NULL,
    scene       TEXT,
    description TEXT NOT NULL,
    images      TEXT NOT NULL,    -- JSON 数组,存文件名
    date        TEXT NOT NULL,
    created_at  INTEGER NOT NULL DEFAULT (strftime('%s','now'))
  );
  CREATE INDEX IF NOT EXISTS idx_notes_created ON notes(created_at DESC);

  CREATE TABLE IF NOT EXISTS works (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    title       TEXT NOT NULL,
    problem     TEXT,             -- 现象/问题
    analysis    TEXT,             -- 排查过程
    solution    TEXT,             -- 解决方法
    tags        TEXT NOT NULL DEFAULT '[]',  -- JSON 数组,如 ["OpenWrt","Linux"]
    images      TEXT NOT NULL,    -- JSON 数组,存文件名
    date        TEXT NOT NULL,
    created_at  INTEGER NOT NULL DEFAULT (strftime('%s','now'))
  );
  CREATE INDEX IF NOT EXISTS idx_works_created ON works(created_at DESC);

  -- 全局设置 KV 表 (Hero 背景等)
  CREATE TABLE IF NOT EXISTS settings (
    key        TEXT PRIMARY KEY,
    value      TEXT NOT NULL,
    updated_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
  );
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

// 列出所有 travel (公开)
app.get('/api/travels', (req, res) => {
  const rows = db.prepare(`
    SELECT id, title, location, description, images, date, created_at
    FROM travels
    ORDER BY created_at DESC
  `).all()

  const travels = rows.map((r) => ({
    id: r.id,
    title: r.title,
    location: r.location || undefined,
    description: r.description,
    date: r.date,
    images: JSON.parse(r.images).map((fn) => `${PUBLIC_BASE_URL}/data/figures/${fn}`),
  }))
  res.json({ travels })
})

// 新建 travel (admin)
app.post('/api/travels', requireAuth, (req, res) => {
  const { title, location, description, images, date } = req.body || {}
  if (!title || !description || !Array.isArray(images) || images.length === 0) {
    return res.status(400).json({ error: 'title, description, images 必填' })
  }

  const result = db.prepare(`
    INSERT INTO travels (title, location, description, images, date)
    VALUES (?, ?, ?, ?, ?)
  `).run(
    title.trim(),
    location?.trim() || null,
    description.trim(),
    JSON.stringify(images),
    date || new Date().toISOString().slice(0, 7).replace('-', '.'),
  )

  res.json({ id: result.lastInsertRowid })
})

// 删除 travel (admin)
app.delete('/api/travels/:id', requireAuth, (req, res) => {
  const id = parseInt(req.params.id, 10)
  const row = db.prepare('SELECT images FROM travels WHERE id = ?').get(id)
  if (!row) return res.status(404).json({ error: '记录不存在' })

  db.prepare('DELETE FROM travels WHERE id = ?').run(id)

  const images = JSON.parse(row.images)
  for (const fn of images) {
    const fp = path.join(UPLOAD_DIR, fn)
    fs.unlink(fp, () => {})
  }
  res.json({ ok: true })
})

// 更新 travel (admin) - 局部更新,只改提供的字段
// body 可包含: title?, location?, description?, images?: string[]
app.put('/api/travels/:id', requireAuth, (req, res) => {
  const id = parseInt(req.params.id, 10)
  const row = db.prepare('SELECT images FROM travels WHERE id = ?').get(id)
  if (!row) return res.status(404).json({ error: '记录不存在' })

  const { title, location, description, images } = req.body || {}
  const oldImages = JSON.parse(row.images)

  if (title !== undefined && !title.trim()) {
    return res.status(400).json({ error: '标题不能为空' })
  }
  if (description !== undefined && !description.trim()) {
    return res.status(400).json({ error: '描述不能为空' })
  }
  if (images !== undefined && (!Array.isArray(images) || images.length === 0)) {
    return res.status(400).json({ error: 'images 必须是非空数组' })
  }

  let imagesToDelete = []
  if (images !== undefined) {
    const newSet = new Set(images)
    imagesToDelete = oldImages.filter((fn) => !newSet.has(fn))
  }

  const sets = []
  const args = []
  if (title !== undefined) { sets.push('title = ?'); args.push(title.trim()) }
  if (location !== undefined) { sets.push('location = ?'); args.push(location.trim() || null) }
  if (description !== undefined) { sets.push('description = ?'); args.push(description.trim()) }
  if (images !== undefined) { sets.push('images = ?'); args.push(JSON.stringify(images)) }

  if (sets.length === 0) {
    return res.status(400).json({ error: '没有要更新的字段' })
  }

  args.push(id)
  db.prepare(`UPDATE travels SET ${sets.join(', ')} WHERE id = ?`).run(...args)

  for (const fn of imagesToDelete) {
    const fp = path.join(UPLOAD_DIR, fn)
    fs.unlink(fp, () => {})
  }

  res.json({ ok: true, deletedFiles: imagesToDelete.length })
})

// 列出所有 note (公开)
app.get('/api/notes', (req, res) => {
  const rows = db.prepare(`
    SELECT id, title, scene, description, images, date, created_at
    FROM notes
    ORDER BY created_at DESC
  `).all()

  const notes = rows.map((r) => ({
    id: r.id,
    title: r.title,
    scene: r.scene || undefined,
    description: r.description,
    date: r.date,
    images: JSON.parse(r.images).map((fn) => `${PUBLIC_BASE_URL}/data/figures/${fn}`),
  }))
  res.json({ notes })
})

// 新建 note (admin)
app.post('/api/notes', requireAuth, (req, res) => {
  const { title, scene, description, images, date } = req.body || {}
  if (!title || !description || !Array.isArray(images) || images.length === 0) {
    return res.status(400).json({ error: 'title, description, images 必填' })
  }

  const result = db.prepare(`
    INSERT INTO notes (title, scene, description, images, date)
    VALUES (?, ?, ?, ?, ?)
  `).run(
    title.trim(),
    scene?.trim() || null,
    description.trim(),
    JSON.stringify(images),
    date || new Date().toISOString().slice(0, 7).replace('-', '.'),
  )

  res.json({ id: result.lastInsertRowid })
})

// 删除 note (admin)
app.delete('/api/notes/:id', requireAuth, (req, res) => {
  const id = parseInt(req.params.id, 10)
  const row = db.prepare('SELECT images FROM notes WHERE id = ?').get(id)
  if (!row) return res.status(404).json({ error: '记录不存在' })

  db.prepare('DELETE FROM notes WHERE id = ?').run(id)

  const images = JSON.parse(row.images)
  for (const fn of images) {
    const fp = path.join(UPLOAD_DIR, fn)
    fs.unlink(fp, () => {})
  }
  res.json({ ok: true })
})

// 更新 note (admin) - 局部更新,只改提供的字段
// body 可包含: title?, scene?, description?, images?: string[]
app.put('/api/notes/:id', requireAuth, (req, res) => {
  const id = parseInt(req.params.id, 10)
  const row = db.prepare('SELECT images FROM notes WHERE id = ?').get(id)
  if (!row) return res.status(404).json({ error: '记录不存在' })

  const { title, scene, description, images } = req.body || {}
  const oldImages = JSON.parse(row.images)

  if (title !== undefined && !title.trim()) {
    return res.status(400).json({ error: '标题不能为空' })
  }
  if (description !== undefined && !description.trim()) {
    return res.status(400).json({ error: '描述不能为空' })
  }
  if (images !== undefined && (!Array.isArray(images) || images.length === 0)) {
    return res.status(400).json({ error: 'images 必须是非空数组' })
  }

  let imagesToDelete = []
  if (images !== undefined) {
    const newSet = new Set(images)
    imagesToDelete = oldImages.filter((fn) => !newSet.has(fn))
  }

  const sets = []
  const args = []
  if (title !== undefined) { sets.push('title = ?'); args.push(title.trim()) }
  if (scene !== undefined) { sets.push('scene = ?'); args.push(scene.trim() || null) }
  if (description !== undefined) { sets.push('description = ?'); args.push(description.trim()) }
  if (images !== undefined) { sets.push('images = ?'); args.push(JSON.stringify(images)) }

  if (sets.length === 0) {
    return res.status(400).json({ error: '没有要更新的字段' })
  }

  args.push(id)
  db.prepare(`UPDATE notes SET ${sets.join(', ')} WHERE id = ?`).run(...args)

  for (const fn of imagesToDelete) {
    const fp = path.join(UPLOAD_DIR, fn)
    fs.unlink(fp, () => {})
  }

  res.json({ ok: true, deletedFiles: imagesToDelete.length })
})

// 列出所有 work (公开) - 调试记录
app.get('/api/works', (req, res) => {
  const rows = db.prepare(`
    SELECT id, title, problem, analysis, solution, tags, images, date, created_at
    FROM works
    ORDER BY created_at DESC
  `).all()

  const works = rows.map((r) => ({
    id: r.id,
    title: r.title,
    problem: r.problem || undefined,
    analysis: r.analysis || undefined,
    solution: r.solution || undefined,
    tags: JSON.parse(r.tags),
    date: r.date,
    images: JSON.parse(r.images).map((fn) => `${PUBLIC_BASE_URL}/data/figures/${fn}`),
  }))
  res.json({ works })
})

// 新建 work (admin)
app.post('/api/works', requireAuth, (req, res) => {
  const { title, problem, analysis, solution, tags, images, date } = req.body || {}
  if (!title || !Array.isArray(images) || images.length === 0) {
    return res.status(400).json({ error: 'title、images 必填' })
  }
  // problem/analysis/solution 至少一个非空
  if (!problem?.trim() && !analysis?.trim() && !solution?.trim()) {
    return res.status(400).json({ error: '现象 / 排查 / 解决 至少写一段' })
  }

  const result = db.prepare(`
    INSERT INTO works (title, problem, analysis, solution, tags, images, date)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    title.trim(),
    problem?.trim() || null,
    analysis?.trim() || null,
    solution?.trim() || null,
    JSON.stringify(Array.isArray(tags) ? tags : []),
    JSON.stringify(images),
    date || new Date().toISOString().slice(0, 7).replace('-', '.'),
  )

  res.json({ id: result.lastInsertRowid })
})

// 删除 work (admin)
app.delete('/api/works/:id', requireAuth, (req, res) => {
  const id = parseInt(req.params.id, 10)
  const row = db.prepare('SELECT images FROM works WHERE id = ?').get(id)
  if (!row) return res.status(404).json({ error: '记录不存在' })

  db.prepare('DELETE FROM works WHERE id = ?').run(id)

  const images = JSON.parse(row.images)
  for (const fn of images) {
    const fp = path.join(UPLOAD_DIR, fn)
    fs.unlink(fp, () => {})
  }
  res.json({ ok: true })
})

// 更新 work (admin) - 局部更新
// body 可包含: title?, problem?, analysis?, solution?, tags?: string[], images?: string[]
app.put('/api/works/:id', requireAuth, (req, res) => {
  const id = parseInt(req.params.id, 10)
  const row = db.prepare('SELECT images FROM works WHERE id = ?').get(id)
  if (!row) return res.status(404).json({ error: '记录不存在' })

  const { title, problem, analysis, solution, tags, images } = req.body || {}
  const oldImages = JSON.parse(row.images)

  if (title !== undefined && !title.trim()) {
    return res.status(400).json({ error: '标题不能为空' })
  }
  if (images !== undefined && (!Array.isArray(images) || images.length === 0)) {
    return res.status(400).json({ error: 'images 必须是非空数组' })
  }

  let imagesToDelete = []
  if (images !== undefined) {
    const newSet = new Set(images)
    imagesToDelete = oldImages.filter((fn) => !newSet.has(fn))
  }

  const sets = []
  const args = []
  if (title !== undefined) { sets.push('title = ?'); args.push(title.trim()) }
  if (problem !== undefined) { sets.push('problem = ?'); args.push(problem?.trim() || null) }
  if (analysis !== undefined) { sets.push('analysis = ?'); args.push(analysis?.trim() || null) }
  if (solution !== undefined) { sets.push('solution = ?'); args.push(solution?.trim() || null) }
  if (tags !== undefined) { sets.push('tags = ?'); args.push(JSON.stringify(Array.isArray(tags) ? tags : [])) }
  if (images !== undefined) { sets.push('images = ?'); args.push(JSON.stringify(images)) }

  if (sets.length === 0) {
    return res.status(400).json({ error: '没有要更新的字段' })
  }

  args.push(id)
  db.prepare(`UPDATE works SET ${sets.join(', ')} WHERE id = ?`).run(...args)

  for (const fn of imagesToDelete) {
    const fp = path.join(UPLOAD_DIR, fn)
    fs.unlink(fp, () => {})
  }

  res.json({ ok: true, deletedFiles: imagesToDelete.length })
})

// ---------- Hero 背景设置 ----------
// 复用 UPLOAD_DIR 存图 (与 figures 同目录),靠 hero- 前缀区分
// URL 仍是 ${PUBLIC_BASE_URL}/data/figures/${filename},前端加 hero- 前缀过滤

const DEFAULT_HERO_BG = { type: 'color', value: '#ebe4d8' }

function upsertSetting(key, valueObj) {
  db.prepare(`
    INSERT INTO settings (key, value, updated_at) VALUES (?, ?, strftime('%s','now'))
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
  `).run(key, JSON.stringify(valueObj))
}

// GET /api/settings/hero-bg - 任何人可读
app.get('/api/settings/hero-bg', (req, res) => {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get('hero_bg')
  if (!row) return res.json(DEFAULT_HERO_BG)
  try {
    const parsed = JSON.parse(row.value)
    // 如果是 image 但文件已经被删了,降级为默认
    if (parsed.type === 'image') {
      const fp = path.join(UPLOAD_DIR, parsed.value)
      if (!fs.existsSync(fp)) return res.json(DEFAULT_HERO_BG)
      // 把绝对路径 url 一起返回,前端可以直接用
      parsed.url = `${PUBLIC_BASE_URL}/data/figures/${parsed.value}`
    }
    return res.json(parsed)
  } catch {
    return res.json(DEFAULT_HERO_BG)
  }
})

// PUT /api/settings/hero-bg - admin (改预设: color / gradient)
app.put('/api/settings/hero-bg', requireAuth, (req, res) => {
  const { type, value } = req.body || {}
  if (!['color', 'gradient'].includes(type)) {
    return res.status(400).json({ error: 'type 必须是 color 或 gradient' })
  }
  const v = typeof value === 'string' ? value.trim() : ''
  if (!v) return res.status(400).json({ error: 'value 必填' })
  // 白名单防止 css 注入
  if (type === 'color' && !/^#[0-9a-fA-F]{3,8}$/.test(v)) {
    return res.status(400).json({ error: 'color 必须是 #hex 格式' })
  }
  if (type === 'gradient' && !/^(linear|radial)-gradient\(/.test(v)) {
    return res.status(400).json({ error: 'gradient 必须是 linear-gradient(...) 或 radial-gradient(...)' })
  }
  upsertSetting('hero_bg', { type, value: v })
  res.json({ ok: true, type, value: v })
})

// POST /api/settings/hero-bg/upload - admin (上传图片做背景)
app.post('/api/settings/hero-bg/upload', requireAuth, (req, res) => {
  upload.single('file')(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message || '上传失败' })
    if (!req.file) return res.status(400).json({ error: '没有文件' })

    // 给上传的文件加 hero- 前缀
    const newName = `hero-${req.file.filename}`
    const oldPath = req.file.path
    const newPath = path.join(UPLOAD_DIR, newName)
    try {
      fs.renameSync(oldPath, newPath)
    } catch (e) {
      return res.status(500).json({ error: '文件移动失败: ' + e.message })
    }

    // 清理旧的 hero- 图 (只保留一张最新的)
    try {
      const files = fs.readdirSync(UPLOAD_DIR).filter(
        (f) => f.startsWith('hero-') && f !== newName
      )
      for (const f of files) {
        fs.unlinkSync(path.join(UPLOAD_DIR, f))
      }
    } catch (e) {
      console.warn('[hero-bg] 清理旧 hero 图失败:', e.message)
    }

    upsertSetting('hero_bg', { type: 'image', value: newName })
    res.json({
      ok: true,
      type: 'image',
      value: newName,
      url: `${PUBLIC_BASE_URL}/data/figures/${newName}`,
    })
  })
})

// DELETE /api/settings/hero-bg - admin (重置默认)
app.delete('/api/settings/hero-bg', requireAuth, (req, res) => {
  // 清理所有 hero- 图
  try {
    const files = fs.readdirSync(UPLOAD_DIR).filter((f) => f.startsWith('hero-'))
    for (const f of files) {
      fs.unlinkSync(path.join(UPLOAD_DIR, f))
    }
  } catch {}
  db.prepare('DELETE FROM settings WHERE key = ?').run('hero_bg')
  res.json({ ok: true })
})

// ---------- About 照片 ----------
// 复用 UPLOAD_DIR 存图, 靠 about- 前缀区分
// 只保留一张, 上传时自动清旧的

// GET /api/settings/about-photo - 任何人可读
app.get('/api/settings/about-photo', (req, res) => {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get('about_photo')
  if (!row) return res.json({})
  try {
    const parsed = JSON.parse(row.value)
    if (parsed && parsed.filename) {
      const fp = path.join(UPLOAD_DIR, parsed.filename)
      if (!fs.existsSync(fp)) return res.json({})
      return res.json({ url: `${PUBLIC_BASE_URL}/data/figures/${parsed.filename}` })
    }
    return res.json({})
  } catch {
    return res.json({})
  }
})

// POST /api/settings/about-photo/upload - admin
app.post('/api/settings/about-photo/upload', requireAuth, (req, res) => {
  upload.single('file')(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message || '上传失败' })
    if (!req.file) return res.status(400).json({ error: '没有文件' })

    // 给上传的文件加 about- 前缀
    const newName = `about-${req.file.filename}`
    const oldPath = req.file.path
    const newPath = path.join(UPLOAD_DIR, newName)
    try {
      fs.renameSync(oldPath, newPath)
    } catch (e) {
      return res.status(500).json({ error: '文件移动失败: ' + e.message })
    }

    // 清理旧的 about- 图 (只保留一张最新的)
    try {
      const files = fs.readdirSync(UPLOAD_DIR).filter(
        (f) => f.startsWith('about-') && f !== newName
      )
      for (const f of files) {
        fs.unlinkSync(path.join(UPLOAD_DIR, f))
      }
    } catch (e) {
      console.warn('[about-photo] 清理旧 about 图失败:', e.message)
    }

    upsertSetting('about_photo', { filename: newName })
    res.json({
      ok: true,
      url: `${PUBLIC_BASE_URL}/data/figures/${newName}`,
    })
  })
})

// DELETE /api/settings/about-photo - admin (重置默认)
app.delete('/api/settings/about-photo', requireAuth, (req, res) => {
  try {
    const files = fs.readdirSync(UPLOAD_DIR).filter((f) => f.startsWith('about-'))
    for (const f of files) {
      fs.unlinkSync(path.join(UPLOAD_DIR, f))
    }
  } catch {}
  db.prepare('DELETE FROM settings WHERE key = ?').run('about_photo')
  res.json({ ok: true })
})

// ---------- 上传 (通用,admin) ----------

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
  seedTravelIfEmpty()
  seedNoteIfEmpty()
  seedWorkIfEmpty()
})

// ---------- seed travels / notes ----------

function seedTravelIfEmpty() {
  const count = db.prepare('SELECT COUNT(*) AS n FROM travels').get().n
  if (count > 0) return

  db.prepare(`
    INSERT INTO travels (title, location, description, images, date)
    VALUES (?, ?, ?, ?, ?)
  `).run(
    '示例旅行 · 大理',
    '云南 · 大理',
    '苍山洱海,风很慢。点进来这条等之后你写入真实旅行记录时会被替换。',
    JSON.stringify([]),
    '2025.10',
  )
  console.log('[seed] 插入示例旅行: 大理')
}

function seedNoteIfEmpty() {
  const count = db.prepare('SELECT COUNT(*) AS n FROM notes').get().n
  if (count > 0) return

  db.prepare(`
    INSERT INTO notes (title, scene, description, images, date)
    VALUES (?, ?, ?, ?, ?)
  `).run(
    '示例生活 · 周末咖啡',
    '深圳 · 家里',
    '新到的豆子终于养到合适的日子,做一杯慢慢喝,听着外面雨声发一下午呆。',
    JSON.stringify([]),
    '2026.05',
  )
  console.log('[seed] 插入示例笔记: 周末咖啡')
}

function seedWorkIfEmpty() {
  const count = db.prepare('SELECT COUNT(*) AS n FROM works').get().n
  if (count > 0) return

  db.prepare(`
    INSERT INTO works (title, problem, analysis, solution, tags, images, date)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    'OpenWrt 调试踩坑 · 启动卡住',
    '设备上电后启动卡在 "switching to clocksource tsc",要等 30 秒才进 shell。',
    `试过几个常见方向:
1. 关掉 watchdog - 没效果
2. 改 console 输出到 earlycon - 没看到额外信息
3. 看 dmesg 完整日志,发现是 mtd partition 扫描卡住`,
    '把 rootfs 从 squashfs 换成 ext4 + 不挂载 debug 分区,启动时间从 30s 降到 4s。',
    JSON.stringify(['OpenWrt', '嵌入式', '启动']),
    JSON.stringify([]),
    '2026.04',
  )
  console.log('[seed] 插入示例 work: OpenWrt 启动卡住')
}