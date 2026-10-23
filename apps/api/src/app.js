// LongTeng 个人网站后端服务
// 启动: node server.js
// 依赖: express, better-sqlite3, multer, cors, dotenv

import express from 'express'
import cors from 'cors'
import multer from 'multer'
import rateLimit from 'express-rate-limit'
import { fileTypeFromBuffer } from 'file-type'
import Database from 'better-sqlite3'
import path from 'node:path'
import fs from 'node:fs'
import { readFile, unlink } from 'node:fs/promises'
import crypto from 'node:crypto'
import { config } from './config.js'
import { createLogger } from './logger.js'

// ---------- 配置 ----------
const {
  port: PORT,
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

const databasePath = path.join(DATA_DIR, 'longteng.db')
const legacyDatabasePath = path.join(DATA_DIR, 'chesshub.db')
if (!fs.existsSync(databasePath) && fs.existsSync(legacyDatabasePath)) {
  fs.renameSync(legacyDatabasePath, databasePath)
  logger.info('[migration] database renamed: chesshub.db -> longteng.db')
}
const db = new Database(databasePath)
db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

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

  -- 频道是稳定的内容方向；分类是可调整、可删除的组织方式。
  CREATE TABLE IF NOT EXISTS channels (
    id          TEXT PRIMARY KEY,
    slug        TEXT NOT NULL UNIQUE,
    name        TEXT NOT NULL,
    description TEXT,
    sort_order  INTEGER NOT NULL DEFAULT 0,
    is_active   INTEGER NOT NULL DEFAULT 1,
    created_at  INTEGER NOT NULL DEFAULT (strftime('%s','now')),
    updated_at  INTEGER NOT NULL DEFAULT (strftime('%s','now'))
  );

  CREATE TABLE IF NOT EXISTS categories (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    channel_id  TEXT NOT NULL REFERENCES channels(id) ON DELETE RESTRICT,
    slug        TEXT NOT NULL UNIQUE,
    name        TEXT NOT NULL,
    description TEXT,
    sort_order  INTEGER NOT NULL DEFAULT 0,
    is_active   INTEGER NOT NULL DEFAULT 1,
    legacy_type TEXT UNIQUE,
    created_at  INTEGER NOT NULL DEFAULT (strftime('%s','now')),
    updated_at  INTEGER NOT NULL DEFAULT (strftime('%s','now'))
  );
  CREATE INDEX IF NOT EXISTS idx_categories_channel
    ON categories(channel_id, is_active, sort_order, id);

  CREATE TABLE IF NOT EXISTS content_taxonomy (
    content_type TEXT NOT NULL,
    content_id   INTEGER NOT NULL,
    channel_id   TEXT NOT NULL REFERENCES channels(id) ON DELETE RESTRICT,
    category_id  INTEGER REFERENCES categories(id) ON DELETE SET NULL,
    created_at   INTEGER NOT NULL DEFAULT (strftime('%s','now')),
    updated_at   INTEGER NOT NULL DEFAULT (strftime('%s','now')),
    PRIMARY KEY (content_type, content_id)
  );
  CREATE INDEX IF NOT EXISTS idx_content_taxonomy_category
    ON content_taxonomy(channel_id, category_id, content_type, content_id);

  CREATE TABLE IF NOT EXISTS contents (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    channel_id  TEXT NOT NULL REFERENCES channels(id) ON DELETE RESTRICT,
    category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
    format      TEXT NOT NULL CHECK(format IN ('article','gallery')),
    title       TEXT NOT NULL,
    subtitle    TEXT,
    body        TEXT NOT NULL DEFAULT '',
    images      TEXT NOT NULL DEFAULT '[]',
    date        TEXT NOT NULL,
    status      TEXT NOT NULL DEFAULT 'published' CHECK(status IN ('draft','published')),
    featured    INTEGER NOT NULL DEFAULT 0,
    pinned      INTEGER NOT NULL DEFAULT 0,
    legacy_type TEXT,
    legacy_id   INTEGER,
    created_at  INTEGER NOT NULL DEFAULT (strftime('%s','now')),
    updated_at  INTEGER NOT NULL DEFAULT (strftime('%s','now')),
    UNIQUE(legacy_type, legacy_id)
  );
  CREATE INDEX IF NOT EXISTS idx_contents_display ON contents(channel_id, status, featured DESC, pinned DESC, updated_at DESC);
  CREATE INDEX IF NOT EXISTS idx_contents_category ON contents(channel_id, category_id, updated_at DESC);

  CREATE TABLE IF NOT EXISTS content_notes_v2 (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    content_id  INTEGER NOT NULL REFERENCES contents(id) ON DELETE CASCADE,
    body        TEXT NOT NULL DEFAULT '',
    images      TEXT NOT NULL DEFAULT '[]',
    legacy_type TEXT,
    legacy_id   INTEGER,
    created_at  INTEGER NOT NULL DEFAULT (strftime('%s','now')),
    updated_at  INTEGER NOT NULL DEFAULT (strftime('%s','now')),
    UNIQUE(legacy_type, legacy_id)
  );
  CREATE INDEX IF NOT EXISTS idx_content_notes_v2_parent ON content_notes_v2(content_id, created_at, id);

  CREATE TABLE IF NOT EXISTS content_note_drafts (
    content_id  INTEGER PRIMARY KEY REFERENCES contents(id) ON DELETE CASCADE,
    body        TEXT NOT NULL DEFAULT '',
    updated_at  INTEGER NOT NULL DEFAULT (strftime('%s','now'))
  );

  CREATE TABLE IF NOT EXISTS content_revisions (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    content_id  INTEGER NOT NULL REFERENCES contents(id) ON DELETE CASCADE,
    snapshot    TEXT NOT NULL,
    created_at  INTEGER NOT NULL DEFAULT (strftime('%s','now'))
  );
  CREATE INDEX IF NOT EXISTS idx_content_revisions_parent ON content_revisions(content_id, created_at DESC, id DESC);
`)

// 兼容已部署数据库：定时发布是统一内容模型的可选字段。
const contentColumns = db.prepare("PRAGMA table_info(contents)").all().map((column) => column.name)
if (!contentColumns.includes('publish_at')) db.exec('ALTER TABLE contents ADD COLUMN publish_at INTEGER')
if (!contentColumns.includes('deleted_at')) db.exec('ALTER TABLE contents ADD COLUMN deleted_at INTEGER')
for (const [column, definition] of [['tags', "TEXT NOT NULL DEFAULT '[]'"], ['problem_status', "TEXT NOT NULL DEFAULT 'record'"], ['visibility', "TEXT NOT NULL DEFAULT 'public'"]]) {
  if (!contentColumns.includes(column)) db.exec(`ALTER TABLE contents ADD COLUMN ${column} ${definition}`)
}
function noteMetadata(input, current = {}) {
  const tags = input.tags ?? JSON.parse(current.tags || '[]')
  const problemStatus = input.problem_status ?? current.problem_status ?? 'record'
  if (!Array.isArray(tags) || tags.length > 12 || tags.some(tag => typeof tag !== 'string' || tag.length > 40) || !['record','investigating','resolved','pending'].includes(problemStatus)) return null
  return { tags: JSON.stringify([...new Set(tags.map(tag => tag.trim()).filter(Boolean))]), problemStatus }
}


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

// ---------- 分类基础数据与兼容迁移 ----------
// INSERT OR IGNORE 只负责首次初始化；以后管理中心对名称、排序和状态的修改不会被重启覆盖。
db.exec(`
  INSERT OR IGNORE INTO channels (id, slug, name, description, sort_order)
  VALUES
    ('journal', 'journal', '工作与学习', '工作记录与学习沉淀', 10),
    ('life', 'life', '生活分享', '模型、旅行与生活随笔', 20);

  INSERT OR IGNORE INTO categories (channel_id, slug, name, description, sort_order, legacy_type)
    SELECT 'journal', 'work', '工作记录', '调试问题、过程与工程结论', 10, 'work'
    WHERE NOT EXISTS (SELECT 1 FROM settings WHERE key = 'taxonomy_v1_initialized')
    UNION ALL SELECT 'journal', 'study', '学习笔记', '原理、方法和知识沉淀', 20, 'study'
    WHERE NOT EXISTS (SELECT 1 FROM settings WHERE key = 'taxonomy_v1_initialized')
    UNION ALL SELECT 'life', 'figure', '模型手办', '收藏档案、照片与心得', 10, 'figure'
    WHERE NOT EXISTS (SELECT 1 FROM settings WHERE key = 'taxonomy_v1_initialized')
    UNION ALL SELECT 'life', 'travel', '旅行记录', '地点、见闻与途中影像', 20, 'travel'
    WHERE NOT EXISTS (SELECT 1 FROM settings WHERE key = 'taxonomy_v1_initialized')
    UNION ALL SELECT 'life', 'note', '生活随笔', '日常片段、想法和随手拍', 30, 'note'
    WHERE NOT EXISTS (SELECT 1 FROM settings WHERE key = 'taxonomy_v1_initialized');

  INSERT OR IGNORE INTO settings (key, value)
  VALUES ('taxonomy_v1_initialized', '{"version":1}');

  INSERT OR IGNORE INTO content_taxonomy (content_type, content_id, channel_id, category_id)
    SELECT 'work', id, 'journal', (SELECT id FROM categories WHERE legacy_type = 'work') FROM works;
  INSERT OR IGNORE INTO content_taxonomy (content_type, content_id, channel_id, category_id)
    SELECT 'study', id, 'journal', (SELECT id FROM categories WHERE legacy_type = 'study') FROM studies;
  INSERT OR IGNORE INTO content_taxonomy (content_type, content_id, channel_id, category_id)
    SELECT 'figure', id, 'life', (SELECT id FROM categories WHERE legacy_type = 'figure') FROM figures;
  INSERT OR IGNORE INTO content_taxonomy (content_type, content_id, channel_id, category_id)
    SELECT 'travel', id, 'life', (SELECT id FROM categories WHERE legacy_type = 'travel') FROM travels;
  INSERT OR IGNORE INTO content_taxonomy (content_type, content_id, channel_id, category_id)
    SELECT 'note', id, 'life', (SELECT id FROM categories WHERE legacy_type = 'note') FROM notes;

  CREATE TRIGGER IF NOT EXISTS taxonomy_work_insert AFTER INSERT ON works BEGIN
    INSERT OR IGNORE INTO content_taxonomy (content_type, content_id, channel_id, category_id)
    VALUES ('work', NEW.id, 'journal', (SELECT id FROM categories WHERE legacy_type = 'work'));
  END;
  CREATE TRIGGER IF NOT EXISTS taxonomy_study_insert AFTER INSERT ON studies BEGIN
    INSERT OR IGNORE INTO content_taxonomy (content_type, content_id, channel_id, category_id)
    VALUES ('study', NEW.id, 'journal', (SELECT id FROM categories WHERE legacy_type = 'study'));
  END;
  CREATE TRIGGER IF NOT EXISTS taxonomy_figure_insert AFTER INSERT ON figures BEGIN
    INSERT OR IGNORE INTO content_taxonomy (content_type, content_id, channel_id, category_id)
    VALUES ('figure', NEW.id, 'life', (SELECT id FROM categories WHERE legacy_type = 'figure'));
  END;
  CREATE TRIGGER IF NOT EXISTS taxonomy_travel_insert AFTER INSERT ON travels BEGIN
    INSERT OR IGNORE INTO content_taxonomy (content_type, content_id, channel_id, category_id)
    VALUES ('travel', NEW.id, 'life', (SELECT id FROM categories WHERE legacy_type = 'travel'));
  END;
  CREATE TRIGGER IF NOT EXISTS taxonomy_note_insert AFTER INSERT ON notes BEGIN
    INSERT OR IGNORE INTO content_taxonomy (content_type, content_id, channel_id, category_id)
    VALUES ('note', NEW.id, 'life', (SELECT id FROM categories WHERE legacy_type = 'note'));
  END;

  CREATE TRIGGER IF NOT EXISTS taxonomy_work_delete AFTER DELETE ON works BEGIN
    DELETE FROM content_taxonomy WHERE content_type = 'work' AND content_id = OLD.id;
  END;
  CREATE TRIGGER IF NOT EXISTS taxonomy_study_delete AFTER DELETE ON studies BEGIN
    DELETE FROM content_taxonomy WHERE content_type = 'study' AND content_id = OLD.id;
  END;
  CREATE TRIGGER IF NOT EXISTS taxonomy_figure_delete AFTER DELETE ON figures BEGIN
    DELETE FROM content_taxonomy WHERE content_type = 'figure' AND content_id = OLD.id;
  END;
  CREATE TRIGGER IF NOT EXISTS taxonomy_travel_delete AFTER DELETE ON travels BEGIN
    DELETE FROM content_taxonomy WHERE content_type = 'travel' AND content_id = OLD.id;
  END;
  CREATE TRIGGER IF NOT EXISTS taxonomy_note_delete AFTER DELETE ON notes BEGIN
    DELETE FROM content_taxonomy WHERE content_type = 'note' AND content_id = OLD.id;
  END;
`)

// ---------- 统一内容模型 v2 ----------
// 旧五类表只作为兼容来源；所有现有内容幂等迁移到统一表。
db.exec(`
  INSERT OR IGNORE INTO contents (channel_id, category_id, format, title, body, images, date, status, featured, pinned, legacy_type, legacy_id, created_at, updated_at)
    SELECT 'journal', t.category_id, 'article', w.title, COALESCE(w.description,''), '[]', w.date,
      COALESCE(m.status,'published'), COALESCE(m.featured,0), COALESCE(m.pinned,0), 'work', w.id, w.created_at, COALESCE(m.updated_at,w.created_at)
    FROM works w LEFT JOIN content_taxonomy t ON t.content_type='work' AND t.content_id=w.id LEFT JOIN content_meta m ON m.content_type='work' AND m.content_id=w.id;
  INSERT OR IGNORE INTO contents (channel_id, category_id, format, title, body, images, date, status, featured, pinned, legacy_type, legacy_id, created_at, updated_at)
    SELECT 'journal', t.category_id, 'article', s.title, COALESCE(s.description,''), '[]', s.date,
      COALESCE(m.status,'published'), COALESCE(m.featured,0), COALESCE(m.pinned,0), 'study', s.id, s.created_at, COALESCE(m.updated_at,s.created_at)
    FROM studies s LEFT JOIN content_taxonomy t ON t.content_type='study' AND t.content_id=s.id LEFT JOIN content_meta m ON m.content_type='study' AND m.content_id=s.id;
  INSERT OR IGNORE INTO contents (channel_id, category_id, format, title, subtitle, body, images, date, status, featured, pinned, legacy_type, legacy_id, created_at, updated_at)
    SELECT 'life', t.category_id, 'gallery', f.name, f.brand, f.description, f.images, f.date,
      COALESCE(m.status,'published'), COALESCE(m.featured,0), COALESCE(m.pinned,0), 'figure', f.id, f.created_at, COALESCE(m.updated_at,f.created_at)
    FROM figures f LEFT JOIN content_taxonomy t ON t.content_type='figure' AND t.content_id=f.id LEFT JOIN content_meta m ON m.content_type='figure' AND m.content_id=f.id;
  INSERT OR IGNORE INTO contents (channel_id, category_id, format, title, subtitle, body, images, date, status, featured, pinned, legacy_type, legacy_id, created_at, updated_at)
    SELECT 'life', t.category_id, 'gallery', tr.title, tr.location, tr.description, tr.images, tr.date,
      COALESCE(m.status,'published'), COALESCE(m.featured,0), COALESCE(m.pinned,0), 'travel', tr.id, tr.created_at, COALESCE(m.updated_at,tr.created_at)
    FROM travels tr LEFT JOIN content_taxonomy t ON t.content_type='travel' AND t.content_id=tr.id LEFT JOIN content_meta m ON m.content_type='travel' AND m.content_id=tr.id;
  INSERT OR IGNORE INTO contents (channel_id, category_id, format, title, subtitle, body, images, date, status, featured, pinned, legacy_type, legacy_id, created_at, updated_at)
    SELECT 'life', t.category_id, 'gallery', n.title, n.scene, n.description, n.images, n.date,
      COALESCE(m.status,'published'), COALESCE(m.featured,0), COALESCE(m.pinned,0), 'note', n.id, n.created_at, COALESCE(m.updated_at,n.created_at)
    FROM notes n LEFT JOIN content_taxonomy t ON t.content_type='note' AND t.content_id=n.id LEFT JOIN content_meta m ON m.content_type='note' AND m.content_id=n.id;

  INSERT OR IGNORE INTO content_notes_v2 (content_id, body, images, legacy_type, legacy_id, created_at, updated_at)
    SELECT c.id, COALESCE(n.content,''), COALESCE(n.images,'[]'), 'work', n.id, n.created_at, n.created_at
    FROM work_notes n JOIN contents c ON c.legacy_type='work' AND c.legacy_id=n.work_id;
  INSERT OR IGNORE INTO content_notes_v2 (content_id, body, images, legacy_type, legacy_id, created_at, updated_at)
    SELECT c.id, COALESCE(n.content,''), '[]', 'study', n.id, n.created_at, n.created_at
    FROM study_notes n JOIN contents c ON c.legacy_type='study' AND c.legacy_id=n.study_id;
`)

// 保留旧数据库迁移，移除已停用的生活数据。
{
  db.transaction(() => {
    db.exec("DELETE FROM contents WHERE channel_id = 'life'; DELETE FROM figures; DELETE FROM travels; DELETE FROM notes; DELETE FROM content_meta WHERE content_type IN ('figure','travel','note'); DELETE FROM content_taxonomy WHERE channel_id = 'life'; DELETE FROM categories WHERE channel_id = 'life'; UPDATE channels SET is_active = 0 WHERE id = 'life'; UPDATE channels SET name = '工作笔记', description = '工作中的问题与解法' WHERE id = 'journal';")
  })()
}
const app = express()
// Nginx is the local trusted proxy; distinguish public visitors for rate limits.
app.set('trust proxy', 'loopback')
app.use((req, res, next) => {
  if (/^\/api\/(figures|travels|notes|works|studies)(\/|$)/.test(req.path)) return res.status(410).json({ error: '此旧接口已停用，请使用工作笔记接口' })
  next()
})

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

async function isValidImage(file) {
  const buffer = await readFile(file.path)
  const type = await fileTypeFromBuffer(buffer.subarray(0, 4100))
  return Boolean(type && ALLOWED_MIMES.test(type.mime) && !file.originalname.toLowerCase().endsWith('.svg'))
}
async function validateImageMagic(req, res, next) {
  if (!req.file) return next()
  try {
    if (!await isValidImage(req.file)) {
      await unlink(req.file.path).catch(() => {})
      return res.status(400).json({ error: '文件内容与图片格式不符' })
    }
    next()
  } catch (error) {
    await unlink(req.file.path).catch(() => {})
    next(error)
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

const contentRow = (row) => row ? {
  ...row,
  tags: JSON.parse(row.tags || '[]'),
  images: JSON.parse(row.images || '[]').map((name) => `${PUBLIC_BASE_URL}/data/figures/${name}`),
  category_name: row.category_name || null,
  note_count: Number(row.note_count || 0),
} : null
const contentSelect = `
  SELECT c.*, ch.name AS channel_name, cat.slug AS category_slug, cat.name AS category_name,
    (SELECT COUNT(*) FROM content_notes_v2 n WHERE n.content_id = c.id) AS note_count
  FROM contents c JOIN channels ch ON ch.id = c.channel_id LEFT JOIN categories cat ON cat.id = c.category_id
`
const publishDueContents = () => db.prepare(`
  UPDATE contents
  SET status = 'published', publish_at = NULL, updated_at = strftime('%s','now')
  WHERE status = 'draft' AND publish_at IS NOT NULL AND publish_at <= strftime('%s','now')
`).run()

app.get('/api/contents', (req, res) => {
  publishDueContents()
  const params = []
  const where = []
  where.push("c.channel_id = 'journal'")
  const keywords = String(req.query.q || '').trim().toLowerCase().split(/\s+/).filter(Boolean).slice(0, 12)
  for (const keyword of keywords) { where.push("instr(lower(c.title || ' ' || coalesce(c.subtitle,'') || ' ' || c.body || ' ' || coalesce(cat.name,'') || ' ' || c.tags), ?) > 0"); params.push(keyword) }
  if (req.query.include_deleted === '1') where.push('1 = 1')
  else where.push('c.deleted_at IS NULL')
  if (req.query.channel) { where.push('c.channel_id = ?'); params.push(String(req.query.channel)) }
  const rows = db.prepare(`${contentSelect} ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY c.pinned DESC, c.updated_at DESC, c.id DESC`).all(...params)
  res.json({ contents: rows.map(row => {
    const item = contentRow(row)
    if (req.query.summary === '1') item.body = String(item.body).replace(/[#*`>\n]/g, ' ').slice(0, 160)
    return item
  }) })
})

