export type RoomState = 'waiting' | 'ready' | 'playing' | 'ended' | 'finished';

export interface BaseRoom {
  id: string;
  gameId: string;
  players: (string | null)[];
  state: RoomState;
  createdAt: number;
}

export interface GameMoveResult {
  success: boolean;
  error?: string;
}

export interface JoinRoomResult {
  success: boolean;
  room?: BaseRoom;
  playerIndex?: number;
  error?: string;
}

export interface GameHandler {
  gameId: string;
  maxPlayers: number;
  createRoom(socketId: string): BaseRoom;
  joinRoom(socketId: string, roomId: string, rooms: Map<string, BaseRoom>): JoinRoomResult;
  handleMove(socketId: string, roomId: string, move: any, rooms: Map<string, BaseRoom>): { success: boolean; room?: BaseRoom; error?: string };
  handlePass?(socketId: string, roomId: string, rooms: Map<string, BaseRoom>): { success: boolean; room?: BaseRoom; error?: string };
  startGame?(socketId: string, roomId: string, rooms: Map<string, BaseRoom>): { success: boolean; room?: BaseRoom; error?: string };
  restartGame(socketId: string, roomId: string, rooms: Map<string, BaseRoom>): { success: boolean; room?: BaseRoom; error?: string };
  getPlayerIndex(roomId: string, socketId: string, rooms: Map<string, BaseRoom>): number | null;
  getOpponentSocketIds(roomId: string, socketId: string, rooms: Map<string, BaseRoom>): string[];
}

export function generateRoomId(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export const GOBANG_GAME_ID = 'gobang';
export const HONGA_GAME_ID = 'honga';