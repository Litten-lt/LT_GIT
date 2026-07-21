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
const startServer = () => spawn(process.execPath, ['server.js'], { cwd: root, env: { ...process.env, PORT: String(port), NODE_ENV: 'test', DATA_DIR: base, UPLOAD_DIR: path.join(base, 'uploads'), JWT_SECRET: 'content-state-test-secret', ADMIN_USER: 'admin', ADMIN_PASS: 'pass', CORS_ORIGIN: '*' }, stdio: 'ignore' })

before(async () => {
  await rm(base, { recursive: true, force: true }); await mkdir(path.join(base, 'uploads'), { recursive: true })
  server = startServer()
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
  const textNote = await request('/api/notes', { method: 'POST', headers: { authorization: `Bearer ${admin}`, 'content-type': 'application/json' }, body: JSON.stringify({ title: '无图生活文章', description: '只有文字也可以发布', images: [] }) })
  assert.equal(textNote.status, 200)
  await request(`/api/admin/content/note/${textNote.body.id}`, { method: 'PATCH', headers: { authorization: `Bearer ${admin}`, 'content-type': 'application/json' }, body: JSON.stringify({ status: 'published' }) })
  const guestNotes = await request('/api/notes', { headers: { authorization: `Bearer ${guest}` } })
  assert.deepEqual(guestNotes.body.notes.find((item) => item.id === textNote.body.id).images, [])
  const adminList = await request('/api/admin/content', { headers: { authorization: `Bearer ${admin}` } })
  const item = adminList.body.items.find((entry) => entry.type === 'work' && entry.id === id)
  assert.equal(item.status, 'draft'); assert.equal(item.featured, 1)
  assert.equal(item.channel_id, 'journal')
  assert.equal(item.category_slug, 'work')

  const taxonomy = await request('/api/taxonomy', { headers: { authorization: `Bearer ${admin}` } })
  assert.equal(taxonomy.status, 200)
  assert.deepEqual(taxonomy.body.channels.map((channel) => channel.id), ['journal', 'life'])
  assert.equal(taxonomy.body.channels.flatMap((channel) => channel.categories).length, 5)
  const studyCategoryId = taxonomy.body.channels.flatMap((channel) => channel.categories).find((entry) => entry.slug === 'study').id
  const unified = await request('/api/contents', { method: 'POST', headers: { authorization: `Bearer ${admin}`, 'content-type': 'application/json' }, body: JSON.stringify({ channel_id: 'journal', category_id: studyCategoryId, format: 'article', title: '统一模型测试', body: '统一正文', images: [], status: 'draft' }) })
  assert.equal(unified.status, 201)
  const guestUnifiedDrafts = await request('/api/contents?channel=journal', { headers: { authorization: `Bearer ${guest}` } })
  assert.equal(guestUnifiedDrafts.body.contents.some((entry) => entry.id === unified.body.id), false)
  await request(`/api/contents/${unified.body.id}`, { method: 'PUT', headers: { authorization: `Bearer ${admin}`, 'content-type': 'application/json' }, body: JSON.stringify({ status: 'published', featured: true }) })
  const noteForm = new FormData(); noteForm.append('body', '统一过程说明')
  const unifiedNote = await request(`/api/contents/${unified.body.id}/notes`, { method: 'POST', headers: { authorization: `Bearer ${admin}` }, body: noteForm })
  assert.equal(unifiedNote.status, 201)
  const unifiedDetail = await request(`/api/contents/${unified.body.id}`, { headers: { authorization: `Bearer ${guest}` } })
  assert.equal(unifiedDetail.body.content.category_name, '学习笔记')
  assert.equal(unifiedDetail.body.content.notes[0].body, '统一过程说明')
  const revisions = await request(`/api/contents/${unified.body.id}/revisions`, { headers: { authorization: `Bearer ${admin}` } })
  assert.equal(revisions.body.revisions.length, 1)
  assert.equal(revisions.body.revisions[0].title, '统一模型测试')
  const trashed = await request(`/api/contents/${unified.body.id}`, { method: 'DELETE', headers: { authorization: `Bearer ${admin}` } })
  assert.equal(trashed.status, 200)
  const guestAfterTrash = await request(`/api/contents/${unified.body.id}`, { headers: { authorization: `Bearer ${guest}` } })
  assert.equal(guestAfterTrash.status, 404)
  const trashList = await request('/api/contents?include_deleted=1', { headers: { authorization: `Bearer ${admin}` } })
  assert.ok(trashList.body.contents.find((entry) => entry.id === unified.body.id).deleted_at)
  const restoredContent = await request(`/api/contents/${unified.body.id}/restore`, { method: 'POST', headers: { authorization: `Bearer ${admin}` } })
  assert.equal(restoredContent.status, 200)
  const guestAfterRestore = await request(`/api/contents/${unified.body.id}`, { headers: { authorization: `Bearer ${guest}` } })
  assert.equal(guestAfterRestore.status, 200)

  const custom = await request('/api/admin/categories', { method: 'POST', headers: { authorization: `Bearer ${admin}`, 'content-type': 'application/json' }, body: JSON.stringify({ channel_id: 'journal', name: '工程实践' }) })
  assert.equal(custom.status, 201)
  const categoryId = custom.body.category.id
  const renamed = await request(`/api/admin/categories/${categoryId}`, { method: 'PATCH', headers: { authorization: `Bearer ${admin}`, 'content-type': 'application/json' }, body: JSON.stringify({ name: '工程复盘', sort_order: 5 }) })
  assert.equal(renamed.body.category.name, '工程复盘')

  const moved = await request(`/api/admin/content/work/${id}`, { method: 'PATCH', headers: { authorization: `Bearer ${admin}`, 'content-type': 'application/json' }, body: JSON.stringify({ category_id: categoryId }) })
  assert.equal(moved.status, 200)
  assert.equal(moved.body.category_name, '工程复盘')

  const lifeCategory = await request('/api/admin/categories', { method: 'POST', headers: { authorization: `Bearer ${admin}`, 'content-type': 'application/json' }, body: JSON.stringify({ channel_id: 'life', name: '观影' }) })
  const invalidBatch = await request('/api/admin/content-categories', { method: 'PATCH', headers: { authorization: `Bearer ${admin}`, 'content-type': 'application/json' }, body: JSON.stringify({ items: [{ type: 'work', id }], category_id: lifeCategory.body.category.id }) })
  assert.equal(invalidBatch.status, 400)
  const afterInvalidBatch = await request('/api/admin/content', { headers: { authorization: `Bearer ${admin}` } })
  assert.equal(afterInvalidBatch.body.items.find((entry) => entry.type === 'work' && entry.id === id).category_id, categoryId)

  const workCategoryId = taxonomy.body.channels.flatMap((channel) => channel.categories).find((entry) => entry.slug === 'work').id
  const removed = await request(`/api/admin/categories/${categoryId}`, { method: 'DELETE', headers: { authorization: `Bearer ${admin}`, 'content-type': 'application/json' }, body: JSON.stringify({ move_to: workCategoryId }) })
  assert.equal(removed.body.affected, 1)
  const afterCategoryDelete = await request('/api/admin/content', { headers: { authorization: `Bearer ${admin}` } })
  assert.equal(afterCategoryDelete.body.items.find((entry) => entry.type === 'work' && entry.id === id).category_id, workCategoryId)
  const validBatch = await request('/api/admin/content-categories', { method: 'PATCH', headers: { authorization: `Bearer ${admin}`, 'content-type': 'application/json' }, body: JSON.stringify({ items: [{ type: 'work', id }], category_id: workCategoryId }) })
  assert.equal(validBatch.body.updated, 1)

  const guestCategoryWrite = await request('/api/admin/categories', { method: 'POST', headers: { authorization: `Bearer ${guest}`, 'content-type': 'application/json' }, body: JSON.stringify({ channel_id: 'journal', name: '越权分类' }) })
  assert.equal(guestCategoryWrite.status, 403)

  // 删除的是分类关系，不是内容；频道保留，分类变为 NULL，为下一阶段“其他”兜底做准备。
  const { default: Database } = await import('better-sqlite3')
  const db = new Database(path.join(base, 'chesshub.db'))
  db.pragma('foreign_keys = ON')
  db.prepare("DELETE FROM categories WHERE slug = 'work'").run()
  db.close()

  const afterDelete = await request('/api/admin/content', { headers: { authorization: `Bearer ${admin}` } })
  const uncategorized = afterDelete.body.items.find((entry) => entry.type === 'work' && entry.id === id)
  assert.equal(uncategorized.channel_id, 'journal')
  assert.equal(uncategorized.category_id, null)
  assert.equal(uncategorized.category_slug, null)

  server.kill()
  await new Promise((resolve) => server.once('exit', resolve))
  server = startServer()
  await wait()
  const adminAfterRestart = await login('admin', 'pass')
  const taxonomyAfterRestart = await request('/api/taxonomy', { headers: { authorization: `Bearer ${adminAfterRestart}` } })
  assert.equal(taxonomyAfterRestart.body.channels.flatMap((channel) => channel.categories).some((category) => category.slug === 'work'), false)
})

