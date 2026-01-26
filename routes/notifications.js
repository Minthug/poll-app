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
router.get('/unread-count', isAuthenticated, async (req, res) => {
    try {
        const count = await NotificationHelper.getUnreadCount(req.user._id);
        res.json({ count });
    } catch (error) {
        res.status(500).json({ error: '오류가 발생했습니다'});
    }
});

// 알림 읽음 처리
router.get('/:id/read', isAuthenticated, async (req, res) => {
    try {
        await NotificationHelper.markAsRead(req.params.id, req.user._id);
        res.json({ success: true});
    } catch (error) {
        res.status(500).json({ error: '오류가 발생했습니다'});
    }
});

// 모든 알람 읽음 처리
router.get('/read-all', isAuthenticated, async (req, res) => {
    try {
        await NotificationHelper.markAllAsRead(req.user._id);
        req.flash('success', '모든 알림을 읽음 처리했습니다');
        res.redirect('/notifications');
    } catch (error) {
        req.flash('error', '오류가 발생했습니다');
        res.redirect('/notifications');
    }
});