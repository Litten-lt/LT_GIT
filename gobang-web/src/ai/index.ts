import { Board, Player, BOARD_SIZE } from '../types';
import { logger } from '../utils/logger';

const SCORES = {
  FIVE: 100000,
  FOUR: 10000,
  THREE: 1000,
  TWO: 100,
  ONE: 10,
};

const CENTER = Math.floor(BOARD_SIZE / 2);
const CENTER_BONUS = 10;
const MAX_SPOTS = 15;

function getPositionBonus(row: number, col: number): number {
  const distFromCenter = Math.abs(row - CENTER) + Math.abs(col - CENTER);
  return Math.max(0, CENTER_BONUS - distFromCenter);
}

function evaluateLine(count: number, openEnds: number): number {
  if (count >= 5) return SCORES.FIVE;

  let score = 0;

  if (openEnds === 0 && count < 5) {
    return 0;
  }

  if (count === 4) {
    score = openEnds === 1 ? SCORES.FOUR * 0.5 : SCORES.FOUR;
  } else if (count === 3) {
    score = openEnds === 2 ? SCORES.THREE : SCORES.THREE * 0.5;
  } else if (count === 2) {
    score = openEnds === 2 ? SCORES.TWO : SCORES.TWO * 0.5;
  } else if (count === 1) {
    score = SCORES.ONE;
  }

  return score;
}

function evaluateBoard(board: Board, player: Player): number {
  let score = 0;

  for (let row = 0; row < BOARD_SIZE; row++) {
    for (let col = 0; col < BOARD_SIZE; col++) {
      if (board[row][col] === null) {
        score += getPositionBonus(row, col);
      }
    }
  }

  const directions = [[0, 1], [1, 0], [1, 1], [1, -1]];

  for (let row = 0; row < BOARD_SIZE; row++) {
    for (let col = 0; col < BOARD_SIZE; col++) {
      const cell = board[row][col];
      if (cell === null) continue;

      for (const [dx, dy] of directions) {
        const line: number[] = [0, 0, 0, 0, 0];

        for (let dir = 1; dir <= 4; dir++) {
          const r = row + dx * dir;
          const c = col + dy * dir;
          if (r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE) {
            line[dir] = board[r][c] === cell ? 1 : board[r][c] === null ? 0 : -1;
          }
        }

        for (let dir = -1; dir >= -4; dir--) {
          const r = row + dx * dir;
          const c = col + dy * dir;
          if (r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE) {
            line[4 + dir] = board[r][c] === cell ? 1 : board[r][c] === null ? 0 : -1;
          }
        }

        const count = line.filter(l => l === 1).length;
        const openEnds = line.filter(l => l === 0).length;

        if (cell === player) {
          score += evaluateLine(count, openEnds);
        } else {
          score -= evaluateLine(count, openEnds) * 1.1;
        }
      }
    }
  }

  return score;
}

function getEmptySpots(board: Board): [number, number][] {
  const spots: [number, number][] = [];
  const checked = new Set<string>();

  for (let row = 0; row < BOARD_SIZE; row++) {
    for (let col = 0; col < BOARD_SIZE; col++) {
      if (board[row][col] !== null) {
        for (let dr = -2; dr <= 2; dr++) {
          for (let dc = -2; dc <= 2; dc++) {
            if (spots.length >= MAX_SPOTS) break;

            const r = row + dr;
            const c = col + dc;
            const key = `${r},${c}`;
            if (r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE &&
                board[r][c] === null && !checked.has(key)) {
              spots.push([r, c]);
              checked.add(key);
            }
          }
        }
      }
    }
  }

  if (spots.length === 0) {
    spots.push([CENTER, CENTER]);
  }

  logger.debug(`AI 搜索区域: ${spots.length} 个位置`);

  return spots;
}

function simulateMove(board: Board, row: number, col: number, player: Player): Board {
  const newBoard = board.map(r => [...r]);
  newBoard[row][col] = player;
  return newBoard;
}

export interface AIMoveResult {
  row: number;
  col: number;
  score: number;
}

export function findBestMove(
  board: Board,
  player: Player,
  depth: number
): AIMoveResult {
  const spots = getEmptySpots(board);
  let bestScore = -Infinity;
  let bestMove: [number, number] = spots[0];

  for (const [row, col] of spots) {
    const newBoard = simulateMove(board, row, col, player);
    const score = minimax(newBoard, depth - 1, -Infinity, Infinity, false, player);
    if (score > bestScore) {
      bestScore = score;
      bestMove = [row, col];
    }
  }

  return { row: bestMove[0], col: bestMove[1], score: bestScore };
}

function minimax(
  board: Board,
  depth: number,
  alpha: number,
  beta: number,
  isMaximizing: boolean,
  aiPlayer: Player
): number {
  const opponent: Player = aiPlayer === 'black' ? 'white' : 'black';

  const spots = getEmptySpots(board);
  if (depth === 0 || spots.length === 0) {
    return evaluateBoard(board, aiPlayer);
  }

  let localAlpha = alpha;
  let localBeta = beta;

  if (isMaximizing) {
    let maxScore = -Infinity;
    for (const [row, col] of spots) {
      const newBoard = simulateMove(board, row, col, aiPlayer);
      const score = minimax(newBoard, depth - 1, localAlpha, localBeta, false, aiPlayer);
      maxScore = Math.max(maxScore, score);
      localAlpha = Math.max(localAlpha, score);
      if (localBeta <= localAlpha) break;
    }
    return maxScore;
  } else {
    let minScore = Infinity;
    for (const [row, col] of spots) {
      const newBoard = simulateMove(board, row, col, opponent);
      const score = minimax(newBoard, depth - 1, localAlpha, localBeta, true, aiPlayer);
      minScore = Math.min(minScore, score);
      localBeta = Math.min(localBeta, score);
      if (localBeta <= localAlpha) break;
    }
    return minScore;
  }
}

export const AI_DEPTHS = {
  easy: 2,
  medium: 3,
  hard: 4,
};