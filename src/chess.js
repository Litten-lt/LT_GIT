import {randomBytes,randomUUID,scrypt,timingSafeEqual} from 'node:crypto'
import {promisify} from 'node:util'
import {digest} from './auth.js'

const rules = ['红中麻将', '长沙麻将']
const capacity = 4
const cookieName = 'zhimu_chess'
const derive = promisify(scrypt)
const fail = (status, message) => { throw Object.assign(new Error(message), {status}) }

export function registerChess(router, db, {basePath, secureCookies}) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS chess_players (
      id TEXT PRIMARY KEY, token_hash TEXT UNIQUE NOT NULL, expires_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS chess_rooms (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, rule INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS chess_seats (
      player_id TEXT PRIMARY KEY REFERENCES chess_players(id) ON DELETE CASCADE,
      room_id TEXT NOT NULL REFERENCES chess_rooms(id) ON DELETE CASCADE,
      seen_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS chess_names (
      player_id TEXT PRIMARY KEY REFERENCES chess_players(id) ON DELETE CASCADE,
      name TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS chess_room_passwords (
      room_id TEXT PRIMARY KEY REFERENCES chess_rooms(id) ON DELETE CASCADE,
      salt TEXT NOT NULL, hash TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS chess_seats_room ON chess_seats(room_id);
  `)
  const cleanup = () => {
    db.prepare('DELETE FROM chess_rooms WHERE NOT EXISTS (SELECT 1 FROM chess_room_passwords WHERE room_id=chess_rooms.id)').run()
    db.prepare('DELETE FROM chess_players WHERE expires_at <= unixepoch()').run()
    db.prepare('DELETE FROM chess_seats WHERE seen_at <= unixepoch() - 300').run()
    db.prepare('DELETE FROM chess_rooms WHERE NOT EXISTS (SELECT 1 FROM chess_seats WHERE room_id=chess_rooms.id)').run()
  }
  const findPlayer = req => {
    const token = (req.headers.cookie || '').split(';').map(cookie => cookie.trim())
      .find(cookie => cookie.startsWith(cookieName + '='))?.slice(cookieName.length + 1)
    return token?.length === 64
      ? db.prepare('SELECT id FROM chess_players WHERE token_hash=? AND expires_at>unixepoch()').get(digest(token))?.id
      : undefined
  }
  const seatOf = id => db.prepare('SELECT room_id FROM chess_seats WHERE player_id=?').get(id ?? null)?.room_id ?? null
  const sit = db.prepare('INSERT INTO chess_seats VALUES (?, ?, unixepoch())')
  const ownerOf = db.prepare('SELECT player_id FROM chess_seats WHERE room_id=? ORDER BY rowid LIMIT 1')
  const roomMembers = db.prepare(`
    SELECT s.player_id, n.name FROM chess_seats s
    LEFT JOIN chess_names n ON n.player_id=s.player_id
    WHERE s.room_id=? ORDER BY s.rowid
  `)
  const mutate = async (req, res, action) => {
    if (secureCookies && !req.secure) fail(400, '请通过 HTTPS 进入棋牌室')
    const password = req.body?.password
    let salt, hash, passwordMatches
    if (action === 'create') {
      if (typeof password !== 'string' || !password.trim() || password.length > 64) fail(400, '请输入 1–64 个字符的房间密码')
      salt = randomBytes(16).toString('hex')
      hash = (await derive(password, salt, 32)).toString('hex')
    }
    if (action === 'join' && typeof password === 'string' && password.length && password.length <= 64) {
      const credential = db.prepare('SELECT salt, hash FROM chess_room_passwords WHERE room_id=?').get(req.params.id)
      if (credential) passwordMatches = timingSafeEqual(await derive(password, credential.salt, 32), Buffer.from(credential.hash, 'hex'))
    }
    const result = db.transaction(() => {
      cleanup()
      let playerId = findPlayer(req)
      let token
      if (!playerId) {
        if (action === 'kick') fail(403, '只有房主可以移出玩家')
        if (action === 'leave') return {roomId: null}
        playerId = randomUUID()
        token = randomBytes(32).toString('hex')
        db.prepare('INSERT INTO chess_players VALUES (?, ?, unixepoch() + 604800)').run(playerId, digest(token))
      }
      if (action === 'name') {
        const name = typeof req.body?.name === 'string' ? req.body.name.trim() : ''
        if (!name || name.length > 20 || /[\p{Cc}\p{Cf}]/u.test(name)) fail(400, '请输入 1–20 个字符的昵称')
        db.prepare('INSERT INTO chess_names VALUES (?, ?) ON CONFLICT(player_id) DO UPDATE SET name=excluded.name').run(playerId, name)
        return {token, roomId: seatOf(playerId)}
      }
      if (action === 'kick') {
        const roomId = req.params.id
        if (ownerOf.get(roomId)?.player_id !== playerId) fail(403, '只有房主可以移出玩家')
        if (req.params.playerId === playerId) fail(400, '房主可以直接离开房间')
        const removed = db.prepare('DELETE FROM chess_seats WHERE room_id=? AND player_id=?').run(roomId, req.params.playerId)
        if (!removed.changes) fail(404, '该玩家已离开')
        return {roomId}
      }
      if (action === 'leave') {
        db.prepare('DELETE FROM chess_seats WHERE player_id=?').run(playerId)
        cleanup()
        return {token, roomId: null}
      }
      const current = seatOf(playerId)
      if (current && action === 'join' && current === req.params.id) return {token, roomId: current}
      if (current) fail(409, '请先离开当前房间')
      if (action === 'create') {
        const name = typeof req.body?.name === 'string' ? req.body.name.trim() : ''
        const rule = rules.indexOf(req.body?.rule)
        if (!name || name.length > 30 || rule < 0 || req.body?.game !== 'mahjong') fail(400, '请填写房名并选择麻将规则')
        if (db.prepare('SELECT count(*) AS count FROM chess_rooms').get().count >= 100) fail(429, '大厅房间已达上限，请稍后再试')
        const roomId = randomUUID()
        db.prepare('INSERT INTO chess_rooms VALUES (?, ?, ?)').run(roomId, name, rule)
        db.prepare('INSERT INTO chess_room_passwords VALUES (?, ?, ?)').run(roomId, salt, hash)
        sit.run(playerId, roomId)
        return {token, roomId}
      }
      const roomId = req.params.id
      if (!db.prepare('SELECT 1 FROM chess_room_passwords WHERE room_id=?').get(roomId)) fail(404, '房间已经关闭')
      if (db.prepare('SELECT count(*) AS count FROM chess_seats WHERE room_id=?').get(roomId).count >= capacity) fail(409, '房间已满')
      if (!passwordMatches) fail(403, '房间密码不正确')
      sit.run(playerId, roomId)
      return {token, roomId}
    }).immediate()
    if (result.token) {
      res.cookie(cookieName, result.token, {
        httpOnly: true, secure: secureCookies, sameSite: 'strict',
        path: (basePath || '') + '/api/chess', maxAge: 7 * 86400 * 1000
      })
    }
    res.status(action === 'create' ? 201 : 200).json({roomId: result.roomId})
  }

  router.get('/api/chess', (req, res) => {
    const result = db.transaction(() => {
      cleanup()
      const playerId = findPlayer(req)
      const rooms = db.prepare(`
        SELECT r.id, r.name, r.rule, count(*) AS players
        FROM chess_rooms r JOIN chess_seats s ON s.room_id=r.id
        GROUP BY r.id ORDER BY r.rowid DESC
      `).all().map(room => ({...room, game: '麻将', rule: rules[room.rule], capacity}))
      const roomId = seatOf(playerId)
      const name = playerId ? db.prepare('SELECT name FROM chess_names WHERE player_id=?').get(playerId)?.name ?? '' : ''
      const owner = roomId ? ownerOf.get(roomId).player_id : null
      const isOwner = Boolean(owner && owner === playerId)
      for (const room of rooms) {
        room.members = roomMembers.all(room.id).map((member, index) => ({
          name: member.name ?? member.player_id.slice(0, 8),
          owner: index === 0,
          self: member.player_id === playerId,
          ...(isOwner && room.id === roomId ? {id: member.player_id} : {})
        }))
      }
      return {rooms, rules, roomId, name, playerNumber: playerId?.slice(0, 8) ?? null, isOwner}
    }).immediate()
    res.json(result)
  })
  router.post('/api/chess/presence', (req, res) => {
    db.prepare('UPDATE chess_seats SET seen_at=unixepoch() WHERE player_id=? AND seen_at>unixepoch()-300')
      .run(findPlayer(req) ?? null)
    res.json({ok: true})
  })
  const handle = action => (req, res, next) => mutate(req, res, action).catch(next)
  router.post('/api/chess/rooms', handle('create'))
  router.post('/api/chess/rooms/:id/join', handle('join'))
  router.post('/api/chess/leave', handle('leave'))
  router.post('/api/chess/name', handle('name'))
  router.post('/api/chess/rooms/:id/kick/:playerId', handle('kick'))
}
