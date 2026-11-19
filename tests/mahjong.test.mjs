import test from 'node:test'
import assert from 'node:assert/strict'
import {advance, BOT_DELAY, canWin, legalMoves, newMatch, play, tableView, tileSet, RED} from '../src/mahjong.js'

const humans = Array.from({length: 4}, (_, id) => ({id, name: String(id), bot: false}))
const move = (match, seat, type, tile) => assert.ok(play(match, seat, {type, tile}))

test('Guangdong wall has 112 tiles; standard wins, seven pairs and wildcard groups are recognized', () => {
  assert.deepEqual([...new Set(tileSet())], Array.from({length: 28}, (_, index) => index))
  for (let tile = 0; tile < 28; tile++) assert.equal(tileSet().filter(value => value === tile).length, 4)
  assert.ok(canWin([0,1,2, 3,4,5, 9,10,11, 18,18,18, 24,24]))
  assert.ok(canWin([0,1,RED, 3,4,5, 9,10,11, 18,18,RED, 24,24]))
  assert.ok(canWin([0,0, 2,2, 4,4, 8,8, 11,11, 16,16, 24,RED]))
  assert.ok(canWin([0,1,2, 3,4,5, 9,10,11, 18,18],1))
  assert.equal(canWin([0,1,3,5,7,9,11,13,15,17,19,21,23,25]),false)
  assert.equal(canWin([7,8,9, 0,0,0, 12,12,12, 18,18,18, 24,24]),false)
})

test('a discard opens a claim instead of allowing an out-of-turn discard; kong draws from the tail', () => {
  const match = newMatch(humans, tileSet(), 0)
  match.hands = [[0,1,2], [0,0,0,3], [4,5], [6,7]]
  match.wall = [8,9]
  move(match,0,'discard',0)
  assert.equal(match.phase,'claim')
  assert.deepEqual(legalMoves(match,2),[])
  assert.equal(play(match,2,{type:'discard',tile:4}),false)
  move(match,1,'openKong',0)
  assert.equal(match.turn,1)
  assert.equal(match.drawn,9)
  assert.deepEqual(match.discards[0],[])
  assert.deepEqual(match.scores,[-1,1,0,0])
})

test('pong transfers the turn, added and closed kongs draw a tile, red cannot be claimed', () => {
  const match = newMatch(humans, tileSet(), 0)
  match.hands = [[0,RED], [0,0,1], [RED,RED,2], [3]]
  match.wall = [0,8,9,10]
  move(match,0,'discard',0)
  move(match,1,'pong',0)
  assert.equal(match.drawn,null)
  move(match,1,'discard',1)
  move(match,2,'discard',RED)
  assert.equal(match.phase,'turn')
  assert.equal(match.turn,3)
  match.turn = 1
  match.drawn = 0
  match.hands[1] = [0,5,5,5,5]
  move(match,1,'addedKong',0)
  move(match,1,'closedKong',5)
  assert.deepEqual(match.melds[1].map(meld=>meld.type),['addedKong','closedKong'])
  assert.equal(tableView(match,0).melds[1][1].tile,null)
  assert.equal(tableView(match,1).melds[1][1].tile,5)
  assert.deepEqual(match.scores,[-2,6,-2,-2])
})

test('self-draw settles once; an exhausted wall settles as a draw', () => {
  const match = newMatch(humans, tileSet(), 0)
  match.hands[0] = [0,1,2,3,4,5,9,10,11,18,18,18,24,24]
  move(match,0,'win')
  assert.deepEqual(match.scores,[6,-2,-2,-2])
  assert.equal(play(match,0,{type:'win'}),false)
  const draw = newMatch(humans, tileSet(), 0)
  draw.wall = []
  move(draw,0,'discard',draw.drawn)
  if (draw.phase === 'claim') advance(draw, draw.deadline)
  assert.equal(draw.winner,null)
  assert.deepEqual(draw.scores,[0,0,0,0])
})

test('a human and three robots finish full seeded games with all tiles accounted for', () => {
  const players = humans.map(player => ({...player, bot: player.id !== 0}))
  for (let attempt = 0; attempt < 24; attempt++) {
    let seed = attempt + 1
    const wall = tileSet()
    for (let index = wall.length - 1; index > 0; index--) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
      const other = seed % (index + 1)
      ;[wall[index], wall[other]] = [wall[other], wall[index]]
    }
    const match = newMatch(players, wall, attempt % 4)
    advance(match)
    for (let turn = 0; match.phase !== 'ended' && turn < 120; turn++) {
      const view = tableView(match,0)
      assert.equal(view.wall,undefined)
      assert.equal(view.hands,undefined)
      assert.ok(view.moves.length)
      const choice = view.moves.find(option=>option.type==='win') ?? view.moves[0]
      assert.ok(play(match,0,choice))
      advance(match)
      const meldTiles = match.melds.flat().flatMap(meld=>Array(meld.type==='pong'?3:4).fill(meld.tile))
      assert.deepEqual([...match.wall,...match.hands.flat(),...match.discards.flat(),...meldTiles].sort((a,b)=>a-b),tileSet())
    }
    assert.equal(match.phase,'ended')
    assert.equal(match.scores.reduce((a,b)=>a+b),0)
  }
})

test('robot actions are paced, visible in order and stop for a human claim', () => {
  const players=humans.map(player=>({...player,bot:player.id!==0}))
  const match=newMatch(players,tileSet(),1)
  match.hands=[[5,5],[5,RED],[7],[8]]
  match.wall=[9,10]
  match.botAt=10000
  assert.equal(advance(match,9999,true),false)
  assert.equal(advance(match,10000,true),true)
  assert.deepEqual(match.events,[{seq:1,type:'discard',seat:1,tile:5}])
  assert.equal(match.phase,'claim')
  assert.equal(advance(match,match.deadline-1,true),false)
  move(match,0,'pong',5)
  assert.deepEqual(match.events[1],{seq:2,type:'pong',seat:0,tile:5})
  assert.equal(advance(match,match.botAt+BOT_DELAY,true),false)
  assert.equal(match.turn,0)
})
