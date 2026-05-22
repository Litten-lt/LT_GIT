import { BaseRoom } from '../../types';
import { Card, CardType, Suit, Rank } from './logic';
import type { TeamInfo } from './logic';

// Server-specific game constants
export const HONGA_GAME_ID = 'honga';

export type CardGroup = Card[];

// Server-specific types
export interface HongARoom extends BaseRoom {
  gameId: typeof HONGA_GAME_ID;
  players: [string | null, string | null, string | null, string | null];
  hands: Record<string, Card[]>;
  currentPlayerIndex: number;
  lastPlay: LastPlayInfo | null;
  currentRoundBest: LastPlayInfo | null;
  roundHistory: LastPlayInfo[];
  scores: { A: number; B: number };
  playerScores: Record<string, number>;
  teams: TeamInfo | null;
  finishedPlayers: string[];
  deck: Card[];
  roundStarter: number;
  roundWinner: number;
  hostSocketId: string;
  passCount: number;
}

export interface LastPlayInfo {
  playerIndex: number;
  cards: CardGroup;
  cardType: CardType;
}

// Re-export all logic functions from the local logic module
export {
  RANK_ORDER,
  SUIT_PRIORITY,
  CARD_POINT,
  createDeck,
  shuffleDeck,
  isSkyBomb,
  isBomb4Pair,
  isBomb510K,
  isTripleOne,
  isTriplePair,
  getCardType,
  getCardsScore,
  isPointCard,
  compareCards,
  canBeat,
  getNextPlayerIndex,
  advanceToNextPlayer,
  findRedAs,
  determineTeams,
  findFirstPlayer,
  canPlayType,
  removeCardsFromHand,
  hasCard,
  hasCards,
} from './logic';

// Re-export types separately
export type { TeamInfo, TeamMode } from './logic';
export { Card, CardType, Suit, Rank } from './logic';