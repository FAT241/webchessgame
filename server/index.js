const express = require('express');
const http = require('http');
const {Server} = require('socket.io');
const cors = require('cors');
const {Chess} = require('chess.js');
const mongoose = require('mongoose');
const connectDB = require('./db');
const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');
const userRoutes = require('./routes/user');
const User = require('./models/User');
const Match = require('./models/Match');

require('dotenv').config();

const DEFAULT_TIME = 600;
const K = 32;
const DISCONNECT_TIMEOUT = 60000; // 60 giây

const calculateElo = (ratingA, ratingB, actualScoreA) => {
    const expectedScoreA = 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
    return Math.round(ratingA + K * (actualScoreA - expectedScoreA));
};

const updateGameStats = async (p1Name, p2Name, winnerColor) => {
    try {
        const userWhite = await User.findOne({username: p1Name});
        const userBlack = await User.findOne({username: p2Name});

        if (userWhite && userBlack) {
            let scoreWhite = 0.5;
            if (winnerColor === 'white') scoreWhite = 1;
            else if (winnerColor === 'black') scoreWhite = 0;

            const newEloWhite = calculateElo(userWhite.elo, userBlack.elo, scoreWhite);
            const newEloBlack = calculateElo(userBlack.elo, userWhite.elo, 1 - scoreWhite);

            if (scoreWhite === 1) {
                userWhite.wins++;
                userBlack.losses++;
            } else if (scoreWhite === 0) {
                userWhite.losses++;
                userBlack.wins++;
            } else {
                userWhite.draws++;
                userBlack.draws++;
            }

            userWhite.elo = newEloWhite;
            userWhite.gamesPlayed++;
            userBlack.elo = newEloBlack;
            userBlack.gamesPlayed++;

            await userWhite.save();
            await userBlack.save();
            console.log(`[ELO] ${p1Name}: ${newEloWhite} | ${p2Name}: ${newEloBlack}`);
        }
    } catch (err) {
        console.error("Lỗi Elo:", err);
    }
};

const processGameResult = async (p1Name, p2Name, winnerColor, reason, pgn) => {
    try {
        const newMatch = new Match({
            whitePlayer: p1Name, blackPlayer: p2Name,
            winner: winnerColor || 'draw', reason: reason, pgn: pgn
        });
        await newMatch.save();
        await updateGameStats(p1Name, p2Name, winnerColor);
    } catch (err) {
        console.error("Lỗi lưu kết quả:", err);
    }
};

class GameManager {
    constructor() {
        this.rooms = new Map();
        this.matchmakingQueue = [];
        this.disconnectTimers = new Map(); // Lưu timer đếm ngược
    }

    createRoom(hostId, hostName, timeConfig = {minutes: 10, increment: 0}) {
        const roomId = Math.random().toString(36).substring(2, 8).toUpperCase();
        const initialSeconds = timeConfig.minutes * 60;

        this.rooms.set(roomId, {
            id: roomId,
            players: [hostId],
            playerNames: {[hostId]: hostName},
            whitePlayer: hostName,
            blackPlayer: null,
            game: new Chess(),
            timers: {w: initialSeconds, b: initialSeconds},
            timeConfig: timeConfig,
            timerInterval: null,
            status: 'playing'
        });
        return roomId;
    }

    joinRoom(playerId, roomId, playerName) {
        const room = this.rooms.get(roomId);
        if (room) {
            if (room.whitePlayer === playerName) {
                const oldSocketId = room.players[0];
                room.players[0] = playerId;

                if (this.disconnectTimers.has(oldSocketId)) {
                    clearTimeout(this.disconnectTimers.get(oldSocketId));
                    this.disconnectTimers.delete(oldSocketId);
                }
                return 'reconnect';
            }
            if (room.blackPlayer === playerName) {
                const oldSocketId = room.players[1];
                room.players[1] = playerId;

                if (this.disconnectTimers.has(oldSocketId)) {
                    clearTimeout(this.disconnectTimers.get(oldSocketId));
                    this.disconnectTimers.delete(oldSocketId);
                }
                return 'reconnect';
            }

            if (room.whitePlayer === playerName || room.blackPlayer === playerName) return false;

            if (room.players.length < 2) {
                room.players.push(playerId);
                room.playerNames[playerId] = playerName;
                room.blackPlayer = playerName;
                return true;
            }
        }
        return false;
    }

