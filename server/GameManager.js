const Chess = require('chess.js').Chess;

class GameManager {
    constructor() {
        this.rooms = new Map();
    }

    createRoom(hostId, hostName, timeLimit = 10) {
        const roomId = Math.random().toString(36).substring(2, 8).toUpperCase();
        const timeInSeconds = timeLimit * 60;

        this.rooms.set(roomId, {
            id: roomId,
            players: [hostId],
            playerNames: {[hostId]: hostName},
            whitePlayer: hostName, blackPlayer: null,
            game: new Chess(),
            timers: {w: timeInSeconds, b: timeInSeconds},
            timerInterval: null
        });
        return roomId;
    }

    joinRoom(playerId, roomId, playerName) { // <--- Thêm tham số playerName
        const room = this.rooms.get(roomId);
        if (room && room.players.length < 2) {
            room.players.push(playerId);
            room.playerNames[playerId] = playerName; // <--- Lưu tên người vào
            return true;
        }
        return false;
    }

    getRoom(roomId) {
        return this.rooms.get(roomId);
    }

    removeRoom(roomId) {
        this.rooms.delete(roomId);
    }
}

module.exports = {GameManager};