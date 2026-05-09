import { useReducer, useEffect, useCallback, useState } from 'react';
import { Player } from '../../../types';
import { createGobangReducer } from '../hooks/useGobangReducer';
import { StatusBar } from './StatusBar';
import { ControlPanel } from './ControlPanel';
import { ResultModal } from './ResultModal';
import { RoomUI } from './RoomUI';
import { Board as BoardComponent } from './Board';
import { findBestMove } from '../ai';
import { logger } from '../../../utils/logger';
import { useOnlineGame } from '../../../hooks/useOnlineGame';
import { BOARD_SIZE } from '../types';

interface GobangGameProps {
  onBack: () => void;
  initialOnlineRoom: string | null;
  onNavigateToOnline: (roomId: string) => void;
  onClearOnlineState: () => void;
}

type AppMode = 'local' | 'online';

type GameBoard = (Player | null)[][];

interface LocalGameState {
  board: GameBoard;
  currentPlayer: Player;
  status: 'playing' | 'ended';
  winner: Player | 'draw' | null;
  moveHistory: [number, number][];
  lastMove: [number, number] | null;
  winningLine: [number, number][] | null;
}

const initialBoard: GameBoard = Array(BOARD_SIZE).fill(null).map(() => Array(BOARD_SIZE).fill(null));

const INITIAL_STATE: LocalGameState = {
  board: initialBoard,
  currentPlayer: 'black',
  status: 'playing',
  winner: null,
  moveHistory: [],
  lastMove: null,
  winningLine: null,
};

const gameReducer = createGobangReducer();

