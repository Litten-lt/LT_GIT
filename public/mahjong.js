const get = id => document.getElementById(id)
const room = new URLSearchParams(location.search).get('room')
const endpoint = './api/chess/rooms/' + encodeURIComponent(room || '') + '/match'
const svgNamespace = 'http://www.w3.org/2000/svg'
const numbers = '一二三四五六七八九'
const labels = {pong: '碰', openKong: '明杠', closedKong: '暗杠', addedKong: '补杠', win: '胡', pass: '过', fly: '飞红中'}
const positions = [
  [[0,0]], [[-.72,-1],[.72,1]], [[-.85,-1.25],[0,0],[.85,1.25]],
  [[-1,-1],[1,-1],[-1,1],[1,1]], [[-1,-1],[1,-1],[0,0],[-1,1],[1,1]],
  [[-1,-1.22],[1,-1.22],[-1,0],[1,0],[-1,1.22],[1,1.22]],
  [[-1.1,-1.42],[0,-.95],[1.1,-.48],[-1,.35],[1,.35],[-1,1.39],[1,1.39]],
  [[-1,-1.5],[1,-1.5],[-1,-.5],[1,-.5],[-1,.5],[1,.5],[-1,1.5],[1,1.5]],
  [[-1.32,-1.18],[0,-1.18],[1.32,-1.18],[-1.32,0],[0,0],[1.32,0],[-1.32,1.18],[0,1.18],[1.32,1.18]]
]
const bambooRows = {
  2: [' g ', ' g '], 3: [' r ', 'g g'], 4: ['g g', 'g g'],
  5: ['g g', ' r ', 'g g'], 6: ['ggg', 'ggg'],
  7: [' r ', 'ggg', 'ggg'],
  9: ['grg', 'grg', 'grg']
}
let state
let selected = null
let busy = false
let pendingPoll
let connectionError = false
let lastEvent = 0
let announcements = Promise.resolve()
let audioContext
let audioEnabled = false
let audioChain = Promise.resolve()
let activeVoice
const clips = new Map()

function node(tag, className, text) {
  const element = document.createElement(tag)
  element.className = className
  if (text !== undefined) element.textContent = text
  return element
}

function shape(svg, tag, attributes, text) {
  const element = document.createElementNS(svgNamespace, tag)
  for (const [name, value] of Object.entries(attributes)) element.setAttribute(name, value)
  if (text) element.textContent = text
  svg.append(element)
}

