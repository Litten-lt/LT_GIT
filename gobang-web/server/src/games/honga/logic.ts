import { Card, CardType, Suit, Rank } from '../../../../src/games/honga/logic';
import type { TeamInfo, TeamMode } from '../../../../src/games/honga/logic';

// Re-export all logic functions from the shared logic module
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
} from '../../../../src/games/honga/logic';

// Re-export types
export type { TeamInfo, TeamMode };
export { Card, CardType, Suit, Rank };
