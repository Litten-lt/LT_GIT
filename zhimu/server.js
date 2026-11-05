import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createApp } from './src/app.js'

const root = path.dirname(fileURLToPath(import.meta.url))
const port = Number(process.env.PORT || 3210)
const { app, db } = createApp({ filename: path.join(process.env.DATA_DIR || path.join(root,'data'),'zhimu.db'), basePath: process.env.BASE_PATH || '', secureCookies: process.env.NODE_ENV==='production', backupFile: process.env.BACKUP_FILE || '/var/backups/zhimu/automatic/latest.tar.gz' })
const server = app.listen(port, '127.0.0.1', () => console.log(`知木 http://127.0.0.1:${port}${process.env.BASE_PATH || ''}/`))
for (const signal of ['SIGINT','SIGTERM']) process.on(signal, () => server.close(() => { db.close(); process.exit(0) }))
