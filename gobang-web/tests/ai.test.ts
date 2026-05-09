import { describe, it, expect } from 'vitest';
import { findBestMove, AI_DEPTHS } from '../src/games/gobang/ai';
import { Board } from '../src/types';

function createEmptyBoard(): Board {
  return Array(15).fill(null).map(() => Array(15).fill(null));
}

describe('AI Algorithm', () => {
  describe('findBestMove', () => {
    it('should return center position on empty board', () => {
      const board = createEmptyBoard();
      const result = findBestMove(board, 'black', AI_DEPTHS.easy);

      expect(result.row).toBe(7);
      expect(result.col).toBe(7);
    });

    it('should return valid move within board bounds', () => {
      const board = createEmptyBoard();
      board[7][7] = 'black';
      const result = findBestMove(board, 'white', AI_DEPTHS.easy);

      expect(result.row).toBeGreaterThanOrEqual(0);
      expect(result.row).toBeLessThanOrEqual(14);
      expect(result.col).toBeGreaterThanOrEqual(0);
      expect(result.col).toBeLessThanOrEqual(14);
    });

    it('should not return occupied position', () => {
      const board = createEmptyBoard();
      board[7][7] = 'black';
      const result = findBestMove(board, 'white', AI_DEPTHS.easy);

      expect(board[result.row][result.col]).toBeNull();
    });

    it('should find winning move when available', () => {
      const board = createEmptyBoard();
      board[0][0] = 'black';
      board[0][1] = 'black';
      board[0][2] = 'black';
      board[0][3] = 'black';

      const result = findBestMove(board, 'black', AI_DEPTHS.easy);

      expect(result.row).toBe(0);
      expect(result.col).toBe(4);
    });

    it('should block opponent winning move', () => {
      const board = createEmptyBoard();
      board[0][0] = 'white';
      board[0][1] = 'white';
      board[0][2] = 'white';
      board[0][3] = 'white';

      const result = findBestMove(board, 'black', AI_DEPTHS.easy);

      expect(result.row).toBe(0);
      expect(result.col).toBe(4);
    });
  });

  describe('AI_DEPTHS', () => {
    it('should have correct depth values', () => {
      expect(AI_DEPTHS.easy).toBe(2);
      expect(AI_DEPTHS.medium).toBe(3);
      expect(AI_DEPTHS.hard).toBe(4);
    });
  });
});

describe('Win Detection', () => {
  describe('Horizontal win', () => {
    it('should detect horizontal five in a row', () => {
      const board = createEmptyBoard();
      board[7][0] = 'black';
      board[7][1] = 'black';
      board[7][2] = 'black';
      board[7][3] = 'black';
      board[7][4] = 'black';

      const lastMove: [number, number] = [7, 4];
      const row = lastMove[0];
      const col = lastMove[1];
      let count = 1;

      for (let c = col - 1; c >= 0 && board[row][c] === 'black'; c--) count++;
      for (let c = col + 1; c < 15 && board[row][c] === 'black'; c++) count++;

      expect(count).toBeGreaterThanOrEqual(5);
    });
  });

  describe('Vertical win', () => {
    it('should detect vertical five in a row', () => {
      const board = createEmptyBoard();
      board[0][7] = 'white';
      board[1][7] = 'white';
      board[2][7] = 'white';
      board[3][7] = 'white';
      board[4][7] = 'white';

      const lastMove: [number, number] = [4, 7];
      const row = lastMove[0];
      const col = lastMove[1];
      let count = 1;

      for (let r = row - 1; r >= 0 && board[r][col] === 'white'; r--) count++;
      for (let r = row + 1; r < 15 && board[r][col] === 'white'; r++) count++;

      expect(count).toBeGreaterThanOrEqual(5);
    });
  });

  describe('Diagonal win', () => {
    it('should detect diagonal five in a row', () => {
      const board = createEmptyBoard();
      board[0][0] = 'black';
      board[1][1] = 'black';
      board[2][2] = 'black';
      board[3][3] = 'black';
      board[4][4] = 'black';

      const lastMove: [number, number] = [4, 4];
      const row = lastMove[0];
      const col = lastMove[1];
      let count = 1;

      for (let i = 1; i < 5; i++) {
        if (row - i >= 0 && col - i >= 0 && board[row - i][col - i] === 'black') count++;
      }
      for (let i = 1; i < 5; i++) {
        if (row + i < 15 && col + i < 15 && board[row + i][col + i] === 'black') count++;
      }

      expect(count).toBeGreaterThanOrEqual(5);
    });

    it('should detect anti-diagonal five in a row', () => {
      const board = createEmptyBoard();
      board[0][14] = 'white';
      board[1][13] = 'white';
      board[2][12] = 'white';
      board[3][11] = 'white';
      board[4][10] = 'white';

      const lastMove: [number, number] = [4, 10];
      const row = lastMove[0];
      const col = lastMove[1];
      let count = 1;

      for (let i = 1; i < 5; i++) {
        if (row - i >= 0 && col + i < 15 && board[row - i][col + i] === 'white') count++;
      }
      for (let i = 1; i < 5; i++) {
        if (row + i < 15 && col - i >= 0 && board[row + i][col - i] === 'white') count++;
      }

      expect(count).toBeGreaterThanOrEqual(5);
    });
  });

  describe('Draw detection', () => {
    it('should detect board is not full when empty', () => {
      const board = createEmptyBoard();
      let isFull = true;

      for (let row = 0; row < 15; row++) {
        for (let col = 0; col < 15; col++) {
          if (board[row][col] === null) {
            isFull = false;
            break;
          }
        }
        if (!isFull) break;
      }

      expect(isFull).toBe(false);
    });

    it('should detect board is full when all cells filled', () => {
      const board = createEmptyBoard();
      for (let row = 0; row < 15; row++) {
        for (let col = 0; col < 15; col++) {
          board[row][col] = 'black';
        }
      }

      const isFull = board.every(row => row.every(cell => cell !== null));
      expect(isFull).toBe(true);
    });
  });
});