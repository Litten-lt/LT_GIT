// ChessHub 后端服务
// 启动: node server.js
// 依赖: express, better-sqlite3, multer, cors, jsonwebtoken, dotenv

import express from 'express'
import cors from 'cors'
import jwt from 'jsonwebtoken'
import multer from 'multer'
import rateLimit from 'express-rate-limit'
import { fileTypeFromBuffer } from 'file-type'
import Database from 'better-sqlite3'
import path from 'node:path'
import fs from 'node:fs'
import { readFile, unlink } from 'node:fs/promises'
import crypto from 'node:crypto'
import os from 'node:os'
import { execSync } from 'node:child_process'
import { config } from './config.js'
import { createLogger } from './logger.js'
import { createAuthMiddleware } from './middleware/auth.js'
import { CONTENT_TYPES, createContentMetaService } from './services/content-meta.js'

// ---------- 配置 ----------
const {
  port: PORT,
  adminUser: ADMIN_USER,
  adminPass: ADMIN_PASS,
  jwtSecret: JWT_SECRET,
  uploadDir: UPLOAD_DIR,
  dataDir: DATA_DIR,
  corsOrigin: CORS_ORIGIN,
  publicBaseUrl: PUBLIC_BASE_URL,
  nodeEnv: NODE_ENV,
} = config

// ---------- 日志 ----------
const logger = createLogger(config)

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
    description TEXT,            -- 创建时写的纯文本描述
    date        TEXT NOT NULL,
    created_at  INTEGER NOT NULL DEFAULT (strftime('%s','now')),
    updated_at  INTEGER NOT NULL DEFAULT (strftime('%s','now'))
  );
  CREATE INDEX IF NOT EXISTS idx_works_created ON works(created_at DESC);

  -- 说明表: 一个 work 关联 N 条 note (调查/说明流,可追加)
  CREATE TABLE IF NOT EXISTS work_notes (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    work_id     INTEGER NOT NULL,
    content     TEXT,            -- 单条说明的纯文本
    images      TEXT NOT NULL DEFAULT '[]',   -- JSON 数组
    created_at  INTEGER NOT NULL DEFAULT (strftime('%s','now')),
    FOREIGN KEY (work_id) REFERENCES works(id) ON DELETE CASCADE
  );
  CREATE INDEX IF NOT EXISTS idx_work_notes_work_id ON work_notes(work_id, created_at DESC);

  -- 学习笔记 (study/study_notes) — 与 works/work_notes 同结构
  CREATE TABLE IF NOT EXISTS studies (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    title       TEXT NOT NULL,
    description TEXT,
    date        TEXT NOT NULL,
    created_at  INTEGER NOT NULL DEFAULT (strftime('%s','now')),
    updated_at  INTEGER NOT NULL DEFAULT (strftime('%s','now'))
  );
  CREATE INDEX IF NOT EXISTS idx_studies_created ON studies(created_at DESC);

  CREATE TABLE IF NOT EXISTS study_notes (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    study_id    INTEGER NOT NULL,
    content     TEXT,
    images      TEXT NOT NULL DEFAULT '[]',
    created_at  INTEGER NOT NULL DEFAULT (strftime('%s','now')),
    FOREIGN KEY (study_id) REFERENCES studies(id) ON DELETE CASCADE
  );
  CREATE INDEX IF NOT EXISTS idx_study_notes_study_id ON study_notes(study_id, created_at DESC);

  -- 全局设置 KV 表 (Hero 背景等)
  CREATE TABLE IF NOT EXISTS settings (
    key        TEXT PRIMARY KEY,
    value      TEXT NOT NULL,
    updated_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
  );
  CREATE TABLE IF NOT EXISTS content_meta (
    content_type TEXT NOT NULL,
    content_id   INTEGER NOT NULL,
    status       TEXT NOT NULL DEFAULT 'published' CHECK(status IN ('draft','published')),
    featured     INTEGER NOT NULL DEFAULT 0,
    pinned       INTEGER NOT NULL DEFAULT 0,
    updated_at   INTEGER NOT NULL DEFAULT (strftime('%s','now')),
    PRIMARY KEY (content_type, content_id)
  );
  CREATE INDEX IF NOT EXISTS idx_content_meta_display
    ON content_meta(status, featured DESC, pinned DESC, updated_at DESC);
