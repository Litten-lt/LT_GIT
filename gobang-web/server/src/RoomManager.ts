import { BaseRoom, GameHandler, generateRoomId } from './types';

export class RoomManager {
  private rooms: Map<string, BaseRoom> = new Map();
  private gameHandlers: Map<string, GameHandler> = new Map();

  registerGame(handler: GameHandler): void {
    this.gameHandlers.set(handler.gameId, handler);
  }

  getHandler(gameId: string): GameHandler | undefined {
    return this.gameHandlers.get(gameId);
  }

  createRoom(socketId: string, gameId: string): BaseRoom | null {
    const handler = this.gameHandlers.get(gameId);
    if (!handler) {
      console.log(`[RoomManager] No handler for game: ${gameId}`);
      return null;
    }

    let roomId = generateRoomId();
    while (this.rooms.has(roomId)) {
      roomId = generateRoomId();
    }

    const room = handler.createRoom(socketId);
    room.id = roomId;
    this.rooms.set(roomId, room);

    console.log(`[RoomManager] Room created: ${roomId} for ${gameId} by ${socketId}`);
    return room;
  }

  joinRoom(socketId: string, roomId: string, gameId: string): { room: BaseRoom; playerIndex: number } | { error: string } {
    const room = this.rooms.get(roomId);
    if (!room) {
      return { error: 'room-not-found' };
    }

    if (room.gameId !== gameId) {
      return { error: 'room-not-found' };
    }

    const handler = this.gameHandlers.get(gameId);
    if (!handler) {
      return { error: 'game-not-supported' };
    }

    const result = handler.joinRoom(socketId, roomId, this.rooms);
    if (!result.success || !result.room) {
      return { error: result.error || 'join-failed' };
    }

    this.rooms.set(roomId, result.room);
    return { room: result.room, playerIndex: result.playerIndex! };
  }

  leaveRoom(socketId: string, roomId: string): void {
    const room = this.rooms.get(roomId);
    if (!room) return;

    const handler = this.gameHandlers.get(room.gameId);
    if (!handler) return;

    const playerIndex = room.players.findIndex(p => p === socketId);
    if (playerIndex !== -1) {
      room.players[playerIndex] = null;
    }

    if (room.players.every(p => p === null)) {
      this.rooms.delete(roomId);
      console.log(`[RoomManager] Room deleted: ${roomId}`);
    } else {
      this.rooms.set(roomId, room);
    }
  }

  handleMove(socketId: string, roomId: string, move: any): { success: boolean; room?: BaseRoom; error?: string } {
    const room = this.rooms.get(roomId);
    if (!room) {
      return { success: false, error: 'room-not-found' };
    }

    const handler = this.gameHandlers.get(room.gameId);
    if (!handler) {
      return { success: false, error: 'game-not-supported' };
    }

    const result = handler.handleMove(socketId, roomId, move, this.rooms);
    if (result.success && result.room) {
      this.rooms.set(roomId, result.room);
    }

    return result;
  }

  restartGame(socketId: string, roomId: string): { success: boolean; room?: BaseRoom; error?: string } {
    const room = this.rooms.get(roomId);
    if (!room) {
      return { success: false, error: 'room-not-found' };
    }

    const handler = this.gameHandlers.get(room.gameId);
    if (!handler) {
      return { success: false, error: 'game-not-supported' };
    }

    const result = handler.restartGame(socketId, roomId, this.rooms);
    if (result.success && result.room) {
      this.rooms.set(roomId, result.room);
    }

    return result;
  }

  startGame(socketId: string, roomId: string): { success: boolean; room?: BaseRoom; error?: string } {
    const room = this.rooms.get(roomId);
    if (!room) {
      return { success: false, error: 'room-not-found' };
    }

    const handler = this.gameHandlers.get(room.gameId);
    if (!handler) {
      return { success: false, error: 'game-not-supported' };
    }

    if (!handler.startGame) {
      return { success: false, error: 'method-not-supported' };
    }

    const result = handler.startGame(socketId, roomId, this.rooms);
    if (result.success && result.room) {
      this.rooms.set(roomId, result.room);
    }

    return result;
  }

  handlePass(socketId: string, roomId: string): { success: boolean; room?: BaseRoom; error?: string } {
    const room = this.rooms.get(roomId);
    if (!room) {
      return { success: false, error: 'room-not-found' };
    }

    const handler = this.gameHandlers.get(room.gameId);
    if (!handler) {
      return { success: false, error: 'game-not-supported' };
    }

    if (!handler.handlePass) {
      return { success: false, error: 'method-not-supported' };
    }

    const result = handler.handlePass(socketId, roomId, this.rooms);
    if (result.success && result.room) {
      this.rooms.set(roomId, result.room);
    }

    return result;
  }

  getRoom(roomId: string): BaseRoom | undefined {
    return this.rooms.get(roomId);
  }

  getPlayerIndex(roomId: string, socketId: string): number | null {
    const room = this.rooms.get(roomId);
    if (!room) return null;

    const handler = this.gameHandlers.get(room.gameId);
    if (!handler) return null;

    return handler.getPlayerIndex(roomId, socketId, this.rooms);
  }

  getOpponentSocketIds(roomId: string, socketId: string): string[] {
    const room = this.rooms.get(roomId);
    if (!room) return [];

    const handler = this.gameHandlers.get(room.gameId);
    if (!handler) return [];

    return handler.getOpponentSocketIds(roomId, socketId, this.rooms);
  }

  cleanupInactiveRooms(maxAgeMs: number = 30 * 60 * 1000): number {
    const now = Date.now();
    let removed = 0;
    for (const [roomId, room] of this.rooms) {
      if (now - room.createdAt > maxAgeMs) {
        this.rooms.delete(roomId);
        removed++;
      }
    }
    return removed;
  }
}