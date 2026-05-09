"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const http_1 = require("http");
const socket_io_1 = require("socket.io");
const RoomManager_1 = require("./RoomManager");
const PORT = 3001;
const app = (0, express_1.default)();
const httpServer = (0, http_1.createServer)(app);
const io = new socket_io_1.Server(httpServer, {
    cors: {
        origin: ['https://chesshub.fun'],
        methods: ['GET', 'POST'],
    },
});
const roomManager = new RoomManager_1.RoomManager();
const socketToRoom = new Map();
io.on('connection', (socket) => {
    console.log(`[Server] Client connected: ${socket.id}`);
    socket.on('create-room', () => {
        const room = roomManager.createRoom(socket.id);
        socketToRoom.set(socket.id, room.id);
        socket.join(room.id);
        socket.emit('room-created', { room, playerIndex: 0 });
        console.log(`[Server] Room created: ${room.id} by ${socket.id}`);
    });
    socket.on('join-room', ({ roomId }) => {
        const result = roomManager.joinRoom(socket.id, roomId);
        if ('error' in result) {
            socket.emit('error', { message: result.error, code: result.error });
            console.log(`[Server] Join room failed: ${result.error} for ${socket.id}`);
            return;
        }
        socketToRoom.set(socket.id, roomId);
        socket.join(roomId);
        socket.emit('room-joined', {
            room: result.room,
            playerIndex: result.playerIndex,
        });
        socket.to(roomId).emit('player-joined', { room: result.room });
        console.log(`[Server] ${socket.id} joined room ${roomId} as player ${result.playerIndex}`);
    });
    socket.on('leave-room', ({ roomId }) => {
        handleLeaveRoom(socket, roomId);
    });
    socket.on('make-move', ({ roomId, row, col }) => {
        const result = roomManager.makeMove(socket.id, roomId, row, col);
        if (!result.success) {
            socket.emit('error', { message: result.error, code: result.error });
            return;
        }
        const expectedPlayer = roomManager.getPlayerIndex(roomId, socket.id) === 0 ? 'black' : 'white';
        const opponentId = roomManager.getOpponentSocketId(roomId, socket.id);
        io.to(roomId).emit('opponent-move', {
            row,
            col,
            player: expectedPlayer,
        });
        if (result.room.state === 'ended') {
            io.to(roomId).emit('game-over', {
                winner: result.room.winner,
                winningLine: result.room.winningLine || undefined,
            });
        }
        console.log(`[Server] Move: ${expectedPlayer} at [${row}, ${col}] in room ${roomId}`);
    });
    socket.on('restart-game', ({ roomId }) => {
        const result = roomManager.restartGame(socket.id, roomId);
        if (!result.success) {
            socket.emit('error', { message: result.error, code: result.error });
            return;
        }
        io.to(roomId).emit('restart-approved', { room: result.room });
        console.log(`[Server] Game restarted in room ${roomId}`);
    });
    socket.on('disconnect', () => {
        console.log(`[Server] Client disconnected: ${socket.id}`);
        const roomId = socketToRoom.get(socket.id);
        if (roomId) {
            handleLeaveRoom(socket, roomId);
            socketToRoom.delete(socket.id);
        }
    });
});
function handleLeaveRoom(socket, roomId) {
    const opponentId = roomManager.getOpponentSocketId(roomId, socket.id);
    roomManager.leaveRoom(socket.id, roomId);
    socket.leave(roomId);
    socketToRoom.delete(socket.id);
    if (opponentId) {
        socket.to(roomId).emit('opponent-left', {});
    }
    console.log(`[Server] ${socket.id} left room ${roomId}`);
}
setInterval(() => {
    const removed = roomManager.cleanupInactiveRooms();
    if (removed > 0) {
        console.log(`[Server] Cleaned up ${removed} inactive rooms`);
    }
}, 5 * 60 * 1000);
httpServer.listen(PORT, () => {
    console.log(`
╔═══════════════════════════════════════════════════════════╗
║          Gobang Server Running on port ${PORT}             ║
║                                                           ║
║   Local:    http://localhost:${PORT}                        ║
║   Socket.IO: Ready for connections                        ║
╚═══════════════════════════════════════════════════════════╝
  `);
});
