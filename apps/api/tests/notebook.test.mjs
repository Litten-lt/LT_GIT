import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdtemp, rm, readdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import Database from 'better-sqlite3'

let directory, server
let logs = ''
const port = 30119
const request = async (route, method = 'GET', body, extraHeaders = {}) => {
  const response = await fetch(`http://127.0.0.1:${port}/api${route}`, { method, headers: { ...(body && !(body instanceof FormData) ? { 'content-type': 'application/json' } : {}), ...extraHeaders }, body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined })
  return { status: response.status, data: await response.json(), headers: response.headers }
}
const stop = async () => { if (server) { const exited = new Promise(resolve => server.once('exit', resolve)); server.kill(); await exited; server = null } }
const start = async () => {
  server = spawn(process.execPath, ['server.js'], { cwd: path.resolve(import.meta.dirname, '..'), env: { ...process.env, NODE_ENV: 'test', PORT: String(port), DATA_DIR: directory, UPLOAD_DIR: path.join(directory, 'uploads'), CORS_ORIGIN: 'https://site.example', LOG_LEVEL: 'silent' }, stdio: ['ignore', 'pipe', 'pipe'] })
  server.stderr.on('data', chunk => { logs += chunk })
  for (let i = 0; i < 100; i++) { try { if ((await request('/health')).status === 200) return } catch {} await new Promise(resolve => setTimeout(resolve, 50)) }
  throw new Error('startup failed: ' + logs)
}
const create = async (change = {}) => {
  const result = await request('/contents', 'POST', { channel_id: 'journal', format: 'article', title: '工作问题', body: '排查正文 VLAN', images: [], status: 'published', ...change })
  assert.equal(result.status, 201, JSON.stringify(result.data))
  return result.data.id
}
before(async () => { directory = await mkdtemp(path.join(tmpdir(), 'longteng-notebook-')); await start() })
after(async () => { await stop(); await rm(directory, { recursive: true, force: true }) })

