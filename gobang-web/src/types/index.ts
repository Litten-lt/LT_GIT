export type Player = 'black' | 'white';
export type Cell = Player | null;
export type Board = Cell[][];
export type GameMode = 'pvp' | 'ai';
export type Difficulty = 'easy' | 'medium' | 'hard';
export type GameStatus = 'playing' | 'ended';

export interface GameState {
  board: Board;
  currentPlayer: Player;
  gameMode: GameMode;
  difficulty: Difficulty;
  status: GameStatus;
  winner: Player | 'draw' | null;
  moveHistory: [number, number][];
  lastMove: [number, number] | null;
  winningLine: [number, number][] | null;
}

export type GameAction =
  | { type: 'MOVE'; row: number; col: number }
  | { type: 'UNDO' }
  | { type: 'RESTART' }
  | { type: 'SET_MODE'; mode: GameMode }
  | { type: 'SET_DIFFICULTY'; difficulty: Difficulty }
  | { type: 'AI_MOVE'; row: number; col: number };

export const BOARD_SIZE = 15;
export const WIN_COUNT = 5;

export const EMPTY_BOARD: Board = Array(BOARD_SIZE)
  .fill(null)
  .map(() => Array(BOARD_SIZE).fill(null));

export const INITIAL_STATE: GameState = {
  board: EMPTY_BOARD.map(row => [...row]),
  currentPlayer: 'black',
  gameMode: 'pvp',
  difficulty: 'medium',
  status: 'playing',
  winner: null,
  moveHistory: [],
  lastMove: null,
  winningLine: null,
};

export function createEmptyBoard(): Board {
  return Array(BOARD_SIZE)
    .fill(null)
    .map(() => Array(BOARD_SIZE).fill(null));
}