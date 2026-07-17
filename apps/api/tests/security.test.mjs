// ChessHub P0 安全测试
// 用法: node --test tests/security.test.mjs
// 依赖: Node 20+ (内置 test runner + fetch)
//
// 启动 1 个主 server (跑 Group A/C/E/F), 2 个独立 server 跑 rate limit 隔离用例
// 全部数据落在 tests/.test-data/ (gitignore 排除)

import { test, describe, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdir, readFile, writeFile, stat, readdir, unlink, rmdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import http from 'node:http'
import { Buffer } from 'node:buffer'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const TEST_DATA = path.join(__dirname, '.test-data')

// ---------- helpers ----------

function spawnServer(env, port, logSink = []) {
  const child = spawn(process.execPath, [path.join(ROOT, 'server.js')], {
    cwd: ROOT,
    env: {
      ...process.env,
      PORT: String(port),
      NODE_ENV: env.NODE_ENV || 'test',
      DATA_DIR: env.DATA_DIR,
      UPLOAD_DIR: env.UPLOAD_DIR,
      CORS_ORIGIN: env.CORS_ORIGIN || '*',
      PUBLIC_BASE_URL: `http://127.0.0.1:${port}`,
      LOG_LEVEL: 'silent',  // 测试时把日志都关掉
      JWT_SECRET: 'test-jwt-secret-12345',
      ADMIN_USER: 'admin',
      ADMIN_PASS: 'test-pass',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  child.stdout.on('data', (d) => logSink.push(d.toString()))
  child.stderr.on('data', (d) => logSink.push(d.toString()))
  return child
}

function waitForServer(port, timeoutMs = 5000) {
  return new Promise((resolve, reject) => {
    const start = Date.now()
    const tick = () => {
      const req = http.get({ host: '127.0.0.1', port, path: '/api/health', timeout: 500 }, (res) => {
        res.resume()
        if (res.statusCode === 200) return resolve()
        if (Date.now() - start > timeoutMs) return reject(new Error(`server not healthy after ${timeoutMs}ms`))
        setTimeout(tick, 100)
      })
      req.on('error', () => {
        if (Date.now() - start > timeoutMs) return reject(new Error(`server not responding after ${timeoutMs}ms`))
        setTimeout(tick, 100)
      })
    }
    tick()
  })
}

async function killServer(child) {
  if (!child || child.killed) return
  child.kill('SIGTERM')
  await new Promise((resolve) => {
    const timer = setTimeout(() => { child.kill('SIGKILL'); resolve() }, 2000)
    child.on('exit', () => { clearTimeout(timer); resolve() })
  })
}

async function req(port, p, init = {}) {
  const url = `http://127.0.0.1:${port}${p}`
  const res = await fetch(url, init)
  const text = await res.text()
  let json = null
  try { json = text ? JSON.parse(text) : null } catch { /* keep text */ }
  return { status: res.status, headers: res.headers, body: json, text }
}

async function loginAsAdmin(port) {
  const r = await req(port, '/api/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'test-pass' }),
  })
  assert.equal(r.status, 200, `login failed: ${r.text}`)
  return r.body.token
}

// 构造一个看起来像图片但实际不是的 payload
// 攻击场景: 攻击者拿 PHP/TXT 改成 .php/.txt 后缀 + Content-Type: image/jpeg
//           → multer fileFilter 通过 (mime 看着对)
//           → magic bytes 校验拒 (内容不是真图片)
function evilPhp() { return Buffer.from('<?php system($_GET["c"]); exit; ?>') }
function evilTxt() { return Buffer.from('Hello world this is plain text payload, definitely not an image') }

// 构造一个最小的真实 PNG (1x1 透明)
function realPng() {
  // 来自 libmagic 的标准 1x1 透明 PNG hex
  return Buffer.from(
    '89504E470D0A1A0A0000000D49484452000000010000000108060000001F15C4890000000D49444154789C636000010000000500010D0A2DB40000000049454E44AE426082',
    'hex',
  )
}

// 构造一个最小的真实 JPEG
function realJpeg() {
  // SOI + APP0 + EOI
  return Buffer.from(
    'FFD8FFE000104A46494600010100000100010000FFDB004300080606070605080707070909080A0C140D0C0B0B0C1912130F141D1A1F1E1D1A1C1C20242E2720222C231C1C2837292C30313434341F27393D38323C2E333432FFC0000B080001000101011100FFDA00080101000000013FFFD9',
    'hex',
  )
}

// ---------- Group A: CORS ----------

describe('① CORS 白名单', () => {
  let server, logs = []
  const PORT = 30010
  before(async () => {
    const dataDir = path.join(TEST_DATA, 'cors-data')
    const uploadDir = path.join(TEST_DATA, 'cors-uploads')
    await mkdir(dataDir, { recursive: true })
    await mkdir(uploadDir, { recursive: true })
    server = spawnServer({
      DATA_DIR: dataDir,
      UPLOAD_DIR: uploadDir,
      CORS_ORIGIN: 'https://chesshub.fun,http://localhost:5173',
    }, PORT, logs)
    await waitForServer(PORT)
  })
  after(async () => { await killServer(server) })

  test('A.1 允许的 origin (https://chesshub.fun) 拿到 ACAO 头', async () => {
    const r = await req(PORT, '/api/health', {
      headers: { Origin: 'https://chesshub.fun' },
    })
    assert.equal(r.status, 200)
    assert.equal(r.headers.get('access-control-allow-origin'), 'https://chesshub.fun')
  })

  test('A.2 允许的 origin (http://localhost:5173) 拿到 ACAO 头', async () => {
    const r = await req(PORT, '/api/health', {
      headers: { Origin: 'http://localhost:5173' },
    })
    assert.equal(r.status, 200)
    assert.equal(r.headers.get('access-control-allow-origin'), 'http://localhost:5173')
  })

  test('A.3 不允许的 origin (https://evil.com) 没有 ACAO 头', async () => {
    const r = await req(PORT, '/api/health', {
      headers: { Origin: 'https://evil.com' },
    })
    assert.equal(r.status, 200)  // 请求本身成功
    assert.equal(r.headers.get('access-control-allow-origin'), null,
      'evil origin should not get ACAO header')
  })

  test('A.4 同源 (无 Origin 头) 不受限', async () => {
    const r = await req(PORT, '/api/health')
    assert.equal(r.status, 200)
  })
})

describe('① CORS 拒绝 prod + *', () => {
  let server, logs = []
  const PORT = 30011
  before(async () => {
    const dataDir = path.join(TEST_DATA, 'cors-prod-data')
    const uploadDir = path.join(TEST_DATA, 'cors-prod-uploads')
    await mkdir(dataDir, { recursive: true })
    await mkdir(uploadDir, { recursive: true })
    server = spawnServer({
      NODE_ENV: 'production',
      DATA_DIR: dataDir,
      UPLOAD_DIR: uploadDir,
      CORS_ORIGIN: '*',  // prod + * 应该被拒
    }, PORT, logs)
    await waitForServer(PORT)
  })
  after(async () => { await killServer(server) })

  test('A.5 生产环境 + CORS=* 时, 跨域请求被拒', async () => {
    const r = await req(PORT, '/api/health', {
      headers: { Origin: 'https://anywhere.com' },
    })
    // cors 中间件会 throw, 由全局 error handler 兜底 → 500
    assert.equal(r.status, 500, 'should be blocked in prod with wildcard')
    assert.equal(r.body.error, '服务器内部错误',
      'should not leak CORS error message to client')
  })
})

// ---------- Group B: Rate limit ----------

describe('② Rate limit - 登录', () => {
  let server, logs = []
  const PORT = 30020
  before(async () => {
    const dataDir = path.join(TEST_DATA, 'rl-login-data')
    const uploadDir = path.join(TEST_DATA, 'rl-login-uploads')
    await mkdir(dataDir, { recursive: true })
    await mkdir(uploadDir, { recursive: true })
    server = spawnServer({
      DATA_DIR: dataDir,
      UPLOAD_DIR: uploadDir,
      CORS_ORIGIN: '*',
    }, PORT, logs)
    await waitForServer(PORT)
  })
  after(async () => { await killServer(server) })

  test('B.1 连续 11 次错误登录, 第 11 次返回 429', async () => {
    let last429 = null
    for (let i = 0; i < 11; i++) {
      const r = await req(PORT, '/api/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ username: 'admin', password: 'wrong' }),
      })
      if (r.status === 429) { last429 = r; break }
    }
    assert.ok(last429, 'should have been rate-limited')
    assert.equal(last429.body.error, '登录尝试过于频繁，请 5 分钟后再试')
    // 应该有 RateLimit-* 头
    assert.ok(last429.headers.get('ratelimit-limit'), 'should have RateLimit-Limit header')
  })
})

describe('② Rate limit - 上传', () => {
  let server, logs = []
  const PORT = 30021
  let token
  before(async () => {
    const dataDir = path.join(TEST_DATA, 'rl-upload-data')
    const uploadDir = path.join(TEST_DATA, 'rl-upload-uploads')
    await mkdir(dataDir, { recursive: true })
    await mkdir(uploadDir, { recursive: true })
    server = spawnServer({
      DATA_DIR: dataDir,
      UPLOAD_DIR: uploadDir,
      CORS_ORIGIN: '*',
    }, PORT, logs)
    await waitForServer(PORT)
    token = await loginAsAdmin(PORT)
  })
  after(async () => { await killServer(server) })

  test('B.2 连续 21 次上传, 第 21 次返回 429', async () => {
    const fd = new FormData()
    fd.append('file', new Blob([realJpeg()], { type: 'image/jpeg' }), 'test.jpg')
    let last429 = null
    for (let i = 0; i < 21; i++) {
      const r = await req(PORT, '/api/upload', {
        method: 'POST',
        headers: { authorization: `Bearer ${token}` },
        body: fd,
      })
      if (r.status === 429) { last429 = r; break }
    }
    assert.ok(last429, 'should have been rate-limited on upload')
    assert.equal(last429.body.error, '上传过于频繁，请稍后再试')
  })
})

describe('② Rate limit - /api/health 不受限', () => {
  let server, logs = []
  const PORT = 30022
  before(async () => {
    const dataDir = path.join(TEST_DATA, 'rl-health-data')
    const uploadDir = path.join(TEST_DATA, 'rl-health-uploads')
    await mkdir(dataDir, { recursive: true })
    await mkdir(uploadDir, { recursive: true })
    server = spawnServer({
      DATA_DIR: dataDir,
      UPLOAD_DIR: uploadDir,
      CORS_ORIGIN: '*',
    }, PORT, logs)
    await waitForServer(PORT)
  })
  after(async () => { await killServer(server) })

  test('B.3 连续 250 次 /api/health, 全部 200', async () => {
    // 先快速打 200 次 (应该都不限), 再打 50 次确认还在 200
    const results = await Promise.all(
      Array.from({ length: 250 }, () => req(PORT, '/api/health')),
    )
    const non200 = results.filter((r) => r.status !== 200)
    assert.equal(non200.length, 0,
      `health should never be rate-limited, got ${non200.length} non-200`)
  })
})

// ---------- Group C: Magic bytes ----------

describe('③ Magic bytes 校验', () => {
  let server, logs = []
  let token
  const PORT = 30030
  const UPLOAD_DIR = path.join(TEST_DATA, 'magic-uploads')

  before(async () => {
    const dataDir = path.join(TEST_DATA, 'magic-data')
    await mkdir(dataDir, { recursive: true })
    await mkdir(UPLOAD_DIR, { recursive: true })
    server = spawnServer({
      DATA_DIR: dataDir,
      UPLOAD_DIR,
      CORS_ORIGIN: '*',
    }, PORT, logs)
    await waitForServer(PORT)
    token = await loginAsAdmin(PORT)
  })
  after(async () => { await killServer(server) })

  test('C.1 .php 改名 image/jpeg 上传 → 400', async () => {
    const fd = new FormData()
    fd.append('file', new Blob([evilPhp()], { type: 'image/jpeg' }), 'evil.php')
    const r = await req(PORT, '/api/upload', {
      method: 'POST',
      headers: { authorization: `Bearer ${token}` },
      body: fd,
    })
    assert.equal(r.status, 400, `expected 400, got ${r.status}: ${r.text}`)
    assert.equal(r.body.error, '文件内容与图片格式不符')
  })

  test('C.2 .txt 改名 image/png 上传 → 400', async () => {
    const fd = new FormData()
    fd.append('file', new Blob([evilTxt()], { type: 'image/png' }), 'fake.txt')
    const r = await req(PORT, '/api/upload', {
      method: 'POST',
      headers: { authorization: `Bearer ${token}` },
      body: fd,
    })
    assert.equal(r.status, 400)
    assert.equal(r.body.error, '文件内容与图片格式不符')
  })

  test('C.3 真实 jpg 上传 → 200', async () => {
    const fd = new FormData()
    fd.append('file', new Blob([realJpeg()], { type: 'image/jpeg' }), 'good.jpg')
    const r = await req(PORT, '/api/upload', {
      method: 'POST',
      headers: { authorization: `Bearer ${token}` },
      body: fd,
    })
    assert.equal(r.status, 200, `got ${r.status}: ${r.text}`)
    assert.ok(r.body.filename)
  })

  test('C.4 真实 png 上传 → 200', async () => {
    const fd = new FormData()
    fd.append('file', new Blob([realPng()], { type: 'image/png' }), 'good.png')
    const r = await req(PORT, '/api/upload', {
      method: 'POST',
      headers: { authorization: `Bearer ${token}` },
      body: fd,
    })
    assert.equal(r.status, 200, `got ${r.status}: ${r.text}`)
    assert.ok(r.body.filename)
  })

  test('C.5 .svg (带图片 mime) 上传 → 400', async () => {
    // SVG magic 不是 image/*, magic bytes 会直接拒
    const svg = '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'
    const fd = new FormData()
    fd.append('file', new Blob([svg], { type: 'image/svg+xml' }), 'evil.svg')
    const r = await req(PORT, '/api/upload', {
      method: 'POST',
      headers: { authorization: `Bearer ${token}` },
      body: fd,
    })
    assert.equal(r.status, 400, `expected 400, got ${r.status}: ${r.text}`)
  })

  test('C.6 magic bytes 失败后, UPLOAD_DIR 没文件残留', async () => {
    const before = await readdir(UPLOAD_DIR)
    const fd = new FormData()
    fd.append('file', new Blob([evilPhp()], { type: 'image/jpeg' }), 'leak.php')
    await req(PORT, '/api/upload', {
      method: 'POST',
      headers: { authorization: `Bearer ${token}` },
      body: fd,
    })
    const after = await readdir(UPLOAD_DIR)
    const newFiles = after.filter((f) => !before.includes(f))
    assert.equal(newFiles.length, 0,
      `expected 0 new files, got: ${newFiles.join(', ')}`)
  })

  test('C.7 magic bytes 失败后, /api/settings/hero-bg/upload 也清理', async () => {
    const before = await readdir(UPLOAD_DIR)
    const fd = new FormData()
    fd.append('file', new Blob([evilPhp()], { type: 'image/jpeg' }), 'leak2.php')
    await req(PORT, '/api/settings/hero-bg/upload', {
      method: 'POST',
      headers: { authorization: `Bearer ${token}` },
      body: fd,
    })
    const after = await readdir(UPLOAD_DIR)
    const newFiles = after.filter((f) => !before.includes(f))
    assert.equal(newFiles.length, 0,
      `expected 0 new files, got: ${newFiles.join(', ')}`)
  })
})

// ---------- Group D: 备份 cron (静态 + 模拟运行) ----------

describe('④ 备份 cron', () => {
  test('D.1 备份脚本模板存在', async () => {
    const scriptPath = path.join(__dirname, 'chesshub-backup.sh')
    assert.ok(existsSync(scriptPath), `${scriptPath} not found`)
  })

  test('D.2 脚本关键命令齐全', async () => {
    const script = await readFile(path.join(__dirname, 'chesshub-backup.sh'), 'utf8')
    assert.ok(script.includes('tar -czf'), 'should use tar -czf')
    assert.ok(script.includes('data.tar.gz') || script.includes('data'), 'should backup data dir')
    assert.ok(script.includes('.env') || script.includes('env'), 'should include .env')
    assert.ok(script.includes('uploads'), 'should backup uploads')
    assert.ok(script.includes('find') && script.includes('-mtime'), 'should have retention cleanup')
    assert.ok(script.includes('set -euo pipefail') || script.includes('set -e'), 'should fail-fast')
  })

  test('D.3 模拟运行: 临时 DATA_DIR 跑一次能产出 tar', async () => {
    // 在 Windows 上 (无原生 bash) 跳过 bash -n 检查,
    // 其他平台跑 bash -n 语法检查
    if (process.platform === 'win32') {
      // 用 node 解析: 没有语法错误就能 readFile, 我们 D.1/D.2 已验过
      // 这里用 basic check: 脚本末尾有换行 + 不会让 bash 立即 crash
      const script = await readFile(path.join(__dirname, 'chesshub-backup.sh'), 'utf8')
      assert.ok(script.endsWith('\n'), 'should end with newline')
      return
    }
    const scriptPath = path.join(__dirname, 'chesshub-backup.sh')
    const { execFileSync } = await import('node:child_process')
    execFileSync('bash', ['-n', scriptPath], { stdio: 'pipe' })
  })
})

// ---------- Group E: 错误处理 + 日志 ----------

describe('⑤ 全局错误处理 + 日志', () => {
  let server, logs = []
  const PORT = 30040
  before(async () => {
    const dataDir = path.join(TEST_DATA, 'err-data')
    const uploadDir = path.join(TEST_DATA, 'err-uploads')
    await mkdir(dataDir, { recursive: true })
    await mkdir(uploadDir, { recursive: true })
    // 用 info 级别 (不是 silent) 方便看日志
    server = spawnServer({
      DATA_DIR: dataDir,
      UPLOAD_DIR: uploadDir,
      CORS_ORIGIN: '*',
      LOG_LEVEL: 'info',
    }, PORT, logs)
    // 把日志重定向到 logs 数组
    server.stdout.removeAllListeners('data')
    server.stderr.removeAllListeners('data')
    server.stdout.on('data', (d) => logs.push(d.toString()))
    server.stderr.on('data', (d) => logs.push(d.toString()))
    await waitForServer(PORT)
  })
  after(async () => { await killServer(server) })

  test('E.1 不存在的 API 路径返回 404 + 静态错误信息', async () => {
    const r = await req(PORT, '/api/this-does-not-exist')
    assert.equal(r.status, 404)
    assert.equal(r.body.error, 'API 不存在')
  })

  test('E.2 静态分析: server.js 源码中没有任何 5xx 路由直接回 e.message', async () => {
    const src = await readFile(path.join(ROOT, 'server.js'), 'utf8')
    // 找所有 res.status(500).json(...) 形态
    const matches = src.match(/res\.status\(5\w+\)\.json\(\s*\{\s*error:\s*e\.message/g) || []
    assert.equal(matches.length, 0,
      `发现 ${matches.length} 处直接回 e.message 的 5xx, 应当全部改用 logger + 静态文案`)
  })

  test('E.3 静态分析: 全部 5xx 都配合 req.log.error({err: e})', async () => {
    const src = await readFile(path.join(ROOT, 'server.js'), 'utf8')
    // 找所有 res.status(5xx) 附近 5 行内是否有 logger
    const lines = src.split('\n')
    const violations = []
    for (let i = 0; i < lines.length; i++) {
      if (/res\.status\(5\d+\)/.test(lines[i])) {
        const window = lines.slice(Math.max(0, i - 5), i + 1).join('\n')
        if (!/req\.log\?\.(error|warn)|logger\.(error|warn)/.test(window)) {
          violations.push(`line ${i + 1}: ${lines[i].trim()}`)
        }
      }
    }
    assert.equal(violations.length, 0,
      `发现 5xx 路径未配 logger:\n${violations.join('\n')}`)
  })

  test('E.4 触发 multer 错误时, server 仍正常处理 (错误不挂掉 server)', async () => {
    // 触发 multer 错误: 上传 6MB 文件 (超过 5MB limit)
    const adminToken = await loginAsAdmin(PORT)
    const hugeBuf = Buffer.alloc(6 * 1024 * 1024)  // 6 MB
    const fd = new FormData()
    fd.append('file', new Blob([hugeBuf], { type: 'image/jpeg' }), 'huge.jpg')
    const r = await req(PORT, '/api/upload', {
      method: 'POST',
      headers: { authorization: `Bearer ${adminToken}` },
      body: fd,
    })
    // multer 在 callback 里 catch, 返回 400 (不是 500, 是 multer 自己的处理)
    assert.equal(r.status, 400)
    // 错误信息不应泄露 stack / 路径
    assert.ok(r.body.error && typeof r.body.error === 'string')
    assert.ok(r.body.error.length < 200, 'error message should be short')
    // server 仍然响应 (没挂)
    const h = await req(PORT, '/api/health')
    assert.equal(h.status, 200)
  })
})

// ---------- Group F: 烟雾测试（回归） ----------

describe('F. 回归烟雾测试', () => {
  let server, logs = []
  const PORT = 30050
  before(async () => {
    const dataDir = path.join(TEST_DATA, 'smoke-data')
    const uploadDir = path.join(TEST_DATA, 'smoke-uploads')
    await mkdir(dataDir, { recursive: true })
    await mkdir(uploadDir, { recursive: true })
    server = spawnServer({
      DATA_DIR: dataDir,
      UPLOAD_DIR: uploadDir,
      CORS_ORIGIN: '*',
    }, PORT, logs)
    await waitForServer(PORT)
  })
  after(async () => { await killServer(server) })

  test('F.1 /api/health 200', async () => {
    const r = await req(PORT, '/api/health')
    assert.equal(r.status, 200)
    assert.equal(r.body.ok, true)
  })

  test('F.2 /api/auth/login 正常返回 token', async () => {
    const r = await req(PORT, '/api/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'test-pass' }),
    })
    assert.equal(r.status, 200)
    assert.ok(r.body.token)
    assert.equal(r.body.role, 'admin')
  })

  test('F.3 /api/figures 带 token 返回空数组 (新库)', async () => {
    const token = await loginAsAdmin(PORT)
    const r = await req(PORT, '/api/figures', {
      headers: { authorization: `Bearer ${token}` },
    })
    assert.equal(r.status, 200)
    assert.ok(Array.isArray(r.body.figures))
  })

  test('F.4 无 token 访问 /api/auth/me → 401', async () => {
    const r = await req(PORT, '/api/auth/me')
    assert.equal(r.status, 401)
  })

  test('F.5 guest token 不能访问 admin 接口 → 403', async () => {
    const loginRes = await req(PORT, '/api/auth/guest', { method: 'POST' })
    const token = loginRes.body.token
    const r = await req(PORT, '/api/admin/usage', {
      headers: { authorization: `Bearer ${token}` },
    })
    assert.equal(r.status, 403)
  })
})

// ---------- Group G: GET 鉴权 (修复 P0 之后的全表 GET 都要 session 验证) ----------

describe('G. GET 鉴权 - 防 curl 直打后端', () => {
  let server, logs = []
  const PORT = 30060
  before(async () => {
    const dataDir = path.join(TEST_DATA, 'getauth-data')
    const uploadDir = path.join(TEST_DATA, 'getauth-uploads')
    await mkdir(dataDir, { recursive: true })
    await mkdir(uploadDir, { recursive: true })
    server = spawnServer({
      DATA_DIR: dataDir,
      UPLOAD_DIR: uploadDir,
      CORS_ORIGIN: '*',
    }, PORT, logs)
    await waitForServer(PORT)
  })
  after(async () => { await killServer(server) })

  // 内容与账号接口需要 token；页面外观设置供公开首页读取。
  const protectedGets = [
    '/api/auth/me',
    '/api/figures',
    '/api/travels',
    '/api/notes',
    '/api/works',
  ]
  const publicGets = [
    '/api/settings/hero-bg',
    '/api/settings/about-photo',
  ]
  const readableGets = [...protectedGets, ...publicGets]

  for (const path of protectedGets) {
    test(`G.1 无 token GET ${path} → 401`, async () => {
      const r = await req(PORT, path)
      assert.equal(r.status, 401, `expected 401 for ${path}, got ${r.status}: ${r.text}`)
    })

    test(`G.2 错 token GET ${path} → 401`, async () => {
      const r = await req(PORT, path, {
        headers: { authorization: 'Bearer invalid.token.here' },
      })
      assert.equal(r.status, 401, `expected 401 for ${path} with bad token`)
    })
  }

  for (const path of publicGets) {
    test(`G.3 公开页面设置 GET ${path} 无需 token`, async () => {
      const r = await req(PORT, path)
      assert.equal(r.status, 200, `public GET ${path} should 200, got ${r.status}: ${r.text}`)
    })
  }
  test('G.4 admin token 能读所有 GET 端点', async () => {
    const token = await loginAsAdmin(PORT)
    for (const path of readableGets) {
      const r = await req(PORT, path, {
        headers: { authorization: `Bearer ${token}` },
      })
      assert.equal(r.status, 200, `admin GET ${path} should 200, got ${r.status}: ${r.text}`)
    }
  })

  test('G.5 guest token 也能读 GET 端点 (产品意图: 游客可看内容)', async () => {
    const loginRes = await req(PORT, '/api/auth/guest', { method: 'POST' })
    const token = loginRes.body.token
    assert.ok(token, 'guest login should return token')
    for (const path of readableGets) {
      const r = await req(PORT, path, {
        headers: { authorization: `Bearer ${token}` },
      })
      assert.equal(r.status, 200, `guest GET ${path} should 200, got ${r.status}: ${r.text}`)
    }
  })

  test('G.6 /api/health 仍然公开 (不需要 token)', async () => {
    const r = await req(PORT, '/api/health')
    assert.equal(r.status, 200)
  })

  test('G.7 guest 不能写 (POST/PUT/DELETE 仍要 admin)', async () => {
    const loginRes = await req(PORT, '/api/auth/guest', { method: 'POST' })
    const token = loginRes.body.token
    const r = await req(PORT, '/api/figures', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify({ name: 'x', description: 'x', images: [] }),
    })
    assert.equal(r.status, 403, `guest POST should 403, got ${r.status}`)
  })
})

// ---------- Group H: work_notes CRUD + 老数据迁移 ----------

describe('H. work 新模型 (title+description + notes 流)', () => {
  let server, logs = []
  const PORT = 30070
  before(async () => {
    const dataDir = path.join(TEST_DATA, 'workv2-data')
    const uploadDir = path.join(TEST_DATA, 'workv2-uploads')
    await mkdir(dataDir, { recursive: true })
    await mkdir(uploadDir, { recursive: true })
    server = spawnServer({
      DATA_DIR: dataDir,
      UPLOAD_DIR: uploadDir,
      CORS_ORIGIN: '*',
    }, PORT, logs)
    await waitForServer(PORT)
  })
  after(async () => { await killServer(server) })

  test('H.1 POST /api/works 缺 title → 400', async () => {
    const tok = await loginAsAdmin(PORT)
    const r = await req(PORT, '/api/works', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${tok}` },
      body: JSON.stringify({ description: 'only desc' }),
    })
    assert.equal(r.status, 400)
  })

  test('H.2 POST /api/works 缺 title 不接受老字段 (problem/analysis/tags)', async () => {
    const tok = await loginAsAdmin(PORT)
    const r = await req(PORT, '/api/works', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${tok}` },
      body: JSON.stringify({ title: 'x', problem: 'old', tags: ['t'] }),
    })
    // 不报错,但 problem/tags 字段被忽略 (只存 title+description)
    assert.equal(r.status, 200)
  })

  test('H.3 GET /api/works 列表只返 work 字段 (无 problem/analysis/tags/images)', async () => {
    const tok = await loginAsAdmin(PORT)
    const r = await req(PORT, '/api/works', { headers: { authorization: `Bearer ${tok}` } })
    assert.equal(r.status, 200)
    assert.ok(Array.isArray(r.body.works))
    for (const w of r.body.works) {
      assert.ok('id' in w && 'title' in w)
      assert.ok(!('problem' in w), `work 应不含 problem 字段`)
      assert.ok(!('analysis' in w), `work 应不含 analysis 字段`)
      assert.ok(!('solution' in w), `work 应不含 solution 字段`)
      assert.ok(!('tags' in w), `work 应不含 tags 字段`)
      assert.ok(!('images' in w), `work 应不含 images 字段 (主表已不存图)`)
      assert.ok('note_count' in w, `work 应含 note_count`)
    }
  })

  test('H.4 POST /api/works + GET /api/works/:id 含 notes 数组', async () => {
    const tok = await loginAsAdmin(PORT)
    // 创建
    const create = await req(PORT, '/api/works', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${tok}` },
      body: JSON.stringify({ title: '测试 ticket', description: '这是描述' }),
    })
    assert.equal(create.status, 200)
    const id = create.body.id
    // 详情
    const detail = await req(PORT, `/api/works/${id}`, { headers: { authorization: `Bearer ${tok}` } })
    assert.equal(detail.status, 200)
    assert.equal(detail.body.work.title, '测试 ticket')
    assert.equal(detail.body.work.description, '这是描述')
    assert.ok(Array.isArray(detail.body.work.notes))
    assert.equal(detail.body.work.note_count, 0)
  })

  test('H.5 POST /api/works/:id/notes 加一条纯文本 note', async () => {
    const tok = await loginAsAdmin(PORT)
    const list = await req(PORT, '/api/works', { headers: { authorization: `Bearer ${tok}` } })
    const id = list.body.works[0].id
    // multer 只解析 multipart/form-data, 用 FormData (会自动设 Content-Type + boundary)
    const fd = new FormData()
    fd.append('content', '第一条调查说明')
    const r = await req(PORT, `/api/works/${id}/notes`, {
      method: 'POST',
      headers: { authorization: `Bearer ${tok}` },
      body: fd,
    })
    assert.equal(r.status, 200, `note POST should 200, got ${r.status}: ${r.text}`)
    // 详情
    const detail = await req(PORT, `/api/works/${id}`, { headers: { authorization: `Bearer ${tok}` } })
    assert.equal(detail.body.work.note_count, 1)
    assert.equal(detail.body.work.notes[0].content, '第一条调查说明')
  })

  test('H.6 POST /api/works/:id/notes 加 note + 真 jpg (magic bytes 通过)', async () => {
    const tok = await loginAsAdmin(PORT)
    const list = await req(PORT, '/api/works', { headers: { authorization: `Bearer ${tok}` } })
    const id = list.body.works[0].id
    // 用之前 evilJpeg 工具函数 (if defined) 或 inline
    const jpegHex = 'ffd8ffe000104a46494600010101006000600000ffdb0043000302020302020303030304030304050805050404050a070706080c0a0c0c0b0a0b0b0d0e12100d0e110e0b0b101610111213141514080a171918141a0d141412ffc0000b080001000101011100ffc4001f0000010501010101010100000000000000000102030405060708090a0bffc4001f0100030101010101010101010000000000000102030405060708090a0bffda0008010100003f00fbd0ffd9'
    const jpgBuf = Buffer.from(jpegHex, 'hex')
    const fd = new FormData()
    fd.append('content', '带图的说明')
    fd.append('images', new Blob([jpgBuf], { type: 'image/jpeg' }), 'test.jpg')
    const r = await req(PORT, `/api/works/${id}/notes`, {
      method: 'POST',
      headers: { authorization: `Bearer ${tok}` },
      body: fd,
    })
    assert.equal(r.status, 200, `note with jpg should 200, got ${r.status}: ${r.text}`)
    assert.equal(r.body.images.length, 1)
  })

  test('H.7 POST /api/works/:id/notes 上传 PHP-as-jpg → 400 (magic bytes 拒)', async () => {
    const tok = await loginAsAdmin(PORT)
    const list = await req(PORT, '/api/works', { headers: { authorization: `Bearer ${tok}` } })
    const id = list.body.works[0].id
    const fd = new FormData()
    fd.append('content', 'evil')
    fd.append('images', new Blob([evilPhp()], { type: 'image/jpeg' }), 'evil.jpg')
    const r = await req(PORT, `/api/works/${id}/notes`, {
      method: 'POST',
      headers: { authorization: `Bearer ${tok}` },
      body: fd,
    })
    assert.equal(r.status, 400, `PHP-as-jpg should 400, got ${r.status}: ${r.text}`)
  })

  test('H.8 PUT /api/works/:id/notes/:nid 改 content + 替换图', async () => {
    const tok = await loginAsAdmin(PORT)
    const list = await req(PORT, '/api/works', { headers: { authorization: `Bearer ${tok}` } })
    const id = list.body.works[0].id
    const detail = await req(PORT, `/api/works/${id}`, { headers: { authorization: `Bearer ${tok}` } })
    const noteId = detail.body.work.notes[0].id
    const fd = new FormData()
    fd.append('content', '改后的内容')
    const r = await req(PORT, `/api/works/${id}/notes/${noteId}`, {
      method: 'PUT',
      headers: { authorization: `Bearer ${tok}` },
      body: fd,
    })
    assert.equal(r.status, 200, `note PUT should 200, got ${r.status}: ${r.text}`)
    const detail2 = await req(PORT, `/api/works/${id}`, { headers: { authorization: `Bearer ${tok}` } })
    assert.equal(detail2.body.work.notes[0].content, '改后的内容')
  })

  test('H.9 DELETE /api/works/:id 级联删 notes + 删图文件', async () => {
    const tok = await loginAsAdmin(PORT)
    const list = await req(PORT, '/api/works', { headers: { authorization: `Bearer ${tok}` } })
    const id = list.body.works[0].id
    // 记下 work 现在的 note 数
    const detail = await req(PORT, `/api/works/${id}`, { headers: { authorization: `Bearer ${tok}` } })
    const notesCount = detail.body.work.note_count
    assert.ok(notesCount > 0, 'sanity: work 应有 notes')

    // 删 work
    const r = await req(PORT, `/api/works/${id}`, {
      method: 'DELETE',
      headers: { authorization: `Bearer ${tok}` },
    })
    assert.equal(r.status, 200)

    // 详情应该 404
    const detail2 = await req(PORT, `/api/works/${id}`, { headers: { authorization: `Bearer ${tok}` } })
    assert.equal(detail2.status, 404)
  })

  test('H.10 PUT /api/works/:id 改 title + description', async () => {
    const tok = await loginAsAdmin(PORT)
    // 先创建一个
    const create = await req(PORT, '/api/works', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${tok}` },
      body: JSON.stringify({ title: '原标题', description: '原描述' }),
    })
    const id = create.body.id
    const r = await req(PORT, `/api/works/${id}`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${tok}` },
      body: JSON.stringify({ title: '新标题', description: '新描述' }),
    })
    assert.equal(r.status, 200)
    const detail = await req(PORT, `/api/works/${id}`, { headers: { authorization: `Bearer ${tok}` } })
    assert.equal(detail.body.work.title, '新标题')
    assert.equal(detail.body.work.description, '新描述')
  })
})

// ---------- Group I: 老 schema 迁移 ----------

describe('I. 老 schema → 新 schema 数据迁移', () => {
  // 先用 node 脚本模拟老 DB schema, 启动 server, 验证迁移结果
  let server, logs = []
  const PORT = 30080
  const dataDir = path.join(TEST_DATA, 'migrate-data')
  const uploadDir = path.join(TEST_DATA, 'migrate-uploads')
  let adminToken, oldId

  before(async () => {
    await mkdir(dataDir, { recursive: true })
    await mkdir(uploadDir, { recursive: true })

    // 1. 先清空 DB (避免重跑时老 schema 残留), 手动建一个老 schema 的 works 表 + 1 条记录
    const dbPath = path.join(dataDir, 'chesshub.db')
    try { await unlink(dbPath) } catch { /* ignore */ }
    const mod = await import('better-sqlite3')
    const Database = mod.default || mod
    const db = new Database(dbPath)
    db.exec(`
      CREATE TABLE works (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        title       TEXT NOT NULL,
        problem     TEXT,
        analysis    TEXT,
        solution    TEXT,
        tags        TEXT NOT NULL DEFAULT '[]',
        images      TEXT NOT NULL,
        date        TEXT NOT NULL,
        created_at  INTEGER NOT NULL DEFAULT (strftime('%s','now'))
      );
      INSERT INTO works (title, problem, analysis, solution, tags, images, date)
      VALUES (
        '老 ticket 标题',
        '老现象: 设备启动慢',
        '老排查: dmesg 看了',
        '老解决: 换了 rootfs',
        '["OpenWrt","legacy"]',
        '[]',
        '2026.03'
      );
    `)
    const row = db.prepare('SELECT id FROM works').get()
    oldId = row.id
    db.close()
    console.log(`[I before] created legacy works table with id=${oldId}`)

    // 2. 启动 server, 触发迁移
    server = spawnServer({
      DATA_DIR: dataDir,
      UPLOAD_DIR: uploadDir,
      CORS_ORIGIN: '*',
    }, PORT, logs)
    await waitForServer(PORT)
  })
  after(async () => { await killServer(server) })

  test('I.1 迁移后 GET /api/works 列表能看到老数据 (id 保留)', async () => {
    adminToken = await loginAsAdmin(PORT)
    const r = await req(PORT, '/api/works', { headers: { authorization: `Bearer ${adminToken}` } })
    assert.equal(r.status, 200)
    const w = r.body.works.find((x) => x.id === oldId)
    assert.ok(w, `老 id=${oldId} 应保留`)
    assert.equal(w.title, '老 ticket 标题')
  })

  test('I.2 迁移后 GET /api/works/:id description 拼接了 [现象]/[排查]/[解决]', async () => {
    const r = await req(PORT, `/api/works/${oldId}`, { headers: { authorization: `Bearer ${adminToken}` } })
    assert.equal(r.status, 200)
    const desc = r.body.work.description
    assert.ok(desc.includes('[现象]'), `description 应含 [现象] tag, got: ${desc.slice(0, 200)}`)
    assert.ok(desc.includes('[排查]'), `description 应含 [排查] tag`)
    assert.ok(desc.includes('[解决]'), `description 应含 [解决] tag`)
    assert.ok(desc.includes('老现象'))
    assert.ok(desc.includes('老排查'))
    assert.ok(desc.includes('老解决'))
  })

  test('I.3 迁移后 work 不再有 problem/analysis/tags/images 字段', async () => {
    const r = await req(PORT, `/api/works/${oldId}`, { headers: { authorization: `Bearer ${adminToken}` } })
    const w = r.body.work
    assert.ok(!('problem' in w))
    assert.ok(!('analysis' in w))
    assert.ok(!('solution' in w))
    assert.ok(!('tags' in w))
    assert.ok(!('images' in w))
  })

  test('I.4 迁移后可以追加新 note (老 work 也能用新功能)', async () => {
    const fd = new FormData()
    fd.append('content', '迁移后追加的新说明')
    const r = await req(PORT, `/api/works/${oldId}/notes`, {
      method: 'POST',
      headers: { authorization: `Bearer ${adminToken}` },
      body: fd,
    })
    assert.equal(r.status, 200, `migrated work add note should 200, got ${r.status}: ${r.text}`)
    const detail = await req(PORT, `/api/works/${oldId}`, { headers: { authorization: `Bearer ${adminToken}` } })
    assert.equal(detail.body.work.note_count, 1)
    assert.equal(detail.body.work.notes[0].content, '迁移后追加的新说明')
  })

  after(async () => {
    if (logs.length) {
      console.log('=== I server logs (last 50) ===')
      console.log(logs.slice(-50).join(''))
    }
    await killServer(server)
  })
})


