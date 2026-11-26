import {randomInt, randomUUID} from 'node:crypto'

export const RED = 27
export const tileSet = () => Array.from({length: 112}, (_, index) => Math.floor(index / 4))

function shuffle(tiles) {
  for (let i = tiles.length - 1; i > 0; i--) {
    const j = randomInt(i + 1)
    ;[tiles[i], tiles[j]] = [tiles[j], tiles[i]]
  }
  return tiles
}

export function canWin(hand, melds = 0) {
  if (hand.length !== 14 - melds * 3) return false
  const counts = Array(27).fill(0)
  let wild = 0
  for (const tile of hand) {
    if (tile === RED) wild++
    else counts[tile]++
  }
  if (!melds && counts.filter(count => count % 2).length <= wild) return true
  const memo = new Map()
  function groups(left) {
    const tile = counts.findIndex(Boolean)
    if (tile < 0) return left % 3 === 0
    const key = counts.join('') + ':' + left
    if (memo.has(key)) return memo.get(key)
    const natural = Math.min(3, counts[tile])
    counts[tile] -= natural
    let found = 3 - natural <= left && groups(left - (3 - natural))
    counts[tile] += natural
    const suitStart = tile - tile % 9
    for (let start = Math.max(suitStart, tile - 2); !found && start <= Math.min(tile, suitStart + 6); start++) {
      const used = []
      for (let i = start; i < start + 3; i++) {
        if (counts[i]) {
          counts[i]--
          used.push(i)
        }
      }
      found = 3 - used.length <= left && groups(left - (3 - used.length))
      for (const i of used) counts[i]++
    }
    memo.set(key, found)
    return found
  }
  for (let i = 0; i < counts.length; i++) {
    if (!counts[i]) continue
    for (let used = 1; used <= Math.min(2, counts[i]); used++) {
      counts[i] -= used
      const found = 2 - used <= wild && groups(wild - (2 - used))
      counts[i] += used
      if (found) return true
    }
  }
  return wild >= 2 && groups(wild - 2)
}

const nextSeat = (seat, distance = 1) => (seat + distance) % 4
const amount = (hand, tile) => hand.filter(value => value === tile).length
const take = (hand, tile, count) => {
  for (let i = 0; i < count; i++) hand.splice(hand.indexOf(tile), 1)
}
const sort = hand => hand.sort((a, b) => a - b)
const now = () => Date.now()
export const BOT_DELAY = 1000

function announce(match, type, seat, tile) {
  const events = match.events ??= []
  events.push({seq: (events.at(-1)?.seq ?? 0) + 1, type, seat, ...(tile === undefined ? {} : {tile})})
  if (events.length > 24) events.shift()
}

export function newMatch(players, wall = shuffle(tileSet()), dealer = randomInt(4), previous) {
  wall = wall.slice()
  const sameTable = previous && players.every(player => previous.players.some(old => old.id === player.id))
  const totals = sameTable ? players.map(player => {
    const seat = previous.players.findIndex(old => old.id === player.id)
    return (previous.totals?.[seat] ?? 0) + previous.scores[seat]
  }) : players.map(() => 0)
  if (sameTable) dealer = players.findIndex(player => player.id === previous.players[previous.winner ?? previous.dealer].id)
  const match = {
    id: randomUUID(), version: 0, rule: 'gd-red-2', players, dealer, turn: dealer, wall, totals,
    round: sameTable ? (previous.round ?? 1) + 1 : 1, flown: [],
    hands: players.map(() => sort(wall.splice(0, 13))), melds: players.map(() => []),
    discards: players.map(() => []), scores: players.map(() => 0), phase: 'turn',
    events: [], botAt: now() + BOT_DELAY
  }
  draw(match, dealer)
  return match
}

