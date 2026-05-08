import { useReducer, useEffect, useCallback, useState } from 'react';
import { INITIAL_STATE } from './types';
import { gameReducer } from './hooks/useGameReducer';
import { Board } from './components/Board';
import { StatusBar } from './components/StatusBar';
import { ControlPanel } from './components/ControlPanel';
import { ResultModal } from './components/ResultModal';
import { RoomUI } from './components/RoomUI';
import { findBestMove, AI_DEPTHS } from './ai';
import { logger } from './utils/logger';
import { useOnlineGame } from './hooks/useOnlineGame';

type AppMode = 'local' | 'online';

function App() {
  const [appMode, setAppMode] = useState<AppMode>('local');
  const [state, dispatch] = useReducer(gameReducer, INITIAL_STATE);

  const {
    status: onlineStatus,
    currentRoom,
    playerIndex,
    isMyTurn,
    error: onlineError,
    createRoom,
    joinRoom,
    leaveRoom,
    makeMove: onlineMakeMove,
    restartGame,
    clearError,
  } = useOnlineGame();

  const handleLocalMove = useCallback((row: number, col: number) => {
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

  const handleLocalRestart = useCallback(() => {
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

  const handleOnlineMove = useCallback((row: number, col: number) => {
    if (!currentRoom) return;
    if (currentRoom.state !== 'playing') return;
    if (!isMyTurn) return;
    if (currentRoom.board[row][col] !== null) return;

    onlineMakeMove(row, col);
  }, [currentRoom, isMyTurn, onlineMakeMove]);

  const handleOnlineRestart = useCallback(() => {
    restartGame();
  }, [restartGame]);

  const handleOnlineLeave = useCallback(() => {
    leaveRoom();
  }, [leaveRoom]);

  const isOnlineGame = currentRoom !== null;
  const isWaiting = currentRoom?.state === 'waiting';
  const isEnded = currentRoom?.state === 'ended';

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6">
      <h1 className="game-title mb-2">
        五子棋
      </h1>

      {!isOnlineGame && (
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setAppMode('local')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              appMode === 'local'
                ? 'bg-amber-700 text-white'
                : 'bg-stone-700 text-stone-300 hover:bg-stone-600'
            }`}
          >
            本地对战
          </button>
          <button
            onClick={() => setAppMode('online')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              appMode === 'online'
                ? 'bg-amber-700 text-white'
                : 'bg-stone-700 text-stone-300 hover:bg-stone-600'
            }`}
          >
            在线对战
          </button>
        </div>
      )}

      {appMode === 'online' && !isOnlineGame && (
        <div className="mb-4">
          <RoomUI
            connectionStatus={onlineStatus}
            onCreateRoom={createRoom}
            onJoinRoom={joinRoom}
          />
        </div>
      )}

      {appMode === 'online' && isOnlineGame && (
        <div className="mb-4">
          <RoomUI
            connectionStatus={onlineStatus}
            onCreateRoom={createRoom}
            onJoinRoom={joinRoom}
            roomId={currentRoom.id}
            playerIndex={playerIndex}
            currentRoom={currentRoom}
            onLeaveRoom={handleOnlineLeave}
          />
        </div>
      )}

      {appMode === 'local' && (
        <>
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
              onCellClick={handleLocalMove}
              disabled={state.status === 'ended' || (state.gameMode === 'ai' && state.currentPlayer === 'white')}
            />
          </div>

          <ControlPanel
            gameMode={state.gameMode}
            difficulty={state.difficulty}
            canUndo={canUndo}
            onRestart={handleLocalRestart}
            onUndo={handleUndo}
            onModeChange={handleModeChange}
            onDifficultyChange={handleDifficultyChange}
          />

          <ResultModal
            winner={state.winner}
            gameStatus={state.status}
            onRestart={handleLocalRestart}
          />
        </>
      )}

      {appMode === 'online' && isOnlineGame && (
        <>
          <StatusBar
            currentPlayer={currentRoom.currentPlayer}
            gameMode="pvp"
            gameStatus={isEnded ? 'ended' : 'playing'}
            winner={currentRoom.winner}
          />

          <div className="my-4">
            <Board
              board={currentRoom.board}
              currentPlayer={currentRoom.currentPlayer}
              lastMove={currentRoom.lastMove}
              winningLine={currentRoom.winningLine}
              onCellClick={handleOnlineMove}
              disabled={!isMyTurn || isEnded || isWaiting}
            />
          </div>

          {(isEnded || isWaiting) && (
            <div className="flex flex-col items-center gap-3 mt-4">
              {isEnded && currentRoom.winner && (
                <div className="text-xl font-bold text-amber-400">
                  {currentRoom.winner === 'draw'
                    ? '平局！'
                    : `${currentRoom.winner === 'black' ? '黑方' : '白方'} 获胜！`}
                </div>
              )}
              <button
                onClick={handleOnlineRestart}
                className="px-6 py-3 bg-amber-700 hover:bg-amber-600 text-white font-semibold rounded-lg transition-colors"
              >
                重新开始
              </button>
            </div>
          )}
        </>
      )}

      {onlineError && (
        <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 bg-red-900/90 text-white px-6 py-3 rounded-lg shadow-lg flex items-center gap-4">
          <span>{onlineError}</span>
          <button
            onClick={clearError}
            className="text-white/70 hover:text-white"
          >
            ×
          </button>
        </div>
      )}
    </div>
  );
}

export default App;