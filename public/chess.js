const byId = id => document.getElementById(id)
const form = byId('create-room')
const profile = byId('player-name')
const join = byId('join-room')
const requirePassword = byId('require-room-password')
const passwordField = byId('create-password')

function updatePasswordField() {
  passwordField.hidden = !requirePassword.checked
  form.elements.password.disabled = !requirePassword.checked
}

requirePassword.onchange = updatePasswordField
const nickname = byId('nickname')
const newRoom = byId('new-room')
const list = byId('rooms')
const status = byId('chess-status')
let busy = false
let pendingPoll
let state

async function request(path = '', body) {
  const response = await fetch('./api/chess' + path, body === undefined ? {} : {
    method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(body)
  })
  const result = await response.json()
  if (!response.ok) throw Object.assign(new Error(result.error), {status: response.status})
  return result
}

function button(label, onClick, disabled = false, style = 'primary') {
  const element = document.createElement('button')
  element.className = style
  element.textContent = label
  element.onclick = onClick
  element.disabled = disabled
  return element
}

function openForm(form, title) {
  form.reset()
  if (title) form.querySelector('h2').textContent = title
  form.querySelector('.dialog-message').textContent = ''
  form.closest('dialog').showModal()
}

function render() {
  if (!form.elements.rule.options.length) {
    for (const rule of state.rules) form.elements.rule.add(new Option(rule, rule))
  }
  newRoom.disabled = Boolean(state.roomId)
  nickname.hidden = !state.playerNumber
  nickname.textContent = state.name || state.playerNumber
  list.replaceChildren()
  if (!state.rooms.length) {
    const empty = document.createElement('li')
    empty.textContent = '大厅暂无房间，可以先创建一间。'
    list.append(empty)
  }
  for (const room of state.rooms) {
    const entry = document.createElement('li')
    entry.className = 'chess-room'
    entry.id = room.id
    const details = document.createElement('div')
    details.className = 'room-details'
    const name = document.createElement('strong')
    name.textContent = room.name
    const summary = document.createElement('p')
    summary.textContent = [room.game, room.rule, room.players + '/' + room.capacity].join(' · ')
    details.append(name, summary)
    const ownRoom = state.roomId === room.id
    const full = room.players >= room.capacity
    const actions = document.createElement('div')
    actions.className = 'chess-actions'
    if (ownRoom) {
      const table = './mahjong.html?' + new URLSearchParams({room: room.id})
      if (room.hasMatch) actions.append(button(room.playing ? '回到牌桌' : '查看上局', () => { location.href = table }))
      if (state.isOwner && room.rule === '红中麻将' && !room.playing) {
        if (!full) actions.append(button('添加机器人', () => act('/rooms/' + room.id + '/bots', {}, '已添加机器人'), false, 'outline-button'))
        actions.append(button('开始游戏', () => act('/rooms/' + room.id + '/start', {}, '已开局', null, table), !full))
      }
      actions.append(button('离开房间', () => act('/leave', {}, '已离开房间'), false, 'outline-button'))
    } else {
      actions.append(button(room.playing ? '对局中' : full ? '已满' : '加入房间', () => {
        act('/rooms/' + room.id + '/join', {}, '已入座', null, null, room)
      }, full || room.playing || Boolean(state.roomId)))
    }
    const link = document.createElement('a')
    link.href = '#' + room.id
    link.textContent = '房间链接'
    actions.append(link)
    const members = document.createElement('ul')
    members.className = 'room-members'
    members.setAttribute('aria-label', '房间成员')
    for (const player of room.members) {
      const row = document.createElement('li')
      const label = document.createElement('span')
      label.textContent = player.name + (player.owner ? ' · 房主' : '') + (player.self ? ' · 你' : '')
      row.append(label)
      if (player.id) {
        const id = document.createElement('small')
        id.textContent = '玩家 ' + player.id.slice(0, 8)
        row.append(id)
        if (!player.self && !room.playing) row.append(button('移出房间', () => {
          if (confirm('将「' + player.name + '」移出房间？')) {
            act('/rooms/' + room.id + '/kick/' + player.id, {}, '已移出玩家')
          }
        }, false, 'outline-button'))
      }
      members.append(row)
    }
    entry.append(details, actions, members)
    list.append(entry)
  }
}

async function refresh() {
  if (state?.roomId) await request('/presence', {roomId: state.roomId})
  const next = await request()
  const changed = JSON.stringify(state) !== JSON.stringify(next)
  if (state?.roomId && !next.roomId) status.textContent = '你已离开原房间。'
  state = next
  if (changed) render()
}

async function act(path, body, message, activeForm, destination, joiningRoom) {
  if (busy) return
  busy = true
  try {
    await pendingPoll
    await request(path, body)
    if (destination) {
      location.href = destination
      return
    }
    if (activeForm) {
      activeForm.closest('dialog').close()
      activeForm.reset()
    }
    await refresh()
    status.textContent = message
  } catch (error) {
    if (joiningRoom && error.status === 401) {
      join.dataset.room = joiningRoom.id
      openForm(join, '加入「' + joiningRoom.name + '」')
      join.querySelector('.dialog-message').textContent = error.message
      return
    }
    const alert = activeForm?.closest('dialog').open ? activeForm.querySelector('.dialog-message') : status
    alert.textContent = error.message
  } finally {
    busy = false
  }
}

newRoom.onclick = () => {
  const number = 100000 + Math.floor(Math.random() * 900000)
  form.elements.name.defaultValue = String(number)
  openForm(form)
  updatePasswordField()
  form.elements.name.select()
}
nickname.onclick = () => {
  openForm(profile)
  profile.elements.name.value = state.name || state.playerNumber
  profile.elements.name.select()
}
for (const cancel of document.querySelectorAll('[data-close]')) {
  cancel.onclick = () => cancel.closest('dialog').close()
}
for (const [element, path, message] of [
  [form, () => '/rooms', '房间已创建，你已入座'],
  [join, () => '/rooms/' + join.dataset.room + '/join', '已入座'],
  [profile, () => '/name', '昵称已保存']
]) {
  element.onsubmit = event => {
    event.preventDefault()
    act(path(), Object.fromEntries(new FormData(element)), message, element)
  }
}

async function poll() {
  if (busy) return
  try {
    await refresh()
    if (status.dataset.pollError || status.textContent === '正在加载房间…') status.textContent = ''
    delete status.dataset.pollError
  } catch {
    status.textContent = '房间暂时无法加载，正在重试。'
    status.dataset.pollError = '1'
  }
}

await poll()
document.getElementById(location.hash.slice(1))?.scrollIntoView()
setInterval(() => {
  if (!busy && !pendingPoll) pendingPoll = poll().finally(() => { pendingPoll = undefined })
}, 5000)