function face(value) {
  const svg = document.createElementNS(svgNamespace, 'svg')
  svg.setAttribute('viewBox', '0 0 30 44')
  svg.setAttribute('aria-hidden', 'true')
  const suit = Math.floor(value / 9), count = value % 9 + 1
  const red = '#ae2627', green = '#20604a', blue = '#174b64'
  const letter = (text, y, fill, size) => shape(svg, 'text', {x: 15, y, fill, 'font-size': size, 'text-anchor': 'middle', 'font-family': 'KaiTi, Kaiti SC, Songti SC, SimSun, serif', 'font-weight': 800}, text)
  if (value === 27) letter('中', 32, red, 29)
  else if (suit === 0) {
    letter(numbers[count - 1], 18, '#223126', 19)
    letter('萬', 39, red, 21)
  } else if (suit === 2 && count === 1) {
    shape(svg, 'path', {d: 'M2 39 Q12 35 27 37 M13 38 Q12 40 8 42 M21 37 Q24 40 27 40', stroke: '#77613b', fill: 'none', 'stroke-width': 1.2})
    shape(svg, 'path', {d: 'M3 34 11 24 C8 16 15 9 20 10 C24 9 26 12 26 14 L30 16 25 17 C24 24 19 28 14 29 L7 36Z', fill: green})
    shape(svg, 'path', {d: 'M14 25q-4-6 6-9-1 8-6 9m-1 4 2 8m4-10 2 9', stroke: '#a5ad6e', fill: 'none', 'stroke-width': 1.2})
    shape(svg, 'path', {d: 'M19 11q3-5 7-2l-1 4', fill: red})
    shape(svg, 'circle', {cx: 23, cy: 14, r: 1, fill: '#f7ead1'})
  } else if (suit === 2 && count === 8) {
    for (const d of ['M5 8v10l10-9 10 9V8', 'M5 36V26l10 9 10-9v10']) {
      shape(svg, 'path', {d,
        fill: 'none', stroke: green, 'stroke-width': 4.3, 'stroke-linecap': 'round', 'stroke-linejoin': 'round'})
      shape(svg, 'path', {d,
        fill: 'none', stroke: '#f7efd8', 'stroke-width': .8, 'stroke-linecap': 'round', 'stroke-linejoin': 'round'})
    }
  } else if (suit === 2) {
    const rows = bambooRows[count]
    const pitch = count === 5 ? 8.3 : rows.length === 3 ? 11.8 : 16
    const height = count === 5 || rows.length === 2 ? 13 : 9.6
    rows.forEach((row, index) => {
      const y = 22 + (index - (rows.length - 1) / 2) * pitch
      Array.from(row).forEach((ink, column) => {
        if (ink === ' ') return
        const x = 15 + (column - 1) * 8.5
        const d = 'M0 -5 Q2.3 -5 1.7 -2.6 Q1.2 -1.6 1.7 -.8 Q2.4 0 1.7 .8 Q1.2 1.6 1.7 2.6 Q2.3 5 0 5 Q-2.3 5 -1.7 2.6 Q-1.2 1.6 -1.7 .8 Q-2.4 0 -1.7 -.8 Q-1.2 -1.6 -1.7 -2.6 Q-2.3 -5 0 -5Z'
        shape(svg, 'path', {d, transform: `translate(${x} ${y}) scale(1 ${height / 10})`,
          fill: ink === 'r' ? red : green, stroke: ink === 'r' ? red : green, 'stroke-width': 1.1})
        shape(svg, 'path', {d: 'M0 -3.6V3.6', transform: `translate(${x} ${y}) scale(1 ${height / 10})`,
          stroke: '#fff7df', opacity: .5, 'stroke-width': .75, 'stroke-linecap': 'round'})
      })
    })
  } else if (suit === 1 && count === 1) {
    shape(svg, 'circle', {cx: 15, cy: 22, r: 12, stroke: green, fill: 'none', 'stroke-width': 1.6})
    for (let i = 0; i < 8; i++) {
      shape(svg, 'ellipse', {cx: 15, cy: 15.4, rx: 1.45, ry: 3.1, fill: green, transform: 'rotate(' + i * 45 + ' 15 22)'})
    }
    shape(svg, 'circle', {cx: 15, cy: 22, r: 3.2, fill: red})
  } else {
    for (const [column, row] of positions[count - 1]) {
      const x = 15 + column * 8.1
      const y = 22 + row * 10.1
      const color = (count === 3 || count === 5) && !column && !row ||
        count === 4 && row > 0 || count === 9 && row === 0 ? red : row > 0 ? blue : green
      const radius = count <= 3 ? 5.1 : 3.8
      shape(svg, 'circle', {cx: x, cy: y, r: radius, stroke: color, fill: 'none', 'stroke-width': 1.35})
      shape(svg, 'circle', {cx: x, cy: y, r: radius * .56, stroke: color, fill: 'none', 'stroke-width': .65})
      shape(svg, 'circle', {cx: x, cy: y, r: .85, fill: color})
    }
  }
  return svg
}

const tileName = tile => tile === 27 ? '红中' : (tile % 9 + 1) + ['万', '筒', '条'][Math.floor(tile / 9)]

function tile(value, className = '', action) {
  const element = node(action ? 'button' : 'span', 'tile ' + className)
  const name = value === null ? '暗牌' : tileName(value)
  element.title = name
  element.setAttribute('aria-label', name)
  if (value === null) element.classList.add('back')
  else element.append(face(value))
  if (action) element.onclick = action
  return element
}

