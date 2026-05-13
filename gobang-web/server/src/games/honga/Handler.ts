import { BaseRoom, GameHandler, generateRoomId } from '../../types';
import {
  HongARoom,
  Card,
  CardGroup,
  createDeck,
  shuffleDeck,
  TeamInfo,
  HONGA_GAME_ID,
  getCardType,
  canBeat,
  getCardsScore,
  getNextPlayerIndex,
  SUIT_PRIORITY,
  CardType,
  RANK_ORDER,
  isTripleOne,
  isTriplePair,
} from './types';

function determineTeams(room: HongARoom): TeamInfo {
  const players = room.players.filter(p => p !== null) as string[];
  const spadeAHolder = players.find(pid => {
    const hand = room.hands[pid];
    return hand?.some(c => c.suit === 'diamond' && c.rank === 14);
  });
  const heartAHolder = players.find(pid => {
    const hand = room.hands[pid];
    return hand?.some(c => c.suit === 'heart' && c.rank === 14);
  });

  if (spadeAHolder && heartAHolder && spadeAHolder === heartAHolder) {
    return {
      mode: '1v3',
      solo: spadeAHolder,
      team: players.filter(p => p !== spadeAHolder) as [string, string, string],
    };
  }

  return {
    mode: '2v2',
    A: [spadeAHolder || '', heartAHolder || ''].filter(Boolean) as [string, string],
    B: players.filter(p => p !== spadeAHolder && p !== heartAHolder) as [string, string],
  };
}

function findFirstPlayer(room: HongARoom): number {
  const spade3Index = room.players.findIndex(pid => {
    if (!pid) return false;
    const hand = room.hands[pid];
    return hand?.some(c => c.suit === 'spade' && c.rank === 3);
  });
  return spade3Index !== -1 ? spade3Index : 0;
}

function getLeadingPlayerIndex(room: HongARoom): number {
  if (room.lastPlay) {
    return room.lastPlay.playerIndex;
  }
  return room.roundStarter;
}

function advanceToNextPlayer(room: HongARoom): number {
  const players = room.players;
  const current = room.currentPlayerIndex;
  let next = (current + 1) % 4;
  let count = 0;
  while (players[next] === null && count < 4) {
    next = (next + 1) % 4;
    count++;
  }
  return next;
}

function canPlayType(lastType: CardType, newType: CardType): boolean {
  if (lastType === newType) return true;
  const bombs: CardType[] = ['bomb-4', 'bomb-5-10-k', 'bomb-4-pair', 'sky-bomb'];
  return bombs.includes(newType);
}

function validatePlay(room: HongARoom, playerIndex: number, cards: Card[]): { valid: boolean; error?: string } {
  const playerId = room.players[playerIndex];
  if (!playerId) return { valid: false, error: 'no-hand' };

  const hand = room.hands[playerId];
  if (!hand) return { valid: false, error: 'no-hand' };

  for (const card of cards) {
    if (!hand.some(c => c.suit === card.suit && c.rank === card.rank)) {
      return { valid: false, error: 'card-not-in-hand' };
    }
  }

  const cardType = getCardType(cards);
  if (!cardType) {
    return { valid: false, error: 'invalid-card-type' };
  }

  if (room.roundStarter === playerIndex) {
    return { valid: true };
  }

  if (room.lastPlay) {
    const lastType = room.lastPlay.cardType;
    if (!canPlayType(lastType, cardType)) {
      return { valid: false, error: 'cannot-play-this-type' };
    }
    if (cardType !== 'sky-bomb' && !canBeat(room.lastPlay.cards, cards)) {
      return { valid: false, error: 'cannot-beat-last-play' };
    }
  }

  return { valid: true };
}

function removeCardsFromHand(hand: Card[], cardsToRemove: Card[]): Card[] {
  const remaining = [...hand];
  for (const card of cardsToRemove) {
    const idx = remaining.findIndex(c => c.suit === card.suit && c.rank === card.rank);
    if (idx !== -1) remaining.splice(idx, 1);
  }
  return remaining;
}

function calculateRoundWinner(room: HongARoom): { winnerIndex: number; points: number } | null {
  if (!room.lastPlay) return null;

  let winnerIdx = room.lastPlay.playerIndex;
  let maxCards: Card[] = room.lastPlay.cards;
  let maxScore = getCardsScore(maxCards);

  const players = room.players;
  const startedFrom = getLeadingPlayerIndex(room);
  let idx = (startedFrom + 1) % 4;

  while (idx !== startedFrom) {
    if (players[idx] !== null) {
      const playerId = players[idx]!;
      const hand = room.hands[playerId];
      if (hand) {
        const lastCards = room.lastPlay.cards;
        if (canBeat(lastCards, hand.length === 0 ? [] : [])) {
        }
      }
    }
    idx = (idx + 1) % 4;
  }

  return { winnerIndex: winnerIdx, points: maxScore };
}

