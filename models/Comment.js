const mongoose = require('mongoose');

const commentSchema = new mongoose.Schema({
    pollId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Poll',
        required: true,
        index: true
    },
   
    // 작성자 정보
    author: {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        displayName: {
            type: String,
            required: true
        },
        isAnonymous: {
            type: Boolean,
            default: false
        },
        isPollCreator: {
            type: Boolean,
            default: false
        }
    },

    // 댓글 내용
    content: {
        type: String,
        required: true,
        trim: true,
        maxlength: 1000
    },

    // 댓글 카운트
    commentCount: {
        type: Number,
        default: 0
    },

    // 상태
    isDeleted: {
        type: Boolean,
        default: false
    },
    deletedAt: Date,
    deleteBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },

    // IP 정보 (신고/차단용)
    ipAddress: String,
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

commentSchema.index({ pollId: 1, createdAt: -1 });
module.exports = mongoose.model('Comment', commentSchema);
