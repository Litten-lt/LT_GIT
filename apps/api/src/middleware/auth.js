import jwt from 'jsonwebtoken'

export function createAuthMiddleware(jwtSecret) {
  function readToken(req) {
    const auth = req.headers.authorization || ''
    return auth.startsWith('Bearer ') ? auth.slice(7) : null
  }

  function requireAuth(req, res, next) {
    const token = readToken(req)
    if (!token) return res.status(401).json({ error: '未登录' })

    try {
      const payload = jwt.verify(token, jwtSecret)
      if (payload.role !== 'admin') return res.status(403).json({ error: '权限不足' })
      req.user = payload
      next()
    } catch {
      return res.status(401).json({ error: 'token 无效或已过期' })
    }
  }

  function requireSession(req, res, next) {
    const token = readToken(req)
    if (!token) return res.status(401).json({ error: '未登录' })

    try {
      req.user = jwt.verify(token, jwtSecret)
      next()
    } catch {
      return res.status(401).json({ error: 'token 无效或已过期' })
    }
  }

  return { requireAuth, requireSession }
}
