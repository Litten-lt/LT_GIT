import test from 'node:test'
import assert from 'node:assert/strict'
import {advance, newMatch, play, robotMove, tableView} from '../src/hongjian.js'
import {beats, classify} from '../public/hongjian-rules.js'

const members = Array.from({length: 4}, (_, index) => ({id: String(index), name: String(index), bot: true}))

test('Hongjian recognizes bomb tiers, sequence limits and both triple-with-two forms', () => {
  const shapes = [
    [2, 20, 36], [2, 7, 10], [2, 15, 28, 41], [0, 1, 2, 3, 4],
    [0, 13, 1, 14, 2, 15, 3, 16], [11, 24]
  ].map(classify)
  for (let index = 1; index < shapes.length; index++) assert.ok(beats(shapes[index], shapes[index - 1]))
  assert.equal(beats(shapes[0], shapes[0]), false)
  assert.equal(classify([7, 8, 9, 10, 11]).name, '金顺')
  assert.equal(classify([8, 9, 10, 11, 12]), null)
  assert.equal(classify([0, 13, 1, 14, 2, 15, 3, 16, 4, 17]).name, '连对')
  assert.ok(beats(classify([4, 17, 30, 1, 8]), classify([3, 16, 29, 10, 23])))
})

function lateGame(hands, captured, finished, history, turn) {
  const match = newMatch(members)
  match.players.forEach((player, seat) => {
    player.hand = hands[seat]
    player.captured = captured[seat]
  })
  Object.assign(match, {finished, history, turn})
  return match
}

test('last player gets one response, unplayed points are void and the next round inherits totals', () => {
  const match = lateGame([[], [], [2], [10, 7]], [20, 30, 15, 10], [0, 1],
    [{seat: 0, cards: [11]}, {seat: 1, cards: [24]}], 2)
  assert.ok(play(match, 2, {type: 'play', cards: [2]}))
  assert.equal(match.finalResponse, true)
  assert.ok(play(match, 3, {type: 'play', cards: [10]}))
  assert.deepEqual(match.result.raw, [50, 40])
  assert.deepEqual(match.result.scores, [70, 20])
  assert.deepEqual(match.result.delta, [50, 50, -50, -50])
  assert.equal(play(match, 3, {type: 'play', cards: [7]}), false)
  const next = newMatch(members, match, 0)
  assert.equal(next.round, 2)
  assert.equal(next.turn, 0)
  assert.deepEqual(next.players.map(player => player.total), [50, 50, -50, -50])
})

test('solo head player receives the captured amount from each opponent', () => {
  const match = lateGame([[11, 24], [2], [3], [4]], [15, 0, 0, 0], [], [], 0)
  assert.ok(play(match, 0, {type: 'play', cards: [11, 24]}))
  for (const seat of [1, 2, 3]) assert.ok(play(match, seat, {type: 'pass'}))
  assert.equal(match.result.solo, true)
  assert.deepEqual(match.result.delta, [45, -15, -15, -15])
})

test('robot games finish with valid results, hidden hands and zero-sum totals', () => {
  for (let game = 0; game < 12; game++) {
    const match = newMatch(members)
    const cards = match.players.flatMap(player => player.hand)
    assert.equal(new Set(cards).size, 52)
    assert.ok(match.players[match.turn].hand.includes(39))
    while (match.phase === 'playing') {
      assert.ok(match.version < 250)
      const view = tableView(match, '0')
      assert.equal(view.result, undefined)
      assert.ok(view.players.every(player => !('hand' in player)))
      assert.ok(advance(match, match.deadline))
    }
    assert.equal(match.result.delta.reduce((total, points) => total + points), 0)
  }
})

