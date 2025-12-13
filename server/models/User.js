const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
    username: {type: String, required: true, unique: true},
    password: {type: String, required: true},
    elo: {type: Number, default: 1200},
    wins: {type: Number, default: 0},
    losses: {type: Number, default: 0},
    draws: {type: Number, default: 0},
    avatar: {type: String, default: ""},
    gamesPlayed: {type: Number, default: 0},

    role: {type: String, default: 'user', enum: ['user', 'admin']},
    isBanned: {type: Boolean, default: false},

    friends: [{type: String}],
    friendRequests: [{type: String}],

    createdAt: {type: Date, default: Date.now}
});

module.exports = mongoose.model('User', UserSchema);