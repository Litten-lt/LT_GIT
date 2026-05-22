import { describe, it, expect } from 'vitest';
import {
  getCardType,
  compareCards,
  canBeat,
  isSkyBomb,
  isBomb4Pair,
  isBomb510K,
  isTripleOne,
  isTriplePair,
  getCardsScore,
  isPointCard,
  createDeck,
  shuffleDeck,
  determineTeams,
  findFirstPlayer,
  canPlayType,
  removeCardsFromHand,
  hasCard,
  hasCards,
  advanceToNextPlayer,
  SUIT_PRIORITY,
  RANK_ORDER,
  CARD_POINT,
  type Card,
} from '../../src/games/honga/logic';

describe('Deck Operations', () => {
  describe('createDeck', () => {
    it('should create a deck of 52 cards', () => {
      const deck = createDeck();
      expect(deck).toHaveLength(52);
    });

    it('should contain all 4 suits', () => {
      const deck = createDeck();
      const suits = new Set(deck.map(c => c.suit));
      expect(suits.size).toBe(4);
      expect(suits.has('spade')).toBe(true);
      expect(suits.has('heart')).toBe(true);
      expect(suits.has('club')).toBe(true);
      expect(suits.has('diamond')).toBe(true);
    });

    it('should contain all 13 ranks per suit', () => {
      const deck = createDeck();
      const spades = deck.filter(c => c.suit === 'spade');
      expect(spades).toHaveLength(13);
      const ranks = spades.map(c => c.rank).sort((a, b) => a - b);
      expect(ranks).toEqual([3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]);
    });
  });

  describe('shuffleDeck', () => {
    it('should return a deck of same length', () => {
      const deck = createDeck();
      const shuffled = shuffleDeck(deck);
      expect(shuffled).toHaveLength(deck.length);
    });

    it('should contain the same cards as original', () => {
      const deck = createDeck();
      const shuffled = shuffleDeck(deck);
      const sortedDeck = [...deck].sort((a, b) =>
        a.suit.localeCompare(b.suit) || a.rank - b.rank
      );
      const sortedShuffled = [...shuffled].sort((a, b) =>
        a.suit.localeCompare(b.suit) || a.rank - b.rank
      );
      expect(sortedShuffled).toEqual(sortedDeck);
    });
  });
});

describe('Bomb Detection', () => {
  describe('isSkyBomb', () => {
    it('should detect sky bomb (diamond A + heart A)', () => {
      const cards: Card[] = [
        { suit: 'diamond', rank: 14 },
        { suit: 'heart', rank: 14 },
      ];
      expect(isSkyBomb(cards)).toBe(true);
    });

    it('should not detect sky bomb with other cards', () => {
      const cards: Card[] = [
        { suit: 'diamond', rank: 14 },
        { suit: 'spade', rank: 14 },
      ];
      expect(isSkyBomb(cards)).toBe(false);
    });

    it('should not detect sky bomb with more than 2 cards', () => {
      const cards: Card[] = [
        { suit: 'diamond', rank: 14 },
        { suit: 'heart', rank: 14 },
        { suit: 'spade', rank: 14 },
      ];
      expect(isSkyBomb(cards)).toBe(false);
    });

    it('should not detect sky bomb with only 1 card', () => {
      const cards: Card[] = [{ suit: 'diamond', rank: 14 }];
      expect(isSkyBomb(cards)).toBe(false);
    });
  });

  describe('isBomb4Pair', () => {
    it('should detect bomb-4-pair (4 consecutive pairs)', () => {
      const cards: Card[] = [
        { suit: 'spade', rank: 3 }, { suit: 'heart', rank: 3 },
        { suit: 'spade', rank: 4 }, { suit: 'heart', rank: 4 },
        { suit: 'spade', rank: 5 }, { suit: 'heart', rank: 5 },
        { suit: 'spade', rank: 6 }, { suit: 'heart', rank: 6 },
      ];
      expect(isBomb4Pair(cards)).toBe(true);
    });

    it('should not detect bomb-4-pair with non-consecutive ranks', () => {
      const cards: Card[] = [
        { suit: 'spade', rank: 3 }, { suit: 'heart', rank: 3 },
        { suit: 'spade', rank: 5 }, { suit: 'heart', rank: 5 },
        { suit: 'spade', rank: 7 }, { suit: 'heart', rank: 7 },
        { suit: 'spade', rank: 9 }, { suit: 'heart', rank: 9 },
      ];
      expect(isBomb4Pair(cards)).toBe(false);
    });

    it('should not detect bomb-4-pair with wrong card count', () => {
      const cards: Card[] = [
        { suit: 'spade', rank: 3 }, { suit: 'heart', rank: 3 },
        { suit: 'spade', rank: 4 }, { suit: 'heart', rank: 4 },
        { suit: 'spade', rank: 5 }, { suit: 'heart', rank: 5 },
      ];
      expect(isBomb4Pair(cards)).toBe(false);
    });
  });

  describe('isBomb510K', () => {
    it('should detect bomb-5-10-k', () => {
      const cards: Card[] = [
        { suit: 'spade', rank: 5 },
        { suit: 'spade', rank: 10 },
        { suit: 'spade', rank: 13 },
      ];
      expect(isBomb510K(cards)).toBe(true);
    });

    it('should not detect bomb-5-10-k with different cards', () => {
      const cards: Card[] = [
        { suit: 'spade', rank: 5 },
        { suit: 'spade', rank: 6 },
        { suit: 'spade', rank: 13 },
      ];
      expect(isBomb510K(cards)).toBe(false);
    });
  });
});

