export const ranks = '3 4 5 6 7 8 9 10 J Q K A 2'.split(' ')
export const suits = ['♦', '♥', '♣', '♠']
export const rankOf = card => card % 13
export const suitOf = card => Math.floor(card / 13)
export const redAces = [11, 24]
export const points = card => ({2: 5, 7: 10, 10: 10})[rankOf(card)] ?? 0

export function classify(cards) {
  if (!Array.isArray(cards) || !cards.length || cards.length > 13 ||
      cards.some(card => !Number.isInteger(card) || card < 0 || card >= 52) ||
      new Set(cards).size !== cards.length) return null
  const counts = new Map()
  for (const card of cards) {
    const rank = rankOf(card)
    counts.set(rank, (counts.get(rank) ?? 0) + 1)
  }
  const keys = [...counts.keys()].sort((a, b) => a - b)
  const high = keys.at(-1)
  const length = cards.length
  const sameSuit = cards.every(card => suitOf(card) === suitOf(cards[0]))
  const consecutive = high < 12 && high - keys[0] === keys.length - 1
  const shape = (name, power = 0, value = high) => ({name, power, value, length})
  if (length === 2 && redAces.every(card => cards.includes(card))) return shape('天炸', 6)
  if (keys.length === 1) {
    if (length === 4) return shape('四张', 3)
    return shape(['', '单张', '对子', '三张'][length])
  }
  if (length === 3 && keys.join() === '2,7,10') {
    return sameSuit ? shape('同色五十 K', 2, suitOf(cards[0])) : shape('异色五十 K', 1)
  }
  if (consecutive && length === keys.length && length >= 5) {
    return length === 5 && sameSuit ? shape('金顺', 4) : shape('顺子')
  }
  if (consecutive && keys.length >= 2 && [...counts.values()].every(count => count === 2)) {
    return keys.length === 4 ? shape('地炸', 5) : shape('连对')
  }
  const triple = keys.find(rank => counts.get(rank) === 3)
  if (triple !== undefined && (length === 4 || length === 5)) {
    return shape(length === 4 ? '三带一' : '三带二', 0, triple)
  }
  return null
}

export function beats(candidate, target) {
  if (!candidate) return false
  if (!target) return true
  if (candidate.power !== target.power) return candidate.power > target.power
  return candidate.power !== 1 && candidate.name === target.name &&
    candidate.length === target.length && candidate.value > target.value
}

export function suggestedPlays(hand, target) {
  const plays = []
  for (let mask = 1; mask < 2 ** hand.length; mask++) {
    const cards = hand.filter((_, index) => mask & (1 << index))
    if (target && cards.length !== target.length && ![2, 3, 4, 5, 8].includes(cards.length)) continue
    const shape = classify(cards)
    if (beats(shape, target)) plays.push({cards, shape})
  }
  return plays.sort((a, b) => a.shape.power - b.shape.power ||
    b.cards.length - a.cards.length || a.shape.value - b.shape.value)
}
