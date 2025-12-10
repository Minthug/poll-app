const express = require('express');
const router = express.Router();
const User = require('../modules/User');
const { body, validationResult } = require('express-validator');

// ========================================
// 회원가입 페이지
// ========================================
router.get('/register', (req, res) => {
    res.render('auth/register', { error: null })
});

// ========================================
// 회원가입 처리
// ========================================
router.post('/register', [
    body('username').trim().isLength({ min: 2, max: 20}).withMessage('닉네임은 2-20자여야 합니다')
    .matches(/^[a-zA-Z0-9가-힣]+$/).withMessage('닉네임은 한글, 영문, 숫자만 가능합니다'),
    body('email').isEmail().withMessage('올바른 이메일 형식이 아닙니다').normalizeEmail(),
])