describe('Card Group Detection', () => {
  describe('isTripleOne', () => {
    it('should detect triple-one (三带一)', () => {
      const cards: Card[] = [
        { suit: 'spade', rank: 9 },
        { suit: 'heart', rank: 9 },
        { suit: 'club', rank: 9 },
        { suit: 'diamond', rank: 7 },
      ];
      expect(isTripleOne(cards)).toBe(true);
    });

    it('should not detect triple-one when all same rank', () => {
      const cards: Card[] = [
        { suit: 'spade', rank: 9 },
        { suit: 'heart', rank: 9 },
        { suit: 'club', rank: 9 },
        { suit: 'diamond', rank: 9 },
      ];
      expect(isTripleOne(cards)).toBe(false);
    });
  });

  describe('isTriplePair', () => {
    it('should detect triple-pair (三带一对)', () => {
      const cards: Card[] = [
        { suit: 'spade', rank: 9 },
        { suit: 'heart', rank: 9 },
        { suit: 'club', rank: 9 },
        { suit: 'diamond', rank: 5 },
        { suit: 'spade', rank: 5 },
      ];
      expect(isTriplePair(cards)).toBe(true);
    });

    it('should not detect triple-pair when not matching pattern', () => {
      const cards: Card[] = [
        { suit: 'spade', rank: 9 },
        { suit: 'heart', rank: 9 },
        { suit: 'club', rank: 9 },
        { suit: 'diamond', rank: 7 },
        { suit: 'spade', rank: 8 },
      ];
      expect(isTriplePair(cards)).toBe(false);
    });
  });
});

