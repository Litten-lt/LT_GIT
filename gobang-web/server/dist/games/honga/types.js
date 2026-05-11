"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CARD_VALUES = exports.SUIT_ORDER = exports.RANK_ORDER = exports.HONGA_GAME_ID = void 0;
exports.createDeck = createDeck;
exports.shuffleDeck = shuffleDeck;
exports.dealCards = dealCards;
exports.isSkyBomb = isSkyBomb;
exports.getCardType = getCardType;
exports.HONGA_GAME_ID = 'honga';
exports.RANK_ORDER = [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];
exports.SUIT_ORDER = ['spade', 'heart', 'club', 'diamond'];
exports.CARD_VALUES = {
    3: 3, 4: 4, 5: 5, 6: 6, 7: 7, 8: 8, 9: 9, 10: 10,
    11: 10, 12: 10, 13: 10, 14: 11, 15: 12
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
function dealCards(deck) {
    const hands = new Map();
    for (let i = 0; i < 4; i++) {
        hands.set(`player_${i}`, deck.slice(i * 13, (i + 1) * 13));
    }
    return hands;
}
function isSkyBomb(cards) {
    if (cards.length !== 2)
        return false;
    const hasSpadeA = cards.some(c => c.suit === 'diamond' && c.rank === 14);
    const hasHeartA = cards.some(c => c.suit === 'heart' && c.rank === 14);
    return hasSpadeA && hasHeartA;
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
    }
    if (cards.length === 3) {
        if (cards.every(c => c.rank === cards[0].rank))
            return 'triple';
    }
    if (cards.length === 4) {
        if (cards.every(c => c.rank === cards[0].rank))
            return 'bomb-4';
    }
    return null;
}
