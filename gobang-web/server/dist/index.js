"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const http_1 = require("http");
const socket_io_1 = require("socket.io");
const RoomManager_1 = require("./RoomManager");
const Handler_1 = require("./games/gobang/Handler");
const Handler_2 = require("./games/honga/Handler");
const types_1 = require("./games/honga/types");
const PORT = 3001;
const app = (0, express_1.default)();
const httpServer = (0, http_1.createServer)(app);
const gobangIO = new socket_io_1.Server(httpServer, {
    path: '/socket.io',
    cors: {
        origin: ['https://chesshub.fun'],
        methods: ['GET', 'POST'],
    },
});
const hongAIO = new socket_io_1.Server(httpServer, {
    path: '/honga-socket',
    cors: {
        origin: ['https://chesshub.fun'],
        methods: ['GET', 'POST'],
    },
});
const roomManager = new RoomManager_1.RoomManager();
roomManager.registerGame(Handler_1.GobangHandler);
roomManager.registerGame(Handler_2.HongAHandler);
const gobangSocketToRoom = new Map();
const hongASocketToRoom = new Map();
function setupGobangHandlers() {
    gobangIO.on('connection', (socket) => {
        console.log(`[Gobang] Client connected: ${socket.id}`);
        socket.on('create-room', () => {
            const room = roomManager.createRoom(socket.id, Handler_1.GOBANG_GAME_ID);
            if (!room) {
                socket.emit('error', { message: 'Failed to create room', code: 'create-failed' });
                return;
            }
            gobangSocketToRoom.set(socket.id, room.id);
            socket.join(room.id);
            socket.emit('room-created', { room, playerIndex: 0 });
            console.log(`[Gobang] Room created: ${room.id} by ${socket.id}`);
        });
        socket.on('join-room', ({ roomId }) => {
            const result = roomManager.joinRoom(socket.id, roomId, Handler_1.GOBANG_GAME_ID);
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
        socket.on('leave-room', ({ roomId }) => {
            handleGobangLeave(socket, roomId);
        });
        socket.on('make-move', ({ roomId, row, col }) => {
            const result = roomManager.handleMove(socket.id, roomId, { row, col });
            if (!result.success) {
                socket.emit('error', { message: result.error, code: result.error });
                return;
            }
            const room = result.room;
            const playerIndex = roomManager.getPlayerIndex(roomId, socket.id);
            const expectedPlayer = playerIndex === 0 ? 'black' : 'white';
            gobangIO.to(roomId).emit('opponent-move', {
                row,
                col,
                player: expectedPlayer,
            });
            if (room.state === 'ended') {
                gobangIO.to(roomId).emit('game-over', {
                    winner: room.winner,
                    winningLine: room.winningLine || undefined,
                });
            }
        });
        socket.on('restart-game', ({ roomId }) => {
            const result = roomManager.restartGame(socket.id, roomId);
            if (!result.success) {
                socket.emit('error', { message: result.error, code: result.error });
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
function handleGobangLeave(socket, roomId) {
    const opponentIds = roomManager.getOpponentSocketIds(roomId, socket.id);
    roomManager.leaveRoom(socket.id, roomId);
    socket.leave(roomId);
    if (opponentIds.length > 0) {
        socket.to(roomId).emit('opponent-left', {});
    }
    console.log(`[Gobang] ${socket.id} left room ${roomId}`);
}
function setupHongAHandlers() {
    hongAIO.on('connection', (socket) => {
        console.log(`[HongA] Client connected: ${socket.id}`);
        socket.on('create-room', () => {
            const room = roomManager.createRoom(socket.id, types_1.HONGA_GAME_ID);
            if (!room) {
                socket.emit('error', { message: 'Failed to create room', code: 'create-failed' });
                return;
            }
            hongASocketToRoom.set(socket.id, room.id);
            socket.join(room.id);
            const hongARoom = room;
            const handsObj = {};
            for (const key in hongARoom.hands) {
                handsObj[key] = hongARoom.hands[key];
            }
            socket.emit('room-created', { room: { ...hongARoom, hands: handsObj }, playerIndex: 0 });
            console.log(`[HongA] Room created: ${room.id} by ${socket.id}`);
        });
        socket.on('join-room', ({ roomId }) => {
            const result = roomManager.joinRoom(socket.id, roomId, types_1.HONGA_GAME_ID);
            if ('error' in result) {
                socket.emit('error', { message: result.error, code: result.error });
                console.log(`[HongA] Join room failed: ${result.error} for ${socket.id}`);
                return;
            }
            hongASocketToRoom.set(socket.id, roomId);
            socket.join(roomId);
            const room = result.room;
            const handsObj = {};
            for (const key in room.hands) {
                handsObj[key] = room.hands[key];
            }
            socket.emit('room-joined', { room: { ...room, hands: handsObj }, playerIndex: result.playerIndex });
            socket.to(roomId).emit('player-joined', { room: { ...room, hands: handsObj } });
            console.log(`[HongA] ${socket.id} joined room ${roomId} as player ${result.playerIndex}`);
        });
        socket.on('leave-room', ({ roomId }) => {
            handleHongALeave(socket, roomId);
        });
        socket.on('play-cards', ({ roomId, cards }) => {
            const result = roomManager.handleMove(socket.id, roomId, { cards });
            if (!result.success) {
                socket.emit('error', { message: result.error, code: result.error });
                return;
            }
            const room = result.room;
            const playerIndex = roomManager.getPlayerIndex(roomId, socket.id);
            const handsObj = {};
            for (const key in room.hands) {
                handsObj[key] = room.hands[key];
            }
            hongAIO.to(roomId).emit('opponent-played', {
                playerIndex,
                cards,
                room: {
                    ...room,
                    hands: handsObj,
                },
            });
            if (room.state === 'finished') {
                hongAIO.to(roomId).emit('game-over', { room: { ...room, hands: handsObj } });
            }
        });
        socket.on('start-game', ({ roomId }) => {
            const result = roomManager.startGame(socket.id, roomId);
            if (!result.success) {
                socket.emit('error', { message: result.error, code: result.error });
                return;
            }
            const room = result.room;
            const handsObj = {};
            for (const key in room.hands) {
                handsObj[key] = room.hands[key];
            }
            hongAIO.to(roomId).emit('game-started', { room: { ...room, hands: handsObj } });
        });
        socket.on('pass', ({ roomId }) => {
            const result = roomManager.handlePass(socket.id, roomId);
            if (!result.success) {
                socket.emit('error', { message: result.error, code: result.error });
                return;
            }
            const room = result.room;
            const playerIndex = roomManager.getPlayerIndex(roomId, socket.id);
            const handsObj = {};
            for (const key in room.hands) {
                handsObj[key] = room.hands[key];
            }
            hongAIO.to(roomId).emit('player-passed', { playerIndex });
            hongAIO.to(roomId).emit('room-state', { room: { ...room, hands: handsObj } });
        });
        socket.on('restart-game', ({ roomId }) => {
            const result = roomManager.restartGame(socket.id, roomId);
            if (!result.success) {
                socket.emit('error', { message: result.error, code: result.error });
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
function handleHongALeave(socket, roomId) {
    const room = roomManager.getRoom(roomId);
    if (!room)
        return;
    const opponentIds = roomManager.getOpponentSocketIds(roomId, socket.id);
    roomManager.leaveRoom(socket.id, roomId);
    socket.leave(roomId);
    if (room.state === 'playing' || room.state === 'ready') {
        hongAIO.to(roomId).emit('player-left', { playerIndex: room.players.indexOf(socket.id) });
        hongAIO.to(roomId).emit('game-over', { reason: 'player-left' });
    }
    else if (opponentIds.length > 0) {
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