`)

// 老 works 表迁移: 检测 problem 字段就拼 description 重建表, 保留 id
const worksCols = db.prepare("PRAGMA table_info(works)").all().map(c => c.name)
if (worksCols.includes('problem')) {
  console.log('[migration] works: 旧 schema → 新 schema, 开始迁移...')
  db.exec(`
    ALTER TABLE works RENAME TO _works_legacy;

    CREATE TABLE works (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      title       TEXT NOT NULL,
      description TEXT,
      date        TEXT NOT NULL,
      created_at  INTEGER NOT NULL DEFAULT (strftime('%s','now')),
      updated_at  INTEGER NOT NULL DEFAULT (strftime('%s','now'))
    );

    INSERT INTO works (id, title, description, date, created_at, updated_at)
    SELECT
      id,
      title,
      TRIM(COALESCE(
        (CASE WHEN problem IS NOT NULL AND problem != '' THEN '[现象]' || char(10) || problem || char(10) || char(10) ELSE '' END) ||
        (CASE WHEN analysis IS NOT NULL AND analysis != '' THEN '[排查]' || char(10) || analysis || char(10) || char(10) ELSE '' END) ||
        (CASE WHEN solution IS NOT NULL AND solution != '' THEN '[解决]' || char(10) || solution ELSE '' END),
        ''
      )),
      date,
      created_at,
      created_at
    FROM _works_legacy;

    -- 删老 work_notes: 它的 FK 引用 _works_legacy (SQLite 在 ALTER RENAME 时自动改了 FK 引用的表名)
    -- _works_legacy 之后会 DROP, FK 会指向不存在的表 → 重建 work_notes 让 FK 引用新 works
    DROP TABLE IF EXISTS work_notes;
    CREATE TABLE work_notes (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      work_id     INTEGER NOT NULL,
      content     TEXT,
      images      TEXT NOT NULL DEFAULT '[]',
      created_at  INTEGER NOT NULL DEFAULT (strftime('%s','now')),
      FOREIGN KEY (work_id) REFERENCES works(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_work_notes_work_id ON work_notes(work_id, created_at DESC);

    -- 老 images (如果有图) → 创建第一条 note 存图, 保留原始截图
    INSERT INTO work_notes (work_id, content, images, created_at)
    SELECT id, '[原始截图]', images, created_at
    FROM _works_legacy
    WHERE images IS NOT NULL AND images != '[]' AND images != '';

    DROP TABLE _works_legacy;
  `)
  console.log('[migration] works: 迁移完成')
}

const app = express()

// ---------- 中间件 ----------

// CORS 白名单 (生产禁止 '*' + credentials)
app.use(cors({
  origin: (origin, cb) => {
    // 同源 / curl / 无 origin 头 → 放行
    if (!origin) return cb(null, true)
    // 显式 '*' 仅允许非生产
    if (CORS_ORIGIN === '*') {
      if (NODE_ENV === 'production') {
        return cb(new Error('CORS wildcard disabled in production'))
      }
      return cb(null, true)
    }
    const allowed = CORS_ORIGIN.split(',').map((s) => s.trim()).filter(Boolean)
    if (allowed.includes(origin)) return cb(null, true)
    // 拒绝: 不设 ACAO 头, 请求继续 200, 浏览器会拦 response
    return cb(null, false)
  },
  credentials: true,
}))

app.use(express.json({ limit: '2mb' }))

// 给每次请求挂一个 child logger (方便 controller 里 req.log.error(...))
app.use((req, res, next) => {
  req.log = logger.child({ method: req.method, path: req.path })
  next()
})

// ---------- Rate limit ----------
const loginLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 10,
  message: { error: '登录尝试过于频繁，请 5 分钟后再试' },
  standardHeaders: true,
  legacyHeaders: false,
})

const uploadLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  message: { error: '上传过于频繁，请稍后再试' },
  standardHeaders: true,
  legacyHeaders: false,
})

const globalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 200,
  message: { error: '请求过于频繁，请稍后再试' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.path === '/api/health',
})

app.use(globalLimiter)

const { requireAuth, requireSession } = createAuthMiddleware(JWT_SECRET)
const { contentMeta, decorateContent, contentExists } = createContentMetaService(db)

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

// ---------- 上传后置校验: magic bytes ----------
// 文件 mime 头部 (用于校验真实文件类型, 防止 .php 改后缀上传)
const ALLOWED_MIMES = /^image\/(jpe?g|png|webp|gif)$/i

async function validateImageMagic(req, res, next) {
  if (!req.file) return next()
  try {
    const buf = await readFile(req.file.path)
    const ft = await fileTypeFromBuffer(buf.slice(0, 4100))
    if (!ft || !ALLOWED_MIMES.test(ft.mime)) {
      await unlink(req.file.path).catch(() => {})
      return res.status(400).json({ error: '文件内容与图片格式不符' })
    }
    // SVG 可带 <script>, 等效 XSS, 单独拒绝
    if (req.file.originalname.toLowerCase().endsWith('.svg')) {
      await unlink(req.file.path).catch(() => {})
      return res.status(400).json({ error: '暂不支持 SVG' })
    }
    next()
  } catch (e) {
    req.log?.error({ err: e }, 'magic bytes check failed')
    next(e)
  }
}

// 包装 multer + magic bytes, 让 upload 路由里不用关心校验细节
function uploadImageMiddleware(req, res, next) {
  upload.single('file')(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message || '上传失败' })
    if (!req.file) return res.status(400).json({ error: '没有文件' })
    validateImageMagic(req, res, next)
  })
}

// ---------- 路由 ----------

// 健康检查
app.get('/api/health', (req, res) => {
  res.json({ ok: true, time: new Date().toISOString() })
})

// 登录
app.post('/api/auth/login', loginLimiter, (req, res) => {
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
app.post('/api/auth/guest', loginLimiter, (req, res) => {
  const token = jwt.sign(
    { sub: 'guest', role: 'guest' },
    JWT_SECRET,
    { expiresIn: '7d' }
  )
  res.json({ token, role: 'guest', username: '游客' })
})

// 验证 token 是否还有效 (admin + guest 都能查自己)
app.get('/api/auth/me', requireSession, (req, res) => {
  res.json({ username: req.user.sub, role: req.user.role })
})
// 统一内容管理列表 (admin)
app.get('/api/admin/content', requireAuth, (req, res) => {
  const specs = [
    ['work', 'works', 'title'], ['study', 'studies', 'title'],
    ['figure', 'figures', 'name'], ['travel', 'travels', 'title'], ['note', 'notes', 'title'],
  ]
  const items = specs.flatMap(([type, table, titleField]) => db.prepare(`
    SELECT id, ${titleField} AS title, date, created_at FROM ${table}
  `).all().map((row) => { const meta = contentMeta(type, row.id); return { type, ...row, ...meta, updated_at: meta.state_updated_at || row.created_at } }))
  items.sort((a, b) => Number(b.pinned) - Number(a.pinned) || Number(b.updated_at || b.created_at || 0) - Number(a.updated_at || a.created_at || 0))
  res.json({ items })
})

app.patch('/api/admin/content/:type/:id', requireAuth, (req, res) => {
  const type = req.params.type
  const id = Number(req.params.id)
  if (!CONTENT_TYPES.has(type) || !Number.isInteger(id) || !contentExists(type, id)) {
    return res.status(404).json({ error: '内容不存在' })
  }
  const current = contentMeta(type, id)
  const status = req.body?.status === undefined ? current.status : req.body.status
  const featured = req.body?.featured === undefined ? Number(current.featured) : Number(Boolean(req.body.featured))
  const pinned = req.body?.pinned === undefined ? Number(current.pinned) : Number(Boolean(req.body.pinned))
  if (!['draft', 'published'].includes(status)) return res.status(400).json({ error: '状态无效' })
  db.prepare(`
    INSERT INTO content_meta (content_type, content_id, status, featured, pinned, updated_at)
    VALUES (?, ?, ?, ?, ?, strftime('%s','now'))
    ON CONFLICT(content_type, content_id) DO UPDATE SET
      status=excluded.status, featured=excluded.featured, pinned=excluded.pinned, updated_at=excluded.updated_at
  `).run(type, id, status, featured, pinned)
  res.json({ ok: true, status, featured, pinned })
})

// 列出所有手办 (公开)
app.get('/api/figures', requireSession, (req, res) => {
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
  res.json({ figures: decorateContent(figures, 'figure', req.user.role) })
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
app.get('/api/travels', requireSession, (req, res) => {
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
  res.json({ travels: decorateContent(travels, 'travel', req.user.role) })
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
app.get('/api/notes', requireSession, (req, res) => {
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
  res.json({ notes: decorateContent(notes, 'note', req.user.role) })
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

// 列出所有 work (含 note_count) - 调试记录
app.get('/api/works', requireSession, (req, res) => {
  const rows = db.prepare(`
    SELECT w.id, w.title, w.description, w.date, w.created_at, w.updated_at,
           (SELECT COUNT(*) FROM work_notes WHERE work_id = w.id) AS note_count
    FROM works w
    ORDER BY w.created_at DESC
  `).all()
  res.json({ works: decorateContent(rows, 'work', req.user.role) })
})

// 详情 (含全部 notes, 按时间正序)
app.get('/api/works/:id', requireSession, (req, res) => {
  const id = Number(req.params.id)
  const w = db.prepare(`
    SELECT id, title, description, date, created_at, updated_at FROM works WHERE id = ?
  `).get(id)
  if (!w || (req.user.role !== 'admin' && contentMeta('work', id).status !== 'published')) return res.status(404).json({ error: '记录不存在' })

  const notes = db.prepare(`
    SELECT id, content, images, created_at FROM work_notes
    WHERE work_id = ? ORDER BY created_at ASC
  `).all(id)
  for (const n of notes) {
    try {
      n.images = JSON.parse(n.images || '[]').map((fn) => `${PUBLIC_BASE_URL}/data/figures/${fn}`)
    } catch {
      n.images = []
    }
  }
  res.json({ work: { ...w, notes, note_count: notes.length } })
})

// 新建 work (admin) - 极简: title + description (可空)
app.post('/api/works', requireAuth, (req, res) => {
  const { title, description } = req.body || {}
  if (!title || !title.trim()) {
    return res.status(400).json({ error: '标题必填' })
  }
  const date = new Date().toISOString().slice(0, 7).replace('-', '.')
  const result = db.prepare(`
    INSERT INTO works (title, description, date) VALUES (?, ?, ?)
  `).run(title.trim(), description?.trim() || null, date)
  res.json({ id: result.lastInsertRowid })
})

// 删除 work (admin) - 级联删 notes (ON DELETE CASCADE) + 删 notes 的图
app.delete('/api/works/:id', requireAuth, (req, res) => {
  const id = Number(req.params.id)
  const w = db.prepare('SELECT id FROM works WHERE id = ?').get(id)
  if (!w) return res.status(404).json({ error: '记录不存在' })

  // 收集所有 notes 的图, 一起删
  const notes = db.prepare('SELECT images FROM work_notes WHERE work_id = ?').all(id)
  for (const n of notes) {
    try {
      const imgs = JSON.parse(n.images || '[]')
      for (const fn of imgs) fs.unlink(path.join(UPLOAD_DIR, fn), () => {})
    } catch { /* ignore */ }
  }

  // ON DELETE CASCADE 自动删 notes
  db.prepare('DELETE FROM works WHERE id = ?').run(id)
  res.json({ ok: true })
})

// 更新 work (admin) - 改 title + description
app.put('/api/works/:id', requireAuth, (req, res) => {
  const id = Number(req.params.id)
  const w = db.prepare('SELECT id FROM works WHERE id = ?').get(id)
  if (!w) return res.status(404).json({ error: '记录不存在' })

  const { title, description } = req.body || {}
  if (title !== undefined && !title.trim()) {
    return res.status(400).json({ error: '标题不能为空' })
  }

  const sets = []
  const args = []
  if (title !== undefined) { sets.push('title = ?'); args.push(title.trim()) }
  if (description !== undefined) { sets.push('description = ?'); args.push(description?.trim() || null) }
  if (sets.length === 0) {
    return res.status(400).json({ error: '没有要更新的字段' })
  }

  sets.push("updated_at = strftime('%s','now')")
  args.push(id)
  db.prepare(`UPDATE works SET ${sets.join(', ')} WHERE id = ?`).run(...args)
  res.json({ ok: true })
})

// ---------- work_notes 增删改 (admin) ----------

// 添加一条说明 (admin) - 接收 content + 多张图片 (≤5 张)
app.post('/api/works/:id/notes', requireAuth, uploadLimiter, (req, res) => {
  const workId = Number(req.params.id)
  const w = db.prepare('SELECT id FROM works WHERE id = ?').get(workId)
  if (!w) return res.status(404).json({ error: 'work 不存在' })

  upload.array('images', 5)(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message || '上传失败' })
    ;(async () => {
      try {
        const content = req.body?.content?.trim() || null
        const files = req.files || []

        if (!content && files.length === 0) {
          return res.status(400).json({ error: '内容或图片至少有一个' })
        }

        // magic bytes 校验 (失败清掉所有)
        for (const f of files) {
          try {
            const buf = await readFile(f.path)
            const ft = await fileTypeFromBuffer(buf.slice(0, 4100))
            if (!ft || !ALLOWED_MIMES.test(ft.mime) || f.originalname.toLowerCase().endsWith('.svg')) {
              for (const f2 of files) await unlink(f2.path).catch(() => {})
              return res.status(400).json({ error: `${f.originalname} 文件格式不符` })
            }
          } catch (e) {
            for (const f2 of files) await unlink(f2.path).catch(() => {})
            req.log?.error({ err: e }, 'magic bytes check failed')
            return res.status(500).json({ error: '文件校验失败' })
          }
        }

        const uploadedFiles = files.map((f) => f.filename)
        const result = db.prepare(`
          INSERT INTO work_notes (work_id, content, images) VALUES (?, ?, ?)
        `).run(workId, content, JSON.stringify(uploadedFiles))

        db.prepare(`UPDATE works SET updated_at = strftime('%s','now') WHERE id = ?`).run(workId)
        res.json({ id: result.lastInsertRowid, images: uploadedFiles })
      } catch (e) {
        req.log?.error({ err: e, workId }, 'POST /api/works/:id/notes failed')
        res.status(500).json({ error: '服务器内部错误' })
      }
    })()
  })
})

// 改一条说明 (admin) - 改 content + 完全替换 images (上传新图才删老图)
app.put('/api/works/:id/notes/:nid', requireAuth, uploadLimiter, (req, res) => {
  const workId = Number(req.params.id)
  const noteId = Number(req.params.nid)
  const n = db.prepare(`
    SELECT id, images FROM work_notes WHERE id = ? AND work_id = ?
  `).get(noteId, workId)
  if (!n) return res.status(404).json({ error: 'note 不存在' })

  upload.array('images', 5)(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message || '上传失败' })
    ;(async () => {
      try {
        const content = req.body?.content?.trim() || null
        const files = req.files || []

        if (!content && files.length === 0) {
          return res.status(400).json({ error: '内容或图片至少有一个' })
        }

        for (const f of files) {
          try {
            const buf = await readFile(f.path)
            const ft = await fileTypeFromBuffer(buf.slice(0, 4100))
            if (!ft || !ALLOWED_MIMES.test(ft.mime) || f.originalname.toLowerCase().endsWith('.svg')) {
              for (const f2 of files) await unlink(f2.path).catch(() => {})
              return res.status(400).json({ error: `${f.originalname} 文件格式不符` })
            }
          } catch (e) {
            for (const f2 of files) await unlink(f2.path).catch(() => {})
            req.log?.error({ err: e }, 'magic bytes check failed')
            return res.status(500).json({ error: '文件校验失败' })
          }
        }

        // 上传了新图才删老图; 没传新图就保留老图
        const oldImages = JSON.parse(n.images || '[]')
        if (files.length > 0) {
          for (const fn of oldImages) fs.unlink(path.join(UPLOAD_DIR, fn), () => {})
        }
        const newImages = files.length > 0 ? files.map((f) => f.filename) : oldImages

        db.prepare(`
          UPDATE work_notes SET content = ?, images = ? WHERE id = ?
        `).run(content, JSON.stringify(newImages), noteId)

        db.prepare(`UPDATE works SET updated_at = strftime('%s','now') WHERE id = ?`).run(workId)
        res.json({ ok: true, images: newImages })
      } catch (e) {
        req.log?.error({ err: e, workId, noteId }, 'PUT /api/works/:id/notes/:nid failed')
        res.status(500).json({ error: '服务器内部错误' })
      }
    })()
  })
})

// 删一条说明 (admin) - 删图 + 删记录
app.delete('/api/works/:id/notes/:nid', requireAuth, (req, res) => {
  const workId = Number(req.params.id)
  const noteId = Number(req.params.nid)
  const n = db.prepare(`
    SELECT id, images FROM work_notes WHERE id = ? AND work_id = ?
  `).get(noteId, workId)
  if (!n) return res.status(404).json({ error: 'note 不存在' })

  try {
    const imgs = JSON.parse(n.images || '[]')
    for (const fn of imgs) fs.unlink(path.join(UPLOAD_DIR, fn), () => {})
  } catch { /* ignore */ }

  db.prepare('DELETE FROM work_notes WHERE id = ?').run(noteId)
  db.prepare(`UPDATE works SET updated_at = strftime('%s','now') WHERE id = ?`).run(workId)
  res.json({ ok: true })
})

// ---------- 学习笔记 (studies / study_notes) — 与 works 同结构 ----------

// 列出所有 study (含 note_count)
app.get('/api/studies', requireSession, (req, res) => {
  const rows = db.prepare(`
    SELECT s.id, s.title, s.description, s.date, s.created_at, s.updated_at,
           (SELECT COUNT(*) FROM study_notes WHERE study_id = s.id) AS note_count
    FROM studies s
    ORDER BY s.created_at DESC
  `).all()
  res.json({ studies: decorateContent(rows, 'study', req.user.role) })
})

// 详情 (含全部 notes, 按时间正序)
app.get('/api/studies/:id', requireSession, (req, res) => {
  const id = Number(req.params.id)
  const s = db.prepare(`
    SELECT id, title, description, date, created_at, updated_at FROM studies WHERE id = ?
  `).get(id)
  if (!s || (req.user.role !== 'admin' && contentMeta('study', id).status !== 'published')) return res.status(404).json({ error: '记录不存在' })

  const notes = db.prepare(`
    SELECT id, content, images, created_at FROM study_notes
    WHERE study_id = ? ORDER BY created_at ASC
  `).all(id)
  for (const n of notes) {
    try {
      n.images = JSON.parse(n.images || '[]').map((fn) => `${PUBLIC_BASE_URL}/data/figures/${fn}`)
    } catch {
      n.images = []
    }
  }
  res.json({ study: { ...s, notes, note_count: notes.length } })
})

// 新建 study (admin) - 极简: title + description (可空)
app.post('/api/studies', requireAuth, (req, res) => {
  const { title, description } = req.body || {}
  if (!title || !title.trim()) {
    return res.status(400).json({ error: '标题必填' })
  }
  const date = new Date().toISOString().slice(0, 7).replace('-', '.')
  const result = db.prepare(`
    INSERT INTO studies (title, description, date) VALUES (?, ?, ?)
  `).run(title.trim(), description?.trim() || null, date)
  res.json({ id: result.lastInsertRowid })
})

// 删除 study (admin) - 级联删 notes + 删 notes 的图
app.delete('/api/studies/:id', requireAuth, (req, res) => {
  const id = Number(req.params.id)
  const s = db.prepare('SELECT id FROM studies WHERE id = ?').get(id)
  if (!s) return res.status(404).json({ error: '记录不存在' })

  const notes = db.prepare('SELECT images FROM study_notes WHERE study_id = ?').all(id)
  for (const n of notes) {
    try {
      const imgs = JSON.parse(n.images || '[]')
      for (const fn of imgs) fs.unlink(path.join(UPLOAD_DIR, fn), () => {})
    } catch { /* ignore */ }
  }

  db.prepare('DELETE FROM studies WHERE id = ?').run(id)
  res.json({ ok: true })
})

// 更新 study (admin) - 改 title + description
app.put('/api/studies/:id', requireAuth, (req, res) => {
  const id = Number(req.params.id)
  const s = db.prepare('SELECT id FROM studies WHERE id = ?').get(id)
  if (!s) return res.status(404).json({ error: '记录不存在' })

  const { title, description } = req.body || {}
  if (title !== undefined && !title.trim()) {
    return res.status(400).json({ error: '标题不能为空' })
  }

  const sets = []
  const args = []
  if (title !== undefined) { sets.push('title = ?'); args.push(title.trim()) }
  if (description !== undefined) { sets.push('description = ?'); args.push(description?.trim() || null) }
  if (sets.length === 0) {
    return res.status(400).json({ error: '没有要更新的字段' })
  }

  sets.push("updated_at = strftime('%s','now')")
  args.push(id)
  db.prepare(`UPDATE studies SET ${sets.join(', ')} WHERE id = ?`).run(...args)
  res.json({ ok: true })
})

// 添加一条说明 (admin)
app.post('/api/studies/:id/notes', requireAuth, uploadLimiter, (req, res) => {
  const studyId = Number(req.params.id)
  const s = db.prepare('SELECT id FROM studies WHERE id = ?').get(studyId)
  if (!s) return res.status(404).json({ error: 'study 不存在' })

  upload.array('images', 5)(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message || '上传失败' })
    ;(async () => {
      try {
        const content = req.body?.content?.trim() || null
        const files = req.files || []

        if (!content && files.length === 0) {
          return res.status(400).json({ error: '内容或图片至少有一个' })
        }

        for (const f of files) {
          try {
            const buf = await readFile(f.path)
            const ft = await fileTypeFromBuffer(buf.slice(0, 4100))
            if (!ft || !ALLOWED_MIMES.test(ft.mime) || f.originalname.toLowerCase().endsWith('.svg')) {
              for (const f2 of files) await unlink(f2.path).catch(() => {})
              return res.status(400).json({ error: `${f.originalname} 文件格式不符` })
            }
          } catch (e) {
            for (const f2 of files) await unlink(f2.path).catch(() => {})
            req.log?.error({ err: e }, 'magic bytes check failed')
            return res.status(500).json({ error: '文件校验失败' })
          }
        }

        const uploadedFiles = files.map((f) => f.filename)
        const result = db.prepare(`
          INSERT INTO study_notes (study_id, content, images) VALUES (?, ?, ?)
        `).run(studyId, content, JSON.stringify(uploadedFiles))

        db.prepare(`UPDATE studies SET updated_at = strftime('%s','now') WHERE id = ?`).run(studyId)
        res.json({ id: result.lastInsertRowid, images: uploadedFiles })
      } catch (e) {
        req.log?.error({ err: e, studyId }, 'POST /api/studies/:id/notes failed')
        res.status(500).json({ error: '服务器内部错误' })
      }
    })()
  })
})

// 改一条说明 (admin)
app.put('/api/studies/:id/notes/:nid', requireAuth, uploadLimiter, (req, res) => {
  const studyId = Number(req.params.id)
  const noteId = Number(req.params.nid)
  const n = db.prepare(`
    SELECT id, images FROM study_notes WHERE id = ? AND study_id = ?
  `).get(noteId, studyId)
  if (!n) return res.status(404).json({ error: 'note 不存在' })

  upload.array('images', 5)(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message || '上传失败' })
    ;(async () => {
      try {
        const content = req.body?.content?.trim() || null
        const files = req.files || []

        if (!content && files.length === 0) {
          return res.status(400).json({ error: '内容或图片至少有一个' })
        }

        for (const f of files) {
          try {
            const buf = await readFile(f.path)
            const ft = await fileTypeFromBuffer(buf.slice(0, 4100))
            if (!ft || !ALLOWED_MIMES.test(ft.mime) || f.originalname.toLowerCase().endsWith('.svg')) {
              for (const f2 of files) await unlink(f2.path).catch(() => {})
              return res.status(400).json({ error: `${f.originalname} 文件格式不符` })
            }
          } catch (e) {
            for (const f2 of files) await unlink(f2.path).catch(() => {})
            req.log?.error({ err: e }, 'magic bytes check failed')
            return res.status(500).json({ error: '文件校验失败' })
          }
        }

        const oldImages = JSON.parse(n.images || '[]')
        if (files.length > 0) {
          for (const fn of oldImages) fs.unlink(path.join(UPLOAD_DIR, fn), () => {})
        }
        const newImages = files.length > 0 ? files.map((f) => f.filename) : oldImages

        db.prepare(`
          UPDATE study_notes SET content = ?, images = ? WHERE id = ?
        `).run(content, JSON.stringify(newImages), noteId)

        db.prepare(`UPDATE studies SET updated_at = strftime('%s','now') WHERE id = ?`).run(studyId)
        res.json({ ok: true, images: newImages })
      } catch (e) {
        req.log?.error({ err: e, studyId, noteId }, 'PUT /api/studies/:id/notes/:nid failed')
        res.status(500).json({ error: '服务器内部错误' })
      }
    })()
  })
})

// 删一条说明 (admin)
app.delete('/api/studies/:id/notes/:nid', requireAuth, (req, res) => {
  const studyId = Number(req.params.id)
  const noteId = Number(req.params.nid)
  const n = db.prepare(`
    SELECT id, images FROM study_notes WHERE id = ? AND study_id = ?
  `).get(noteId, studyId)
  if (!n) return res.status(404).json({ error: 'note 不存在' })

  try {
    const imgs = JSON.parse(n.images || '[]')
    for (const fn of imgs) fs.unlink(path.join(UPLOAD_DIR, fn), () => {})
  } catch { /* ignore */ }

  db.prepare('DELETE FROM study_notes WHERE id = ?').run(noteId)
  db.prepare(`UPDATE studies SET updated_at = strftime('%s','now') WHERE id = ?`).run(studyId)
  res.json({ ok: true })
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
app.post('/api/settings/hero-bg/upload', requireAuth, uploadLimiter, (req, res) => {
  uploadImageMiddleware(req, res, () => {
    // 给上传的文件加 hero- 前缀
    const newName = `hero-${req.file.filename}`
    const oldPath = req.file.path
    const newPath = path.join(UPLOAD_DIR, newName)
    try {
      fs.renameSync(oldPath, newPath)
    } catch (e) {
      req.log?.error({ err: e, op: 'hero-bg upload rename' }, 'file rename failed')
      return res.status(500).json({ error: '文件移动失败' })
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
      req.log?.warn({ err: e }, 'hero-bg cleanup old files failed')
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
app.post('/api/settings/about-photo/upload', requireAuth, uploadLimiter, (req, res) => {
  uploadImageMiddleware(req, res, () => {
    // 给上传的文件加 about- 前缀
    const newName = `about-${req.file.filename}`
    const oldPath = req.file.path
    const newPath = path.join(UPLOAD_DIR, newName)
    try {
      fs.renameSync(oldPath, newPath)
    } catch (e) {
      req.log?.error({ err: e, op: 'about-photo upload rename' }, 'file rename failed')
      return res.status(500).json({ error: '文件移动失败' })
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
      req.log?.warn({ err: e }, 'about-photo cleanup old files failed')
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

// ---------- Usage & Admin (admin) ----------

// 拿 DB 引用文件集合 (figures/travels/notes + work_notes; works 表本身无 images 列)
function getDbReferencedFiles() {
  const set = new Set()
  for (const t of ['figures', 'travels', 'notes', 'work_notes']) {
    for (const r of db.prepare('SELECT images FROM ' + t).all()) {
      try {
        JSON.parse(r.images).forEach((f) => set.add(f))
      } catch {}
    }
  }
  return set
}

// 扫 UPLOAD_DIR,排除 hero-/about- 前缀,返回孤儿清单
function scanOrphans() {
  const dbFiles = getDbReferencedFiles()
  const orphans = []
  let totalBytes = 0
  if (!fs.existsSync(UPLOAD_DIR)) return { count: 0, bytes: 0, files: [] }
  for (const f of fs.readdirSync(UPLOAD_DIR)) {
    if (f.startsWith('hero-') || f.startsWith('about-')) continue
    if (!/\.(jpe?g|png|webp|gif)$/i.test(f)) continue
    if (!dbFiles.has(f)) {
      try {
        const s = fs.statSync(path.join(UPLOAD_DIR, f))
        orphans.push({ filename: f, bytes: s.size })
        totalBytes += s.size
      } catch {}
    }
  }
  return { count: orphans.length, bytes: totalBytes, files: orphans }
}

// GET /api/admin/usage - admin
// 返回 { disk, memory, upload_dir, orphans, db, process, server_time }
app.get('/api/admin/usage', requireAuth, (req, res) => {
  try {
    const result = { server_time: new Date().toISOString() }

    // RAM
    const totalMem = os.totalmem()
    const freeMem = os.freemem()
    result.memory = {
      total_bytes: totalMem,
      free_bytes: freeMem,
      used_bytes: totalMem - freeMem,
      use_percent: Math.round(((totalMem - freeMem) / totalMem) * 100),
    }

    // Disk (整个 /)
    try {
      const dfOut = execSync('df -B1 / 2>/dev/null | tail -1', { timeout: 5000 })
        .toString()
        .trim()
        .split(/\s+/)
      const total = parseInt(dfOut[1])
      const used = parseInt(dfOut[2])
      const free = parseInt(dfOut[3])
      const usePercent = parseInt(dfOut[4])
      result.disk = {
        mount: '/',
        total_bytes: total,
        used_bytes: used,
        free_bytes: free,
        use_percent: usePercent,
      }
    } catch (e) {
      result.disk = { error: e.message }
    }

    // UPLOAD_DIR 统计
    try {
      const files = fs
        .readdirSync(UPLOAD_DIR)
        .filter((f) => !f.startsWith('.'))
      let totalBytes = 0
      const byPrefix = {}
      for (const f of files) {
        const s = fs.statSync(path.join(UPLOAD_DIR, f))
        if (!s.isFile()) continue
        totalBytes += s.size
        // 分类: hero- / about- 是显式前缀, 其他时间戳开头的归为 "业务"
        let prefix
        if (f.startsWith('hero-')) prefix = 'hero-'
        else if (f.startsWith('about-')) prefix = 'about-'
        else if (/^\d+-/.test(f)) prefix = '(业务)'
        else prefix = '(no-prefix)'
        byPrefix[prefix] = (byPrefix[prefix] || 0) + 1
      }
      result.upload_dir = {
        path: UPLOAD_DIR,
        file_count: files.length,
        bytes: totalBytes,
        by_prefix: byPrefix,
      }
    } catch (e) {
      result.upload_dir = { error: e.message }
    }

    // 孤儿
    result.orphans = scanOrphans()

    // DB
    try {
      const dbPath = path.join(DATA_DIR, 'chesshub.db')
      const dbStat = fs.statSync(dbPath)
      const walPath = dbPath + '-wal'
      const walStat = fs.existsSync(walPath) ? fs.statSync(walPath) : { size: 0 }
      const tables = {}
      for (const t of ['figures', 'travels', 'notes', 'works', 'settings']) {
        try {
          tables[t] = db.prepare('SELECT COUNT(*) AS n FROM ' + t).get().n
        } catch {
          tables[t] = 0
        }
      }
      result.db = {
        path: dbPath,
        db_bytes: dbStat.size,
        wal_bytes: walStat.size,
        tables,
      }
    } catch (e) {
      result.db = { error: e.message }
    }

    // Process
    const mu = process.memoryUsage()
    result.process = {
      pid: process.pid,
      uptime_sec: Math.floor(process.uptime()),
      rss_bytes: mu.rss,
      heap_used_bytes: mu.heapUsed,
      heap_total_bytes: mu.heapTotal,
      node_version: process.version,
    }

    res.json(result)
  } catch (e) {
    req.log?.error({ err: e }, 'usage endpoint failed')
    res.status(500).json({ error: '查询用量失败' })
  }
})

// POST /api/admin/orphans/clean - admin (一键清孤儿, 不需 SSH 登录)
app.post('/api/admin/orphans/clean', requireAuth, (req, res) => {
  try {
    const orphans = scanOrphans()
    let deletedCount = 0
    let deletedBytes = 0
    const deletedFiles = []
    for (const o of orphans.files) {
      try {
        fs.unlinkSync(path.join(UPLOAD_DIR, o.filename))
        deletedCount++
        deletedBytes += o.bytes
        deletedFiles.push(o.filename)
      } catch (e) {
        req.log?.warn({ filename: o.filename, err: e }, 'orphan unlink failed')
      }
    }
    res.json({
      deleted_count: deletedCount,
      deleted_bytes: deletedBytes,
      deleted_files: deletedFiles,
    })
  } catch (e) {
    req.log?.error({ err: e }, 'orphans clean failed')
    res.status(500).json({ error: '清理孤儿失败' })
  }
})

// ---------- 上传 (通用,admin) ----------

// 上传图片 (admin) - 接收 multipart/form-data, 字段名 'file'
// 返回 { url, filename }
app.post('/api/upload', requireAuth, uploadLimiter, (req, res) => {
  uploadImageMiddleware(req, res, () => {
    const url = `${PUBLIC_BASE_URL}/data/figures/${req.file.filename}`
    res.json({ url, filename: req.file.filename, size: req.file.size })
  })
})

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'API 不存在' })
})

// 错误处理 (兜底, 永远不漏 e.message 给前端)
app.use((err, req, res, next) => {
  // multer 错误 (file too large 等) 通常带 statusCode
  const status = err.statusCode || 500
  req.log?.error({ err, path: req.path, method: req.method }, 'request failed')
  if (status >= 400 && status < 500) {
    return res.status(status).json({ error: err.message || '请求错误' })
  }
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
    logger.info('[seed] figures 表为空且找不到 aobing.jpg,跳过 seed')
    return
  }

  // 复制到 UPLOAD_DIR(覆盖)
  const dest = path.join(UPLOAD_DIR, 'aobing.jpg')
  try {
    fs.copyFileSync(src, dest)
    logger.info({ src, dest }, '[seed] 复制')
  } catch (e) {
    logger.error({ err: e, src, dest }, '[seed] 复制失败')
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
  logger.info('[seed] 插入示例手办:摩动核 敖丙(白龙)')
}

export function startServer() {
  return app.listen(PORT, '127.0.0.1', () => {
    logger.info({ port: PORT, env: NODE_ENV }, `[chesshub-server] listening on http://127.0.0.1:${PORT}`)
    logger.info({ user: ADMIN_USER }, '[chesshub-server] admin configured')
    logger.info({ dir: UPLOAD_DIR }, '[chesshub-server] upload dir')
    logger.info({ dir: DATA_DIR }, '[chesshub-server] data dir')
    seedIfEmpty()
    seedTravelIfEmpty()
    seedNoteIfEmpty()
    seedWorkIfEmpty()
  })
}

export { app, db }

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
  logger.info('[seed] 插入示例旅行: 大理')
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
  logger.info('[seed] 插入示例笔记: 周末咖啡')
}

function seedWorkIfEmpty() {
  const count = db.prepare('SELECT COUNT(*) AS n FROM works').get().n
  if (count > 0) return

  // 新模型: title + description (调查流,无 problem/analysis/solution/tags/images)
  db.prepare(`
    INSERT INTO works (title, description, date)
    VALUES (?, ?, ?)
  `).run(
    'OpenWrt 调试踩坑 · 启动卡住',
    '设备上电后启动卡在 "switching to clocksource tsc",要等 30 秒才进 shell。\n\n试过 watchdog 关闭 / earlycon / dmesg 等方向,最后把 rootfs 从 squashfs 换成 ext4 + 不挂载 debug 分区,启动时间从 30s 降到 4s。',
    '2026.04',
  )
  logger.info('[seed] 插入示例 work: OpenWrt 启动卡住')
}
