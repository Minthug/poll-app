const express = require('express');
const router = express.Router();
const NotificationHelper = require('../utils/notificationHelper');
const { isAuthenticated } = require('../middleware/auth');

// 알림 목록 조회
router.get('/', isAuthenticated, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const result = await NotificationHelper.getNotifications(req.user._id, page);

        res.render('notifications/list', {
            title: '알림',
            ...result
        });
    } catch (error) {
        console.log('알림 조회 오류:', error);
        req.flash('error', '알림을 불러오는데 실패했습니다');
        res.redirect('/');
    }
});

// 읽지 않은 알림 개수 (API)
