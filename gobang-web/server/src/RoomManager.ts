import {
  Room,
  createEmptyBoard,
  generateRoomId,
  checkWin,
  isBoardFull,
  isValidMove,
} from './types';

export class RoomManager {
  private rooms: Map<string, Room> = new Map();

  createRoom(socketId: string): Room {
    let roomId = generateRoomId();
    while (this.rooms.has(roomId)) {
      roomId = generateRoomId();
    }

    const room: Room = {
      id: roomId,
      players: [socketId, null],
      state: 'waiting',
      board: createEmptyBoard(),
      currentPlayer: 'black',
      moveHistory: [],
      winner: null,
      winningLine: null,
      createdAt: Date.now(),
    };

    this.rooms.set(roomId, room);
    return room;
  }

  joinRoom(socketId: string, roomId: string): { room: Room; playerIndex: 0 | 1 } | { error: string } {
    const room = this.rooms.get(roomId);
    if (!room) {
      return { error: 'room-not-found' };
    }

    if (room.players[1] !== null) {
      return { error: 'room-full' };
    }

    if (room.players[0] === socketId) {
      return { room, playerIndex: 0 };
    }

    room.players[1] = socketId;
    room.state = 'playing';

    return { room, playerIndex: 1 };
  }

  leaveRoom(socketId: string, roomId: string): void {
    const room = this.rooms.get(roomId);
    if (!room) return;

    if (room.players[0] === socketId) {
      room.players[0] = null;
    } else if (room.players[1] === socketId) {
      room.players[1] = null;
    }

    if (room.players[0] === null && room.players[1] === null) {
      this.rooms.delete(roomId);
    }
  }

  makeMove(
    socketId: string,
    roomId: string,
    row: number,
    col: number
  ): { success: true; room: Room } | { success: false; error: string } {
    const room = this.rooms.get(roomId);
    if (!room) {
      return { success: false, error: 'room-not-found' };
    }

    if (room.state === 'ended') {
      return { success: false, error: 'game-ended' };
    }

    const playerIndex = room.players[0] === socketId ? 0 : room.players[1] === socketId ? 1 : -1;
    if (playerIndex === -1) {
      return { success: false, error: 'not-in-room' };
    }

    const expectedPlayer: 'black' | 'white' = playerIndex === 0 ? 'black' : 'white';
    if (room.currentPlayer !== expectedPlayer) {
      return { success: false, error: 'not-your-turn' };
    }

    if (!isValidMove(room.board, row, col)) {
      return { success: false, error: 'cell-occupied' };
    }

    room.board[row][col] = expectedPlayer;
    room.moveHistory.push([row, col]);

    const winningLine = checkWin(room.board, row, col, expectedPlayer);
    if (winningLine) {
      room.state = 'ended';
      room.winner = expectedPlayer;
      room.winningLine = winningLine;
    } else if (isBoardFull(room.board)) {
      room.state = 'ended';
      room.winner = 'draw';
      room.winningLine = null;
    } else {
      room.currentPlayer = expectedPlayer === 'black' ? 'white' : 'black';
    }

    return { success: true, room };
  }

  restartGame(socketId: string, roomId: string): { success: true; room: Room } | { success: false; error: string } {
    const room = this.rooms.get(roomId);
    if (!room) {
      return { success: false, error: 'room-not-found' };
    }

    const playerIndex = room.players[0] === socketId ? 0 : room.players[1] === socketId ? 1 : -1;
    if (playerIndex === -1) {
      return { success: false, error: 'not-in-room' };
    }

    room.board = createEmptyBoard();
    room.currentPlayer = 'black';
    room.moveHistory = [];
    room.winner = null;
    room.winningLine = null;
    room.state = room.players[0] !== null && room.players[1] !== null ? 'playing' : 'waiting';

    return { success: true, room };
  }

  getRoom(roomId: string): Room | undefined {
    return this.rooms.get(roomId);
  }

  getPlayerIndex(roomId: string, socketId: string): 0 | 1 | null {
    const room = this.rooms.get(roomId);
    if (!room) return null;
    if (room.players[0] === socketId) return 0;
    if (room.players[1] === socketId) return 1;
    return null;
  }

  getOpponentSocketId(roomId: string, socketId: string): string | null {
    const room = this.rooms.get(roomId);
    if (!room) return null;
    if (room.players[0] === socketId) return room.players[1];
    if (room.players[1] === socketId) return room.players[0];
    return null;
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