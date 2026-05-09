"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WIN_COUNT = exports.BOARD_SIZE = void 0;
exports.createEmptyBoard = createEmptyBoard;
exports.checkWin = checkWin;
exports.isBoardFull = isBoardFull;
exports.isValidMove = isValidMove;
exports.generateRoomId = generateRoomId;
exports.BOARD_SIZE = 15;
exports.WIN_COUNT = 5;
function createEmptyBoard() {
    return Array(exports.BOARD_SIZE)
        .fill(null)
        .map(() => Array(exports.BOARD_SIZE).fill(null));
}
function checkWin(board, row, col, player) {
    const directions = [
        [0, 1],
        [1, 0],
        [1, 1],
        [1, -1],
    ];
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
function generateRoomId() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let result = '';
    for (let i = 0; i < 6; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}
