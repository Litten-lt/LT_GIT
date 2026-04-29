import { useReducer, useEffect, useCallback } from 'react';
import { INITIAL_STATE } from './types';
import { gameReducer } from './hooks/useGameReducer';
import { Board } from './components/Board';
import { StatusBar } from './components/StatusBar';
import { ControlPanel } from './components/ControlPanel';
import { ResultModal } from './components/ResultModal';
import { findBestMove, AI_DEPTHS } from './ai';
import { logger } from './utils/logger';

function App() {
  const [state, dispatch] = useReducer(gameReducer, INITIAL_STATE);

  const handleMove = useCallback((row: number, col: number) => {
    if (state.status === 'ended') return;
    if (state.board[row][col] !== null) return;
    if (state.gameMode === 'ai' && state.currentPlayer === 'white') return;

    logger.move(state.currentPlayer, row, col);
    dispatch({ type: 'MOVE', row, col });
  }, [state.status, state.board, state.currentPlayer, state.gameMode]);

  const handleUndo = useCallback(() => {
    logger.info('用户执行悔棋');
    dispatch({ type: 'UNDO' });
  }, []);

  const handleRestart = useCallback(() => {
    logger.gameStart();
    dispatch({ type: 'RESTART' });
  }, []);

  const handleModeChange = useCallback((mode: 'pvp' | 'ai') => {
    logger.info(`切换模式: ${mode === 'pvp' ? '双人' : 'AI'}`);
    dispatch({ type: 'SET_MODE', mode });
  }, []);

  const handleDifficultyChange = useCallback((difficulty: 'easy' | 'medium' | 'hard') => {
    const names = { easy: '简单', medium: '中等', hard: '困难' };
    logger.info(`切换难度: ${names[difficulty]}`);
    dispatch({ type: 'SET_DIFFICULTY', difficulty });
  }, []);

  useEffect(() => {
    if (state.gameMode !== 'ai') return;
    if (state.status === 'ended') return;
    if (state.currentPlayer !== 'white') return;

    const depth = AI_DEPTHS[state.difficulty];
    logger.aiThink(depth);

    const timeoutId = setTimeout(() => {
      const result = findBestMove(state.board, 'white', depth);
      logger.aiMove(result.row, result.col, result.score);
      dispatch({ type: 'AI_MOVE', row: result.row, col: result.col });
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [state.board, state.currentPlayer, state.gameMode, state.status, state.difficulty]);

  useEffect(() => {
    if (state.status === 'ended' && state.winner) {
      logger.gameEnd(state.winner);
    }
  }, [state.status, state.winner]);

  useEffect(() => {
    logger.gameStart();
  }, []);

  const canUndo = state.gameMode === 'pvp'
    ? state.moveHistory.length > 0
    : state.moveHistory.length >= 2;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6">
      <h1 className="game-title mb-2">
        五子棋
      </h1>

      <StatusBar
        currentPlayer={state.currentPlayer}
        gameMode={state.gameMode}
        gameStatus={state.status}
        winner={state.winner}
      />

      <div className="my-4">
        <Board
          board={state.board}
          currentPlayer={state.currentPlayer}
          lastMove={state.lastMove}
          winningLine={state.winningLine}
          onCellClick={handleMove}
          disabled={state.status === 'ended' || (state.gameMode === 'ai' && state.currentPlayer === 'white')}
        />
      </div>

      <ControlPanel
        gameMode={state.gameMode}
        difficulty={state.difficulty}
        canUndo={canUndo}
        onRestart={handleRestart}
        onUndo={handleUndo}
        onModeChange={handleModeChange}
        onDifficultyChange={handleDifficultyChange}
      />

      <ResultModal
        winner={state.winner}
        gameStatus={state.status}
        onRestart={handleRestart}
      />
    </div>
  );
}

export default App;