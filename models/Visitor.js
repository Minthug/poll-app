const mongoose = require('mongoose');

const visitorSchema = new mongoose.Schema({
    ip: {
        type: String,
        required: true
    },
    action: {
        type: String,
        enum: ['agree_terms', 'vote'],
        required: true
    },
    pollId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Poll',
        default: null
    },
    userAgent: {
        type: String
    },
    timeStamps: {
        type: Date,
        default: Date.now
    },
    location: {
        country: String,
        region: String,
        city: String
    },
    createdAt: { type: Date, default: Date.now }
});

// 인덱스 추가 (검색 성능 향상)
visitorSchema.index({ ip: 1 });
visitorSchema.index({ action: 1 });
visitorSchema.index({ timestamp: -1 });

module.exports = mongoose.model('Visitor', visitorSchema);