export const GobangGame: React.FC<GobangGameProps> = ({
  onBack,
  initialOnlineRoom,
  onNavigateToOnline,
  onClearOnlineState,
}) => {
  const [appMode, setAppMode] = useState<AppMode>('local');
  const [gameMode, setGameMode] = useState<'pvp' | 'ai'>('pvp');
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium');
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
    reconnectToRoom,
    connectionError,
  } = useOnlineGame();

  useEffect(() => {
    if (initialOnlineRoom && appMode === 'online') {
      reconnectToRoom(initialOnlineRoom);
    }
  }, [initialOnlineRoom, appMode]);

  const handleLocalMove = useCallback((row: number, col: number) => {
    if (state.status === 'ended') return;
    if (state.board[row][col] !== null) return;
    if (gameMode === 'ai' && state.currentPlayer === 'white') return;

    logger.move(state.currentPlayer, row, col);
    dispatch({ type: 'MOVE', row, col });
  }, [state.status, state.board, state.currentPlayer, gameMode]);

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
    setGameMode(mode);
    dispatch({ type: 'RESTART' });
  }, []);

  const handleDifficultyChange = useCallback((diff: 'easy' | 'medium' | 'hard') => {
    const names = { easy: '简单', medium: '中等', hard: '困难' };
    logger.info(`切换难度: ${names[diff]}`);
    setDifficulty(diff);
  }, []);

  const AI_DEPTHS = { easy: 2, medium: 3, hard: 4 };

  useEffect(() => {
    if (gameMode !== 'ai') return;
    if (state.status === 'ended') return;
    if (state.currentPlayer !== 'white') return;

    const depth = AI_DEPTHS[difficulty];
    logger.aiThink(depth);

    const timeoutId = setTimeout(() => {
      const result = findBestMove(state.board, 'white', depth);
      logger.aiMove(result.row, result.col, result.score);
      dispatch({ type: 'AI_MOVE', row: result.row, col: result.col });
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [state.board, state.currentPlayer, gameMode, state.status, difficulty]);

  useEffect(() => {
    if (state.status === 'ended' && state.winner) {
      logger.gameEnd(state.winner);
    }
  }, [state.status, state.winner]);

  useEffect(() => {
    logger.gameStart();
  }, []);

  const canUndo = gameMode === 'pvp'
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
    onClearOnlineState();
  }, [leaveRoom, onClearOnlineState]);

  const handleCreateRoom = useCallback(() => {
    createRoom();
  }, [createRoom]);

  const handleJoinRoom = useCallback((roomId: string) => {
    joinRoom(roomId);
  }, [joinRoom]);

  const isOnlineGame = currentRoom !== null;
  const isWaiting = currentRoom?.state === 'waiting';
  const isEnded = currentRoom?.state === 'ended';

  useEffect(() => {
    if (isOnlineGame && currentRoom) {
      onNavigateToOnline(currentRoom.id);
    }
  }, [isOnlineGame, currentRoom, onNavigateToOnline]);

  const handleAppModeChange = (mode: AppMode) => {
    setAppMode(mode);
    if (mode === 'local') {
      onClearOnlineState();
    }
  };

  const isRoomExpired = connectionError === 'room-not-found' || connectionError === 'room-closed';

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <div className="absolute top-4 left-4">
        <button
          onClick={onBack}
          className="flex items-center gap-2 px-4 py-2 bg-slate-800/80 hover:bg-slate-700/80 text-slate-300 rounded-lg border border-slate-700/50 transition-colors"
        >
          <span>←</span>
          <span>返回</span>
        </button>
      </div>

      <div className="flex items-center gap-2 mb-4">
        <span className="text-2xl">⬤</span>
        <h1 className="text-2xl font-bold text-white">五子棋</h1>
      </div>

      <div className="flex gap-2 mb-4">
        <button
          onClick={() => handleAppModeChange('local')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            appMode === 'local'
              ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/50'
              : 'bg-slate-800/80 text-slate-400 border border-slate-700/50 hover:bg-slate-700/80'
          }`}
        >
          本地对战
        </button>
        <button
          onClick={() => handleAppModeChange('online')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            appMode === 'online'
              ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/50'
              : 'bg-slate-800/80 text-slate-400 border border-slate-700/50 hover:bg-slate-700/80'
          }`}
        >
          在线对战
        </button>
      </div>

      {appMode === 'local' && (
        <>
          <StatusBar
            currentPlayer={state.currentPlayer}
            gameMode={gameMode}
            gameStatus={state.status}
            winner={state.winner}
          />

          <div className="my-4">
            <BoardComponent
              board={state.board}
              currentPlayer={state.currentPlayer}
              lastMove={state.lastMove}
              winningLine={state.winningLine}
              onCellClick={handleLocalMove}
              disabled={state.status === 'ended' || (gameMode === 'ai' && state.currentPlayer === 'white')}
            />
          </div>

          <ControlPanel
            gameMode={gameMode}
            difficulty={difficulty}
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

      {appMode === 'online' && isRoomExpired && (
        <div className="flex flex-col items-center justify-center p-8 bg-slate-800/50 rounded-xl border border-red-500/50">
          <div className="text-4xl mb-4">⏰</div>
          <h2 className="text-xl font-bold text-red-400 mb-2">房间已失效</h2>
          <p className="text-slate-400 text-center max-w-xs mb-6">
            该房间已过期或不存在，请创建新房间
          </p>
          <div className="mb-4">
            <RoomUI
              connectionStatus={onlineStatus}
              onCreateRoom={handleCreateRoom}
              onJoinRoom={handleJoinRoom}
            />
          </div>
        </div>
      )}

      {appMode === 'online' && !isRoomExpired && !isOnlineGame && (
        <div className="mb-4">
          <RoomUI
            connectionStatus={onlineStatus}
            onCreateRoom={handleCreateRoom}
            onJoinRoom={handleJoinRoom}
          />
        </div>
      )}

      {appMode === 'online' && !isRoomExpired && isOnlineGame && (
        <>
          <div className="mb-4">
            <RoomUI
              connectionStatus={onlineStatus}
              onCreateRoom={handleCreateRoom}
              onJoinRoom={handleJoinRoom}
              roomId={currentRoom.id}
              playerIndex={playerIndex}
              currentRoom={currentRoom}
              onLeaveRoom={handleOnlineLeave}
            />
          </div>

          <StatusBar
            currentPlayer={currentRoom.currentPlayer}
            gameMode="pvp"
            gameStatus={isEnded ? 'ended' : 'playing'}
            winner={currentRoom.winner}
          />

          <div className="my-4">
            <BoardComponent
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
                <div className="text-xl font-bold text-cyan-400">
                  {currentRoom.winner === 'draw'
                    ? '平局！'
                    : `${currentRoom.winner === 'black' ? '黑方' : '白方'} 获胜！`}
                </div>
              )}
              <button
                onClick={handleOnlineRestart}
                className="px-6 py-3 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 text-white font-semibold rounded-lg shadow-lg shadow-cyan-500/25 transition-all"
              >
                重新开始
              </button>
            </div>
          )}
        </>
      )}

      {onlineError && !connectionError && (
        <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 bg-red-900/90 text-white px-6 py-3 rounded-lg shadow-lg flex items-center gap-4">
          <span>{onlineError}</span>
          <button
            onClick={clearError}
            className="text-white/70 hover:text-white text-xl"
          >
            ×
          </button>
        </div>
      )}
    </div>
  );
};