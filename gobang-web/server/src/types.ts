export type Player = 'black' | 'white';
export type Cell = Player | null;
export type Board = Cell[][];

export const BOARD_SIZE = 15;
export const WIN_COUNT = 5;

export type RoomState = 'waiting' | 'playing' | 'ended';

export interface Room {
  id: string;
  players: [string | null, string | null];
  state: RoomState;
  board: Board;
  currentPlayer: Player;
  moveHistory: [number, number][];
  winner: Player | 'draw' | null;
  winningLine: [number, number][] | null;
  createdAt: number;
}

export interface ServerToClientEvents {
  'room-created': (data: { room: Room; playerIndex: 0 }) => void;
  'room-joined': (data: { room: Room; playerIndex: 0 | 1 }) => void;
  'player-joined': (data: { room: Room }) => void;
  'opponent-move': (data: { row: number; col: number; player: Player }) => void;
  'game-over': (data: { winner: Player | 'draw'; winningLine?: [number, number][] }) => void;
  'restart-approved': (data: { room: Room }) => void;
  'restart-denied': (data: {}) => void;
  'opponent-left': (data: {}) => void;
  'error': (data: { message: string; code?: string }) => void;
  'room-state': (data: { room: Room }) => void;
}

export interface ClientToServerEvents {
  'create-room': () => void;
  'join-room': (data: { roomId: string }) => void;
  'leave-room': (data: { roomId: string }) => void;
  'make-move': (data: { roomId: string; row: number; col: number }) => void;
  'restart-game': (data: { roomId: string }) => void;
}

export function createEmptyBoard(): Board {
  return Array(BOARD_SIZE)
    .fill(null)
    .map(() => Array(BOARD_SIZE).fill(null));
}

export function checkWin(board: Board, row: number, col: number, player: Player): [number, number][] | null {
  const directions = [
    [0, 1],
    [1, 0],
    [1, 1],
    [1, -1],
  ];

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

export function isBoardFull(board: Board): boolean {
  for (let row = 0; row < BOARD_SIZE; row++) {
    for (let col = 0; col < BOARD_SIZE; col++) {
      if (board[row][col] === null) {
        return false;
      }
    }
  }
  return true;
}

export function isValidMove(board: Board, row: number, col: number): boolean {
  return row >= 0 && row < BOARD_SIZE && col >= 0 && col < BOARD_SIZE && board[row][col] === null;
}

export function generateRoomId(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}