const express = require('express');
const router = express.Router();
const User = require('../models/User');
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
    body('passwordConfirm').custom((value, { req }) => {
        if (value !== req.body.password) {
        throw new Error('비밀번호가 일치하지 않습니다');
        }
        return true;
    })
],
async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.render('auth/register', {
            error: errors.array()[0].msg
        });
    }
    try {
        const { username, email, password } = req.body;

        const existingUser = await User.findOne({
            $or: [{ email }, { username }]
        });

        if (existingUser) {
            if (existingUser.email === email) {
                return res.render('auth/register', {
                    error: '이미 사용 중인 이메일입니다'
                });
            }
            if (existingUser.username === username) {
                return res.render('auth/register', {
                    error: '이미 사용 중인 사용자명입니다'
                });
            }
        }
        
        const user = await User.create({
            username,
            email,
            password
        });

        console.log('✅ 회원가입 완료:', user.username);

        // 자동 로그인 (? 쿠키 세션? ) => 세션
        req.session.userId = user._id;
        req.session.username = user.username;
        res.redirect('/polls');
    } catch(error) {
        console.error('회원가입 오류:', error);
        res.render('auth/register', {
            error: '회원가입 중 오류가 발생했습니다'
        });
    }
}
);

// ========================================
// 로그인 페이지
// ========================================
router.get('/login', (req, res) => {
    res.render('auth/login', { error: null });
});

// ========================================
// 로그인 처리
// ========================================
router.post('/login', [
    body('email').isEmail().withMessage('올바른 이메일을 입력하세요'),
    body('password').notEmpty().withMessage('비밀번호를 입력하세요')
],
async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.render('auth/login', {
            error: errors.array()[0].msg
        });
    }

    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email });

        if (!user) {
            return res.render('auth/login', {
                error: '이메일 또는 비밀번호가 일치하지 않습니다'
            });
        }

        // 비밀번호 확인
        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            return res.render('auth/login', {
                error: '이메일 또는 비밀번호가 일치하지 않습니다'
            });
        }
    
        // 세션 저장
        req.session.userId = user._id;
        req.session.username = user.username;

        console.log('✅ 로그인 성공:', user.username);
        res.redirect('/polls');
    } catch(error) {
        console.error('로그인 오류:', error);
        res.render('auth/login', {
            error: '로그인 중 오류가 발생했습니다'
        });
    }
}
);

// ========================================
// 로그아웃
// ========================================
router.get('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.error('로그아웃 오류:', err);
        }
        res.redirect('/');
    });
});

module.exports = router;