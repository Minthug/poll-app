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
    options: [optionSchema],
    createdAt: {
        type: Date,
        defalut: Date.now
    },
    endDate: {
        type: Date
    }
});

module.exports = mongoose.model('Poll', pollSchema);
