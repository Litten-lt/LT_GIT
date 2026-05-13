import { BaseRoom, GameHandler, generateRoomId, GOBANG_GAME_ID } from '../../types';

export { GOBANG_GAME_ID };

export type Player = 'black' | 'white';
export type Cell = Player | null;
export type Board = Cell[][];

export const BOARD_SIZE = 15;
export const WIN_COUNT = 5;

export interface GobangRoom extends BaseRoom {
  gameId: typeof GOBANG_GAME_ID;
  players: [string | null, string | null];
  board: Board;
  currentPlayer: Player;
  moveHistory: [number, number][];
  winner: Player | 'draw' | null;
  winningLine: [number, number][] | null;
}

function createEmptyBoard(): Board {
  return Array(BOARD_SIZE)
    .fill(null)
    .map(() => Array(BOARD_SIZE).fill(null));
}

function checkWin(board: Board, row: number, col: number, player: Player): [number, number][] | null {
  const directions = [[0, 1], [1, 0], [1, 1], [1, -1]];

  for (const [dx, dy] of directions) {
    const line: [number, number][] = [[row, col]];

    for (let dir = 1; dir <= 4; dir++) {
      const r = row + dx * dir;
      const c = col + dy * dir;
      if (r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE && board[r][c] === player) {
        line.push([r, c]);
      } else {
        break;
      }
    }

    for (let dir = -1; dir >= -4; dir--) {
      const r = row + dx * dir;
      const c = col + dy * dir;
      if (r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE && board[r][c] === player) {
        line.push([r, c]);
      } else {
        break;
      }
    }

    if (line.length >= WIN_COUNT) {
      return line;
    }
  }

  return null;
}

function isBoardFull(board: Board): boolean {
  for (let row = 0; row < BOARD_SIZE; row++) {
    for (let col = 0; col < BOARD_SIZE; col++) {
      if (board[row][col] === null) {
        return false;
      }
    }
  }
  return true;
}

function isValidMove(board: Board, row: number, col: number): boolean {
  return row >= 0 && row < BOARD_SIZE && col >= 0 && col < BOARD_SIZE && board[row][col] === null;
}

export const GobangHandler: GameHandler = {
  gameId: GOBANG_GAME_ID,
  maxPlayers: 2,

  createRoom(socketId: string): GobangRoom {
    const room: GobangRoom = {
      id: '',
      gameId: GOBANG_GAME_ID,
      players: [socketId, null],
      state: 'waiting',
      board: createEmptyBoard(),
      currentPlayer: 'black',
      moveHistory: [],
      winner: null,
      winningLine: null,
      createdAt: Date.now(),
    };

    return room;
  },

  joinRoom(socketId: string, roomId: string, rooms: Map<string, BaseRoom>): { success: boolean; room?: GobangRoom; playerIndex?: number; error?: string } {
    const room = rooms.get(roomId) as GobangRoom | undefined;
    if (!room) {
      return { success: false, error: 'room-not-found' };
    }

    if (room.gameId !== GOBANG_GAME_ID) {
      return { success: false, error: 'room-not-found' };
    }

    if (room.players[1] !== null) {
      return { success: false, error: 'room-full' };
    }

    if (room.players[0] === socketId) {
      return { success: true, room, playerIndex: 0 };
    }

    room.players[1] = socketId;
    room.state = 'playing';

    return { success: true, room, playerIndex: 1 };
  },

  handleMove(socketId: string, roomId: string, move: any, rooms: Map<string, BaseRoom>): { success: boolean; room?: GobangRoom; error?: string } {
    const room = rooms.get(roomId) as GobangRoom | undefined;
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

    const expectedPlayer: Player = playerIndex === 0 ? 'black' : 'white';
    if (room.currentPlayer !== expectedPlayer) {
      return { success: false, error: 'not-your-turn' };
    }

    const { row, col } = move;
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
  },

  restartGame(socketId: string, roomId: string, rooms: Map<string, BaseRoom>): { success: boolean; room?: GobangRoom; error?: string } {
    const room = rooms.get(roomId) as GobangRoom | undefined;
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
  },

  getPlayerIndex(roomId: string, socketId: string, rooms: Map<string, BaseRoom>): number | null {
    const room = rooms.get(roomId) as GobangRoom | undefined;
    if (!room) return null;
    if (room.players[0] === socketId) return 0;
    if (room.players[1] === socketId) return 1;
    return null;
  },

  getOpponentSocketIds(roomId: string, socketId: string, rooms: Map<string, BaseRoom>): string[] {
    const room = rooms.get(roomId) as GobangRoom | undefined;
    if (!room) return [];
    const opponents: string[] = [];
    if (room.players[0] === socketId && room.players[1]) opponents.push(room.players[1]);
    if (room.players[1] === socketId && room.players[0]) opponents.push(room.players[0]);
    return opponents;
  },
};