app.get('/api/contents/:id', (req, res) => {
  publishDueContents()
  const id = Number(req.params.id)
  const row = db.prepare(`${contentSelect} WHERE c.id = ?`).get(id)
  if (!row || row.deleted_at) return res.status(404).json({ error: '内容不存在' })
  const notes = db.prepare('SELECT id, body, images, created_at, updated_at FROM content_notes_v2 WHERE content_id = ? ORDER BY created_at, id').all(id).map((note) => ({ ...note, images: JSON.parse(note.images || '[]').map((name) => `${PUBLIC_BASE_URL}/data/figures/${name}`) }))
  res.json({ content: { ...contentRow(row), notes } })
})

app.post('/api/contents', (req, res) => {
  const metadata = noteMetadata(req.body || {})
  if (!metadata) return res.status(400).json({ error: '标签或处理状态无效' })
  const { channel_id: channelId, category_id: rawCategory, format, title, subtitle, body, images = [], status = 'draft', featured = 0, pinned = 0, publish_at: rawPublishAt } = req.body || {}
  const categoryId = rawCategory === null || rawCategory === '' || rawCategory === undefined ? null : Number(rawCategory)
  const publishAt = rawPublishAt === null || rawPublishAt === '' || rawPublishAt === undefined ? null : Number(rawPublishAt)
  if (channelId !== 'journal' || !['article','gallery'].includes(format) || !String(title || '').trim() || !String(body || '').trim() || !Array.isArray(images)) return res.status(400).json({ error: '内容参数无效' })
  if (!['draft','published'].includes(status)) return res.status(400).json({ error: '发布状态无效' })
  if (publishAt !== null && (!Number.isInteger(publishAt) || publishAt <= Math.floor(Date.now() / 1000))) return res.status(400).json({ error: '定时发布时间必须晚于当前时间' })
  if (categoryId !== null && !db.prepare('SELECT id FROM categories WHERE id = ? AND channel_id = ?').get(categoryId, channelId)) return res.status(400).json({ error: '分类不属于当前频道' })
  const nowDate = new Date().toISOString().slice(0, 7).replace('-', '.')
  const effectiveStatus = publishAt ? 'draft' : status
  const result = db.prepare(`INSERT INTO contents (channel_id, category_id, format, title, subtitle, body, images, date, status, featured, pinned, publish_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(channelId, categoryId, format, String(title).trim(), String(subtitle || '').trim() || null, String(body).trim(), JSON.stringify(images), nowDate, effectiveStatus, Number(Boolean(featured && effectiveStatus === 'published')), Number(Boolean(pinned && effectiveStatus === 'published')), publishAt)
  db.prepare('UPDATE contents SET tags=?, problem_status=?, visibility=? WHERE id=?').run(metadata.tags, metadata.problemStatus, 'public', Number(result.lastInsertRowid))
  res.status(201).json({ id: Number(result.lastInsertRowid) })
})

app.put('/api/contents/:id', (req, res) => {
  const id = Number(req.params.id)
  const current = db.prepare('SELECT * FROM contents WHERE id = ?').get(id)
  if (!current) return res.status(404).json({ error: '内容不存在' })
  const metadata = noteMetadata(req.body || {}, current)
  if (!metadata) return res.status(400).json({ error: '标签或处理状态无效' })
  const channelId = req.body?.channel_id ?? current.channel_id
  const categoryId = Object.prototype.hasOwnProperty.call(req.body || {}, 'category_id') ? (req.body.category_id === null || req.body.category_id === '' ? null : Number(req.body.category_id)) : current.category_id
  const format = req.body?.format ?? current.format
  const title = req.body?.title === undefined ? current.title : String(req.body.title).trim()
  const body = req.body?.body === undefined ? current.body : String(req.body.body).trim()
  const images = req.body?.images === undefined ? JSON.parse(current.images) : req.body.images
  const status = req.body?.status ?? current.status
  const rawPublishAt = Object.prototype.hasOwnProperty.call(req.body || {}, 'publish_at') ? req.body.publish_at : current.publish_at
  const publishAt = rawPublishAt === null || rawPublishAt === '' || rawPublishAt === undefined ? null : Number(rawPublishAt)
  if (channelId !== 'journal' || !['article','gallery'].includes(format) || !title || !body || !Array.isArray(images) || !['draft','published'].includes(status)) return res.status(400).json({ error: '内容参数无效' })
  if (publishAt !== null && (!Number.isInteger(publishAt) || publishAt <= Math.floor(Date.now() / 1000))) return res.status(400).json({ error: '定时发布时间必须晚于当前时间' })
  if (categoryId !== null && !db.prepare('SELECT id FROM categories WHERE id = ? AND channel_id = ?').get(categoryId, channelId)) return res.status(400).json({ error: '分类不属于当前频道' })
  const effectiveStatus = publishAt ? 'draft' : status
  db.transaction(() => {
    db.prepare('INSERT INTO content_revisions (content_id, snapshot) VALUES (?, ?)').run(id, JSON.stringify(current))
    db.prepare(`UPDATE contents SET channel_id=?, category_id=?, format=?, title=?, subtitle=?, body=?, images=?, status=?, featured=?, pinned=?, publish_at=?, updated_at=strftime('%s','now') WHERE id=?`).run(channelId, categoryId, format, title, req.body?.subtitle === undefined ? current.subtitle : String(req.body.subtitle || '').trim() || null, body, JSON.stringify(images), effectiveStatus, Number(Boolean(req.body?.featured ?? current.featured) && effectiveStatus === 'published'), Number(Boolean(req.body?.pinned ?? current.pinned) && effectiveStatus === 'published'), publishAt, id)
    db.prepare('UPDATE contents SET tags=?, problem_status=?, visibility=? WHERE id=?').run(metadata.tags, metadata.problemStatus, 'public', id)
    db.prepare('DELETE FROM content_revisions WHERE content_id = ? AND id NOT IN (SELECT id FROM content_revisions WHERE content_id = ? ORDER BY created_at DESC, id DESC LIMIT 20)').run(id, id)
  })()
  res.json({ ok: true })
})

app.delete('/api/contents/:id', (req, res) => {
  const id = Number(req.params.id)
  const current = db.prepare('SELECT images FROM contents WHERE id = ?').get(id)
  if (!current) return res.status(404).json({ error: '内容不存在' })
  db.prepare("UPDATE contents SET deleted_at=strftime('%s','now'), updated_at=strftime('%s','now') WHERE id = ?").run(id)
  res.json({ ok: true })
})

app.post('/api/contents/:id/restore', (req, res) => {
  const result = db.prepare("UPDATE contents SET deleted_at=NULL, updated_at=strftime('%s','now') WHERE id = ? AND deleted_at IS NOT NULL").run(Number(req.params.id))
  if (!result.changes) return res.status(404).json({ error: '回收站中没有这条内容' })
  res.json({ ok: true })
})

app.delete('/api/contents/:id/permanent', (req, res) => {
  const result = db.prepare('DELETE FROM contents WHERE id = ? AND deleted_at IS NOT NULL').run(Number(req.params.id))
  if (!result.changes) return res.status(404).json({ error: '只能彻底删除回收站中的内容' })
  res.json({ ok: true })
})

app.get('/api/contents/:id/revisions', (req, res) => {
  const revisions = db.prepare('SELECT id, created_at, snapshot FROM content_revisions WHERE content_id = ? ORDER BY created_at DESC, id DESC').all(Number(req.params.id)).map((row) => {
    const snapshot = JSON.parse(row.snapshot)
    return { id: row.id, created_at: row.created_at, title: snapshot.title, body: snapshot.body, subtitle: snapshot.subtitle }
  })
  res.json({ revisions })
})

app.post('/api/contents/:id/revisions/:revisionId/restore', (req, res) => {
  const id = Number(req.params.id)
  const current = db.prepare('SELECT * FROM contents WHERE id = ? AND deleted_at IS NULL').get(id)
  const revision = db.prepare('SELECT snapshot FROM content_revisions WHERE id = ? AND content_id = ?').get(Number(req.params.revisionId), id)
  if (!current || !revision) return res.status(404).json({ error: '内容或历史版本不存在' })
  const snapshot = JSON.parse(revision.snapshot)
  db.transaction(() => {
    db.prepare('INSERT INTO content_revisions (content_id, snapshot) VALUES (?, ?)').run(id, JSON.stringify(current))
    db.prepare("UPDATE contents SET title=?, subtitle=?, body=?, images=?, updated_at=strftime('%s','now') WHERE id=?").run(snapshot.title, snapshot.subtitle, snapshot.body, snapshot.images, id)
    db.prepare('UPDATE contents SET tags=?, problem_status=? WHERE id=?').run(snapshot.tags || '[]', snapshot.problem_status || 'record', id)
  })()
  res.json({ ok: true })
})

app.get('/api/contents/:id/note-draft', (req, res) => {
  const contentId = Number(req.params.id)
  if (!db.prepare('SELECT id FROM contents WHERE id = ? AND deleted_at IS NULL').get(contentId)) return res.status(404).json({ error: '内容不存在' })
  const draft = db.prepare('SELECT body, updated_at FROM content_note_drafts WHERE content_id = ?').get(contentId)
  res.json({ draft: draft || null })
})

app.put('/api/contents/:id/note-draft', (req, res) => {
  const contentId = Number(req.params.id)
  const body = String(req.body?.body || '').trim()
  if (!db.prepare('SELECT id FROM contents WHERE id = ? AND deleted_at IS NULL').get(contentId)) return res.status(404).json({ error: '内容不存在' })
  if (!body) return res.status(400).json({ error: '草稿内容不能为空' })
  if (body.length > 200000) return res.status(400).json({ error: '草稿内容过长' })
  db.prepare(`INSERT INTO content_note_drafts (content_id, body) VALUES (?, ?)
    ON CONFLICT(content_id) DO UPDATE SET body=excluded.body, updated_at=strftime('%s','now')`).run(contentId, body)
  const draft = db.prepare('SELECT body, updated_at FROM content_note_drafts WHERE content_id = ?').get(contentId)
  res.json({ draft })
})

app.delete('/api/contents/:id/note-draft', (req, res) => {
  db.prepare('DELETE FROM content_note_drafts WHERE content_id = ?').run(Number(req.params.id))
  res.json({ ok: true })
})

app.post('/api/contents/:id/notes', uploadLimiter, (req, res) => {
  upload.array('images', 5)(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message || '上传失败' })
    ;(async () => {
      const files = req.files || []
      try {
        if (!db.prepare('SELECT id FROM contents WHERE id = ? AND deleted_at IS NULL').get(Number(req.params.id))) { await Promise.all(files.map(file => unlink(file.path).catch(() => {}))); return res.status(404).json({ error: '内容不存在' }) }
        for (const file of files) if (!await isValidImage(file)) { await Promise.all(files.map((item) => unlink(item.path).catch(() => {}))); return res.status(400).json({ error: '文件内容与图片格式不符' }) }
        const body = String(req.body?.body || '').trim()
        if (!body && !files.length) return res.status(400).json({ error: '内容或图片至少有一个' })
        const contentId = Number(req.params.id)
        const result = db.transaction(() => {
          const inserted = db.prepare('INSERT INTO content_notes_v2 (content_id, body, images) VALUES (?, ?, ?)').run(contentId, body, JSON.stringify(files.map((file) => file.filename)))
          db.prepare('DELETE FROM content_note_drafts WHERE content_id = ?').run(contentId)
          return inserted
        })()
        res.status(201).json({ id: Number(result.lastInsertRowid) })
      } catch (e) {
        req.log?.error({ err: e }, 'create unified note failed')
        res.status(500).json({ error: '保存说明失败' })
      }
    })()
  })
})

app.put('/api/contents/:id/notes/:noteId', (req, res) => {
  const note = db.prepare('SELECT id FROM content_notes_v2 WHERE id = ? AND content_id = ?').get(Number(req.params.noteId), Number(req.params.id))
  if (!note) return res.status(404).json({ error: '说明不存在' })
  const body = String(req.body?.body || '').trim()
  if (!body) return res.status(400).json({ error: '说明内容不能为空' })
  db.prepare("UPDATE content_notes_v2 SET body=?, updated_at=strftime('%s','now') WHERE id=?").run(body, note.id)
  res.json({ ok: true })
})

app.delete('/api/contents/:id/notes/:noteId', (req, res) => {
  const result = db.prepare('DELETE FROM content_notes_v2 WHERE id = ? AND content_id = ?').run(Number(req.params.noteId), Number(req.params.id))
  if (!result.changes) return res.status(404).json({ error: '说明不存在' })
  res.json({ ok: true })
})

// 当前笔记分类。
app.get('/api/taxonomy', (req, res) => {
  const channels = db.prepare(`
    SELECT id, slug, name, description, sort_order
    FROM channels WHERE is_active = 1
    ORDER BY sort_order, id
  `).all()
  const categories = db.prepare(`
    SELECT cat.id, cat.channel_id, cat.slug, cat.name, cat.description, cat.sort_order, cat.legacy_type,
      (SELECT COUNT(*) FROM contents c WHERE c.category_id = cat.id) AS content_count
    FROM categories cat WHERE cat.is_active = 1
    ORDER BY channel_id, sort_order, id
  `).all()
  res.json({
    channels: channels.map((channel) => ({
      ...channel,
      categories: categories.filter((category) => category.channel_id === channel.id),
    })),
  })
})

app.post('/api/admin/categories', (req, res) => {
  const channelId = String(req.body?.channel_id || '')
  const name = String(req.body?.name || '').trim()
  const description = String(req.body?.description || '').trim()
  if (!name || name.length > 30) return res.status(400).json({ error: '分类名称需为 1–30 个字符' })
  if (!db.prepare('SELECT id FROM channels WHERE id = ? AND is_active = 1').get(channelId)) {
    return res.status(400).json({ error: '频道不存在' })
  }
  const nextSort = db.prepare('SELECT COALESCE(MAX(sort_order), 0) + 10 AS value FROM categories WHERE channel_id = ?').get(channelId).value
  const slug = `custom-${crypto.randomUUID().slice(0, 8)}`
  const result = db.prepare(`
    INSERT INTO categories (channel_id, slug, name, description, sort_order)
    VALUES (?, ?, ?, ?, ?)
  `).run(channelId, slug, name, description || null, nextSort)
  const category = db.prepare('SELECT id, channel_id, slug, name, description, sort_order, legacy_type FROM categories WHERE id = ?').get(result.lastInsertRowid)
  res.status(201).json({ category })
})

app.patch('/api/admin/categories/:id', (req, res) => {
  const id = Number(req.params.id)
  const current = db.prepare('SELECT * FROM categories WHERE id = ?').get(id)
  if (!current) return res.status(404).json({ error: '分类不存在' })
  const name = req.body?.name === undefined ? current.name : String(req.body.name).trim()
  const description = req.body?.description === undefined ? current.description : String(req.body.description).trim() || null
  const sortOrder = req.body?.sort_order === undefined ? current.sort_order : Number(req.body.sort_order)
  if (!name || name.length > 30) return res.status(400).json({ error: '分类名称需为 1–30 个字符' })
  if (!Number.isInteger(sortOrder)) return res.status(400).json({ error: '排序值无效' })
  db.prepare(`UPDATE categories SET name = ?, description = ?, sort_order = ?, updated_at = strftime('%s','now') WHERE id = ?`).run(name, description, sortOrder, id)
  const category = db.prepare('SELECT id, channel_id, slug, name, description, sort_order, legacy_type FROM categories WHERE id = ?').get(id)
  res.json({ category })
})

app.delete('/api/admin/categories/:id', (req, res) => {
  const id = Number(req.params.id)
  const current = db.prepare('SELECT id, name, channel_id FROM categories WHERE id = ?').get(id)
  if (!current) return res.status(404).json({ error: '分类不存在' })
  const rawMoveTo = req.body?.move_to
  const moveTo = rawMoveTo === null || rawMoveTo === '' || rawMoveTo === undefined ? null : Number(rawMoveTo)
  const target = moveTo === null ? null : db.prepare('SELECT id, channel_id FROM categories WHERE id = ? AND is_active = 1').get(moveTo)
  if (moveTo !== null && (!target || target.id === id || target.channel_id !== current.channel_id)) return res.status(400).json({ error: '目标分类必须是同一频道内的其他分类' })
  const unifiedCount = db.prepare('SELECT COUNT(*) AS count FROM contents WHERE category_id = ?').get(id).count
  const legacyCount = db.prepare('SELECT COUNT(*) AS count FROM content_taxonomy WHERE category_id = ?').get(id).count
  const affected = Math.max(unifiedCount, legacyCount)
  db.transaction(() => {
    if (moveTo !== null) {
      db.prepare('UPDATE contents SET category_id = ?, updated_at = strftime(\'%s\',\'now\') WHERE category_id = ?').run(moveTo, id)
      db.prepare('UPDATE content_taxonomy SET category_id = ?, updated_at = strftime(\'%s\',\'now\') WHERE category_id = ?').run(moveTo, id)
    }
    db.prepare('DELETE FROM categories WHERE id = ?').run(id)
  })()
  res.json({ ok: true, affected, moved_to: moveTo })
})

// ---------- Hero 背景设置 ----------
// 复用 UPLOAD_DIR 存图 (与 figures 同目录),靠 hero- 前缀区分
// URL 仍是 ${PUBLIC_BASE_URL}/data/figures/${filename},前端加 hero- 前缀过滤

const DEFAULT_HERO_BG = { type: 'color', value: '#ebe4d8' }

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

// ---------- 上传图片 ----------

// 上传图片 - 接收 multipart/form-data, 字段名 'file'
// 返回 { url, filename }
app.post('/api/upload', uploadLimiter, (req, res) => {
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

export function startServer() {
  return app.listen(PORT, '127.0.0.1', () => {
    logger.info({ port: PORT, env: NODE_ENV }, `[longteng-api] listening on http://127.0.0.1:${PORT}`)
  })
}
export { app, db }
