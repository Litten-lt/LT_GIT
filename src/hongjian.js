import {randomInt, randomUUID} from 'node:crypto'
import {beats, classify, points, rankOf, redAces, suggestedPlays} from '../public/hongjian-rules.js'

const BOT_DELAY = 850
const nextSeat = (match, seat) => {
  for (let offset = 1; offset <= 4; offset++) {
    const next = (seat + offset) % 4
    if (match.players[next].hand.length) return next
  }
  return null
}
const sumPoints = cards => cards.reduce((total, card) => total + points(card), 0)
const playedRedAces = (match, seat) => redAces.filter(card =>
  match.history.some(move => move.seat === seat && move.cards?.includes(card)))

export function newMatch(members, previous, time = Date.now()) {
  const deck = Array.from({length: 52}, (_, index) => index)
  for (let index = deck.length - 1; index > 0; index--) {
    const swap = randomInt(index + 1)
    ;[deck[index], deck[swap]] = [deck[swap], deck[index]]
  }
  const continuing = previous?.phase === 'ended' &&
    members.every(member => previous.players.some(player => player.id === member.id))
  const players = members.map((member, seat) => ({
    ...member, hand: deck.slice(seat * 13, seat * 13 + 13).sort((a, b) => rankOf(a) - rankOf(b) || a - b),
    captured: 0,
    total: continuing ? previous.players.find(player => player.id === member.id).total : 0
  }))
  const match = {
    id: randomUUID(), version: 0, phase: 'playing', round: continuing ? previous.round + 1 : 1,
    players, finished: [], history: [], trick: null, finalResponse: false
  }
  const lastLeader = continuing ? previous.players[previous.finished[0]].id : null
  setTurn(match, lastLeader ? players.findIndex(player => player.id === lastLeader) :
    players.findIndex(player => player.hand.includes(39)), time)
  return match
}

function setTurn(match, turn, time) {
  match.turn = turn
  match.deadline = match.players[turn]?.bot ? time + BOT_DELAY : null
}

function settle(match, solo) {
  const redTeam = match.players.map((_, seat) => seat).filter(seat =>
    redAces.some(card => match.history.some(move => move.seat === seat && move.cards?.includes(card)) ||
      match.players[seat].hand.includes(card)))
  const leader = match.finished[0]
  const leaderTeam = Number(!redTeam.includes(leader))
  const teams = match.players.map((_, seat) => Number(!redTeam.includes(seat)))
  const raw = [0, 0]
  match.players.forEach((player, seat) => { raw[teams[seat]] += player.captured })
  const scores = [...raw]
  if (!solo) {
    scores[leaderTeam] += 20
    scores[1 - leaderTeam] -= 20
  }
  const winner = scores[0] === scores[1] ? leaderTeam : Number(scores[1] > scores[0])
  const difference = solo ? raw[0] : Math.abs(scores[0] - scores[1])
  const delta = teams.map(team => {
    const stake = redTeam.length === 1 && team === 0 ? difference * 3 : difference
    return stake === 0 || team === winner ? stake : -stake
  })
  match.players.forEach((player, seat) => { player.total += delta[seat] })
  match.result = {teams, raw, scores, winner, difference, delta, solo, leaderTeam}
  match.phase = 'ended'
  setTurn(match, null)
}

function closeTrick(match, time, end = false) {
  const {seat, points: earned} = match.trick
  match.players[seat].captured += earned
  match.trick = null
  if (match.redFinished || match.soloWin || end) {
    settle(match, Boolean(match.soloWin))
  } else {
    setTurn(match, match.players[seat].hand.length ? seat : nextSeat(match, seat), time)
  }
}