test('a solo player without head pays the transfer and settles the margin with each opponent', () => {
  const match = lateGame([[], [], [5], [4, 8]], [30, 20, 10, 30], [1, 2],
    [{seat: 0, cards: [11, 24]}], 2)
  assert.ok(play(match, 2, {type: 'play', cards: [5]}))
  assert.ok(play(match, 3, {type: 'pass'}))
  assert.deepEqual(match.result.scores, [10, 80])
  assert.deepEqual(match.result.delta, [-210, 70, 70, 70])
})

test('table exposes every play of the current trick and resets its start after collection', () => {
  const match = lateGame([[0, 1], [3, 4], [5, 6], [7, 8]], [0, 0, 0, 0], [], [], 0)
  assert.ok(play(match, 0, {type: 'play', cards: [0]}))
  assert.ok(play(match, 1, {type: 'play', cards: [3]}))
  let view = tableView(match, '0')
  assert.deepEqual(view.history.slice(view.trick.start).map(move => move.cards), [[0], [3]])
  for (const seat of [2, 3, 0]) assert.ok(play(match, seat, {type: 'pass'}))
  assert.equal(tableView(match, '0').trick, null)
  assert.ok(play(match, 1, {type: 'play', cards: [4]}))
  view = tableView(match, '0')
  assert.deepEqual(view.history.slice(view.trick.start).map(move => move.cards), [[4]])
})


test('a red ace holder going out ends the game after the remaining responses', () => {
  const match = lateGame([[11], [24, 3], [12, 7], [10, 6]], [0, 0, 0, 0], [], [], 0)
  assert.ok(play(match, 0, {type: 'play', cards: [11]}))
  assert.equal(tableView(match, '1').redFinished, true)
  assert.ok(play(match, 1, {type: 'pass'}))
  assert.ok(play(match, 2, {type: 'play', cards: [12]}))
  assert.ok(play(match, 3, {type: 'pass'}))
  assert.ok(play(match, 1, {type: 'pass'}))
  assert.equal(match.phase, 'ended')
  assert.equal(match.result.solo, false)
  assert.deepEqual(match.result.teams, [0, 0, 1, 1])
  assert.deepEqual(match.result.raw, [0, 0])
})

test('a bot conserves a bomb at low stakes, contests a large pot and respects a known ally', () => {
  const hand = [0, 13, 26, 39, 24, 1, 4]
  const match = lateGame([hand, [5, 6, 7, 8], [9, 10, 11, 14], [15, 16, 17, 18]],
    [0, 0, 0, 0], [], [], 0)
  const cards = [12, 25]
  match.trick = {seat: 1, cards, shape: classify(cards), points: 0}
  assert.equal(robotMove(match, 0).type, 'pass')
  match.trick.points = 45
  assert.equal(classify(robotMove(match, 0).cards).name, '四张')
  match.history.push({seat: 1, cards: [11]})
  assert.equal(robotMove(match, 0).type, 'pass')
})


test('bots prefer small opening leads and hold back multiple twos on a scoreless response', () => {
  const match = lateGame([[0, 9, 12, 25, 38, 14, 18], [2, 6, 20], [7, 23, 26], [8, 10, 39]],
    [0, 0, 0, 0], [], [], 0)
  assert.deepEqual(robotMove(match, 0), {type: 'play', cards: [0]})
  const cards = [3, 16, 29, 4, 5]
  match.trick = {seat: 1, cards, shape: classify(cards), points: 0}
  assert.equal(robotMove(match, 0).type, 'pass')
  match.trick.points = 40
  assert.equal(classify(robotMove(match, 0).cards).value, 12)
})

test('a bot can spend a high single to take the lead for its remaining straight', () => {
  const match = lateGame([[0, 14, 28, 42, 4, 12], [7, 8, 20, 23], [6, 9, 26, 27], [10, 11, 39, 40]],
    [0, 0, 0, 0], [], [], 0)
  const cards = [16]
  match.trick = {seat: 1, cards, shape: classify(cards), points: 0}
  assert.deepEqual(robotMove(match, 0), {type: 'play', cards: [12]})
})
