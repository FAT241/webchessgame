const mongoose = require('mongoose');

const ReportSchema = new mongoose.Schema({
    reporter: {type: String, required: true},
    reportedUser: {type: String, required: true},
    reason: {type: String, required: true},
    description: {type: String},
    matchId: {type: String},
    status: {
        type: String,
        default: 'pending',
        enum: ['pending', 'resolved', 'rejected']
    },
    createdAt: {type: Date, default: Date.now}
});

module.exports = mongoose.model('Report', ReportSchema);