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

export function newMatch(players, wall = shuffle(tileSet()), dealer = randomInt(4)) {
  wall = wall.slice()
  const match = {
    id: randomUUID(), version: 0, rule: 'gd-red-1', players, dealer, turn: dealer, wall,
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
    for (let seat = 0; seat < 4; seat++) match.scores[seat] += seat === winner ? 6 : -2
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
  if (canWin(hand, match.melds[seat].length)) moves.push({type: 'win'})
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

function robotMove(hand, moves) {
  for (const type of ['win', 'closedKong', 'addedKong', 'openKong', 'pong']) {
    const move = moves.find(option => option.type === type)
    if (move) return move
  }
  const score = tile => {
    if (tile === RED) return 100
    const suit = Math.floor(tile / 9)
    return amount(hand, tile) * 4 + hand.filter(other => Math.floor(other / 9) === suit && Math.abs(other - tile) === 1).length
  }
  return moves.find(move => move.type === 'pass') ?? moves.reduce((best, move) => score(move.tile) < score(best.tile) ? move : best)
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
      const move = bot ? robotMove(match.hands[seat], moves) :
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
    players: match.players.map((player, index) => ({name: player.name, bot: player.bot, count: match.hands[index].length})),
    melds: match.melds.map((melds, index) => melds.map(meld => ({
      ...meld, tile: meld.type === 'closedKong' && index !== seat ? null : meld.tile
    }))),
    remaining: match.wall.length,
    hand: match.hands[seat], events: match.events ?? [],
    drawn: phase === 'turn' && turn === seat ? match.drawn : null,
    drawVersion: phase === 'turn' && turn === seat ? match.drawVersion ?? version : null,
    moves: legalMoves(match, seat),
    winningHand: phase === 'ended' && winner !== null ? match.hands[winner] : null
  }
}