function finish(match, winner = null) {
  match.phase = 'ended'
  match.claim = null
  match.deadline = null
  match.winner = winner
  if (winner === null) announce(match, 'draw')
  if (winner !== null) {
    const clean = !match.hands[winner].includes(RED)
    const multiplier = match.flown?.includes(winner) ? 2 : 1
    const marks = match.rule === 'gd-red-2' ? match.wall.splice(-Math.min(match.wall.length, clean ? 6 : 4)).reverse() : []
    const hits = marks.map(tile => tile === RED || [0, 4, 8].includes(tile % 9))
    const payment = (2 + hits.filter(Boolean).length * 2) * multiplier
    match.settlement = {clean, multiplier, marks, hits, payment}
    for (let seat = 0; seat < 4; seat++) match.scores[seat] += seat === winner ? payment * 3 : -payment
  }
}

function draw(match, seat, tail = false) {
  if (!match.wall.length) return finish(match)
  match.turn = seat
  match.phase = 'turn'
  match.claim = null
  match.drawn = tail ? match.wall.pop() : match.wall.shift()
  match.drawVersion = match.version
  match.hands[seat].push(match.drawn)
  match.deadline = now() + 60000
}

export function legalMoves(match, seat) {
  if (match.phase === 'claim') {
    const {choices, replies, tile} = match.claim
    return Object.hasOwn(replies, seat) ? [] : (choices[seat] ?? []).map(type => ({type, tile}))
  }
  if (match.phase !== 'turn' || match.turn !== seat) return []
  const hand = match.hands[seat]
  const moves = [...new Set(hand)].map(tile => ({type: 'discard', tile}))
  if (match.drawn === null) return moves
  if (canWin(hand, match.melds[seat].length)) {
    moves.push({type: 'win'})
    if (match.rule === 'gd-red-2' && hand.includes(RED) && !match.flown.includes(seat) && match.wall.length) moves.push({type: 'fly', tile: RED})
  }
  if (match.wall.length) {
    for (const tile of new Set(hand)) {
      if (tile === RED) continue
      if (amount(hand, tile) === 4) moves.push({type: 'closedKong', tile})
      if (match.melds[seat].some(meld => meld.type === 'pong' && meld.tile === tile)) moves.push({type: 'addedKong', tile})
    }
  }
  return moves
}

function payKong(match, seat, from) {
  for (let other = 0; other < 4; other++) {
    if (other !== seat && (from === undefined || from === other)) {
      match.scores[other]--
      match.scores[seat]++
    }
  }
}

function resolveClaim(match) {
  const {choices, replies, from, tile} = match.claim
  if (Object.keys(choices).some(seat => !Object.hasOwn(replies, seat))) return
  for (const type of ['openKong', 'pong']) {
    for (let distance = 1; distance < 4; distance++) {
      const seat = nextSeat(from, distance)
      if (replies[seat] !== type) continue
      take(match.hands[seat], tile, type === 'pong' ? 2 : 3)
      match.discards[from].pop()
      match.lastDiscard = null
      match.melds[seat].push({type, tile, from})
      announce(match, type, seat, tile)
      if (type === 'openKong') {
        payKong(match, seat, from)
        return draw(match, seat, true)
      }
      match.claim = null
      match.turn = seat
      match.phase = 'turn'
      match.drawn = null
      match.deadline = now() + 60000
      return
    }
  }
  draw(match, nextSeat(from))
}

export function play(match, seat, move) {
  if (!legalMoves(match, seat).some(option => option.type === move?.type && option.tile === move.tile)) return false
  match.version++
  match.botAt = now() + BOT_DELAY
  const {type, tile} = move
  if (match.phase === 'claim') {
    match.claim.replies[seat] = type
    resolveClaim(match)
    return true
  }
  if (type === 'win') {
    announce(match, type, seat)
    finish(match, seat)
  }
  else if (type === 'closedKong' || type === 'addedKong') {
    take(match.hands[seat], tile, type === 'closedKong' ? 4 : 1)
    if (type === 'closedKong') match.melds[seat].push({type, tile})
    else match.melds[seat].find(meld => meld.type === 'pong' && meld.tile === tile).type = type
    payKong(match, seat)
    announce(match, type, seat, type === 'closedKong' ? undefined : tile)
    draw(match, seat, true)
  } else {
    if (type === 'fly') match.flown.push(seat)
    take(match.hands[seat], tile, 1)
    sort(match.hands[seat])
    match.discards[seat].push(tile)
    match.lastDiscard = {seat, tile}
    announce(match, type, seat, tile)
    const choices = {}
    if (tile !== RED) {
      for (let other = 0; other < 4; other++) {
        if (other === seat) continue
        const count = amount(match.hands[other], tile)
        if (count >= 2) choices[other] = count === 3 && match.wall.length ? ['openKong', 'pong', 'pass'] : ['pong', 'pass']
      }
    }
    if (Object.keys(choices).length) {
      match.phase = 'claim'
      match.claim = {from: seat, tile, choices, replies: {}}
      match.deadline = now() + 15000
    } else draw(match, nextSeat(seat))
  }
  return true
}

