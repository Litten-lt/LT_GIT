import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { Card, RANK_DISPLAY } from '../games/honga/types';

const SUIT_CHINESE: Record<string, string> = {
  spade: '黑桃', heart: '红桃', club: '梅花', diamond: '方片'
};

export type HongAConnectionStatus = 'disconnected' | 'connecting' | 'connected';

export interface HongAPlayer {
  index: number;
  socketId: string | null;
  finished: boolean;
}

export interface HongARoomState {
  id: string;
  players: [string | null, string | null, string | null, string | null];
  state: 'waiting' | 'ready' | 'playing' | 'ended' | 'finished';
  hands: Record<string, Card[]>;
  currentPlayerIndex: number;
  lastPlay: {
    playerIndex: number;
    cards: Card[];
  } | null;
  currentRoundBest: {
    playerIndex: number;
    cards: Card[];
  } | null;
  roundHistory: {
    playerIndex: number;
    cards: Card[];
    cardType: string;
  }[];
  scores: { A: number; B: number };
  playerScores: Record<string, number>;
  teams: {
    mode: '2v2' | '1v3';
    A?: [string, string];
    B?: [string, string];
    solo?: string;
    team?: [string, string, string];
  } | null;
  finishedPlayers: string[];
  roundStarter: number;
  hostSocketId: string;
  passCount: number;
}

export interface GameLogEntry {
  id: string;
  type: 'info' | 'play' | 'pass' | 'error' | 'system';
  message: string;
  timestamp: number;
}

interface UseHongAOnlineReturn {
  status: HongAConnectionStatus;
  currentRoom: HongARoomState | null;
  playerIndex: number | null;
  mySocketId: string | null;
  isMyTurn: boolean;
  error: string | null;
  connectionError: string | null;
  gameLog: GameLogEntry[];
  createRoom: () => void;
  joinRoom: (roomId: string) => void;
  leaveRoom: () => void;
  playCards: (cards: Card[]) => void;
  pass: () => void;
  startGame: () => void;
  restartGame: () => void;
  clearError: () => void;
  reconnectToRoom: (roomId: string) => void;
  addLog: (type: GameLogEntry['type'], message: string) => void;
}

const SERVER_URL = 'https://chesshub.fun';