    handleDisconnect(socketId, io) {
        this.removeFromQueue(socketId);

        for (const [roomId, room] of this.rooms.entries()) {
            if (room.players.includes(socketId) && room.status === 'playing') {
                const isWhite = room.players[0] === socketId;
                const playerName = isWhite ? room.whitePlayer : room.blackPlayer;

                console.log(`User ${playerName} bị mất kết nối. Đếm ngược 60s...`);

                io.to(roomId).emit('opponent_disconnected', {
                    msg: `Đối thủ ${playerName} mất kết nối! Tự động xử thắng sau 60s.`
                });

                const timer = setTimeout(async () => {
                    if (this.rooms.has(roomId) && room.status === 'playing') {
                        const winnerColor = isWhite ? 'black' : 'white';

                        await processGameResult(room.whitePlayer, room.blackPlayer, winnerColor, 'Đối thủ mất kết nối', room.game.pgn());

                        io.to(roomId).emit('game_over', {
                            winner: winnerColor,
                            reason: 'Đối thủ mất kết nối quá 60s'
                        });
                        this.stopTimer(roomId);
                        room.status = 'finished';
                    }
                }, DISCONNECT_TIMEOUT);

                this.disconnectTimers.set(socketId, timer);
                break;
            }
        }
    }

    addToQueue(socketId, username, io) {
        if (this.matchmakingQueue.find(p => p.username === username)) return;
        this.matchmakingQueue.push({socketId, username});
        if (this.matchmakingQueue.length >= 2) {
            const p1 = this.matchmakingQueue.shift();
            const p2 = this.matchmakingQueue.shift();
            const roomId = this.createRoom(p1.socketId, p1.username);
            this.joinRoom(p2.socketId, roomId, p2.username);

            const room = this.rooms.get(roomId);
            const s1 = io.sockets.sockets.get(p1.socketId);
            const s2 = io.sockets.sockets.get(p2.socketId);
            if (s1) s1.join(roomId);
            if (s2) s2.join(roomId);

            io.to(roomId).emit('game_start', {
                fen: room.game.fen(), pgn: room.game.pgn(), roomId: roomId, timers: room.timers,
                names: {w: room.whitePlayer, b: room.blackPlayer},
                timeConfig: room.timeConfig
            });
            if (s1) s1.emit('player_color', 'w');
            if (s2) s2.emit('player_color', 'b');
            this.startTimer(roomId, io);
        }
    }

    removeFromQueue(socketId) {
        this.matchmakingQueue = this.matchmakingQueue.filter(p => p.socketId !== socketId);
    }

    getRoom(roomId) {
        return this.rooms.get(roomId);
    }

    startTimer(roomId, io) {
        const room = this.rooms.get(roomId);
        if (!room) return;
        if (room.timerInterval) clearInterval(room.timerInterval);

        room.timerInterval = setInterval(async () => {
            const turn = room.game.turn();
            room.timers[turn] -= 1;
            io.to(roomId).emit('time_update', room.timers);

            if (room.timers[turn] <= 0) {
                clearInterval(room.timerInterval);
                const winnerColor = turn === 'w' ? 'black' : 'white';
                await processGameResult(room.whitePlayer, room.blackPlayer, winnerColor, 'Hết giờ', room.game.pgn());
                io.to(roomId).emit('game_over', {winner: winnerColor, reason: 'Hết giờ (Timeout)'});
                room.status = 'finished';
            }
        }, 1000);
    }

    stopTimer(roomId) {
        const room = this.rooms.get(roomId);
        if (room && room.timerInterval) clearInterval(room.timerInterval);
    }
}

const app = express();
connectDB();
app.use(cors({
    origin: "http://localhost:3000",
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type", "x-auth-token"]
}));
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/user', userRoutes);

app.get('/api/leaderboard', async (req, res) => {
    try {
        const users = await User.find().sort({elo: -1}).limit(10).select('username elo wins gamesPlayed');
        res.json(users);
    } catch (err) {
        res.status(500).send('Lỗi');
    }
});

app.get('/api/history/:username', async (req, res) => {
    try {
        const {username} = req.params;
        const matches = await Match.find({$or: [{whitePlayer: username}, {blackPlayer: username}]}).sort({date: -1}).limit(20);
        res.json(matches);
    } catch (err) {
        res.status(500).send('Lỗi');
    }
});

const server = http.createServer(app);
const io = new Server(server, {cors: {origin: "http://localhost:3000", methods: ["GET", "POST"]}});
const gameManager = new GameManager();