test('read and manage notes directly without cookies, tokens or roles', async () => {
  assert.deepEqual((await request('/contents')).data.contents, [])
  const id = await create({ status: 'draft' })
  assert.equal((await request('/contents/' + id)).data.content.status, 'draft')
  assert.equal((await request('/contents/' + id, 'PUT', { title: '编辑后的问题', tags: ['VLAN'], problem_status: 'resolved' })).status, 200)
  const search = await request('/contents?q=VLAN&summary=1')
  assert.equal(search.data.contents[0].id, id)
  assert.equal(search.data.contents[0].problem_status, 'resolved')
  assert.deepEqual(search.data.contents[0].tags, ['VLAN'])
})
test('removed authentication and legacy endpoints are unavailable', async () => {
  for (const [route, method] of [['/auth/login','POST'], ['/auth/guest','POST'], ['/auth/me','GET']]) assert.equal((await request(route, method)).status, 404)
  for (const route of ['/works','/studies','/notes','/travels','/figures']) assert.equal((await request(route)).status, 410)
  assert.equal((await request('/admin/usage')).status, 404)
})
test('invalid fields and cross-channel content are rejected', async () => {
  assert.equal((await request('/contents', 'POST', { channel_id: 'life', format: 'gallery', title: '生活', body: '不支持' })).status, 400)
  const id = await create()
  for (const body of [{ title: '' }, { problem_status: 'invalid' }, { tags: [42] }, { publish_at: 1 }]) assert.equal((await request('/contents/' + id, 'PUT', body)).status, 400)
})
test('category create, edit and delete reclassify existing notes', async () => {
  const response = await request('/admin/categories', 'POST', { channel_id: 'journal', name: '网络排查' })
  assert.equal(response.status, 201)
  const category = response.data.category
  const id = await create({ category_id: category.id })
  assert.equal((await request('/admin/categories/' + category.id, 'PATCH', { name: '网络运维' })).status, 200)
  assert.equal((await request('/contents/' + id)).data.content.category_name, '网络运维')
  assert.equal((await request('/admin/categories/' + category.id, 'DELETE')).status, 200)
  assert.equal((await request('/contents/' + id)).data.content.category_id, null)
})
test('revisions restore the earlier text and metadata', async () => {
  const id = await create({ body: '最初正文', tags: ['原始标签'] })
  await request('/contents/' + id, 'PUT', { body: '新的正文', tags: ['新标签'] })
  const revision = (await request('/contents/' + id + '/revisions')).data.revisions[0]
  assert.equal((await request(`/contents/${id}/revisions/${revision.id}/restore`, 'POST')).status, 200)
  const result = (await request('/contents/' + id)).data.content
  assert.equal(result.body, '最初正文'); assert.deepEqual(result.tags, ['原始标签'])
})
test('process drafts and process notes support the full editing flow', async () => {
  const id = await create()
  assert.equal((await request(`/contents/${id}/note-draft`, 'PUT', { body: '未完成的排查' })).status, 200)
  assert.equal((await request(`/contents/${id}/note-draft`)).data.draft.body, '未完成的排查')
  const form = new FormData(); form.append('body', '新的证据')
  const response = await request(`/contents/${id}/notes`, 'POST', form)
  assert.equal(response.status, 201)
  const noteId = response.data.id
  assert.equal((await request(`/contents/${id}/note-draft`)).data.draft, null)
  assert.equal((await request(`/contents/${id}/notes/${noteId}`, 'PUT', { body: '验证结果' })).status, 200)
  assert.equal((await request('/contents/' + id)).data.content.notes[0].body, '验证结果')
  assert.equal((await request(`/contents/${id}/notes/${noteId}`, 'DELETE')).status, 200)
})
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX1sAAAAASUVORK5CYII=', 'base64')
test('generic image upload validates actual bytes and removes invalid uploads', async () => {
  const valid = new FormData(); valid.append('file', new Blob([png], { type: 'image/png' }), 'pixel.png')
  assert.equal((await request('/upload', 'POST', valid)).status, 200)
  const beforeFiles = await readdir(path.join(directory, 'uploads'))
  const bad = new FormData(); bad.append('file', new Blob(['<?php echo 1; ?>'], { type: 'image/png' }), 'fake.png')
  assert.equal((await request('/upload', 'POST', bad)).status, 400)
  assert.deepEqual(await readdir(path.join(directory, 'uploads')), beforeFiles)
})
test('process note image validation accepts real images and rejects forged bytes', async () => {
  const id = await create()
  const valid = new FormData(); valid.append('images', new Blob([png], { type: 'image/png' }), 'evidence.png')
  assert.equal((await request(`/contents/${id}/notes`, 'POST', valid)).status, 201)
  const beforeFiles = await readdir(path.join(directory, 'uploads'))
  const bad = new FormData(); bad.append('images', new Blob(['fake'], { type: 'image/png' }), 'forged.png')
  assert.equal((await request(`/contents/${id}/notes`, 'POST', bad)).status, 400)
  assert.deepEqual(await readdir(path.join(directory, 'uploads')), beforeFiles)
})
test('trash can restore content; permanent deletion cascades process notes and revisions', async () => {
  const id = await create()
  assert.equal((await request(`/contents/${id}/permanent`, 'DELETE')).status, 404)
  await request('/contents/' + id, 'PUT', { body: '修订' })
  await request('/contents/' + id, 'DELETE')
  assert.equal((await request('/contents/' + id)).status, 404)
  assert.ok((await request('/contents?include_deleted=1')).data.contents.some(item => item.id === id))
  assert.equal((await request(`/contents/${id}/restore`, 'POST')).status, 200)
  await request('/contents/' + id, 'DELETE')
  assert.equal((await request(`/contents/${id}/permanent`, 'DELETE')).status, 200)
  assert.deepEqual((await request(`/contents/${id}/revisions`)).data.revisions, [])
})
test('scheduled notes publish when due', async () => {
  const id = await create({ publish_at: Math.floor(Date.now() / 1000) + 3600 })
  assert.equal((await request('/contents/' + id)).data.content.status, 'draft')
  const db = new Database(path.join(directory, 'longteng.db')); db.prepare('UPDATE contents SET publish_at=1 WHERE id=?').run(id); db.close()
  const content = (await request('/contents/' + id)).data.content
  assert.equal(content.status, 'published'); assert.equal(content.publish_at, null)
})
test('CORS and invalid request handling remain intact', async () => {
  assert.equal((await request('/health', 'GET', undefined, { origin: 'https://site.example' })).headers.get('access-control-allow-origin'), 'https://site.example')
  assert.equal((await request('/health', 'GET', undefined, { origin: 'https://other.example' })).headers.get('access-control-allow-origin'), null)
  assert.equal((await request('/does-not-exist')).status, 404)
})
test('restart migration preserves notebook records, imports old work and removes life content', async () => {
  const id = await create({ title: '重启后仍保留' })
  await stop()
  const db = new Database(path.join(directory, 'longteng.db'))
  db.prepare("INSERT INTO works (title, description, date) VALUES ('旧工作笔记', '历史内容', '2026.10')").run()
  db.prepare("INSERT INTO travels (title, description, images, date) VALUES ('旧生活', '删除', '[]', '2026.10')").run()
  db.close()
  await start()
  assert.equal((await request('/contents/' + id)).data.content.title, '重启后仍保留')
  assert.ok((await request('/contents')).data.contents.some(item => item.title === '旧工作笔记'))
  assert.deepEqual((await request('/taxonomy')).data.channels.map(item => item.id), ['journal'])
  await stop(); await start()
  const checked = new Database(path.join(directory, 'longteng.db'))
  assert.equal(checked.prepare("SELECT count(*) n FROM contents WHERE channel_id='life'").get().n, 0)
  assert.equal(checked.prepare('SELECT count(*) n FROM travels').get().n, 0)
  checked.close()
})
