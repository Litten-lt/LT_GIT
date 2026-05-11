"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GobangHandler = exports.WIN_COUNT = exports.BOARD_SIZE = exports.GOBANG_GAME_ID = void 0;
const types_1 = require("../../types");
Object.defineProperty(exports, "GOBANG_GAME_ID", { enumerable: true, get: function () { return types_1.GOBANG_GAME_ID; } });
exports.BOARD_SIZE = 15;
exports.WIN_COUNT = 5;
function createEmptyBoard() {
    return Array(exports.BOARD_SIZE)
        .fill(null)
        .map(() => Array(exports.BOARD_SIZE).fill(null));
}
function checkWin(board, row, col, player) {
    const directions = [[0, 1], [1, 0], [1, 1], [1, -1]];
    for (const [dx, dy] of directions) {
        const line = [[row, col]];
        for (let dir = 1; dir <= 4; dir++) {
            const r = row + dx * dir;
            const c = col + dy * dir;
            if (r >= 0 && r < exports.BOARD_SIZE && c >= 0 && c < exports.BOARD_SIZE && board[r][c] === player) {
                line.push([r, c]);
            }
            else {
                break;
            }
        }
        for (let dir = -1; dir >= -4; dir--) {
            const r = row + dx * dir;
            const c = col + dy * dir;
            if (r >= 0 && r < exports.BOARD_SIZE && c >= 0 && c < exports.BOARD_SIZE && board[r][c] === player) {
                line.push([r, c]);
            }
            else {
                break;
            }
        }
        if (line.length >= exports.WIN_COUNT) {
            return line;
        }
    }
    return null;
}
function isBoardFull(board) {
    for (let row = 0; row < exports.BOARD_SIZE; row++) {
        for (let col = 0; col < exports.BOARD_SIZE; col++) {
            if (board[row][col] === null) {
                return false;
            }
        }
    }
    return true;
}
function isValidMove(board, row, col) {
    return row >= 0 && row < exports.BOARD_SIZE && col >= 0 && col < exports.BOARD_SIZE && board[row][col] === null;
}
exports.GobangHandler = {
    gameId: types_1.GOBANG_GAME_ID,
    maxPlayers: 2,
    createRoom(socketId) {
        const roomId = (0, types_1.generateRoomId)();
        const room = {
            id: roomId,
            gameId: types_1.GOBANG_GAME_ID,
            players: [socketId, null],
            state: 'waiting',
            board: createEmptyBoard(),
            currentPlayer: 'black',
            moveHistory: [],
            winner: null,
            winningLine: null,
            createdAt: Date.now(),
        };
        return room;
    },
    joinRoom(socketId, roomId, rooms) {
        const room = rooms.get(roomId);
        if (!room) {
            return { success: false, error: 'room-not-found' };
        }
        if (room.gameId !== types_1.GOBANG_GAME_ID) {
            return { success: false, error: 'room-not-found' };
        }
        if (room.players[1] !== null) {
            return { success: false, error: 'room-full' };
        }
        if (room.players[0] === socketId) {
            return { success: true, room, playerIndex: 0 };
        }
        room.players[1] = socketId;
        room.state = 'playing';
        return { success: true, room, playerIndex: 1 };
    },
    handleMove(socketId, roomId, move, rooms) {
        const room = rooms.get(roomId);
        if (!room) {
            return { success: false, error: 'room-not-found' };
        }
        if (room.state === 'ended') {
            return { success: false, error: 'game-ended' };
        }
        const playerIndex = room.players[0] === socketId ? 0 : room.players[1] === socketId ? 1 : -1;
        if (playerIndex === -1) {
            return { success: false, error: 'not-in-room' };
        }
        const expectedPlayer = playerIndex === 0 ? 'black' : 'white';
        if (room.currentPlayer !== expectedPlayer) {
            return { success: false, error: 'not-your-turn' };
        }
        const { row, col } = move;
        if (!isValidMove(room.board, row, col)) {
            return { success: false, error: 'cell-occupied' };
        }
        room.board[row][col] = expectedPlayer;
        room.moveHistory.push([row, col]);
        const winningLine = checkWin(room.board, row, col, expectedPlayer);
        if (winningLine) {
            room.state = 'ended';
            room.winner = expectedPlayer;
            room.winningLine = winningLine;
        }
        else if (isBoardFull(room.board)) {
            room.state = 'ended';
            room.winner = 'draw';
            room.winningLine = null;
        }
        else {
            room.currentPlayer = expectedPlayer === 'black' ? 'white' : 'black';
        }
        return { success: true, room };
    },
    restartGame(socketId, roomId, rooms) {
        const room = rooms.get(roomId);
        if (!room) {
            return { success: false, error: 'room-not-found' };
        }
        const playerIndex = room.players[0] === socketId ? 0 : room.players[1] === socketId ? 1 : -1;
        if (playerIndex === -1) {
            return { success: false, error: 'not-in-room' };
        }
        room.board = createEmptyBoard();
        room.currentPlayer = 'black';
        room.moveHistory = [];
        room.winner = null;
        room.winningLine = null;
        room.state = room.players[0] !== null && room.players[1] !== null ? 'playing' : 'waiting';
        return { success: true, room };
    },
    getPlayerIndex(roomId, socketId, rooms) {
        const room = rooms.get(roomId);
        if (!room)
            return null;
        if (room.players[0] === socketId)
            return 0;
        if (room.players[1] === socketId)
            return 1;
        return null;
    },
    getOpponentSocketIds(roomId, socketId, rooms) {
        const room = rooms.get(roomId);
        if (!room)
            return [];
        const opponents = [];
        if (room.players[0] === socketId && room.players[1])
            opponents.push(room.players[1]);
        if (room.players[1] === socketId && room.players[0])
            opponents.push(room.players[0]);
        return opponents;
    },
};