export function play(match, seat, move, time = Date.now()) {
  if (match.phase !== 'playing' || seat !== match.turn) return false
  const player = match.players[seat]
  if (move?.type === 'pass') {
    if (!match.trick) return false
    match.history.push({seat})
    match.trick.waiting = match.trick.waiting.filter(other => other !== seat)
    if (!match.trick.waiting.length) closeTrick(match, time, match.finalResponse)
    else setTurn(match, nextSeat(match, seat), time)
  } else if (move?.type === 'play') {
    const cards = move.cards
    const shape = classify(cards)
    if (!beats(shape, match.trick?.shape) || !cards.every(card => player.hand.includes(card))) return false
    const finalResponse = match.finalResponse
    player.hand = player.hand.filter(card => !cards.includes(card))
    const start = match.trick?.start ?? match.history.length
    match.history.push({seat, cards, shape: shape.name})
    if (!player.hand.length) {
      match.finished.push(seat)
      const redCount = playedRedAces(match, seat).length
      if (redCount) match.redFinished = true
      if (redCount === 2 && match.finished.length === 1) match.soloWin = true
    }
    match.trick = {
      start, seat, cards, shape, points: (match.trick?.points ?? 0) + sumPoints(cards),
      waiting: match.players.flatMap((other, index) => other.hand.length && index !== seat ? [index] : [])
    }
    if (finalResponse || !match.trick.waiting.length) closeTrick(match, time, finalResponse)
    else {
      match.finalResponse = match.finished.length === 3
      setTurn(match, nextSeat(match, seat), time)
    }
  } else {
    return false
  }
  match.version++
  return true
}

function knownAllies(match, seat) {
  const ownRed = redAces.filter(card => match.players[seat].hand.includes(card) ||
    playedRedAces(match, seat).includes(card))
  if (ownRed.length === 2) return new Set()
  const owners = redAces.map(card => ownRed.includes(card) ? seat :
    match.history.find(move => move.cards?.includes(card))?.seat)
  if (owners.includes(undefined)) return new Set()
  return new Set(match.players.flatMap((_, other) =>
    other !== seat && owners.includes(other) === owners.includes(seat) ? [other] : []))
}

function opponentRisk(shape, rivals, unseen) {
  if (!rivals.length || shape.power === 6) return 0
  const largestHand = Math.max(...rivals.map(player => player.hand.length))
  const threatByPower = [0, .08, .13, .16, .14, .08, .05]
  const minimumCards = [0, 3, 3, 4, 5, 8, 2]
  let risk = threatByPower.reduce((total, chance, power) =>
    power > shape.power && largestHand >= minimumCards[power] ? total + chance : total, 0)
  if (shape.power === 1) return risk
  if (shape.power) {
    return Math.min(.85, risk + (largestHand >= shape.length ? (6 - shape.power) * .035 : 0))
  }
  if (largestHand < shape.length) return risk
  const copies = shape.name === '单张' ? 1 : shape.name === '对子' ? 2 : 3
  const higher = unseen.slice(shape.value + 1).filter(count => count >= copies).length
  const ordinary = ['顺子', '连对'].includes(shape.name)
    ? (11 - shape.value) * .035 : higher * (copies === 1 ? .12 : copies === 2 ? .065 : .04)
  return Math.min(.93, risk * .55 + ordinary * Math.min(1, largestHand / 7))
}

