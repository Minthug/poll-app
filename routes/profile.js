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

        
    }
})