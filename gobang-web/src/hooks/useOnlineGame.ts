import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { Board, Player } from '../types';

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected';

export type GameMode = 'local' | 'online';

interface OnlineRoom {
  id: string;
  players: [string | null, string | null];
  state: 'waiting' | 'playing' | 'ended';
  board: Board;
  currentPlayer: Player;
  moveHistory: [number, number][];
  lastMove: [number, number] | null;
  winner: Player | 'draw' | null;
  winningLine: [number, number][] | null;
}

interface UseOnlineGameReturn {
  status: ConnectionStatus;
  currentRoom: OnlineRoom | null;
  playerIndex: 0 | 1 | null;
  isMyTurn: boolean;
  error: string | null;
  createRoom: () => void;
  joinRoom: (roomId: string) => void;
  leaveRoom: () => void;
  makeMove: (row: number, col: number) => void;
  restartGame: () => void;
  clearError: () => void;
}

const SERVER_URL = 'http://localhost:3001';

export function useOnlineGame(): UseOnlineGameReturn {
  const socketRef = useRef<Socket | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  const [currentRoom, setCurrentRoom] = useState<OnlineRoom | null>(null);
  const [playerIndex, setPlayerIndex] = useState<0 | 1 | null>(null);
  const [error, setError] = useState<string | null>(null);
  const currentRoomIdRef = useRef<string | null>(null);

  useEffect(() => {
    const socket = io(SERVER_URL, {
      autoConnect: true,
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('[Client] Connected to server');
      setStatus('connected');
    });

    socket.on('disconnect', () => {
      console.log('[Client] Disconnected from server');
      setStatus('disconnected');
      setCurrentRoom(null);
      setPlayerIndex(null);
    });

    socket.on('connect_error', () => {
      setStatus('disconnected');
      setError('无法连接到服务器');
    });

    socket.on('room-created', ({ room, playerIndex: idx }) => {
      setCurrentRoom(room);
      setPlayerIndex(idx);
      currentRoomIdRef.current = room.id;
      setError(null);
    });

    socket.on('room-joined', ({ room, playerIndex: idx }) => {
      setCurrentRoom(room);
      setPlayerIndex(idx);
      currentRoomIdRef.current = room.id;
      setError(null);
    });

    socket.on('player-joined', ({ room }) => {
      setCurrentRoom(prev => {
        if (!prev) return room;
        return { ...prev, ...room };
      });
    });

    socket.on('opponent-move', ({ row, col, player }) => {
      setCurrentRoom(prev => {
        if (!prev) return prev;
        const newBoard = prev.board.map(r => [...r]);
        newBoard[row][col] = player;
        return {
          ...prev,
          board: newBoard,
          currentPlayer: player === 'black' ? 'white' : 'black',
          moveHistory: [...prev.moveHistory, [row, col]],
          lastMove: [row, col],
        };
      });
    });

    socket.on('game-over', ({ winner, winningLine }) => {
      setCurrentRoom(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          state: 'ended',
          winner,
          winningLine: winningLine || null,
        };
      });
    });

    socket.on('restart-approved', ({ room }) => {
      setCurrentRoom(room);
    });

    socket.on('restart-denied', () => {
      setError('对方拒绝了重新开始的请求');
    });

    socket.on('opponent-left', () => {
      setError('对手已离开房间');
      setCurrentRoom(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          state: 'waiting',
          players: [prev.players[0], null],
        };
      });
    });

    socket.on('error', ({ message, code }) => {
      console.log('[Client] Error:', message, code);
      setError(message);
    });

    socket.on('room-state', ({ room }) => {
      setCurrentRoom(room);
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, []);

  const createRoom = useCallback(() => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('create-room');
    } else {
      setError('未连接到服务器');
    }
  }, []);

  const joinRoom = useCallback((roomId: string) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('join-room', { roomId });
    } else {
      setError('未连接到服务器');
    }
  }, []);

  const leaveRoom = useCallback(() => {
    if (socketRef.current?.connected && currentRoomIdRef.current) {
      socketRef.current.emit('leave-room', { roomId: currentRoomIdRef.current });
    }
    currentRoomIdRef.current = null;
    setCurrentRoom(null);
    setPlayerIndex(null);
  }, []);

  const makeMove = useCallback((row: number, col: number) => {
    if (socketRef.current?.connected && currentRoomIdRef.current) {
      socketRef.current.emit('make-move', {
        roomId: currentRoomIdRef.current,
        row,
        col,
      });
    }
  }, []);

  const restartGame = useCallback(() => {
    if (socketRef.current?.connected && currentRoomIdRef.current) {
      socketRef.current.emit('restart-game', { roomId: currentRoomIdRef.current });
    }
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const isMyTurn = currentRoom?.currentPlayer === (playerIndex === 0 ? 'black' : 'white');

  return {
    status,
    currentRoom,
    playerIndex,
    isMyTurn,
    error,
    createRoom,
    joinRoom,
    leaveRoom,
    makeMove,
    restartGame,
    clearError,
  };
}