export function robotMove(match, seat) {
  const {hand} = match.players[seat]
  const {trick} = match
  const options = suggestedPlays(hand, trick?.shape)
  if (!options.length) return {type: 'pass'}
  const allies = knownAllies(match, seat)
  const rivals = match.players.filter((player, other) => other !== seat &&
    player.hand.length && !allies.has(other))
  const seen = new Set([...hand, ...match.history.flatMap(move => move.cards ?? [])])
  const unseen = Array(13).fill(0)
  for (let card = 0; card < 52; card++) {
    if (!seen.has(card)) unseen[rankOf(card)]++
  }
  const pot = trick?.points ?? 0
  const opening = match.finished.length === 0 && seen.size - hand.length < 13
  const plannedLeads = (trick ? suggestedPlays(hand) : options)
    .filter(({cards, shape}) => cards.length >= 5 && !shape.power)
    .sort((a, b) => b.cards.length - a.cards.length)
  const twos = hand.filter(card => rankOf(card) === 12).length
  const allyLeading = allies.has(trick?.seat)
  const endPressure = match.redFinished || match.finalResponse ||
    rivals.some(player => player.hand.length <= 2)
  const wholeRankBombs = unseen.flatMap((_, rank) =>
    hand.filter(card => rankOf(card) === rank).length === 4 ? [rank] : [])
  const hasSkyBomb = redAces.every(card => hand.includes(card))
  const ownRed = hand.some(card => redAces.includes(card)) || playedRedAces(match, seat).length > 0
  let bestScore = trick ? 0 : -Infinity
  let best
  for (const {cards, shape} of options) {
    const risk = opponentRisk(shape, rivals, unseen)
    const exposed = sumPoints(cards)
    const finishing = cards.length === hand.length
    const bombCost = shape.power ? 8 + shape.power * 3 : 0
    const splitsBomb = !finishing && (
      (hasSkyBomb && cards.some(card => redAces.includes(card)) && shape.power !== 6) ||
      (shape.power !== 3 && cards.some(card => wholeRankBombs.includes(rankOf(card))))
    )
    const savingPartner = allyLeading ? 12 + pot * .25 : 0
    const potentialFeed = !trick && !shape.power && shape.value <= 7 &&
      [...allies].some(ally => match.players[ally].hand.length === cards.length)
    const capture = allyLeading ? 0 : pot * (1 - risk)
    const securePoints = exposed * ((endPressure ? .65 : .32) - 1.65 * risk)
    const tempo = cards.length * 1.45 + (1 - risk) * (endPressure ? 10 : 3)
    const nextLead = trick && !endPressure && !finishing
      ? plannedLeads.find(lead => lead.cards.every(card => !cards.includes(card)))
      : null
    const leadValue = nextLead ? (nextLead.cards.length + 3) * (1 - risk) : 0
    const highCards = cards.filter(card => rankOf(card) >= 11).length
    const usedTwos = cards.filter(card => rankOf(card) === 12).length
    // Each unspent two is another chance to take control of a singles trick.
    const controlCost = finishing ? 0 : (highCards - usedTwos) * (opening ? 2.5 : 1.2) +
      usedTwos * (endPressure ? 1.5 : 3.5) +
      (twos >= 2 && usedTwos >= 2 && !endPressure ? (usedTwos - 1) * 5 : 0)
    const openingPreference = opening && !trick && !finishing && !shape.power
      ? (12 - shape.value) * .6 : 0
    const finish = finishing ? (!match.finished.length ? 42 : ownRed ? 18 : 13) : 0
    const score = capture + securePoints + tempo + finish + leadValue + openingPreference +
      (potentialFeed ? 6 : 0) - controlCost -
      savingPartner - (splitsBomb ? 7 : 0) - bombCost * (endPressure || finishing ? .35 : 1) -
      risk * (exposed ? 5 : 1) - (trick && !endPressure ? 4 : 0)
    if (score > bestScore) {
      bestScore = score
      best = cards
    }
  }
  return best ? {type: 'play', cards: best} : {type: 'pass'}
}

export function advance(match, time) {
  if (match.phase !== 'playing' || match.deadline === null || time < match.deadline) return false
  return play(match, match.turn, robotMove(match, match.turn), time)
}

export function tableView(match, playerId) {
  const self = match.players.findIndex(player => player.id === playerId)
  if (self === -1) return null
  const {id, version, phase, round, turn, finished, history, result, finalResponse, redFinished, trick} = match
  return {
    id, version, phase, round, turn, finished, history, result, finalResponse, redFinished, trick, self,
    hand: match.players[self].hand,
    players: match.players.map(({name, bot, hand, captured, total}) => ({
      name, bot, remaining: hand.length, captured, total
    }))
  }
}
