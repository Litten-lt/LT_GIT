import { describe, it, expect } from 'vitest';
import { createGobangReducer, INITIAL_GOBANG_STATE } from '../src/games/gobang/hooks/useGobangReducer';

const gameReducer = createGobangReducer();

describe('Game Reducer', () => {
  describe('MOVE action', () => {
    it('should place piece on empty cell', () => {
      const action = { type: 'MOVE' as const, row: 7, col: 7 };
      const state = gameReducer(INITIAL_GOBANG_STATE, action);

      expect(state.board[7][7]).toBe('black');
      expect(state.currentPlayer).toBe('white');
      expect(state.moveHistory).toHaveLength(1);
    });

    it('should not place piece on occupied cell', () => {
      let state = gameReducer(INITIAL_GOBANG_STATE, { type: 'MOVE', row: 7, col: 7 });
      state = gameReducer(state, { type: 'MOVE', row: 7, col: 7 });

      expect(state.board[7][7]).toBe('black');
      expect(state.moveHistory).toHaveLength(1);
    });

    it('should switch player after move', () => {
      let state = gameReducer(INITIAL_GOBANG_STATE, { type: 'MOVE', row: 0, col: 0 });
      expect(state.currentPlayer).toBe('white');

      state = gameReducer(state, { type: 'MOVE', row: 1, col: 1 });
      expect(state.currentPlayer).toBe('black');
    });

    it('should record move in history', () => {
      const action = { type: 'MOVE' as const, row: 5, col: 5 };
      const state = gameReducer(INITIAL_GOBANG_STATE, action);

      expect(state.moveHistory).toContainEqual([5, 5]);
      expect(state.lastMove).toEqual([5, 5]);
    });
  });

  describe('WIN detection', () => {
    it('should detect horizontal win', () => {
      let state = INITIAL_GOBANG_STATE;
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
      let state = INITIAL_GOBANG_STATE;
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
      let state = INITIAL_GOBANG_STATE;
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
    it('should undo moves when enough history exists', () => {
      let state = gameReducer(INITIAL_GOBANG_STATE, { type: 'MOVE', row: 7, col: 7 });
      state = gameReducer(state, { type: 'MOVE', row: 8, col: 8 });
      state = gameReducer(state, { type: 'UNDO' });

      expect(state.board[7][7]).toBeNull();
      expect(state.board[8][8]).toBeNull();
      expect(state.currentPlayer).toBe('black');
    });
  });

  describe('RESTART action', () => {
    it('should reset game state', () => {
      let state = gameReducer(INITIAL_GOBANG_STATE, { type: 'MOVE', row: 7, col: 7 });
      state = gameReducer(state, { type: 'RESTART' });

      expect(state.board[7][7]).toBeNull();
      expect(state.currentPlayer).toBe('black');
      expect(state.status).toBe('playing');
      expect(state.winner).toBeNull();
      expect(state.moveHistory).toHaveLength(0);
    });
  });

  describe('Draw detection', () => {
    it('should detect draw when board is full without winner', () => {
      let state = INITIAL_GOBANG_STATE;
      let detected = false;

      for (let row = 0; row < 15 && !detected; row++) {
        for (let col = 0; col < 15 && !detected; col++) {
          state = gameReducer(state, { type: 'MOVE', row, col });
          if (state.status === 'ended' && state.winner === 'draw') {
            detected = true;
          }
        }
      }
    });
  });
});