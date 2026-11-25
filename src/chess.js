import {randomBytes,randomUUID,scrypt,timingSafeEqual} from 'node:crypto'
import {promisify} from 'node:util'
import {digest} from './auth.js'
import {advance, newMatch, play, tableView} from './mahjong.js'

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
    CREATE TABLE IF NOT EXISTS chess_matches (
      room_id TEXT PRIMARY KEY REFERENCES chess_rooms(id) ON DELETE CASCADE,
      state TEXT NOT NULL,
      active INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
  `)
  const pruneRooms = db.prepare(`
    DELETE FROM chess_rooms
    WHERE NOT EXISTS (
        SELECT 1 FROM chess_seats AS seat
        WHERE seat.room_id=chess_rooms.id AND seat.player_id NOT LIKE 'bot-%'
          AND seat.seen_at > unixepoch() - CASE WHEN EXISTS (
            SELECT 1 FROM chess_matches WHERE room_id=chess_rooms.id AND active=1
          ) THEN 900 ELSE 300 END
      )
  `)
  const cleanup = db.transaction(() => {
    db.prepare('DELETE FROM chess_players WHERE expires_at <= unixepoch()').run()
    pruneRooms.run()
    db.prepare("DELETE FROM chess_players WHERE id LIKE 'bot-%' AND NOT EXISTS (SELECT 1 FROM chess_seats WHERE player_id=chess_players.id)").run()
  })
  const roomCredential = db.prepare('SELECT salt, hash FROM chess_room_passwords WHERE room_id=?')
  const roomExists = db.prepare('SELECT 1 FROM chess_rooms WHERE id=?')
  const touchSeat = db.prepare("UPDATE chess_seats SET seen_at=unixepoch() WHERE room_id=? AND player_id=? AND player_id NOT LIKE 'bot-%'")
  const findPlayer = req => {
    const token = (req.headers.cookie || '').split(';').map(cookie => cookie.trim())
      .find(cookie => cookie.startsWith(cookieName + '='))?.slice(cookieName.length + 1)
    return token?.length === 64
      ? db.prepare('SELECT id FROM chess_players WHERE token_hash=? AND expires_at>unixepoch()').get(digest(token))?.id
      : undefined
  }
  const seatOf = id => db.prepare('SELECT room_id FROM chess_seats WHERE player_id=?').get(id ?? null)?.room_id ?? null
  const sit = db.prepare('INSERT INTO chess_seats VALUES (?, ?, unixepoch())')
  const ownerOf = db.prepare("SELECT player_id FROM chess_seats WHERE room_id=? AND player_id NOT LIKE 'bot-%' ORDER BY rowid LIMIT 1")
  const roomMembers = db.prepare(`
    SELECT s.player_id, n.name FROM chess_seats s
    LEFT JOIN chess_names n ON n.player_id=s.player_id
    WHERE s.room_id=? ORDER BY s.rowid
  `)
  const matchRecord = db.prepare('SELECT state,active FROM chess_matches WHERE room_id=?')
  const saveMatch = db.prepare(`INSERT INTO chess_matches VALUES (?,?,?,unixepoch())
    ON CONFLICT(room_id) DO UPDATE SET state=excluded.state, active=excluded.active, updated_at=excluded.updated_at`)
  const save = (roomId, match) => saveMatch.run(roomId, JSON.stringify(match), Number(match.phase !== 'ended'))
  const isBot = id => id.startsWith('bot-')
  const gameRoom = (roomId, playerId) => {
    if (!roomExists.get(roomId)) fail(410, '房间已关闭，可能有玩家中途离开或长时间无人活动')
    if (!playerId || seatOf(playerId) !== roomId) fail(403, '请先加入房间')
    touchSeat.run(roomId, playerId)
  }
  const mutate = async (req, res, action) => {
    if (secureCookies && !req.secure) fail(400, '请通过 HTTPS 进入棋牌室')
    const password = req.body?.password
    let salt, hash, passwordMatches
    if (action === 'create' && password !== undefined) {
      if (typeof password !== 'string' || !password.trim() || password.length > 64) fail(400, '请输入 1–64 个字符的房间密码')
      salt = randomBytes(16).toString('hex')
      hash = (await derive(password, salt, 32)).toString('hex')
    }
    if (action === 'join' && typeof password === 'string' && password.length && password.length <= 64) {
      const credential = roomCredential.get(req.params.id)
      if (credential) passwordMatches = timingSafeEqual(await derive(password, credential.salt, 32), Buffer.from(credential.hash, 'hex'))
    }
    cleanup.immediate()
    const result = db.transaction(() => {
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
        if (matchRecord.get(roomId)?.active) fail(409, '对局中不能移出玩家')
        if (req.params.playerId === playerId) fail(400, '房主可以直接离开房间')
        const removed = db.prepare('DELETE FROM chess_seats WHERE room_id=? AND player_id=?').run(roomId, req.params.playerId)
        if (!removed.changes) fail(404, '该玩家已离开')
        touchSeat.run(roomId, playerId)
        return {roomId}
      }
      if (action === 'leave') {
        const roomId = seatOf(playerId)
        if (roomId && matchRecord.get(roomId)?.active) {
          db.prepare('DELETE FROM chess_rooms WHERE id=?').run(roomId)
        } else {
          db.prepare('DELETE FROM chess_seats WHERE player_id=?').run(playerId)
        }
        cleanup()
        return {token, roomId: null}
      }
      const current = seatOf(playerId)
      if (current && action === 'join' && current === req.params.id) {
        touchSeat.run(current, playerId)
        return {token, roomId: current}
      }
      if (current) fail(409, '请先离开当前房间')
      if (action === 'create') {
        const name = typeof req.body?.name === 'string' ? req.body.name.trim() : ''
        const rule = rules.indexOf(req.body?.rule)
        if (!name || name.length > 30 || rule < 0 || req.body?.game !== 'mahjong') fail(400, '请填写房名并选择麻将规则')
        if (db.prepare('SELECT count(*) AS count FROM chess_rooms').get().count >= 100) fail(429, '大厅房间已达上限，请稍后再试')
        const roomId = randomUUID()
        db.prepare('INSERT INTO chess_rooms VALUES (?, ?, ?)').run(roomId, name, rule)
        if (hash) db.prepare('INSERT INTO chess_room_passwords VALUES (?, ?, ?)').run(roomId, salt, hash)
        sit.run(playerId, roomId)
        return {token, roomId}
      }
      const roomId = req.params.id
      if (!roomExists.get(roomId)) fail(404, '房间已经关闭')
      if (matchRecord.get(roomId)?.active) fail(409, '房间正在对局')
      if (db.prepare('SELECT count(*) AS count FROM chess_seats WHERE room_id=?').get(roomId).count >= capacity) fail(409, '房间已满')
      if (roomCredential.get(roomId)) {
        if (password === undefined || password === '') fail(401, '此房间需要密码')
        if (!passwordMatches) fail(403, '房间密码不正确')
      }
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
    cleanup.immediate()
    const result = db.transaction(() => {
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
        const game = matchRecord.get(room.id)
        if (game?.active) room.playing = true
        if (game && room.id === roomId && tableView(JSON.parse(game.state), playerId)) room.hasMatch = true
        const ownerId = ownerOf.get(room.id).player_id
        room.members = roomMembers.all(room.id).map(member => ({
          name: member.name ?? member.player_id.slice(0, 8),
          owner: member.player_id === ownerId,
          self: member.player_id === playerId,
          ...(isBot(member.player_id) ? {bot: true} : {}),
          ...(isOwner && room.id === roomId ? {id: member.player_id} : {})
        }))
      }
      return {rooms, rules, roomId, name, playerNumber: playerId?.slice(0, 8) ?? null, isOwner}
    }).immediate()
    res.json(result)
  })
  router.post('/api/chess/presence', (req, res) => {
    cleanup.immediate()
    if (typeof req.body?.roomId === 'string') touchSeat.run(req.body.roomId, findPlayer(req) ?? null)
    res.json({ok: true})
  })
  const handle = action => (req, res, next) => mutate(req, res, action).catch(next)
  router.post('/api/chess/rooms', handle('create'))
  router.post('/api/chess/rooms/:id/join', handle('join'))
  router.post('/api/chess/leave', handle('leave'))
  router.post('/api/chess/name', handle('name'))
  router.post('/api/chess/rooms/:id/kick/:playerId', handle('kick'))
  const table = (req, res, action) => {
    if (secureCookies && !req.secure) fail(400, '请通过 HTTPS 进入牌桌')
    cleanup.immediate()
    const data = db.transaction(() => {
      const roomId = req.params.id
      const playerId = findPlayer(req)
      gameRoom(roomId, playerId)
      const record = matchRecord.get(roomId)
      if (action === 'bot' || action === 'start') {
        if (ownerOf.get(roomId)?.player_id !== playerId) fail(403, '只有房主可以操作')
        if (db.prepare('SELECT rule FROM chess_rooms WHERE id=?').get(roomId).rule !== 0) fail(409, '该玩法暂未开放')
        const members = roomMembers.all(roomId)
        if (action === 'start' && record?.active) return tableView(JSON.parse(record.state), playerId)
        if (record?.active) fail(409, '对局已经开始')
        if (action === 'bot') {
          if (members.length >= capacity) fail(409, '房间已满')
          const id = 'bot-' + randomUUID()
          const names = new Set(members.map(member => member.name))
          const label = ['机器人 1', '机器人 2', '机器人 3'].find(name => !names.has(name)) ?? '机器人'
          db.prepare('INSERT INTO chess_players VALUES (?, ?, unixepoch()+604800)').run(id, digest(id))
          db.prepare('INSERT INTO chess_names VALUES (?, ?)').run(id, label)
          sit.run(id, roomId)
          return {ok: true}
        }
        if (members.length !== capacity) fail(409, '需要四人入座才可开局')
        const match = newMatch(members.map(member => ({
          id: member.player_id, name: member.name ?? member.player_id.slice(0, 8), bot: isBot(member.player_id)
        })), undefined, undefined, record ? JSON.parse(record.state) : undefined)
        save(roomId, match)
        return tableView(match, playerId)
      }
      if (!record) fail(404, '尚未开始对局')
      const match = JSON.parse(record.state)
      if (!tableView(match, playerId)) fail(403, '你不在这局牌桌上')
      const time = Date.now()
      let changed = (action === 'read' || match.deadline <= time) && advance(match, time, true)
      if (action === 'move') {
        const seat = match.players.findIndex(player => player.id === playerId)
        if (req.body?.id !== match.id || req.body?.version !== match.version || !play(match, seat, req.body.move)) {
          if (changed) save(roomId, match)
          return {stale: true}
        }
        changed = true
      }
      if (changed) save(roomId, match)
      return tableView(match, playerId)
    }).immediate()
    if (data.stale) return res.status(409).json({error: '牌局已更新，请查看最新牌面'})
    res.json({...data, isOwner: ownerOf.get(req.params.id)?.player_id === findPlayer(req)})
  }
  router.post('/api/chess/rooms/:id/bots', (req,res) => table(req,res,'bot'))
  router.post('/api/chess/rooms/:id/start', (req,res) => table(req,res,'start'))
  router.get('/api/chess/rooms/:id/match', (req,res) => table(req,res,'read'))
  router.post('/api/chess/rooms/:id/match', (req,res) => table(req,res,'move'))
  return () => cleanup.immediate()
}