function drawSeat(relative) {
  const seat = (state.seat + relative) % 4
  const player = state.players[seat]
  const section = node('section', 'seat seat-' + relative)
  const title = player.name + (relative === 0 ? ' · 你' : '') + (seat === state.dealer ? ' · 庄' : '')
  const acting = state.events.at(-1)?.seat === seat
  const identity = node('div', 'seat-identity')
  section.append(identity)
  identity.append(node('span', 'seat-title' + (state.turn === seat && state.phase !== 'ended' ? ' current' : '') + (acting ? ' acting' : ''), title))
  identity.append(node('p', 'score', state.totals[seat] + ' 分'))
  if (relative) {
    identity.append(node('span', 'hand-count', '手牌 ' + player.count + ' 张'))
    const backs = node('div', 'backs')
    backs.setAttribute('aria-label', player.count + ' 张手牌')
    for (let i = 0; i < player.count; i++) backs.append(node('i', ''))
    section.append(backs)
  }
  const melds = node('div', 'melds')
  for (const meld of state.melds[seat]) {
    const group = node('div', 'meld-group')
    group.setAttribute('aria-label', labels[meld.type])
    for (let index = 0; index < (meld.type === 'pong' ? 3 : 4); index++) group.append(tile(meld.tile))
    melds.append(group)
  }
  const discards = node('div', 'discards')
  const values = state.discards[seat]
  values.forEach((value, index) => {
    const latest = state.lastDiscard?.seat === seat && value === state.lastDiscard.tile && index === values.length - 1
    discards.append(tile(value, latest ? 'latest' : ''))
  })
  const visibleTiles = node('div', 'seat-tiles')
  visibleTiles.append(melds, discards)
  section.append(visibleTiles)
  return section
}

function renderHistory() {
  const seats = [2, 3, 1, 0].map(drawSeat)
  for (const seat of seats) {
    seat.querySelectorAll('.backs, .hand-count, .melds').forEach(element => element.remove())
  }
  get('history-seats').replaceChildren(...seats)
}

get('history-open').onclick = () => {
  if (!state) return
  renderHistory()
  get('history').showModal()
}

function renderHand(discards, animateDraw) {
  const rack = get('hand')
  const old = new Map([...rack.children].map(element => [element.dataset.key, element.getBoundingClientRect()]))
  const origin = [...old.values()].at(-1)?.right ?? rack.getBoundingClientRect().right
  const counts = new Map()
  const hand = state.hand.map((value, index) => {
    const key = value + ':' + (counts.get(value) ?? 0)
    counts.set(value, (counts.get(value) ?? 0) + 1)
    return {value, key, drawn: state.drawn !== null && index === state.hand.length - 1}
  }).sort((a, b) => a.value - b.value)
  const elements = hand.map(({value, key}, index) => {
    const move = discards.find(option => option.tile === value)
    const element = tile(value, '', move && (() => {
      selected = index
      for (const [position, child] of [...rack.children].entries()) {
        if (child.tagName !== 'BUTTON') continue
        child.classList.toggle('selected', index === position)
        child.setAttribute('aria-pressed', String(index === position))
      }
      const discard = get('discard')
      discard.disabled = false
      discard.textContent = '打出' + tileName(value)
      discard.onclick = () => submit(move)
    }))
    element.dataset.key = key
    if (move) element.setAttribute('aria-pressed', 'false')
    return element
  })
  rack.replaceChildren(...elements)
  if (!animateDraw || !old.size || matchMedia('(prefers-reduced-motion: reduce)').matches) return
  elements.forEach((element, index) => {
    const end = element.getBoundingClientRect()
    const inserted = hand[index].drawn
    const start = old.get(hand[index].key)
    if (inserted) {
      element.animate([
        {transform: `translate(${origin - end.left + 6}px, 9px)`, opacity: .15},
        {transform: `translate(${origin - end.left + 6}px, -8px)`, opacity: 1, offset: .25},
        {transform: 'translate(0, -8px)', offset: .84},
        {transform: 'translate(0, 0)', opacity: 1}
      ], {duration: 440, easing: 'ease-out'})
    } else if (start && Math.abs(start.left - end.left) > .5) {
      element.animate([{transform: `translateX(${start.left - end.left}px)`}, {transform: 'none'}],
        {duration: 240, easing: 'ease-out'})
    }
  })
}

