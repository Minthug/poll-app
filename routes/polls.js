const express = require('express');
const router = express.Router();
const Poll = require('../models/Poll');

// 모든 여론 조사 목록
router.get('/', async (req, res) => {
    try {
        const polls = await Poll.find().sort({ createdAt: -1 });
        res.render('polls/index', { polls });
    } catch (error) {
        console.error(error);
        res.status(500).send('서버 오류');
    }
});

// 새 여론조사 폼   
router.get('/new', (req, res) => {
    res.render('polls/new');
});


// 여론조사 생성
router.post('/', async (req, res) => {
    try {
        const { title, description, options } = req.body;

        // 빈 옵션 필터링
        const pollOptions = options.filter(opt => opt.trim() !== '').map(opt => ({
            text: opt,
            votes: 0
        }));

        const poll = new Poll({
            title,
            description,
            options: pollOptions
        });

        await poll.save();
        res.redirect(`/polls/${poll._id}`);
    } catch (error) {
        res.status(500).send('서버 오류');
    }
});

// 여론조사 상세
router.get('/:id', async (req, res) => {
    try {
        const poll = await Poll.findById(req.params.id);
        if (!poll) { 
            return res.status(404).send('여론조사를 찾을 수 없습니다');
        }
            res.render('polls/show', { poll });
        } catch (error) {
            console.error(error);
        res.status(500).send('서버 오류');
    }
});


// 투표 처리
router.post('/:id/vote', async (req, res) => {
    try {
        const { optionId } = req.body;

        const poll = await Poll.findById(req.params.id);
        if (!poll) {
            return res.status(404).json({ success: false, error: '여론조사를 찾을 수 없습니다'})
        }

        const option = poll.options.id(optionId);
        if (!poll) {
            return res.status(404).json({ success: false, error: '옵션을 찾을 수 없습니다'})
        }

        option.votes += 1;
        await poll.save();

        res.json({
            success: true,
            votes: option.votes,
            totalVotes: poll.totalVotes
        });
    } catch(error) {
        console.error(error);
        res.status(500).json({ success: false, error: '서버 오류'})
    }
})

// 결과 보기
router.get('/:id/results', async ( req, res) => {
    try {
        const poll = await Poll.findById(req.params.id);
        if (!poll) return res.status(404).send('여론조사를 찾을 수 없습니다');
        res.render('polls/results', { poll });
    } catch (error) {
        res.status(500).send('서버 오류');
    }
})

module.exports = router;

