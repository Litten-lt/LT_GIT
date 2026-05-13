"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CARD_POINT = exports.RANK_DISPLAY = exports.SUIT_PRIORITY = exports.RANK_ORDER = exports.HONGA_GAME_ID = void 0;
exports.createDeck = createDeck;
exports.shuffleDeck = shuffleDeck;
exports.isSkyBomb = isSkyBomb;
exports.isBomb4Pair = isBomb4Pair;
exports.isTripleOne = isTripleOne;
exports.isTriplePair = isTriplePair;
exports.isBomb510K = isBomb510K;
exports.getCardType = getCardType;
exports.getCardsScore = getCardsScore;
exports.compareCards = compareCards;
exports.canBeat = canBeat;
exports.getNextPlayerIndex = getNextPlayerIndex;
exports.HONGA_GAME_ID = 'honga';
exports.RANK_ORDER = [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];
exports.SUIT_PRIORITY = {
    spade: 4,
    heart: 3,
    club: 2,
    diamond: 1,
};
exports.RANK_DISPLAY = {
    3: '3', 4: '4', 5: '5', 6: '6', 7: '7', 8: '8', 9: '9',
    10: '10', 11: 'J', 12: 'Q', 13: 'K', 14: 'A', 15: '2'
};
exports.CARD_POINT = {
    3: 0, 4: 0, 5: 5, 6: 0, 7: 0, 8: 0, 9: 0,
    10: 10, 11: 10, 12: 10, 13: 10, 14: 11, 15: 12
};
function createDeck() {
    const deck = [];
    const suits = ['spade', 'heart', 'club', 'diamond'];
    const ranks = [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];
    for (const suit of suits) {
        for (const rank of ranks) {
            deck.push({ suit, rank });
        }
    }
    return deck;
}
function shuffleDeck(deck) {
    const shuffled = [...deck];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}
function isSkyBomb(cards) {
    if (cards.length !== 2)
        return false;
    const hasDiamondA = cards.some(c => c.suit === 'diamond' && c.rank === 14);
    const hasHeartA = cards.some(c => c.suit === 'heart' && c.rank === 14);
    return hasDiamondA && hasHeartA;
}
function isBomb4Pair(cards) {
    if (cards.length !== 8)
        return false;
    const pairs = new Map();
    for (const card of cards) {
        const count = pairs.get(card.rank) || 0;
        pairs.set(card.rank, count + 1);
    }
    if (pairs.size !== 4)
        return false;
    const sortedRanks = Array.from(pairs.keys()).sort((a, b) => a - b);
    for (let i = 1; i < sortedRanks.length; i++) {
        if (sortedRanks[i] !== sortedRanks[i - 1] + 1)
            return false;
    }
    for (const count of pairs.values()) {
        if (count !== 2)
            return false;
    }
    return true;
}
function isTripleOne(cards) {
    if (cards.length !== 4)
        return false;
    const rankCounts = {};
    for (const card of cards) {
        rankCounts[card.rank] = (rankCounts[card.rank] || 0) + 1;
    }
    const counts = Object.values(rankCounts);
    return counts.includes(3) && counts.includes(1);
}
function isTriplePair(cards) {
    if (cards.length !== 5)
        return false;
    const rankCounts = {};
    for (const card of cards) {
        rankCounts[card.rank] = (rankCounts[card.rank] || 0) + 1;
    }
    const counts = Object.values(rankCounts);
    return counts.includes(3) && counts.includes(2);
}
function isBomb510K(cards) {
    if (cards.length !== 3)
        return false;
    const has5 = cards.some(c => c.rank === 5);
    const has10 = cards.some(c => c.rank === 10);
    const hasK = cards.some(c => c.rank === 13);
    return has5 && has10 && hasK;
}
function getCardType(cards) {
    if (cards.length === 0)
        return null;
    if (cards.length === 1)
        return 'single';
    if (cards.length === 2) {
        if (cards[0].rank === cards[1].rank)
            return 'pair';
        if (isSkyBomb(cards))
            return 'sky-bomb';
        return null;
    }
    if (cards.length === 3) {
        if (isBomb510K(cards))
            return 'bomb-5-10-k';
        if (cards.every(c => c.rank === cards[0].rank))
            return 'triple';
        return null;
    }
    if (cards.length === 4) {
        if (cards.every(c => c.rank === cards[0].rank))
            return 'bomb-4';
        if (isTripleOne(cards))
            return 'triple-one';
        return null;
    }
    if (cards.length === 5) {
        if (isTriplePair(cards))
            return 'triple-pair';
    }
    if (isBomb4Pair(cards))
        return 'bomb-4-pair';
    if (isBomb510K(cards))
        return 'bomb-5-10-k';
    if (cards.length >= 5) {
        const sorted = [...cards].sort((a, b) => a.rank - b.rank);
        let isStraight = true;
        for (let i = 1; i < sorted.length; i++) {
            if (sorted[i].rank !== sorted[i - 1].rank + 1) {
                isStraight = false;
                break;
            }
        }
        if (isStraight)
            return 'straight';
    }
    return null;
}
function getCardsScore(cards) {
    return cards.reduce((sum, card) => sum + exports.CARD_POINT[card.rank], 0);
}
function compareCards(a, b) {
    const typeA = getCardType(a);
    const typeB = getCardType(b);
    if (!typeA || !typeB)
        return 0;
    const bombPriority = {
        'sky-bomb': 100,
        'bomb-4-pair': 90,
        'bomb-4': 80,
        'bomb-5-10-k': 70,
        'straight': 60,
        'triple-pair': 50,
        'triple-one': 40,
        'triple': 30,
        'pair': 20,
        'single': 10,
    };
    const priorityA = bombPriority[typeA];
    const priorityB = bombPriority[typeB];
    if (priorityA !== priorityB) {
        return priorityA - priorityB;
    }
    if (typeA === 'straight' || typeA === 'bomb-5-10-k') {
        if (a.length !== b.length) {
            return a.length - b.length;
        }
        const maxRankA = Math.max(...a.map(c => c.rank));
        const maxRankB = Math.max(...b.map(c => c.rank));
        return maxRankA - maxRankB;
    }
    if (typeA === 'bomb-4') {
        const maxRankA = Math.max(...a.map(c => c.rank));
        const maxRankB = Math.max(...b.map(c => c.rank));
        return maxRankA - maxRankB;
    }
    if (typeA === 'single' || typeA === 'pair' || typeA === 'triple') {
        if (a[0].rank !== b[0].rank) {
            return a[0].rank - b[0].rank;
        }
        if (typeA === 'pair' || typeA === 'triple') {
            return 0;
        }
        const suitA = exports.SUIT_PRIORITY[a[0].suit];
        const suitB = exports.SUIT_PRIORITY[b[0].suit];
        return suitA - suitB;
    }
    return 0;
}
function canBeat(lastPlay, newPlay) {
    return compareCards(newPlay, lastPlay) > 0;
}
function getNextPlayerIndex(current, players) {
    let next = (current + 1) % 4;
    while (players[next] === null) {
        next = (next + 1) % 4;
        if (next === current)
            break;
    }
    return next;
}
