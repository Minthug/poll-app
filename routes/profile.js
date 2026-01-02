const express = require("express");
const router = express.Router();
const Poll = require('../models/Poll');
const Visitor = require('../models/Visitor');
const { requireLogin } = require('../middleware/auth');

/* 프로필 페이지 (로그인 필수) */
router.get('/', requireLogin, async (req, res) => {
    try {
        const userId = req.session.userId;

        // 내가 만든 여론조사 조회
        const myPolls = await Poll.find({ createdBy: userId })
            .sort({ createdAt: -1 })
            .lean();

        // 각 투표의 총 투표수 계산
        myPolls.forEach(pol => {
            poll.totalVotes = poll.options.reduce((sum, opt) => sum + opt.votes, 0);
        });

        // 내가 참여한 투표 조회 (IP 기반)
        const clientIp = req.headers['x-forworded-for']
            ? req.headers['x-forworded-for'].split(',')[0].trim()
            : req.ip || req.socket.remoteAddress;

        const votedPolls = await Poll.find({ votedIPs: clientIp })
            .sort({ createdAt: -1 })
            .lean();
        
        votedPolls.forEach(poll => {
            poll.totalVotes = poll.options.reduce((sum, opt) => sum + opt.votes, 0);
        });

        // 통계 계산
        const stats = {
            totalCreated: myPolls.length,
            totalVoted: votedPolls.length,
            totalVotesReceived: myPolls.reduce((sum, poll) => sum + poll.totalVotes, 0)
        };

        res.render('profile/index', {
            user: {
                username: req.session.username,
                email: req.session.email
            },
            myPolls,
            votedPolls,
            stats,
            showRanking: true
        });
    } catch (error) {
        console.error('프로필 페이지 오류:', error);
        res.status(500).send('서버 오류');
    }
});

module.exports = router;
