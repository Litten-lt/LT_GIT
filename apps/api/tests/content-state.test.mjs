import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdir, rm } from 'node:fs/promises'
import path from 'node:path'
import http from 'node:http'

const root = path.resolve(import.meta.dirname, '..')
const base = path.join(import.meta.dirname, '.content-state-data')
const port = 30110
let server
const request = async (pathName, init = {}) => { const res = await fetch(`http://127.0.0.1:${port}${pathName}`, init); return { status: res.status, body: await res.json() } }
const wait = () => new Promise((resolve, reject) => { const started = Date.now(); const tick = () => { const req = http.get(`http://127.0.0.1:${port}/api/health`, (res) => { res.resume(); res.statusCode === 200 ? resolve() : setTimeout(tick, 50) }); req.on('error', () => Date.now() - started > 5000 ? reject(new Error('timeout')) : setTimeout(tick, 50)) }; tick() })
const login = async (username, password) => (await request('/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username, password }) })).body.token

before(async () => {
  await rm(base, { recursive: true, force: true }); await mkdir(path.join(base, 'uploads'), { recursive: true })
  server = spawn(process.execPath, ['server.js'], { cwd: root, env: { ...process.env, PORT: String(port), NODE_ENV: 'test', DATA_DIR: base, UPLOAD_DIR: path.join(base, 'uploads'), JWT_SECRET: 'content-state-test-secret', ADMIN_USER: 'admin', ADMIN_PASS: 'pass', CORS_ORIGIN: '*' }, stdio: 'ignore' })
  await wait()
})
after(async () => { if (server) { server.kill(); await new Promise((resolve) => server.once('exit', resolve)) }; await rm(base, { recursive: true, force: true }) })

test('draft is hidden from guests while admin can manage it', async () => {
  const admin = await login('admin', 'pass')
  const created = await request('/api/works', { method: 'POST', headers: { authorization: `Bearer ${admin}`, 'content-type': 'application/json' }, body: JSON.stringify({ title: '状态测试' }) })
  const id = created.body.id
  const changed = await request(`/api/admin/content/work/${id}`, { method: 'PATCH', headers: { authorization: `Bearer ${admin}`, 'content-type': 'application/json' }, body: JSON.stringify({ status: 'draft', featured: true }) })
  assert.equal(changed.status, 200)
  const guest = (await request('/api/auth/guest', { method: 'POST' })).body.token
  const guestList = await request('/api/works', { headers: { authorization: `Bearer ${guest}` } })
  assert.equal(guestList.body.works.some((item) => item.id === id), false)
  const adminList = await request('/api/admin/content', { headers: { authorization: `Bearer ${admin}` } })
  const item = adminList.body.items.find((entry) => entry.type === 'work' && entry.id === id)
  assert.equal(item.status, 'draft'); assert.equal(item.featured, 1)
})