const suitProfiles = new Map([['000000000', [[0, 0, 0]]]])

function suitShapes(counts) {
  const key = counts.join('')
  if (suitProfiles.has(key)) return suitProfiles.get(key)
  const first = counts.findIndex(Boolean)
  const shapes = new Map()
  function use(tiles, groups = 0, partials = 0, pair = 0) {
    for (const tile of tiles) counts[tile]--
    for (const [g, t, p] of suitShapes(counts)) {
      if (g + groups > 4 || t + partials > 4 || p + pair > 1) continue
      const shape = [g + groups, t + partials, p + pair]
      shapes.set(shape[0] * 10 + shape[1] * 2 + shape[2], shape)
    }
    for (const tile of tiles) counts[tile]++
  }
  use([first])
  if (counts[first] >= 2) {
    use([first, first], 0, 0, 1)
    use([first, first], 0, 1)
  }
  if (counts[first] >= 3) use([first, first, first], 1)
  if (counts[first + 1]) use([first, first + 1], 0, 1)
  if (counts[first + 2]) {
    use([first, first + 2], 0, 1)
    if (counts[first + 1]) use([first, first + 1, first + 2], 1)
  }
  const result = [...shapes.values()].filter(([g, t, p]) =>
    t === 4 || !shapes.has(g * 10 + (t + 1) * 2 + p))
  if (suitProfiles.size < 30_000) suitProfiles.set(key, result)
  return result
}

// A quad can count as two pairs under the local seven-pairs rule.
export function distanceToWin(hand, melds) {
  const counts = Array(RED).fill(0)
  let wild = 0
  for (const tile of hand) {
    if (tile === RED) wild++
    else counts[tile]++
  }
  const pairs = counts.reduce((total, count) => total + Math.floor(count / 2), 0)
  let best = melds ? 8 : 6 - pairs - wild
  const [first, second, third] = [0, 9, 18].map(start => suitShapes(counts.slice(start, start + 9)))
  for (const [a, b, c] of first) {
    for (const [d, e, f] of second) {
      for (const [g, h, i] of third) {
        const groups = melds + a + d + g
        if (groups > 4 || c + f + i > 1) continue
        const partials = Math.min(4 - groups, b + e + h)
        best = Math.min(best, 8 - groups * 2 - partials - c - f - i - wild)
      }
    }
  }
  // The scoring engine is the final authority on completed hands.
  return best < 0 ? (canWin(hand, melds) ? -1 : 0) : best
}

