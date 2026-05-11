import express from 'express';
import { createServer } from 'http';
import { Server, Socket } from 'socket.io';
import { RoomManager } from './RoomManager';
import { GobangHandler, GobangRoom, GOBANG_GAME_ID } from './games/gobang/Handler';
import { HongAHandler, HongARoom } from './games/honga/Handler';
import { HONGA_GAME_ID } from './games/honga/types';

const PORT = 3001;

const app = express();
const httpServer = createServer(app);

const gobangIO = new Server(httpServer, {
  path: '/socket.io',
  cors: {
    origin: ['https://chesshub.fun'],
    methods: ['GET', 'POST'],
  },
});

const hongAIO = new Server(httpServer, {
  path: '/honga-socket',
  cors: {
    origin: ['https://chesshub.fun'],
    methods: ['GET', 'POST'],
  },
});

const roomManager = new RoomManager();
roomManager.registerGame(GobangHandler);
roomManager.registerGame(HongAHandler);

const gobangSocketToRoom = new Map<string, string>();
const hongASocketToRoom = new Map<string, string>();

function setupGobangHandlers() {
  gobangIO.on('connection', (socket: Socket) => {
    console.log(`[Gobang] Client connected: ${socket.id}`);

    socket.on('create-room', () => {
      const room = roomManager.createRoom(socket.id, GOBANG_GAME_ID);
      if (!room) {
        socket.emit('error', { message: 'Failed to create room', code: 'create-failed' });
        return;
      }
      gobangSocketToRoom.set(socket.id, room.id);
      socket.join(room.id);
      socket.emit('room-created', { room, playerIndex: 0 });
      console.log(`[Gobang] Room created: ${room.id} by ${socket.id}`);
    });

    socket.on('join-room', ({ roomId }: { roomId: string }) => {
      const result = roomManager.joinRoom(socket.id, roomId, GOBANG_GAME_ID);

      if ('error' in result) {
        socket.emit('error', { message: result.error, code: result.error });
        console.log(`[Gobang] Join room failed: ${result.error} for ${socket.id}`);
        return;
      }

      gobangSocketToRoom.set(socket.id, roomId);
      socket.join(roomId);
      socket.emit('room-joined', { room: result.room, playerIndex: result.playerIndex });
      socket.to(roomId).emit('player-joined', { room: result.room });
      console.log(`[Gobang] ${socket.id} joined room ${roomId} as player ${result.playerIndex}`);
    });

    socket.on('leave-room', ({ roomId }: { roomId: string }) => {
      handleGobangLeave(socket, roomId);
    });

    socket.on('make-move', ({ roomId, row, col }: { roomId: string; row: number; col: number }) => {
      const result = roomManager.handleMove(socket.id, roomId, { row, col });

      if (!result.success) {
        socket.emit('error', { message: result.error!, code: result.error });
        return;
      }

      const room = result.room as GobangRoom;
      const playerIndex = roomManager.getPlayerIndex(roomId, socket.id);
      const expectedPlayer = playerIndex === 0 ? 'black' : 'white';

      gobangIO.to(roomId).emit('opponent-move', {
        row,
        col,
        player: expectedPlayer,
      });

      if (room.state === 'ended') {
        gobangIO.to(roomId).emit('game-over', {
          winner: room.winner!,
          winningLine: room.winningLine || undefined,
        });
      }
    });

    socket.on('restart-game', ({ roomId }: { roomId: string }) => {
      const result = roomManager.restartGame(socket.id, roomId);

      if (!result.success) {
        socket.emit('error', { message: result.error!, code: result.error });
        return;
      }

      gobangIO.to(roomId).emit('restart-approved', { room: result.room });
    });

    socket.on('disconnect', () => {
      console.log(`[Gobang] Client disconnected: ${socket.id}`);
      const roomId = gobangSocketToRoom.get(socket.id);
      if (roomId) {
        handleGobangLeave(socket, roomId);
        gobangSocketToRoom.delete(socket.id);
      }
    });
  });
}

function handleGobangLeave(socket: Socket, roomId: string) {
  const opponentIds = roomManager.getOpponentSocketIds(roomId, socket.id);
  roomManager.leaveRoom(socket.id, roomId);
  socket.leave(roomId);

  if (opponentIds.length > 0) {
    socket.to(roomId).emit('opponent-left', {});
  }

  console.log(`[Gobang] ${socket.id} left room ${roomId}`);
}

