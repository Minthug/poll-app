const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { body, validationResult } = require('express-validator');

// ========================================
// 회원가입 페이지
// ========================================
router.get('/register', (req, res) => {
    const message = req.query.message || null;

    res.render('auth/register', { 
        error: null,
        message: message,
        timeout: req.query.timeout === true, 
        csrtToken: req.csrfToken(), 
        showRanking: false });
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
            error: errors.array()[0].msg,
            csrfToken: req.csrtToken()
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
                    error: '이미 사용 중인 이메일입니다',
                    csrfToken: req.csrfToken()
                });
            }
            if (existingUser.username === username) {
                return res.render('auth/register', {
                    error: '이미 사용 중인 사용자명입니다',
                    csrfToken: req.csrfToken()
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
            error: '회원가입 중 오류가 발생했습니다',
            csrfToken: req.csrfToken()
        });
    }
}
);

// ========================================
// 로그인 페이지
// ========================================
router.get('/login', (req, res) => {
    const message = req.query.message || null;

    console.log('로그인 페이지 - message', message);

    res.render('auth/login', { 
        error: null,
        timeout: req.query.timeout === 'true',
        csrfToken: req.csrfToken(),
        showRanking: false
    });
});

// ========================================
// 로그인 처리 - 로그인 성공 후 원래 페이지로 돌아가기 
// ========================================
router.post('/login', [
    body('email').isEmail().withMessage('올바른 이메일을 입력하세요'),
    body('password').notEmpty().withMessage('비밀번호를 입력하세요')
],
async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.render('auth/login', {
            error: errors.array()[0].msg,
            message: null,
            timeout: false,
            csrfToken: req.csrfToken(),
            showRanking: false
        });
    }

    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email });

        if (!user) {
            return res.render('auth/login', {
                error: '이메일 또는 비밀번호가 일치하지 않습니다',
                messag: null,
                timeout: false,
                csrfToken: req.csrfToken(),
                showRanking: false
            });
        }

        // 비밀번호 확인
        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            return res.render('auth/login', {
                error: '이메일 또는 비밀번호가 일치하지 않습니다',
                message: null,
                timeout: false,
                csrfToken: req.csrfToken(),
                showRanking: false
            });
        }
    
        // 세션 저장
        req.session.userId = user._id;
        req.session.username = user.username;

        console.log('✅ 로그인 성공:', user.username);

        // 원래 가려던 페이지로 돌아가기
        const returnTo = req.session.returnTo || '/polls';
        delete req.session.returnTo;
        res.redirect('/polls');
    } catch(error) {
        console.error('로그인 오류:', error);
        res.render('auth/login', {
            error: '로그인 중 오류가 발생했습니다',
            message: null,
            timeout: false,
            csrfToken: req.csrfToken(),
            showRanking: false
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

// ========================================
// OAuth 약관 동의 페이지
// ========================================
router.get('/oauth-terms', (res, req) => {
    if (!req.session.userId) {
        return res.redirect('/auth/login');
    }

    res.render('oauth-terms', {
        title: '서비스 약관 동의',
        error: null,
        csrfToken: req.csrfToken()
    });
});

// OAuth 약관 동의 처리
router.post('/oauth-terms', async (req, res) => {
    try {
        if (!req.session.userId) {
            return res.redirect('/auth/login');
        }

        // 약관 동의 여부
        if (!req.body.agreeTerms) {
            return res.render('oauth-terms', {
                title: '서비스 약관 동의',
                error: '서비스 이용약관에 동의해주세요',
                csrfToken: req.csrfToken()
            });

            await User.findByIdAndUpdate(req.session.userId, {
                isFirstLogin: false
            });

            res.redirect('/');
        }
    } catch (error) {
        console.error('약관 동의 처리 오류:', error);
        res.redirect('/');
    }
});
module.exports = router;