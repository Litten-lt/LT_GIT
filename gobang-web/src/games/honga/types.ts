export type Suit = 'spade' | 'heart' | 'club' | 'diamond';
export type Rank = 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15;

export interface Card {
  suit: Suit;
  rank: Rank;
}

export type CardType =
  | 'single'
  | 'pair'
  | 'triple'
  | 'straight'
  | 'triple-one'
  | 'triple-pair'
  | 'bomb-4'
  | 'bomb-5-10-k'
  | 'bomb-4-pair'
  | 'sky-bomb';

export const RANK_DISPLAY: Record<Rank, string> = {
  3: '3', 4: '4', 5: '5', 6: '6', 7: '7', 8: '8', 9: '9',
  10: '10', 11: 'J', 12: 'Q', 13: 'K', 14: 'A', 15: '2'
};