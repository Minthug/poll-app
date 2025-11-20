const express = require('express');
const router = express.Router();
const Visitor = require('../models/Visitor');
const Poll = require('../models/Poll');

// IP 통계 대시보드
router.get('/dashboard', async (req, res) => {
    try {
        // 약관 동의한 고유 IP 수
        const agreeIPs = await Visitor.distinct('ip', { action: 'agree_terms'});

        // 투표한 고유 IP 수
        const voteIPs = await Visitor.distinct('ip', { action: 'vote' });

        
    }
});