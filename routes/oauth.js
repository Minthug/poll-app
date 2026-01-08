const express = require('express');
const passport = require('../config/passport');
const router = express.Router();


// ========================================
// Google OAuth 라우트
// ========================================
router.get('/google', (req, res, next) => {
    console.log('🔵 Google OAuth 시작');
    console.log('GOOGLE_CLIENT_ID:', process.env.GOOGLE_CLIENT_ID ? '설정됨' : '❌ 없음');
    console.log('GOOGLE_CALLBACK_URL:', process.env.GOOGLE_CALLBACK_URL);
    next();
},
    passport.authenticate('google', {
    scope: ['profile', 'email']
    })
);

router.get('/google/callback', (req, res, next) => {
    console.log('🔵 Google 콜백 도착');
    console.log('Query:', req.query);
    next();
}, passport.authenticate('google', { 
    failureRedirect: '/login'
}), (req, res) => {
    console.log('✅ Google 인증 성공');
    console.log('User:', req.user);
    
    req.session.userId = req.user._id;
    req.session.username = req.user.username;
    req.session.lastActivity = Date.now();

    if (req.user.isFirstLogin) {
        return res.redirect('/auth/oauth-terms');
    }

    res.redirect('/');
});


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