export function useHongAOnline(): UseHongAOnlineReturn {
  const socketRef = useRef<Socket | null>(null);
  const [status, setStatus] = useState<HongAConnectionStatus>('disconnected');
  const [currentRoom, setCurrentRoom] = useState<HongARoomState | null>(null);
  const [playerIndex, setPlayerIndex] = useState<number | null>(null);
  const [mySocketId, setMySocketId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [gameLog, setGameLog] = useState<GameLogEntry[]>([]);
  const currentRoomIdRef = useRef<string | null>(null);
  const logIdCounter = useRef(0);

  const addLog = useCallback((type: GameLogEntry['type'], message: string) => {
    const entry: GameLogEntry = {
      id: `log-${++logIdCounter.current}`,
      type,
      message,
      timestamp: Date.now(),
    };
    setGameLog(prev => [...prev.slice(-49), entry]);
  }, []);

  useEffect(() => {
    console.log('[HongA Hook] Initializing socket connection');
    const socket = io(SERVER_URL, {
      path: '/honga-socket',
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('[HongA Client] Connected to server, socket id:', socket.id);
      setStatus('connected');
      setConnectionError(null);
      if (socket.id) setMySocketId(socket.id);
      addLog('system', '已连接到服务器');
    });

    socket.on('disconnect', () => {
      console.log('[HongA Client] Disconnected from server');
      setStatus('disconnected');
      addLog('system', '与服务器断开连接');
    });

    socket.on('connect_error', (err) => {
      console.log('[HongA Client] Connection error:', err.message);
      setStatus('disconnected');
      addLog('error', '无法连接到服务器');
    });

    socket.on('room-created', ({ room, playerIndex: idx }) => {
      setCurrentRoom(convertRoom(room));
      setPlayerIndex(idx);
      currentRoomIdRef.current = room.id;
      setError(null);
      setConnectionError(null);
      addLog('info', `房间 ${room.id} 已创建，你是玩家 ${idx + 1}`);
    });

    socket.on('room-joined', ({ room, playerIndex: idx }) => {
      setCurrentRoom(convertRoom(room));
      setPlayerIndex(idx);
      currentRoomIdRef.current = room.id;
      setError(null);
      setConnectionError(null);
      addLog('info', `已加入房间 ${room.id}，你是玩家 ${idx + 1}`);
    });

    socket.on('player-joined', ({ room }: { room: any }) => {
      const newPlayerCount = (room.players as (string | null)[]).filter((p: string | null) => p !== null).length;
      addLog('info', `玩家 ${newPlayerCount} 加入房间`);
      setCurrentRoom(prev => {
        if (!prev) return convertRoom(room);
        return convertRoom(room);
      });
    });

    socket.on('game-started', ({ room }) => {
      console.log('[HongA Client] Game started!');
      addLog('system', '游戏开始！');
      setCurrentRoom(convertRoom(room));
    });

    socket.on('opponent-played', ({ playerIndex: idx, cards, room: updatedRoom }: { playerIndex: number; cards: any[]; room?: any }) => {
      const cardStr = cards.map((c: any) => `${SUIT_CHINESE[c.suit]}${RANK_DISPLAY[c.rank as keyof typeof RANK_DISPLAY]}`).join(',');
      addLog('play', `玩家 ${idx + 1} 出牌: ${cardStr}`);
      setCurrentRoom(prev => {
        if (!prev) return prev;
        const newRoom = updatedRoom ? convertRoom(updatedRoom) : prev;
        return {
          ...newRoom,
          lastPlay: { playerIndex: idx, cards },
          currentPlayerIndex: (idx + 1) % 4,
        };
      });
    });

    socket.on('player-passed', ({ playerIndex: idx }) => {
      console.log(`[HongA Client] Player ${idx} passed`);
      addLog('pass', `玩家 ${idx + 1} 过`);
    });

    socket.on('score-update', ({ A, B }) => {
      setCurrentRoom(prev => {
        if (!prev) return prev;
        return { ...prev, scores: { A, B } };
      });
    });

    socket.on('game-over', () => {
      setCurrentRoom(prev => {
        if (!prev) return prev;
        return { ...prev, state: 'finished' };
      });
    });

    socket.on('restart-approved', ({ room }) => {
      setCurrentRoom(convertRoom(room));
    });

    socket.on('opponent-left', () => {
      setError('对手已离开房间');
      setCurrentRoom(prev => {
        if (!prev) return prev;
        return { ...prev, state: 'waiting' };
      });
    });

    socket.on('player-left', ({ playerIndex }) => {
      console.log(`[HongA Client] Player ${playerIndex} left the room`);
      setError('有玩家离开了房间，游戏结束');
      setCurrentRoom(prev => {
        if (!prev) return prev;
        return { ...prev, state: 'ended' };
      });
    });

    socket.on('error', ({ message, code }) => {
      console.log('[HongA Client] Error:', message, code);
      if (code === 'room-not-found') {
        setConnectionError('room-not-found');
        setError(null);
        addLog('error', '房间不存在或已过期');
      } else if (code === 'room-full') {
        setConnectionError('room-full');
        setError(null);
        addLog('error', '房间已满');
      } else {
        setError(message);
        addLog('error', message);
      }
    });

    socket.on('room-state', ({ room }) => {
      setCurrentRoom(convertRoom(room));
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, []);

  function convertRoom(room: any): HongARoomState {
    return {
      id: room.id,
      players: room.players,
      state: room.state,
      hands: (room.hands && typeof room.hands === 'object') ? room.hands : {},
      currentPlayerIndex: room.currentPlayerIndex,
      lastPlay: room.lastPlay,
      currentRoundBest: room.currentRoundBest || null,
      roundHistory: room.roundHistory || [],
      scores: room.scores || { A: 0, B: 0 },
      playerScores: room.playerScores || {},
      teams: room.teams,
      finishedPlayers: room.finishedPlayers || [],
      roundStarter: room.roundStarter || 0,
      hostSocketId: room.hostSocketId || '',
      passCount: room.passCount || 0,
    };
  }

  const createRoom = useCallback(() => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('create-room');
    } else {
      setError('未连接到服务器');
    }
  }, []);

  const joinRoom = useCallback((roomId: string) => {
    if (socketRef.current?.connected) {
      setConnectionError(null);
      socketRef.current.emit('join-room', { roomId });
    } else {
      setError('未连接到服务器');
    }
  }, []);

  const reconnectToRoom = useCallback((roomId: string) => {
    if (socketRef.current?.connected) {
      setConnectionError(null);
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
    setConnectionError(null);
  }, []);

  const playCards = useCallback((cards: Card[]) => {
    if (socketRef.current?.connected && currentRoomIdRef.current) {
      socketRef.current.emit('play-cards', {
        roomId: currentRoomIdRef.current,
        cards,
      });
    }
  }, []);

  const pass = useCallback(() => {
    if (socketRef.current?.connected && currentRoomIdRef.current) {
      socketRef.current.emit('pass', { roomId: currentRoomIdRef.current });
    }
  }, []);

  const startGame = useCallback(() => {
    if (socketRef.current?.connected && currentRoomIdRef.current) {
      socketRef.current.emit('start-game', { roomId: currentRoomIdRef.current });
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

  const isMyTurn = currentRoom?.currentPlayerIndex === playerIndex;

  return {
    status,
    currentRoom,
    playerIndex,
    mySocketId,
    isMyTurn,
    error,
    connectionError,
    gameLog,
    createRoom,
    joinRoom,
    leaveRoom,
    playCards,
    pass,
    startGame,
    restartGame,
    clearError,
    reconnectToRoom,
    addLog,
  };
}