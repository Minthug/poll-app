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

    category: {
        type: String,
        enum: ['일반', '정치', '경제', '사회', '문화', '스포츠', '연예', '기술', '게임', '음식', '기타'],
        default: '일반'
    },

    tags: [{
        type: String,
        trim: true
    }],

    // 최대 5개의 옵션을 가질 수 있음
    options: [optionSchema],
    views: { type: Number, default: 0 },
    createdAt: {
        type: Date,
        default: Date.now
    },
    endDate: {
        type: Date,
        default: null
    },
    votedIPs: {
        type: [String],
        default: []
    },
    location: {
        country: String,
        region: String,
        city: String,
        isKorea: { type: Boolean, default: true}
    }
});

pollSchema.methods.isEnded = function() {
    if (!this.endDate) return false;
    return new Date() > this.endDate;
}

pollSchema.methods.getTimeRemaining = function() {
    if (!this.endDate) return null;
    const now = new Date();
    const diff = this.endDate - now;

    if (diff <= 0) return { ended: true };

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    return { days, hours, minutes, ended: false };
};

pollSchema.virtual('totalVotes').get(function() {
        return this.options.reduce((sum, option) => sum + option.votes, 0);
})

pollSchema.set('toJSON', { virtuals: true });
pollSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Poll', pollSchema);
