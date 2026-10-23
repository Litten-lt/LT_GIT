import 'dotenv/config'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const apiRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

export const config = Object.freeze({
  port: Number.parseInt(process.env.PORT || '3000', 10),
  uploadDir: process.env.UPLOAD_DIR || '/var/www/longteng-data/figures',
  dataDir: process.env.DATA_DIR || path.join(apiRoot, 'data'),
  corsOrigin: process.env.CORS_ORIGIN || '*',
  publicBaseUrl: process.env.PUBLIC_BASE_URL || '',
  nodeEnv: process.env.NODE_ENV || 'development',
  logLevel: process.env.LOG_LEVEL || 'info',
})
