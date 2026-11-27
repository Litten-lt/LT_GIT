import {beats, classify, points, rankOf, ranks, redAces, suitOf, suits, suggestedPlays} from './hongjian-rules.js'

const element = id => document.getElementById(id)
const room = new URLSearchParams(location.search).get('room')
const endpoint = './api/chess/rooms/' + encodeURIComponent(room ?? '')
const signed = number => number > 0 ? '+' + number : String(number)
const cardName = card => suits[suitOf(card)] + ranks[rankOf(card)]
let view
let selected = new Set()
let submitting = false
let polling = false
let requestVersion = 0
let hintIndex = 0
let hints

function node(tag, content, className) {
  const item = document.createElement(tag)
  if (content !== undefined) item.textContent = content
  if (className) item.className = className
  return item
}

function cardElement(card, interactive = false) {
  const item = node(interactive ? 'button' : 'span', undefined, 'card')
  item.classList.toggle('red', suitOf(card) < 2)
  item.setAttribute('aria-label', cardName(card))
  item.append(node('span', ranks[rankOf(card)]), node('span', suits[suitOf(card)]))
  if (interactive) {
    item.type = 'button'
    item.dataset.card = card
    item.onclick = () => {
      if (selected.has(card)) selected.delete(card)
      else selected.add(card)
      renderSelection()
    }
  }
  return item
}

function seatElement(seat) {
  const player = view.players[seat]
  const place = view.finished.indexOf(seat)
  const label = place === 0 ? '上游' : place > 0 ? '第 ' + (place + 1) + ' 位出完' : player.remaining + ' 张'
  const item = node('div', undefined, 'seat')
  item.classList.toggle('active', view.turn === seat)
  const avatar = node('div', undefined, 'seat-avatar')
  avatar.append(node('span', Array.from(player.name)[0] || '•', 'avatar-initial'))
  const shown = redAces.filter(card => view.history.some(move => move.seat === seat && move.cards?.includes(card)))
  if (shown.length) avatar.append(node('span', '红A ' + shown.map(card => suits[suitOf(card)]).join(''), 'red-ace'))
  const details = node('div', undefined, 'seat-details')
  details.append(node('strong', player.name + (seat === view.self ? ' · 你' : '')),
    node('small', label + ' · 抓 ' + player.captured + ' · 累计 ' + signed(player.total)))
  item.append(avatar, details)
  return item
}

function renderSelection() {
  const cards = [...selected]
  const shape = classify(cards)
  const myTurn = view?.phase === 'playing' && view.turn === view.self
  for (const button of element('hand').children) {
    button.setAttribute('aria-pressed', selected.has(Number(button.dataset.card)))
    button.disabled = submitting || view.phase === 'ended'
  }
  const value = cards.reduce((total, card) => total + points(card), 0)
  element('selection').textContent = cards.length ?
    (shape?.name ?? '无法组成牌型') + (value ? ' · 含 ' + value + ' 分' : '') : ''
  element('hint').disabled = submitting || !myTurn
  element('pass').disabled = submitting || !myTurn || !view?.trick
  element('play').disabled = submitting || !myTurn || !beats(shape, view?.trick?.shape)
  element('next').disabled = submitting
}

function render() {
  element('opponents').replaceChildren(...[1, 2, 3].map(offset => seatElement((view.self + offset) % 4)))
  element('self').replaceChildren(seatElement(view.self))
  const trick = view.trick
  const tray = element('trick-cards')
  tray.hidden = !trick
  if (trick) {
    const group = node('div', undefined, 'trick-play')
    const cards = node('div', undefined, 'cards')
    cards.append(...trick.cards.map(card => cardElement(card)))
    group.append(node('small', view.players[trick.seat].name + ' · ' + trick.shape.name), cards)
    tray.replaceChildren(group)
  } else {
    tray.replaceChildren()
  }
  element('trick-points').hidden = view.phase === 'ended'
  element('trick-points').textContent = trick ? '本轮 ' + trick.points + ' 分' : '等待领出'
  element('hand').hidden = view.phase === 'ended' || !view.hand.length
  element('hand').replaceChildren(...(view.phase === 'playing' ? view.hand : []).map(card => cardElement(card, true)))
  element('status').textContent = view.phase === 'ended' ?
    (view.isOwner ? '本局已结束' : '等待房主开启下一局') :
    (view.turn === view.self ? '轮到你' : '轮到 ' + view.players[view.turn].name) +
      (view.finalResponse ? ' · 最后一次压牌' : view.redFinished ? ' · 本轮收分后结算' : '')
  element('next').hidden = view.phase !== 'ended' || !view.isOwner
  for (const id of ['hint', 'pass', 'play']) element(id).hidden = view.phase === 'ended'
  const panel = element('result')
  panel.hidden = !view.result
  if (view.result) {
    const {raw, scores, winner, teams, delta, solo} = view.result
    const list = node('ul')
    view.players.forEach((player, index) => {
      list.append(node('li', player.name + ' · ' + (teams[index] ? '对手方' : '红 A 方') +
        ' · 本局 ' + signed(delta[index]) + ' · 累计 ' + signed(player.total)))
    })
    panel.replaceChildren(node('h2', (winner === 0 ? '红 A 方' : '对手方') + '获胜'),
      node('p', solo ? '双红 A 独打拿到上游，其余三人各付 ' + raw[0] + ' 分' :
        '红 A 方对对手方 · 抓分 ' + raw.join(' : ') + ' · 上游转分后 ' + scores.join(' : ')), list)
  }
  renderSelection()
}

async function request(path, body) {
  const options = body === undefined ? {} : {
    method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(body)
  }
  const response = await fetch(endpoint + path, {...options, signal: AbortSignal.timeout(8000)})
  const data = await response.json()
  if (!response.ok) throw new Error(data.error || '牌桌暂时无法连接')
  return data
}

async function sync(path = '/match', body) {
  const write = body !== undefined
  if (!room || submitting || (!write && polling)) return
  const version = ++requestVersion
  if (write) {
    submitting = true
    renderSelection()
  } else {
    polling = true
  }
  try {
    const next = await request(path, body)
    if (version !== requestVersion) return
    if (!Array.isArray(next.hand)) throw new Error('请从棋牌室进入红尖牌桌')
    if (!view || view.id !== next.id || view.version !== next.version || view.isOwner !== next.isOwner) {
      if (view?.id !== next.id || body?.move) selected.clear()
      selected = new Set([...selected].filter(card => next.hand.includes(card)))
      hints = undefined
      hintIndex = 0
      view = next
      render()
    } else if (element('status').dataset.error) {
      render()
    }
    delete element('status').dataset.error
  } catch (error) {
    if (version !== requestVersion) return
    element('status').textContent = error.name === 'TimeoutError' ? '连接超时，正在重试' : error.message
    element('status').dataset.error = '1'
  } finally {
    if (write) {
      submitting = false
      renderSelection()
    } else {
      polling = false
    }
  }
}

element('hint').onclick = () => {
  hints ??= suggestedPlays(view.hand, view.trick?.shape)
  if (!hints.length) {
    element('selection').textContent = '没有可以压过的牌'
    return
  }
  selected = new Set(hints[hintIndex++ % hints.length].cards)
  renderSelection()
}
const move = action => sync('/match', {id: view.id, version: view.version, move: action})
element('play').onclick = () => move({type: 'play', cards: [...selected]})
element('pass').onclick = () => move({type: 'pass'})
element('next').onclick = () => sync('/start', {})
if (room) {
  await sync()
  setInterval(() => sync(), 1000)
} else {
  element('status').textContent = '请先在棋牌室创建或加入红尖房间'
}
