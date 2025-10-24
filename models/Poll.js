const mongoose = require('mongoose');

const optionSchema = new mongoose.Schema({
    text: {
        type: String,
        required: true
    },
    votes: {
        type: Number,
        default: 0
    }
});

const pollSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true
    },
    description: {
        type: String
    },
    options: [optionSchema],
    createdAt: {
        type: Date,
        defalut: Date.now
    }
});

module.exports = mongoose.model('Poll', pollSchema);
