import { BaseRoom, GameHandler, generateRoomId } from '../../types';
import {
  HongARoom,
  Card,
  CardGroup,
  createDeck,
  shuffleDeck,
  TeamInfo,
  HONGA_GAME_ID,
} from './types';

function determineTeams(room: HongARoom): TeamInfo {
  const players = room.players.filter(p => p !== null) as string[];
  const spadeAHolder = players.find(pid => {
    const hand = room.hands.get(pid);
    return hand?.some(c => c.suit === 'diamond' && c.rank === 14);
  });
  const heartAHolder = players.find(pid => {
    const hand = room.hands.get(pid);
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
    const hand = room.hands.get(pid);
    return hand?.some(c => c.suit === 'spade' && c.rank === 3);
  });
  return spade3Index !== -1 ? spade3Index : 0;
}

export const HongAHandler: GameHandler = {
  gameId: HONGA_GAME_ID,
  maxPlayers: 4,

  createRoom(socketId: string): HongARoom {
    const roomId = generateRoomId();

    const deck = shuffleDeck(createDeck());
    const hands = new Map<string, Card[]>();
    for (let i = 0; i < 4; i++) {
      const playerId = `player_${i}`;
      hands.set(playerId, deck.slice(i * 13, (i + 1) * 13));
    }

    const room: HongARoom = {
      id: roomId,
      gameId: HONGA_GAME_ID,
      players: [socketId, null, null, null],
      hands,
      currentPlayerIndex: -1,
      lastPlay: null,
      scores: { A: 0, B: 0 },
      teams: null,
      finishedPlayers: [],
      deck,
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
      room.state = 'playing';
      room.teams = determineTeams(room);
      room.currentPlayerIndex = findFirstPlayer(room);
    }

    return { success: true, room, playerIndex: emptySlot };
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

    const cards: CardGroup = move.cards;

    room.lastPlay = {
      playerIndex,
      cards,
      cardType: 'single',
    };

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
    room.hands = new Map<string, Card[]>();
    for (let i = 0; i < 4; i++) {
      const playerId = room.players[i] || `player_${i}`;
      room.hands.set(playerId, deck.slice(i * 13, (i + 1) * 13));
    }

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