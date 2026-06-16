// 临时调试端点 - 显示 figures 表完整内容 (含 id, images 数组等)
import 'dotenv/config'
import express from 'express'
import Database from 'better-sqlite3'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const app = express()
const db = new Database(path.join(__dirname, 'data', 'chesshub.db'))

app.get('/debug/figures', (req, res) => {
  const rows = db.prepare('SELECT * FROM figures ORDER BY id DESC').all()
  res.json({
    count: rows.length,
    rows: rows.map((r) => ({
      id: r.id,
      name: r.name,
      brand: r.brand,
      images: JSON.parse(r.images),
      date: r.date,
      created_at: r.created_at,
    })),
  })
})

const port = 3001
app.listen(port, '127.0.0.1', () => {
  console.log(`[debug] listening on http://127.0.0.1:${port}/debug/figures`)
})