function render(animateDraw) {
  get('remaining').textContent = '第 ' + state.round + ' 局 · 剩余 ' + state.remaining
  const felt = get('felt')
  felt.replaceChildren(...[2, 3, 1, 0].map(drawSeat), get('latest').parentElement)
  if (get('history').open) renderHistory()
  const over = state.phase === 'ended'
  updateCountdown()
  const discards = state.moves.filter(move => move.type === 'discard')
  get('message').textContent = over ? '本局结束' : discards.length ?
    '轮到你出牌，先选牌再确认' : state.moves.length ? '请选择操作' :
    state.phase === 'claim' ? '等待其他玩家回应' : '等待 ' + state.players[state.turn].name + ' 出牌'
  renderHand(discards, animateDraw)
  const actions = state.moves.filter(move => move.type !== 'discard').map(move => {
    const name = labels[move.type] + (move.type.endsWith('Kong') ? ' ' + tileName(move.tile) : '')
    const button = node('button', '', name)
    button.dataset.move = move.type
    button.onclick = () => submit(move)
    return button
  })
  get('actions').replaceChildren(...actions)
  if (discards.length) {
    const discard = node('button', '', '出牌')
    discard.id = 'discard'
    discard.disabled = true
    get('actions').append(discard)
  }
  const result = get('result')
  result.hidden = !over
  if (over) {
    const settlement = state.settlement
    const title = state.winner === null ? '流局' : state.players[state.winner].name + (settlement?.clean ? ' 清胡' : ' 自摸')
    const winning = node('div', 'discards')
    for (const value of state.winningHand ?? []) winning.append(tile(value))
    if (state.winner !== null) for (const meld of state.melds[state.winner]) {
      for (let i = 0; i < (meld.type === 'pong' ? 3 : 4); i++) winning.append(tile(meld.tile))
    }
    const back = node('a', '', '返回房间')
    back.href = './chess.html#' + room
    result.replaceChildren(node('h2', '', title), winning)
    if (settlement?.marks.length) {
      const marks = node('div', 'discards')
      settlement.marks.forEach((value, index) => marks.append(tile(value, settlement.hits[index] ? 'latest' : '')))
      result.append(node('p', '', '翻码 ' + settlement.marks.length + ' 张 · 中 ' + settlement.hits.filter(Boolean).length +
        ' 码' + (settlement.multiplier === 2 ? ' · 飞红中 ×2' : '') + ' · 每家付 ' + settlement.payment + ' 分'), marks)
    }
    const scores = node('ul', 'round-scores')
    state.players.forEach((player, index) => scores.append(node('li', '', player.name + ' · 本局 ' +
      (state.scores[index] > 0 ? '+' : '') + state.scores[index] + ' · 累计 ' + state.totals[index])))
    result.append(scores, back)
    if (state.isOwner) {
      const next = node('button', '', '下一局')
      next.onclick = async () => {
        if (busy) return
        busy = true
        next.disabled = true
        try {
          await pendingPoll
          const response = await fetch(endpoint.replace(/match$/, 'start'), {method: 'POST'})
          if (!response.ok) throw new Error((await response.json()).error)
          await sync()
        } catch (error) {
          result.append(node('p', '', error.message))
          next.disabled = false
        } finally { busy = false }
      }
      result.append(next)
    } else result.append(node('p', '', '等待房主开始下一局'))
  }
}

function showEvent(event) {
  const name = state.players[event.seat]?.name
  const phrase = event.type === 'discard' ? name + ' 打出 ' + tileName(event.tile) :
    event.type === 'draw' ? '本局流局' : name + ' · ' + labels[event.type]
  const latest = get('latest')
  latest.replaceChildren(node('span', '', phrase))
  if (event.tile !== undefined) latest.append(tile(event.tile))
}

function queueVoice(event) {
  if (!audioEnabled) return
  const key = event.type === 'discard' || event.type === 'fly' ? event.tile : event.type.endsWith('Kong') ? 'kong' : event.type
  if (!clips.has(key)) clips.set(key, fetch('./mahjong-audio/' + key + '.wav').then(async response => {
    if (!response.ok) throw new Error('语音文件读取失败')
    return audioContext.decodeAudioData(await response.arrayBuffer())
  }).catch(() => {
    clips.delete(key)
    return null
  }))
  const clip = clips.get(key)
  audioChain = audioChain.then(async () => {
    const buffer = await clip
    if (!buffer || !audioEnabled) return
    await new Promise(resolve => {
      const voice = audioContext.createBufferSource()
      voice.buffer = buffer
      voice.connect(audioContext.destination)
      voice.onended = () => { activeVoice = null; resolve() }
      activeVoice = voice
      voice.start()
    })
  }).catch(() => {})
}

