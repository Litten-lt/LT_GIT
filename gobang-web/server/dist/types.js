"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HONGA_GAME_ID = exports.GOBANG_GAME_ID = void 0;
exports.generateRoomId = generateRoomId;
function generateRoomId() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let result = '';
    for (let i = 0; i < 6; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}
exports.GOBANG_GAME_ID = 'gobang';
exports.HONGA_GAME_ID = 'honga';
