const mongoose = require('mongoose');

const MatchSchema = new mongoose.Schema({
    whitePlayer: {type: String, required: true},
    blackPlayer: {type: String, required: true},
    winner: {type: String},
    reason: {type: String},
    pgn: {type: String},
    date: {type: Date, default: Date.now}
});
module.exports = mongoose.model('Match', MatchSchema);