const mongoose = require('mongoose');

const optionSchema = new mongoose.Schema({
    text: {
        type: String,
        required: true,
        trim: true
    },
    votes: {
        type: Number,
        default: 0
    }
});

const pollSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true,
        trim: true
    },
    description: {
        type: String,
        trim: true
    },

    // 최대 5개의 옵션을 가질 수 있음
    options: [optionSchema],
    createdAt: {
        type: Date,
        defalut: Date.now
    },
    endDate: {
        type: Date
    },
    voteIps: {
        type: [String],
        default: []
    }
});

pollSchema.virtual('totalVotes').get(function() {
        return this.options.reduce((sum, option) => sum + option.votes, 0);
})

pollSchema.set('toJSON', { virtuals: true });
pollSchema.set('toObject', { virtuals: true });
module.exports = mongoose.model('Poll', pollSchema);
