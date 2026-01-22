const mongoose = require('mongoose');

const notficiationSchema = new mongoose.Schema({
    recipient: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    sender: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    type: {
        type: String,
        enum: ['comment', 'reply', 'vote', 'poll_end', 'system'],
        required: true
    },
    poll: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Poll'
    },
    comment: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Comment'
    },
    message: {
        type: String,
        required: true
    },
    link: {
        type: String,
    },
    read: {
        type: Boolean,
        default: false
    },
    createdAt: {
        type: Date,
        default: Date.now,
        expires: 2592000 // 30일 후 삭제
    }
});

// 복합 인덱스
notificationSchema.index({ recipient: 1, read: 1, createdAt: -1 });

module.exports = mongoose.model('Notification', notficiationSchema);