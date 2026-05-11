import { BaseRoom } from '../../types';

export const HONGA_GAME_ID = 'honga';

export type Suit = 'spade' | 'heart' | 'club' | 'diamond';
export type Rank = 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15;

export interface Card {
  suit: Suit;
  rank: Rank;
}

export type CardGroup = Card[];

export type CardType =
  | 'single'       // 单张
  | 'pair'         // 对子
  | 'triple'       // 三张
  | 'straight'     // 顺子
  | 'triple-one'   // 三带一
  | 'triple-pair'  // 三带一对
  | 'bomb-4'       // 四张炸弹
  | 'bomb-5-10-k'  // 组合炸弹 5+10+K
  | 'bomb-4-pair'  // 地炸（4连对）
  | 'sky-bomb';    // 天炸

export type TeamInfo =
  | { mode: '2v2'; A: [string, string]; B: [string, string] }
  | { mode: '1v3'; solo: string; team: [string, string, string] };

export interface HongARoom extends BaseRoom {
  gameId: typeof HONGA_GAME_ID;
  players: [string | null, string | null, string | null, string | null];
  hands: Map<string, Card[]>;
  currentPlayerIndex: number;
  lastPlay: { playerIndex: number; cards: CardGroup; cardType: CardType } | null;
  scores: { A: number; B: number };
  teams: TeamInfo | null;
  finishedPlayers: string[];
  deck: Card[];
}

export const RANK_ORDER: Rank[] = [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];

export const SUIT_ORDER: Suit[] = ['spade', 'heart', 'club', 'diamond'];

export const CARD_VALUES: Record<Rank, number> = {
  3: 3, 4: 4, 5: 5, 6: 6, 7: 7, 8: 8, 9: 9, 10: 10,
  11: 10, 12: 10, 13: 10, 14: 11, 15: 12
};

export function createDeck(): Card[] {
  const deck: Card[] = [];
  const suits: Suit[] = ['spade', 'heart', 'club', 'diamond'];
  const ranks: Rank[] = [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];

  for (const suit of suits) {
    for (const rank of ranks) {
      deck.push({ suit, rank });
    }
  }

  return deck;
}

export function shuffleDeck(deck: Card[]): Card[] {
  const shuffled = [...deck];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export function dealCards(deck: Card[]): Map<string, Card[]> {
  const hands = new Map<string, Card[]>();
  for (let i = 0; i < 4; i++) {
    hands.set(`player_${i}`, deck.slice(i * 13, (i + 1) * 13));
  }
  return hands;
}

export function isSkyBomb(cards: Card[]): boolean {
  if (cards.length !== 2) return false;
  const hasSpadeA = cards.some(c => c.suit === 'diamond' && c.rank === 14);
  const hasHeartA = cards.some(c => c.suit === 'heart' && c.rank === 14);
  return hasSpadeA && hasHeartA;
}

export function getCardType(cards: Card[]): CardType | null {
  if (cards.length === 0) return null;

  if (cards.length === 1) return 'single';
  if (cards.length === 2) {
    if (cards[0].rank === cards[1].rank) return 'pair';
    if (isSkyBomb(cards)) return 'sky-bomb';
  }
  if (cards.length === 3) {
    if (cards.every(c => c.rank === cards[0].rank)) return 'triple';
  }
  if (cards.length === 4) {
    if (cards.every(c => c.rank === cards[0].rank)) return 'bomb-4';
  }

  return null;
}