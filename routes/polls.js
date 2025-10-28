const express = require('express');
const router = express.Router();
const Poll = require('../models/Poll');

// 모든 여론 조사 목록
router.get('/', async (req, res) => {
    try {
        const polls = await Poll.find().sort('-createdAt');
        res.render('polls/index', { polls });
    } catch (error) {
        res.status(500).send('서버 오류');
    }
});

// 새 여론조사 폼
router.get('/new', (req, res) => {
    res.render('polls/new');
});


