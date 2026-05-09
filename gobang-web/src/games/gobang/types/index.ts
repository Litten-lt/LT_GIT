import { Board, Player, WIN_COUNT, BOARD_SIZE } from '../../../types';

export interface GobangState {
  board: Board;
  currentPlayer: Player;
  status: 'playing' | 'ended';
  winner: Player | 'draw' | null;
  moveHistory: [number, number][];
  lastMove: [number, number] | null;
  winningLine: [number, number][] | null;
}

export type GobangAction =
  | { type: 'MOVE'; row: number; col: number }
  | { type: 'AI_MOVE'; row: number; col: number }
  | { type: 'UNDO' }
  | { type: 'RESTART' }
  | { type: 'SET_MODE'; mode: 'pvp' | 'ai' }
  | { type: 'SET_DIFFICULTY'; difficulty: 'easy' | 'medium' | 'hard' };

export const INITIAL_GOBANG_STATE: GobangState = {
  board: Array(BOARD_SIZE).fill(null).map(() => Array(BOARD_SIZE).fill(null)),
  currentPlayer: 'black',
  status: 'playing',
  winner: null,
  moveHistory: [],
  lastMove: null,
  winningLine: null,
};

export { BOARD_SIZE, WIN_COUNT };
export type { Board, Player };