function getPointsFromPlay(cards: Card[]): number {
  return getCardsScore(cards);
}

export const HongAHandler: GameHandler = {
  gameId: HONGA_GAME_ID,
  maxPlayers: 4,

  createRoom(socketId: string): HongARoom {
    const deck = shuffleDeck(createDeck());
    const hands: Record<string, Card[]> = {
      [socketId]: deck.slice(0, 13),
    };

    const room: HongARoom = {
      id: '',
      gameId: HONGA_GAME_ID,
      players: [socketId, null, null, null],
      hands,
      currentPlayerIndex: -1,
      lastPlay: null,
      currentRoundBest: null,
      roundHistory: [],
      scores: { A: 0, B: 0 },
      teams: null,
      finishedPlayers: [],
      deck,
      roundStarter: 0,
      hostSocketId: socketId,
      passCount: 0,
      state: 'waiting',
      createdAt: Date.now(),
    };

    return room;
  },

  joinRoom(socketId: string, roomId: string, rooms: Map<string, BaseRoom>): { success: boolean; room?: HongARoom; playerIndex?: number; error?: string } {
    const room = rooms.get(roomId) as HongARoom | undefined;
    if (!room) {
      return { success: false, error: 'room-not-found' };
    }

    if (room.gameId !== HONGA_GAME_ID) {
      return { success: false, error: 'room-not-found' };
    }

    const emptySlot = room.players.findIndex(p => p === null);
    if (emptySlot === -1) {
      return { success: false, error: 'room-full' };
    }

    if (room.players.includes(socketId)) {
      const existingIndex = room.players.findIndex(p => p === socketId);
      return { success: true, room, playerIndex: existingIndex };
    }

    room.players[emptySlot] = socketId;

    if (room.players.every(p => p !== null)) {
      room.state = 'ready';
    }

    return { success: true, room, playerIndex: emptySlot };
  },

  startGame(socketId: string, roomId: string, rooms: Map<string, BaseRoom>): { success: boolean; room?: HongARoom; error?: string } {
    const room = rooms.get(roomId) as HongARoom | undefined;
    if (!room) {
      return { success: false, error: 'room-not-found' };
    }

    if (room.state !== 'ready') {
      return { success: false, error: 'game-not-ready' };
    }

    if (room.players[0] !== socketId) {
      return { success: false, error: 'not-host' };
    }

    const hands: Record<string, Card[]> = {};
    for (let i = 0; i < 4; i++) {
      const playerId = room.players[i];
      if (playerId) {
        hands[playerId] = room.deck.slice(i * 13, (i + 1) * 13);
      }
    }
    room.hands = hands;
    room.currentRoundBest = null;
    room.roundHistory = [];
    room.passCount = 0;
    room.state = 'playing';
    room.teams = determineTeams(room);
    room.currentPlayerIndex = findFirstPlayer(room);
    room.roundStarter = room.currentPlayerIndex;

    return { success: true, room };
  },

  handleMove(socketId: string, roomId: string, move: any, rooms: Map<string, BaseRoom>): { success: boolean; room?: HongARoom; error?: string } {
    const room = rooms.get(roomId) as HongARoom | undefined;
    if (!room) {
      return { success: false, error: 'room-not-found' };
    }

    if (room.state !== 'playing') {
      return { success: false, error: 'game-not-started' };
    }

    const playerIndex = room.players.findIndex(p => p === socketId);
    if (playerIndex === -1) {
      return { success: false, error: 'not-in-room' };
    }

    if (room.currentPlayerIndex !== playerIndex) {
      return { success: false, error: 'not-your-turn' };
    }

    const cards: Card[] = move.cards;
    const validation = validatePlay(room, playerIndex, cards);
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }

    const cardType = getCardType(cards);
    if (!cardType) return { success: false, error: 'invalid-card-type' };

    const hand = room.hands[socketId];
    if (!hand) return { success: false, error: 'no-hand' };

    room.lastPlay = {
      playerIndex,
      cards,
      cardType,
    };

    room.roundHistory.push({ ...room.lastPlay });

    const previousBest = room.currentRoundBest;
    const willBeNewBest = !previousBest || canBeat(cards, previousBest.cards);

    if (willBeNewBest) {
      room.currentRoundBest = room.lastPlay;
    }
    room.passCount = 0;

    room.hands[socketId] = removeCardsFromHand(hand, cards);

    if (room.hands[socketId]?.length === 0) {
      room.finishedPlayers.push(socketId);

      if (room.finishedPlayers.length === 3) {
        const lastPlayer = room.players.find(p => p !== null && !room.finishedPlayers.includes(p!));
        if (lastPlayer) {
          const lastPlayerIndex = room.players.indexOf(lastPlayer);
          if (room.teams) {
            if (room.teams.mode === '2v2') {
              const isTeamA = room.teams.A.includes(socketId);
              room.scores[isTeamA ? 'A' : 'B'] += 2;
            } else {
              if (socketId === room.teams.solo) {
                room.scores.B += 3;
              } else {
                room.scores.A += 1;
              }
            }
          }
        }
        room.state = 'finished';
        return { success: true, room };
      }

      const nextPlayer = advanceToNextPlayer(room);
      room.roundStarter = playerIndex;
      room.currentPlayerIndex = nextPlayer;
      room.lastPlay = null;
      room.currentRoundBest = null;
      room.roundHistory = [];
      room.passCount = 0;

      return { success: true, room };
    }

    const nextPlayer = advanceToNextPlayer(room);
    const isBomb = ['bomb-4', 'bomb-5-10-k', 'bomb-4-pair', 'sky-bomb'].includes(cardType);

    let newRoundStarter: number;
    if (isBomb && room.lastPlay) {
      newRoundStarter = nextPlayer;
    } else {
      newRoundStarter = playerIndex;
    }

    if (newRoundStarter !== room.roundStarter) {
      room.roundStarter = newRoundStarter;
    }

    room.currentPlayerIndex = nextPlayer;

    return { success: true, room };
  },

  handlePass(socketId: string, roomId: string, rooms: Map<string, BaseRoom>): { success: boolean; room?: HongARoom; error?: string } {
    const room = rooms.get(roomId) as HongARoom | undefined;
    if (!room) {
      return { success: false, error: 'room-not-found' };
    }

    if (room.state !== 'playing') {
      return { success: false, error: 'game-not-started' };
    }

    const playerIndex = room.players.findIndex(p => p === socketId);
    if (playerIndex === -1) {
      return { success: false, error: 'not-in-room' };
    }

    if (room.currentPlayerIndex !== playerIndex) {
      return { success: false, error: 'not-your-turn' };
    }

    if (!room.lastPlay) {
      return { success: false, error: 'cannot-pass-first' };
    }

    room.passCount++;

    const activePlayers = room.players.filter(p => p !== null).length;
    if (room.passCount >= activePlayers - 1) {
      room.currentRoundBest = null;
      room.lastPlay = null;
      room.roundHistory = [];
      room.passCount = 0;
      room.currentPlayerIndex = room.roundStarter;
      return { success: true, room };
    }

    const nextPlayer = advanceToNextPlayer(room);
    room.currentPlayerIndex = nextPlayer;

    return { success: true, room };
  },

  restartGame(socketId: string, roomId: string, rooms: Map<string, BaseRoom>): { success: boolean; room?: HongARoom; error?: string } {
    const room = rooms.get(roomId) as HongARoom | undefined;
    if (!room) {
      return { success: false, error: 'room-not-found' };
    }

    const playerIndex = room.players.findIndex(p => p === socketId);
    if (playerIndex === -1) {
      return { success: false, error: 'not-in-room' };
    }

    const deck = shuffleDeck(createDeck());
    const hands: Record<string, Card[]> = {};
    for (let i = 0; i < 4; i++) {
      const playerId = room.players[i] || `player_${i}`;
      hands[playerId] = deck.slice(i * 13, (i + 1) * 13);
    }

    room.hands = hands;

    room.currentPlayerIndex = -1;
    room.lastPlay = null;
    room.scores = { A: 0, B: 0 };
    room.teams = null;
    room.finishedPlayers = [];
    room.deck = deck;
    room.state = room.players.every(p => p !== null) ? 'playing' : 'waiting';

    if (room.state === 'playing') {
      room.teams = determineTeams(room);
      room.currentPlayerIndex = findFirstPlayer(room);
    }

    return { success: true, room };
  },

  getPlayerIndex(roomId: string, socketId: string, rooms: Map<string, BaseRoom>): number | null {
    const room = rooms.get(roomId) as HongARoom | undefined;
    if (!room) return null;
    return room.players.findIndex(p => p === socketId);
  },

  getOpponentSocketIds(roomId: string, socketId: string, rooms: Map<string, BaseRoom>): string[] {
    const room = rooms.get(roomId) as HongARoom | undefined;
    if (!room) return [];
    return room.players.filter(p => p !== null && p !== socketId) as string[];
  },
};

export { HongARoom };