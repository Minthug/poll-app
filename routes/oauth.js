const express = require('express');
const passport = require('../config/passport');
const router = express.Router();


// ========================================
// Google OAuth 라우트
// ========================================
router.get('/google', passport.authenticate('google', {
    scope: ['profile', 'email']
    })
);

router.get('/google/callback', passport.authenticate('google', { failureRedirect: '/auth/login' }),
(req, res) => {
    // 성공 시 세션에 사용자 정보 저장
    req.session.userId = req.user._id;
    req.session.username = req.user.username;
    req.session.lastActivity = Date.now();

    if (req.user.isFirstLogin) {
        return res.redirect('/auth/oauth-terms');
    }

    res.redirect('/');
    }
);


// ========================================
// Naver OAuth 라우트
// ========================================
router.get('/naver', passport.authenticate('naver'));

router.get('/naver/callback', passport.authenticate('naver', { failureRedirect: '/auth/login'}),
(req, res) => {
    req.session.userId = req.user._id;
    req.session.username = req.user.username;
    req.session.lastActivity = Date.now();

    if (req.user.isFirstLogin) {
        return res.redirect('/auth/oauth-terms');
    }
    res.redirect('/');
    }
);

module.exports = router;