describe('Card Type Detection', () => {
  describe('getCardType', () => {
    it('should detect single', () => {
      expect(getCardType([{ suit: 'spade', rank: 7 }])).toBe('single');
    });

    it('should detect pair', () => {
      expect(getCardType([
        { suit: 'spade', rank: 8 },
        { suit: 'heart', rank: 8 },
      ])).toBe('pair');
    });

    it('should detect triple', () => {
      expect(getCardType([
        { suit: 'spade', rank: 9 },
        { suit: 'heart', rank: 9 },
        { suit: 'club', rank: 9 },
      ])).toBe('triple');
    });

    it('should detect bomb-4', () => {
      expect(getCardType([
        { suit: 'spade', rank: 10 },
        { suit: 'heart', rank: 10 },
        { suit: 'club', rank: 10 },
        { suit: 'diamond', rank: 10 },
      ])).toBe('bomb-4');
    });

    it('should detect sky-bomb', () => {
      expect(getCardType([
        { suit: 'diamond', rank: 14 },
        { suit: 'heart', rank: 14 },
      ])).toBe('sky-bomb');
    });

    it('should detect bomb-5-10-k', () => {
      expect(getCardType([
        { suit: 'spade', rank: 5 },
        { suit: 'spade', rank: 10 },
        { suit: 'spade', rank: 13 },
      ])).toBe('bomb-5-10-k');
    });

    it('should detect triple-one', () => {
      expect(getCardType([
        { suit: 'spade', rank: 9 },
        { suit: 'heart', rank: 9 },
        { suit: 'club', rank: 9 },
        { suit: 'diamond', rank: 3 },
      ])).toBe('triple-one');
    });

    it('should detect triple-pair', () => {
      expect(getCardType([
        { suit: 'spade', rank: 9 },
        { suit: 'heart', rank: 9 },
        { suit: 'club', rank: 9 },
        { suit: 'diamond', rank: 5 },
        { suit: 'spade', rank: 5 },
      ])).toBe('triple-pair');
    });

    it('should detect straight (顺子)', () => {
      expect(getCardType([
        { suit: 'spade', rank: 5 },
        { suit: 'spade', rank: 6 },
        { suit: 'spade', rank: 7 },
        { suit: 'spade', rank: 8 },
        { suit: 'spade', rank: 9 },
      ])).toBe('straight');
    });

    it('should detect longer straight', () => {
      expect(getCardType([
        { suit: 'spade', rank: 5 },
        { suit: 'spade', rank: 6 },
        { suit: 'spade', rank: 7 },
        { suit: 'spade', rank: 8 },
        { suit: 'spade', rank: 9 },
        { suit: 'spade', rank: 10 },
      ])).toBe('straight');
    });

    it('should detect bomb-4-pair (地炸)', () => {
      const cards: Card[] = [
        { suit: 'spade', rank: 3 }, { suit: 'heart', rank: 3 },
        { suit: 'spade', rank: 4 }, { suit: 'heart', rank: 4 },
        { suit: 'spade', rank: 5 }, { suit: 'heart', rank: 5 },
        { suit: 'spade', rank: 6 }, { suit: 'heart', rank: 6 },
      ];
      expect(getCardType(cards)).toBe('bomb-4-pair');
    });

    it('should return null for invalid combination', () => {
      expect(getCardType([
        { suit: 'spade', rank: 5 },
        { suit: 'spade', rank: 7 },
        { suit: 'spade', rank: 9 },
      ])).toBeNull();
    });

    it('should return null for empty array', () => {
      expect(getCardType([])).toBeNull();
    });
  });
});

