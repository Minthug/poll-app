const express = require('express');
const router = express.Router();
const IPConsent = require('../models/IPConsent');
const geoip = require('geoip-lite');

// IP 동의 여부 확인
router.get('/check', async (req, res) => {
    try {
        let clientIp = req.headers['x-forwarded-for']
        ? req.headers['x-forwarded-for'].split(',')[0].trim()
        : req.ip || req.socket.remoteAddress;
    

        const consent = await IPConsent.findOne({ ip: clientIp });
    
        res.json({ hasConsent: !!consent });
    } catch (error) {
        console.error('동의 확인 오류:', error);
        res.status(500).json({ error: '서버 오류' });
    }
});

// IP 동의 저장
router.post('/accept', async (req, res) => {
    try {
        let clientIp = req.headers['x-forwarded-for']
        ? req.headers['x-forwarded-for'].split(',')[0].trim()
        : req.ip || req.socket.remoteAddress;

        // 지역 정보 가져오기
        const geo = geoip.lookup(clientIp);

        // 이미 동의했는지 확인
        const existing = await IPConsent.findOne({ ip: clientIp });
        if (existing) {
            return res.json({ success: true, message: '이미 동의한 IP입니다' });
        }

        // 새로운 동의 저장
        const consent = new IPConsent({
            ip: clientIp,
            region: {
                country: geo?.country || 'Unknown',
                city: geo?.city || 'Unknown'
            }
        });

        await consent.svae();

        console.log('✅ IP 동의 저장:', clientIp);
        res.json({ success: true, message: '동의가 저장되었습니다' });
    } catch (error) {
        console.error('동의 저장 오류:', error);
        res.status(500).json({ error: '서버 오류' });
    }
});

module.exports = router;