function setupHongAHandlers() {
  hongAIO.on('connection', (socket: Socket) => {
    console.log(`[HongA] Client connected: ${socket.id}`);

    socket.on('create-room', () => {
      const room = roomManager.createRoom(socket.id, HONGA_GAME_ID);
      if (!room) {
        socket.emit('error', { message: 'Failed to create room', code: 'create-failed' });
        return;
      }
      hongASocketToRoom.set(socket.id, room.id);
      socket.join(room.id);
      socket.emit('room-created', { room, playerIndex: 0 });
      console.log(`[HongA] Room created: ${room.id} by ${socket.id}`);
    });

    socket.on('join-room', ({ roomId }: { roomId: string }) => {
      const result = roomManager.joinRoom(socket.id, roomId, HONGA_GAME_ID);

      if ('error' in result) {
        socket.emit('error', { message: result.error, code: result.error });
        console.log(`[HongA] Join room failed: ${result.error} for ${socket.id}`);
        return;
      }

      hongASocketToRoom.set(socket.id, roomId);
      socket.join(roomId);
      socket.emit('room-joined', { room: result.room, playerIndex: result.playerIndex });
      socket.to(roomId).emit('player-joined', { room: result.room });
      console.log(`[HongA] ${socket.id} joined room ${roomId} as player ${result.playerIndex}`);
    });

    socket.on('leave-room', ({ roomId }: { roomId: string }) => {
      handleHongALeave(socket, roomId);
    });

    socket.on('play-cards', ({ roomId, cards }: { roomId: string; cards: any[] }) => {
      const result = roomManager.handleMove(socket.id, roomId, { cards });

      if (!result.success) {
        socket.emit('error', { message: result.error!, code: result.error });
        return;
      }

      const room = result.room as HongARoom;
      const playerIndex = roomManager.getPlayerIndex(roomId, socket.id);

      hongAIO.to(roomId).emit('opponent-played', {
        playerIndex,
        cards,
      });

      if (room.scores) {
        hongAIO.to(roomId).emit('score-update', room.scores);
      }
    });

    socket.on('pass', ({ roomId }: { roomId: string }) => {
      const playerIndex = roomManager.getPlayerIndex(roomId, socket.id);
      hongAIO.to(roomId).emit('player-passed', { playerIndex });
    });

    socket.on('restart-game', ({ roomId }: { roomId: string }) => {
      const result = roomManager.restartGame(socket.id, roomId);

      if (!result.success) {
        socket.emit('error', { message: result.error!, code: result.error });
        return;
      }

      hongAIO.to(roomId).emit('restart-approved', { room: result.room });
    });

    socket.on('disconnect', () => {
      console.log(`[HongA] Client disconnected: ${socket.id}`);
      const roomId = hongASocketToRoom.get(socket.id);
      if (roomId) {
        handleHongALeave(socket, roomId);
        hongASocketToRoom.delete(socket.id);
      }
    });
  });
}

function handleHongALeave(socket: Socket, roomId: string) {
  const opponentIds = roomManager.getOpponentSocketIds(roomId, socket.id);
  roomManager.leaveRoom(socket.id, roomId);
  socket.leave(roomId);

  if (opponentIds.length > 0) {
    socket.to(roomId).emit('opponent-left', {});
  }

  console.log(`[HongA] ${socket.id} left room ${roomId}`);
}

setupGobangHandlers();
setupHongAHandlers();

setInterval(() => {
  const removed = roomManager.cleanupInactiveRooms();
  if (removed > 0) {
    console.log(`[Server] Cleaned up ${removed} inactive rooms`);
  }
}, 5 * 60 * 1000);

httpServer.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════════════════════╗
║          Game Server Running on port ${PORT}              ║
║                                                           ║
║   Gobang:  http://localhost:${PORT} (path: /socket.io)    ║
║   HongA:   http://localhost:${PORT} (path: /honga-socket) ║
║   Socket.IO: Ready for connections                        ║
╚═══════════════════════════════════════════════════════════╝
  `);
});