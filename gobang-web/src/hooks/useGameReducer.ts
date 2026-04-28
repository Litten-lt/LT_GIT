import {
  GameState,
  GameAction,
  Board,
  Player,
  WIN_COUNT,
  BOARD_SIZE,
} from '../types';

function checkWin(board: Board, row: number, col: number, player: Player): [number, number][] | null {
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

export function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'MOVE':
    case 'AI_MOVE': {
      const { row, col } = action;
      if (state.status === 'ended') return state;
      if (state.board[row][col] !== null) return state;

      const newBoard = state.board.map(r => [...r]);
      newBoard[row][col] = state.currentPlayer;

      const winningLine = checkWin(newBoard, row, col, state.currentPlayer);

      if (winningLine) {
        return {
          ...state,
          board: newBoard,
          status: 'ended',
          winner: state.currentPlayer,
          moveHistory: [...state.moveHistory, [row, col]],
          lastMove: [row, col],
          winningLine,
        };
      }

      if (isBoardFull(newBoard)) {
        return {
          ...state,
          board: newBoard,
          status: 'ended',
          winner: 'draw',
          moveHistory: [...state.moveHistory, [row, col]],
          lastMove: [row, col],
          winningLine: null,
        };
      }

      return {
        ...state,
        board: newBoard,
        currentPlayer: state.currentPlayer === 'black' ? 'white' : 'black',
        moveHistory: [...state.moveHistory, [row, col]],
        lastMove: [row, col],
      };
    }

    case 'UNDO': {
      if (state.moveHistory.length === 0) return state;
      if (state.gameMode === 'ai' && state.moveHistory.length < 2) return state;

      const undoCount = state.gameMode === 'ai' ? 2 : 1;
      const newHistory = state.moveHistory.slice(0, -undoCount);
      const newBoard = state.board.map(r => [...r]);

      for (let i = 0; i < undoCount && state.moveHistory.length > 0; i++) {
        const [r, c] = state.moveHistory[state.moveHistory.length - 1 - i];
        newBoard[r][c] = null;
      }

      const lastMove = newHistory.length > 0 ? newHistory[newHistory.length - 1] : null;

      return {
        ...state,
        board: newBoard,
        currentPlayer: 'black',
        status: 'playing',
        winner: null,
        moveHistory: newHistory,
        lastMove,
        winningLine: null,
      };
    }

    case 'RESTART': {
      return {
        ...state,
        board: Array(BOARD_SIZE).fill(null).map(() => Array(BOARD_SIZE).fill(null)),
        currentPlayer: 'black',
        status: 'playing',
        winner: null,
        moveHistory: [],
        lastMove: null,
        winningLine: null,
      };
    }

    case 'SET_MODE': {
      return {
        ...state,
        gameMode: action.mode,
        board: Array(BOARD_SIZE).fill(null).map(() => Array(BOARD_SIZE).fill(null)),
        currentPlayer: 'black',
        status: 'playing',
        winner: null,
        moveHistory: [],
        lastMove: null,
        winningLine: null,
      };
    }

    case 'SET_DIFFICULTY': {
      return {
        ...state,
        difficulty: action.difficulty,
      };
    }

    default:
      return state;
  }
}