io.on('connection', (socket) => {
    socket.on('send_chat', ({roomId, message, sender}) => {
        io.to(roomId).emit('receive_chat', {sender, message});
    });

    socket.on('find_match', (username) => gameManager.addToQueue(socket.id, username, io));
    socket.on('cancel_find_match', () => gameManager.removeFromQueue(socket.id));

    socket.on('create_room', (data) => {
        let username = "Player 1";
        let timeConfig = {minutes: 10, increment: 0};
        if (typeof data === 'object') {
            username = data.username;
            if (data.time) timeConfig = data.time;
        } else {
            username = data;
        }
        const roomId = gameManager.createRoom(socket.id, username, timeConfig);
        socket.join(roomId);
        socket.emit('room_created', roomId);
    });

    socket.on('join_room', async (data) => {
        let roomId = data.roomId || data;
        let username = data.username || "Player 2";
        const joinResult = gameManager.joinRoom(socket.id, roomId, username);

        if (joinResult) {
            await socket.join(roomId);
            const room = gameManager.getRoom(roomId);
            io.to(roomId).emit('game_start', {
                fen: room.game.fen(), pgn: room.game.pgn(), roomId: roomId, timers: room.timers,
                names: {w: room.whitePlayer, b: room.blackPlayer},
                timeConfig: room.timeConfig
            });

            if (room.whitePlayer === username) socket.emit('player_color', 'w');
            else if (room.blackPlayer === username) socket.emit('player_color', 'b');

            if (joinResult === 'reconnect') {
                io.to(roomId).emit('opponent_reconnected'); // Báo đối thủ biết
            } else {
                gameManager.startTimer(roomId, io);
            }
        } else {
            socket.emit('error_message', 'Lỗi vào phòng');
        }
    });

    socket.on('make_move', async ({roomId, move}) => {
        const room = gameManager.getRoom(roomId);
        if (room && room.status === 'playing') {
            try {
                if (room.game.move(move)) {
                    const justMovedColor = room.game.turn() === 'w' ? 'b' : 'w';
                    room.timers[justMovedColor] += room.timeConfig.increment;
                    gameManager.startTimer(roomId, io);
                    io.to(roomId).emit('move_made', {fen: room.game.fen(), pgn: room.game.pgn()});

                    if (room.game.game_over()) {
                        gameManager.stopTimer(roomId);
                        let winnerColor = null;
                        let reason = 'Kết thúc';
                        if (room.game.in_checkmate()) {
                            winnerColor = room.game.turn() === 'w' ? 'black' : 'white';
                            reason = 'Chiếu bí';
                        } else if (room.game.in_draw()) reason = 'Hòa';
                        await processGameResult(room.whitePlayer, room.blackPlayer, winnerColor, reason, room.game.pgn());
                        io.to(roomId).emit('game_over', {winner: winnerColor, reason});
                        room.status = 'finished';
                    }
                }
            } catch (e) {
            }
        }
    });

    socket.on('resign', async (roomId) => {
        const room = gameManager.getRoom(roomId);
        if (room) {
            gameManager.stopTimer(roomId);
            const loserColor = (room.players[0] === socket.id) ? 'white' : 'black';
            const w = (loserColor === 'white') ? 'black' : 'white';
            await processGameResult(room.whitePlayer, room.blackPlayer, w, 'Đối thủ đầu hàng', room.game.pgn());
            io.to(roomId).emit('game_over', {winner: w, reason: 'Đối thủ đầu hàng 🏳️'});
            room.status = 'finished';
        }
    });
    socket.on('offer_draw', (rid) => socket.to(rid).emit('draw_offered', rid));
    socket.on('respond_draw', async ({roomId, accepted}) => {
        if (accepted) {
            const room = gameManager.getRoom(roomId);
            if (room) {
                gameManager.stopTimer(roomId);
                await processGameResult(room.whitePlayer, room.blackPlayer, null, 'Thỏa thuận hòa', room.game.pgn());
                io.to(roomId).emit('game_over', {winner: null, reason: 'Hòa đồng thuận 🤝'});
                room.status = 'finished';
            }
        } else socket.to(roomId).emit('draw_declined');
    });

    socket.on('disconnect', () => {
        gameManager.handleDisconnect(socket.id, io);
    });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => console.log(`SERVER CHẠY PORT ${PORT}`));