export function robotMove({hand, melds, discards, seat}, moves) {
  const win = moves.find(move => move.type === 'win')
  if (win || moves.length === 1) return win ?? moves[0]

  const remaining = Array(RED + 1).fill(4)
  for (const tile of hand) remaining[tile]--
  for (const river of discards) for (const tile of river) remaining[tile]--
  for (const [index, groups] of melds.entries()) {
    for (const {type, tile} of groups) {
      if (type === 'closedKong' && index !== seat) continue
      remaining[tile] -= type === 'pong' ? 3 : 4
    }
  }

  const memo = new Map()
  const distance = (tiles, groups) => {
    const key = groups + ':' + tiles.slice().sort((a, b) => a - b).join(',')
    if (!memo.has(key)) memo.set(key, distanceToWin(tiles, groups))
    return memo.get(key)
  }
  const rate = (tiles, groups) => {
    const steps = distance(tiles, groups)
    let draws = 0
    for (let tile = 0; tile <= RED; tile++) {
      if (remaining[tile] > 0 && distance([...tiles, tile], groups) < steps) draws += remaining[tile]
    }
    return {steps, draws}
  }
  const compare = (a, b) => b.steps - a.steps || a.draws - b.draws
  const without = (tiles, tile, count = 1) => {
    const next = tiles.slice()
    take(next, tile, count)
    return next
  }
  const groups = melds[seat].length
  const pass = moves.find(move => move.type === 'pass')
  let bestMove = pass
  let best = pass ? rate(hand, groups) : null
  for (const move of moves) {
    const {type, tile} = move
    if (type !== 'discard') continue
    const value = rate(without(hand, tile), groups)
    if (!best || compare(value, best) > 0 || (compare(value, best) === 0 && bestMove.tile === RED)) {
      bestMove = move
      best = value
    }
  }
  for (const move of moves) {
    const {type, tile} = move
    if (type === 'pong') {
      const next = without(hand, tile, 2)
      for (const discard of new Set(next)) {
        const value = rate(without(next, discard), groups + 1)
        if (compare(value, best) > 0) {
          best = value
          bestMove = move
        }
      }
    }
    if (type === 'closedKong' || type === 'addedKong' || type === 'openKong') {
      const count = type === 'closedKong' ? 4 : type === 'openKong' ? 3 : 1
      // The replacement draw has the same unknown distribution as a regular draw.
      // Break an equal-efficiency tie in favor of the kong's immediate points.
      const value = rate(without(hand, tile, count), groups + Number(type !== 'addedKong'))
      if (compare(value, best) >= 0) {
        best = value
        bestMove = move
      }
    }
  }
  return bestMove
}

export function advance(match, time = now(), paced = false) {
  const version = match.version
  while (match.phase !== 'ended') {
    let moved = false
    for (let seat = 0; seat < 4; seat++) {
      const moves = legalMoves(match, seat)
      if (!moves.length) continue
      const bot = match.players[seat].bot
      if (bot && paced && time < (match.botAt ?? 0)) continue
      if (!bot && time < match.deadline) continue
      const move = bot ? robotMove({hand: match.hands[seat], melds: match.melds, discards: match.discards, seat}, moves) :
        moves.find(option => option.type === 'pass') ??
        moves.find(option => option.type === 'discard' && option.tile === match.drawn) ??
        moves.find(option => option.type === 'discard')
      moved = play(match, seat, move)
      if (moved) break
    }
    if (!moved || paced) break
  }
  return version !== match.version
}

export function tableView(match, playerId) {
  const seat = match.players.findIndex(player => player.id === playerId)
  if (seat < 0) return null
  const {id, version, dealer, turn, phase, scores, winner, discards, lastDiscard, deadline} = match
  return {
    id, version, seat, dealer, turn, phase, scores, winner, discards, lastDiscard, deadline,
    round: match.round ?? 1, totals: scores.map((score, index) => (match.totals?.[index] ?? 0) + score),
    settlement: phase === 'ended' ? match.settlement : undefined,
    players: match.players.map((player, index) => ({name: player.name, bot: player.bot, count: match.hands[index].length})),
    melds: match.melds.map((melds, index) => melds.map(meld => ({
      ...meld, tile: meld.type === 'closedKong' && index !== seat && !(phase === 'ended' && winner === index) ? null : meld.tile
    }))),
    remaining: match.wall.length,
    hand: match.hands[seat], events: match.events ?? [],
    drawn: phase === 'turn' && turn === seat ? match.drawn : null,
    drawVersion: phase === 'turn' && turn === seat ? match.drawVersion ?? version : null,
    moves: legalMoves(match, seat),
    winningHand: phase === 'ended' && winner !== null ? match.hands[winner] : null
  }
}