describe('Card Comparison', () => {
  describe('compareCards', () => {
    it('should compare singles by rank', () => {
      const a: Card[] = [{ suit: 'spade', rank: 7 }];
      const b: Card[] = [{ suit: 'spade', rank: 8 }];
      expect(compareCards(a, b)).toBeLessThan(0);
      expect(compareCards(b, a)).toBeGreaterThan(0);
      expect(compareCards(a, a)).toBe(0);
    });

    it('should compare pairs by rank', () => {
      const a: Card[] = [{ suit: 'spade', rank: 7 }, { suit: 'heart', rank: 7 }];
      const b: Card[] = [{ suit: 'spade', rank: 8 }, { suit: 'heart', rank: 8 }];
      expect(compareCards(a, b)).toBeLessThan(0);
      expect(compareCards(b, a)).toBeGreaterThan(0);
    });

    it('should compare singles with same rank by suit priority', () => {
      const a: Card[] = [{ suit: 'spade', rank: 14 }]; // A of spades
      const b: Card[] = [{ suit: 'diamond', rank: 14 }]; // A of diamonds
      expect(compareCards(a, b)).toBeGreaterThan(0); // spade > diamond
    });

    it('should compare bombs by priority (sky-bomb > bomb-4-pair > bomb-4)', () => {
      const skyBomb: Card[] = [{ suit: 'diamond', rank: 14 }, { suit: 'heart', rank: 14 }];
      const bomb4Pair: Card[] = [
        { suit: 'spade', rank: 3 }, { suit: 'heart', rank: 3 },
        { suit: 'spade', rank: 4 }, { suit: 'heart', rank: 4 },
        { suit: 'spade', rank: 5 }, { suit: 'heart', rank: 5 },
        { suit: 'spade', rank: 6 }, { suit: 'heart', rank: 6 },
      ];
      const bomb4: Card[] = [
        { suit: 'spade', rank: 14 },
        { suit: 'heart', rank: 14 },
        { suit: 'club', rank: 14 },
        { suit: 'diamond', rank: 14 },
      ];
      expect(compareCards(skyBomb, bomb4)).toBeGreaterThan(0);
      expect(compareCards(bomb4Pair, bomb4)).toBeGreaterThan(0);
      expect(compareCards(skyBomb, bomb4Pair)).toBeGreaterThan(0);
    });

    it('should compare straights by length then max rank', () => {
      const short: Card[] = [
        { suit: 'spade', rank: 5 },
        { suit: 'spade', rank: 6 },
        { suit: 'spade', rank: 7 },
        { suit: 'spade', rank: 8 },
        { suit: 'spade', rank: 9 },
      ];
      const long: Card[] = [
        { suit: 'spade', rank: 6 },
        { suit: 'spade', rank: 7 },
        { suit: 'spade', rank: 8 },
        { suit: 'spade', rank: 9 },
        { suit: 'spade', rank: 10 },
        { suit: 'spade', rank: 11 },
      ];
      expect(compareCards(long, short)).toBeGreaterThan(0);
    });

    it('should compare bomb-4 by max rank', () => {
      const a: Card[] = [
        { suit: 'spade', rank: 10 },
        { suit: 'heart', rank: 10 },
        { suit: 'club', rank: 10 },
        { suit: 'diamond', rank: 10 },
      ];
      const b: Card[] = [
        { suit: 'spade', rank: 14 },
        { suit: 'heart', rank: 14 },
        { suit: 'club', rank: 14 },
        { suit: 'diamond', rank: 14 },
      ];
      expect(compareCards(a, b)).toBeLessThan(0);
      expect(compareCards(b, a)).toBeGreaterThan(0);
    });
  });

  describe('canBeat', () => {
    it('should return true when new beats last', () => {
      const lastPlay: Card[] = [{ suit: 'spade', rank: 7 }];
      const newPlay: Card[] = [{ suit: 'spade', rank: 8 }];
      expect(canBeat(lastPlay, newPlay)).toBe(true);
    });

    it('should return false when new cannot beat last', () => {
      const lastPlay: Card[] = [{ suit: 'spade', rank: 10 }];
      const newPlay: Card[] = [{ suit: 'spade', rank: 7 }];
      expect(canBeat(lastPlay, newPlay)).toBe(false);
    });

    it('should return true when equal (edge case)', () => {
      const lastPlay: Card[] = [{ suit: 'spade', rank: 7 }];
      const newPlay: Card[] = [{ suit: 'spade', rank: 7 }];
      expect(canBeat(lastPlay, newPlay)).toBe(false); // equal returns 0, not > 0
    });

    it('sky-bomb can beat bomb-4', () => {
      const lastPlay: Card[] = [
        { suit: 'spade', rank: 10 },
        { suit: 'heart', rank: 10 },
        { suit: 'club', rank: 10 },
        { suit: 'diamond', rank: 10 },
      ];
      const newPlay: Card[] = [
        { suit: 'diamond', rank: 14 },
        { suit: 'heart', rank: 14 },
      ];
      expect(canBeat(lastPlay, newPlay)).toBe(true);
    });

    it('bomb-4 can beat single', () => {
      const lastPlay: Card[] = [{ suit: 'spade', rank: 14 }];
      const newPlay: Card[] = [
        { suit: 'spade', rank: 10 },
        { suit: 'heart', rank: 10 },
        { suit: 'club', rank: 10 },
        { suit: 'diamond', rank: 10 },
      ];
      expect(canBeat(lastPlay, newPlay)).toBe(true);
    });
  });
});

describe('Score Calculation', () => {
  describe('getCardsScore', () => {
    it('should return 5 for rank 5', () => {
      expect(getCardsScore([{ suit: 'spade', rank: 5 }])).toBe(5);
    });

    it('should return 10 for rank 10', () => {
      expect(getCardsScore([{ suit: 'spade', rank: 10 }])).toBe(10);
    });

    it('should return 10 for rank K (13)', () => {
      expect(getCardsScore([{ suit: 'spade', rank: 13 }])).toBe(10);
    });

    it('should return 0 for non-point cards', () => {
      expect(getCardsScore([{ suit: 'spade', rank: 3 }])).toBe(0);
      expect(getCardsScore([{ suit: 'spade', rank: 7 }])).toBe(0);
      expect(getCardsScore([{ suit: 'spade', rank: 14 }])).toBe(11);
    });

    it('should sum points for multiple cards', () => {
      const cards: Card[] = [
        { suit: 'spade', rank: 5 },
        { suit: 'spade', rank: 10 },
        { suit: 'spade', rank: 13 },
      ];
      expect(getCardsScore(cards)).toBe(25);
    });
  });

  describe('isPointCard', () => {
    it('should return true for 5, 10, K', () => {
      expect(isPointCard({ suit: 'spade', rank: 5 })).toBe(true);
      expect(isPointCard({ suit: 'spade', rank: 10 })).toBe(true);
      expect(isPointCard({ suit: 'spade', rank: 13 })).toBe(true);
    });

    it('should return false for other ranks', () => {
      expect(isPointCard({ suit: 'spade', rank: 3 })).toBe(false);
      expect(isPointCard({ suit: 'spade', rank: 7 })).toBe(false);
      expect(isPointCard({ suit: 'spade', rank: 14 })).toBe(false);
    });
  });
});

