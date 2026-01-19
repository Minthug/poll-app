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
        
    }
});