function announce(events, matchId) {
  announcements = announcements.then(async () => {
    for (const [index, event] of events.entries()) {
      if (state.id !== matchId) return
      showEvent(event)
      queueVoice(event)
      if (index < events.length - 1) await new Promise(resolve => setTimeout(resolve, 650))
    }
  })
}

get('sound').onclick = async () => {
  try {
    audioContext ??= new (window.AudioContext ?? window.webkitAudioContext)()
    audioEnabled = !audioEnabled
    if (audioEnabled) await audioContext.resume()
    else activeVoice?.stop()
    get('sound').textContent = audioEnabled ? '关闭语音' : '开启语音'
    get('sound').setAttribute('aria-pressed', String(audioEnabled))
  } catch {
    audioEnabled = false
    get('message').textContent = '当前浏览器无法播放报牌语音。'
  }
}

get('fullscreen').onclick = async () => {
  const hint = get('fullscreen-hint')
  hint.hidden = true
  try {
    if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
      await document.documentElement.requestFullscreen()
    }
  } catch {}
  if (document.fullscreenElement) {
    try { await screen.orientation?.lock?.('landscape') } catch {}
  }
  const portrait = matchMedia('(orientation: portrait)').matches
  if (!document.fullscreenElement || portrait) {
    hint.textContent = document.fullscreenElement ? '请横放手机。' :
      '若浏览器仍显示工具栏，请添加到主屏幕，再从桌面图标打开。'
    hint.hidden = false
  }
}

function fitViewport() {
  const viewport = window.visualViewport
  if (!viewport || viewport.scale === 1) {
    document.documentElement.style.setProperty('--viewport-height', Math.floor(viewport?.height ?? innerHeight) + 'px')
  }
}
window.visualViewport?.addEventListener('resize', fitViewport)
window.addEventListener('resize', fitViewport)
fitViewport()

function updateCountdown() {
  get('countdown').textContent = state?.moves.length && state.deadline ?
    Math.max(0, Math.ceil((state.deadline - Date.now()) / 1000)) + ' 秒' : ''
}

let roomClosed = false

async function sync(command) {
  const response = await fetch(endpoint, command ? {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify(command)
  } : {})
  const next = await response.json()
  if (response.status === 410) {
    roomClosed = true
    state = null
    get('actions').replaceChildren()
    get('hand').replaceChildren()
    get('result').hidden = true
    updateCountdown()
    throw new Error(next.error + '，请返回房间大厅。')
  }
  if (!response.ok) throw new Error(next.error)
  if (connectionError || state?.id !== next.id || state.version !== next.version) {
    const sameMatch = state?.id === next.id
    const animateDraw = sameMatch && next.drawVersion !== null && state.drawVersion !== next.drawVersion
    if (!sameMatch) lastEvent = next.events.at(-1)?.seq ?? 0
    connectionError = false
    selected = null
    state = next
    render(animateDraw)
    const latest = next.events.at(-1)
    if (!sameMatch && latest) showEvent(latest)
    announce(next.events.filter(event => event.seq > lastEvent), next.id)
    lastEvent = latest?.seq ?? 0
  }
}

async function submit(move) {
  if (busy) return
  busy = true
  const command = {id: state.id, version: state.version, move}
  try {
    await pendingPoll
    await sync(command)
  } catch (error) {
    try { await sync() } catch {}
    connectionError = true
    get('message').textContent = error.message || '连接异常，请稍后重试'
  } finally {
    busy = false
  }
}

async function poll() {
  if (!busy && room) {
    pendingPoll = sync().catch(error => {
      connectionError = true
      get('message').textContent = error.message || '正在重连…'
    })
    await pendingPoll
    pendingPoll = undefined
  }
  if (!roomClosed) setTimeout(poll, document.hidden ? 1800 : 350)
}
if (room) {
  poll()
  setInterval(updateCountdown, 1000)
}
else get('message').textContent = '请从房间大厅进入牌桌。'