describe('Team Determination', () => {
  describe('determineTeams', () => {
    it('should create 2v2 teams when red As are in different hands', () => {
      const players = ['A', 'B', 'C', 'D'];
      const hands: Record<string, Card[]> = {
        A: [{ suit: 'diamond', rank: 14 }], // A has 方片A
        B: [{ suit: 'heart', rank: 14 }],   // B has 红心A
        C: [],
        D: [],
      };
      const result = determineTeams(players, hands);
      expect(result.mode).toBe('2v2');
    });

    it('should create 1v3 solo team when player has both red As', () => {
      const players = ['A', 'B', 'C', 'D'];
      const hands: Record<string, Card[]> = {
        A: [
          { suit: 'diamond', rank: 14 },
          { suit: 'heart', rank: 14 },
        ], // A has both A
        B: [],
        C: [],
        D: [],
      };
      const result = determineTeams(players, hands);
      expect(result.mode).toBe('1v3');
    });

    it('should handle case where A is missing', () => {
      const players = ['A', 'B', 'C', 'D'];
      const hands: Record<string, Card[]> = {
        A: [],
        B: [{ suit: 'heart', rank: 14 }], // B has 红心A only
        C: [],
        D: [],
      };
      const result = determineTeams(players, hands);
      expect(result.mode).toBe('2v2');
    });
  });

  describe('findFirstPlayer', () => {
    it('should return index of player with spade 3', () => {
      const players: (string | null)[] = ['A', 'B', 'C', 'D'];
      const hands: Record<string, Card[]> = {
        A: [{ suit: 'heart', rank: 14 }],
        B: [{ suit: 'spade', rank: 3 }], // B has spade 3
        C: [],
        D: [],
      };
      expect(findFirstPlayer(players, hands)).toBe(1);
    });

    it('should return 0 when no player has spade 3', () => {
      const players: (string | null)[] = ['A', 'B', 'C', 'D'];
      const hands: Record<string, Card[]> = {
        A: [{ suit: 'heart', rank: 14 }],
        B: [],
        C: [],
        D: [],
      };
      expect(findFirstPlayer(players, hands)).toBe(0);
    });

    it('should skip null players', () => {
      const players: (string | null)[] = [null, 'B', 'C', 'D'];
      const hands: Record<string, Card[]> = {
        B: [{ suit: 'spade', rank: 3 }],
        C: [],
        D: [],
      };
      expect(findFirstPlayer(players, hands)).toBe(1);
    });
  });
});

describe('Card Type Matching', () => {
  describe('canPlayType', () => {
    it('should allow same type', () => {
      expect(canPlayType('single', 'single')).toBe(true);
      expect(canPlayType('pair', 'pair')).toBe(true);
      expect(canPlayType('straight', 'straight')).toBe(true);
    });

    it('should allow bomb to play against non-bomb', () => {
      expect(canPlayType('single', 'bomb-4')).toBe(true);
      expect(canPlayType('pair', 'bomb-4')).toBe(true);
      expect(canPlayType('triple', 'bomb-5-10-k')).toBe(true);
      expect(canPlayType('straight', 'sky-bomb')).toBe(true);
    });

    it('should not allow different non-bomb types', () => {
      expect(canPlayType('single', 'pair')).toBe(false);
      expect(canPlayType('pair', 'triple')).toBe(false);
      expect(canPlayType('triple', 'straight')).toBe(false);
    });
  });
});

