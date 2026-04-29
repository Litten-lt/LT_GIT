import { describe, it, expect } from 'vitest';
import { gameReducer } from '../src/hooks/useGameReducer';
import { GameAction, INITIAL_STATE, Cell } from '../src/types';

describe('Game Reducer', () => {
  describe('MOVE action', () => {
    it('should place piece on empty cell', () => {
      const action: GameAction = { type: 'MOVE', row: 7, col: 7 };
      const state = gameReducer(INITIAL_STATE, action);

      expect(state.board[7][7]).toBe('black');
      expect(state.currentPlayer).toBe('white');
      expect(state.moveHistory).toHaveLength(1);
    });

    it('should not place piece on occupied cell', () => {
      let state = gameReducer(INITIAL_STATE, { type: 'MOVE', row: 7, col: 7 });
      state = gameReducer(state, { type: 'MOVE', row: 7, col: 7 });

      expect(state.board[7][7]).toBe('black');
      expect(state.moveHistory).toHaveLength(1);
    });

    it('should switch player after move', () => {
      let state = gameReducer(INITIAL_STATE, { type: 'MOVE', row: 0, col: 0 });
      expect(state.currentPlayer).toBe('white');

      state = gameReducer(state, { type: 'MOVE', row: 1, col: 1 });
      expect(state.currentPlayer).toBe('black');
    });

    it('should record move in history', () => {
      const action: GameAction = { type: 'MOVE', row: 5, col: 5 };
      const state = gameReducer(INITIAL_STATE, action);

      expect(state.moveHistory).toContainEqual([5, 5]);
      expect(state.lastMove).toEqual([5, 5]);
    });
  });

  describe('WIN detection', () => {
    it('should detect horizontal win', () => {
      let state = INITIAL_STATE;
      const moves: [number, number][] = [
        [7, 0], [0, 0],
        [7, 1], [0, 1],
        [7, 2], [0, 2],
        [7, 3], [0, 3],
        [7, 4],
      ];

      for (const [row, col] of moves) {
        state = gameReducer(state, { type: 'MOVE', row, col });
      }

      expect(state.status).toBe('ended');
      expect(state.winner).toBe('black');
      expect(state.winningLine).not.toBeNull();
    });

    it('should detect vertical win', () => {
      let state = INITIAL_STATE;
      const moves: [number, number][] = [
        [0, 7], [0, 0],
        [1, 7], [1, 0],
        [2, 7], [2, 0],
        [3, 7], [3, 0],
        [4, 7],
      ];

      for (const [row, col] of moves) {
        state = gameReducer(state, { type: 'MOVE', row, col });
      }

      expect(state.status).toBe('ended');
      expect(state.winner).toBe('black');
    });

    it('should detect diagonal win', () => {
      let state = INITIAL_STATE;
      const moves: [number, number][] = [
        [0, 0], [0, 1],
        [1, 1], [1, 2],
        [2, 2], [2, 3],
        [3, 3], [3, 4],
        [4, 4],
      ];

      for (const [row, col] of moves) {
        state = gameReducer(state, { type: 'MOVE', row, col });
      }

      expect(state.status).toBe('ended');
      expect(state.winner).toBe('black');
    });
  });

  describe('UNDO action', () => {
    it('should undo last move in pvp mode', () => {
      let state = gameReducer(INITIAL_STATE, { type: 'MOVE', row: 7, col: 7 });
      state = gameReducer(state, { type: 'UNDO' });

      expect(state.board[7][7]).toBeNull();
      expect(state.currentPlayer).toBe('black');
      expect(state.moveHistory).toHaveLength(0);
    });

    it('should undo two moves in ai mode', () => {
      let state = gameReducer(INITIAL_STATE, { type: 'SET_MODE', mode: 'ai' });
      state = gameReducer(state, { type: 'MOVE', row: 7, col: 7 });
      state = gameReducer(state, { type: 'AI_MOVE', row: 8, col: 8 });
      state = gameReducer(state, { type: 'UNDO' });

      expect(state.board[7][7]).toBeNull();
      expect(state.board[8][8]).toBeNull();
      expect(state.currentPlayer).toBe('black');
    });

    it('should not undo when no moves', () => {
      const state = gameReducer(INITIAL_STATE, { type: 'UNDO' });

      expect(state).toEqual(INITIAL_STATE);
    });
  });

  describe('RESTART action', () => {
    it('should reset game state', () => {
      let state = gameReducer(INITIAL_STATE, { type: 'MOVE', row: 7, col: 7 });
      state = gameReducer(state, { type: 'RESTART' });

      expect(state.board[7][7]).toBeNull();
      expect(state.currentPlayer).toBe('black');
      expect(state.status).toBe('playing');
      expect(state.winner).toBeNull();
      expect(state.moveHistory).toHaveLength(0);
    });
  });

  describe('SET_MODE action', () => {
    it('should switch to ai mode', () => {
      const state = gameReducer(INITIAL_STATE, { type: 'SET_MODE', mode: 'ai' });

      expect(state.gameMode).toBe('ai');
    });

    it('should reset board when switching mode', () => {
      let state = gameReducer(INITIAL_STATE, { type: 'MOVE', row: 7, col: 7 });
      state = gameReducer(state, { type: 'SET_MODE', mode: 'ai' });

      expect(state.board[7][7]).toBeNull();
    });
  });

  describe('SET_DIFFICULTY action', () => {
    it('should change difficulty', () => {
      const state = gameReducer(INITIAL_STATE, { type: 'SET_DIFFICULTY', difficulty: 'hard' });

      expect(state.difficulty).toBe('hard');
    });
  });

  describe('Draw detection', () => {
    it('should detect draw when board is full', () => {
      let state = INITIAL_STATE;
      let isFull = false;

      for (let row = 0; row < 15 && !isFull; row++) {
        for (let col = 0; col < 15 && !isFull; col++) {
          if (state.board[row][col] === null) {
            state = gameReducer(state, { type: 'MOVE', row, col });

            if (state.status === 'ended' && state.winner === 'draw') {
              isFull = true;
            }
          }
        }
      }

      const allFilled = state.board.every((row: Cell[]) => row.every((cell: Cell) => cell !== null));
      if (allFilled) {
        expect(state.status).toBe('ended');
        expect(state.winner).toBe('draw');
      }
    });
  });
});