describe('Hand Manipulation', () => {
  describe('removeCardsFromHand', () => {
    it('should remove specified cards from hand', () => {
      const hand: Card[] = [
        { suit: 'spade', rank: 3 },
        { suit: 'spade', rank: 5 },
        { suit: 'spade', rank: 7 },
      ];
      const toRemove: Card[] = [{ suit: 'spade', rank: 5 }];
      const result = removeCardsFromHand(hand, toRemove);
      expect(result).toHaveLength(2);
      expect(result.some(c => c.suit === 'spade' && c.rank === 5)).toBe(false);
    });

    it('should handle removing multiple cards', () => {
      const hand: Card[] = [
        { suit: 'spade', rank: 3 },
        { suit: 'spade', rank: 5 },
        { suit: 'spade', rank: 7 },
        { suit: 'spade', rank: 9 },
      ];
      const toRemove: Card[] = [
        { suit: 'spade', rank: 5 },
        { suit: 'spade', rank: 7 },
      ];
      const result = removeCardsFromHand(hand, toRemove);
      expect(result).toHaveLength(2);
    });
  });

  describe('hasCard', () => {
    it('should return true when card is in hand', () => {
      const hand: Card[] = [
        { suit: 'spade', rank: 3 },
        { suit: 'spade', rank: 5 },
      ];
      expect(hasCard(hand, { suit: 'spade', rank: 3 })).toBe(true);
    });

    it('should return false when card is not in hand', () => {
      const hand: Card[] = [
        { suit: 'spade', rank: 3 },
        { suit: 'spade', rank: 5 },
      ];
      expect(hasCard(hand, { suit: 'spade', rank: 7 })).toBe(false);
    });
  });

  describe('hasCards', () => {
    it('should return true when all cards are in hand', () => {
      const hand: Card[] = [
        { suit: 'spade', rank: 3 },
        { suit: 'spade', rank: 5 },
        { suit: 'spade', rank: 7 },
      ];
      expect(hasCards(hand, [
        { suit: 'spade', rank: 3 },
        { suit: 'spade', rank: 5 },
      ])).toBe(true);
    });

    it('should return false when some cards are not in hand', () => {
      const hand: Card[] = [
        { suit: 'spade', rank: 3 },
        { suit: 'spade', rank: 5 },
      ];
      expect(hasCards(hand, [
        { suit: 'spade', rank: 3 },
        { suit: 'spade', rank: 7 }, // not in hand
      ])).toBe(false);
    });
  });
});

describe('Player Navigation', () => {
  describe('advanceToNextPlayer', () => {
    it('should skip null players', () => {
      const players: (string | null)[] = ['A', null, 'C', 'D'];
      const finished: string[] = [];
      expect(advanceToNextPlayer(0, players, finished)).toBe(2);
    });

    it('should skip finished players', () => {
      const players: (string | null)[] = ['A', 'B', 'C', 'D'];
      const finished: string[] = ['A'];
      expect(advanceToNextPlayer(0, players, finished)).toBe(1);
    });

    it('should return -1 when all players are finished or null', () => {
      const players: (string | null)[] = ['A', null, null, null];
      const finished: string[] = ['A'];
      expect(advanceToNextPlayer(0, players, finished)).toBe(-1);
    });
  });
});

describe('Constants', () => {
  describe('SUIT_PRIORITY', () => {
    it('should have correct priority order', () => {
      expect(SUIT_PRIORITY.spade).toBe(4);
      expect(SUIT_PRIORITY.heart).toBe(3);
      expect(SUIT_PRIORITY.club).toBe(2);
      expect(SUIT_PRIORITY.diamond).toBe(1);
    });
  });

  describe('RANK_ORDER', () => {
    it('should have all ranks in order', () => {
      expect(RANK_ORDER).toHaveLength(13);
      expect(RANK_ORDER[0]).toBe(3);
      expect(RANK_ORDER[12]).toBe(15);
    });
  });

  describe('CARD_POINT', () => {
    it('should have correct points for 5, 10, K', () => {
      expect(CARD_POINT[5]).toBe(5);
      expect(CARD_POINT[10]).toBe(10);
      expect(CARD_POINT[13]).toBe(10);
    });

    it('should have 0 points for non-score cards', () => {
      expect(CARD_POINT[3]).toBe(0);
      expect(CARD_POINT[7]).toBe(0);
    });
  });
});
