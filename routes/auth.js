const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const User = require('../models/User');
const { body, validationResult } = require('express-validator');


// ========================================
// 이메일 발송 설정
// ========================================
const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: false,
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD
    }
});

transporter.verify((error, success) => {
    if (error) {
        console.error('❌ SMTP 연결 실패:', error);
    } else {
        console.log('✅ SMTP 서버 연결 성공 - 이메일 발송 준비 완료');
    }
});

async function sendVerificationEmail(email, token) {
    try {
    const verificationUrl = `${process.env.BASE_URL}/auth/verify-email/${token}`;

    const info = await transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: email,
        subject: '[여론조사 사이트] 이메일 인증',
        html:`
            <h2>이메일 인증</h2>
            <p>가입해 주셔서 감사합니다!</p>
            <p>아래 버튼을 클릭하여 이메일 인증을 완료해주세요:</p>
            <a href="${verificationUrl}" 
               style="display:inline-block; padding:12px 24px; background:#007bff; 
                      color:white; text-decoration:none; border-radius:5px; margin:20px 0;">
                이메일 인증하기
            </a>
            <p>또는 아래 링크를 복사하여 브라우저에 붙여넣으세요:</p>
            <p style="color:#666; word-break:break-all;">${verificationUrl}</p>
            <p style="color:#999; font-size:12px;">링크는 24시간 동안 유효합니다.</p>
        `
        });


        console.log('✅ 인증 이메일 발송 성공:', email);
        console.log('📧 Message ID:', info.messageId);
        return true;

    } catch (error) {
        console.error('❌ 인증 이메일 발송 실패:', error);
        console.error('📧 받는 사람:', email);
        console.error('🔧 발신자 설정:', process.env.EMAIL_USER);
        throw error;  // 에러를 다시 throw해서 호출한 곳에서 처리하도록
    }
}

// ========================================
// 회원가입 페이지
// ========================================
router.get('/register', (req, res) => {
    const message = req.query.message || null;

    res.render('auth/register', { 
        error: null,
        message: message,
        timeout: req.query.timeout === true, 
        csrfToken: req.csrfToken(), 
        showRanking: false
    });
});

// ========================================
// 회원가입 처리
// ========================================
router.post('/register', [
    body('username')
        .trim()
        .isLength({ min: 2, max: 20 }).withMessage('닉네임은 2-20자여야 합니다')
        .matches(/^[a-zA-Z0-9가-힣]+$/).withMessage('닉네임은 한글, 영문, 숫자만 가능합니다'),
    body('email')
        .isEmail().withMessage('올바른 이메일 형식이 아닙니다')
        .normalizeEmail(),
    body('password')
        .isLength({ min: 8 }).withMessage('비밀번호는 최소 8자 이상이어야 합니다')
        .matches(/^(?=.*[A-Za-z])(?=.*\d)(?=.*[@$!%*#?&])[A-Za-z\d@$!%*#?&]{8,}$/)
        .withMessage('비밀번호는 영문+숫자+특수문자 조합이어야 합니다'),
    body('passwordConfirm')
        .custom((value, { req }) => {
            if (value !== req.body.password) {
                throw new Error('비밀번호가 일치하지 않습니다');
            }
            return true;
        })
], async (req, res) => {
    const errors = validationResult(req);
    
    if (!errors.isEmpty()) {
        return res.render('auth/register', {
            error: errors.array()[0].msg,
            message: null,
            csrfToken: req.csrfToken(),
            showRanking: false
        });
    }

    try {
        const { username, email, password } = req.body;

        // 중복 확인
        const existingUser = await User.findOne({
            $or: [{ email }, { username }]
        });

        if (existingUser) {
            const errorMsg = existingUser.email === email 
                ? '이미 사용 중인 이메일입니다' 
                : '이미 사용 중인 닉네임입니다';
            
            return res.render('auth/register', {
                error: errorMsg,
                message: null,
                csrfToken: req.csrfToken(),
                showRanking: false
            });
        }

        // ⭐ 임시: 이메일 인증 없이 바로 인증된 사용자로 생성
        const user = await User.create({
            username,
            email,
            password,
            emailVerified: true,  // ← false에서 true로 변경
            verificationLevel: 'email'
            // emailVerificationToken, emailVerificationExpires 제거
        });

        console.log('✅ 회원가입 완료 (자동 인증):', user.username);

        // ⭐ 이메일 발송 시도 (실패해도 가입은 완료)
        try {
            const verificationToken = crypto.randomBytes(32).toString('hex');
            await sendVerificationEmail(email, verificationToken);
            console.log('📧 인증 이메일 발송 성공');
        } catch (emailError) {
            console.error('⚠️ 이메일 발송 실패 (무시):', emailError.message);
        }

        // ⭐ 바로 로그인 페이지로 리디렉트
        res.redirect('/auth/login?message=회원가입이 완료되었습니다. 로그인해주세요.');

    } catch (error) {
        console.error('❌ 회원가입 오류:', error);
        res.render('auth/register', {
            error: '회원가입 중 오류가 발생했습니다',
            message: null,
            csrfToken: req.csrfToken(),
            showRanking: false
        });
    }
});

// ========================================
// 이메일 인증 처리
// ========================================
router.get('/verify-email/:token', async (req, res) => {
    try {
        const user = await User.findOne({
            emailVerificationToken: req.params.token,
            emailVerificationExpires: { $gt: Date.now() }
        });

        if (!user) {
            return res.render('auth/email-verification-result', {
                title: '인증 실패',
                success: false,
                message: '유효하지 않거나 만료된 인증 링크 입니다',
                csrfToken: req.csrfToken(),
                showRanking: false
            });
        }

        // 이메일 인증 완료
        user.emailVerified = true;
        user.verificationLevel = 'email_verified';
        user.emailVerificationToken = undefined;
        user.emailVerificationExpires = undefined;
        await user.save();

        console.log('✅ 이메일 인증 완료:', user.username);

        // 자동 로그인 (세션 생성)
        req.session.userId = user._id;
        req.session.username = user.username;
    
        console.log('🔐 자동 로그인:', user.username);

        res.render('auth/email-verification-result', {
            title: '이메일 인증 완료',
            success: true,
            message: '이메일 인증이 완료되었습니다. 이제 로그인 할 수 있습니다',
            username: user.username,
            autoRedirect: true,
            csrfToken: req.csrfToken(),
            showRanking: false
        });
    } catch (error) {

        console.error('❌ 이메일 인증 오류:', error);
        res.render('auth/email-verification-result', {
            title: '인증 실패',
            success: false,
            message: '이메일 인증 중 오류가 발생했습니다',
            csrfToken: req.csrfToken(),
            showRanking: false
        });
    }
});

// ========================================
// 로그인 페이지
// ========================================
router.get('/login', (req, res) => {
    res.render('auth/login', {
        error: null,
        message: req.query.message || null,
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
], async (req, res) => {
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
        
        // 사용자 확인
        if (!user || !(await user.comparePassword(password))) {
            return res.render('auth/login', {
                error: '이메일 또는 비밀번호가 일치하지 않습니다',
                message: null,
                timeout: false,
                csrfToken: req.csrfToken(),
                showRanking: false
            });
        }

        // 이메일 인증 확인
        if(!user.emailVerified) {
            return res.render('auth/login', {
                error: '이메일 인증이 필요합니다. 가입 시 발송된 인증 메일을 확인해주세요',
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

        const returnTo = req.session.returnTo || '/polls';
        delete req.session.returnTo;
        res.redirect(returnTo);
    } catch (error) {
        console.error('❌ 로그인 오류:', error);
        res.render('auth/login', {
            error: '로그인 중 오류가 발생했습니다',
            message: null,
            timeout: false,
            csrfToken: req.csrfToken(),
            showRanking: false
        });
    }
});

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
router.get('/oauth-terms', (req, res) => {
    if (!req.session || !req.session.userId) {
        return res.redirect('/auth/login');
    }

    res.render('oauth-terms', {
        title: '서비스 약관 동의',
        error: null,
        csrfToken: '',
        showRanking: false
    });
});

// OAuth 약관 동의 처리
router.post('/oauth-terms', async (req, res) => {
    try {
        console.log('📝 약관 동의 POST 요청 받음');
        console.log('세션 ID:', req.session.userId);
        console.log('동의 여부:', req.body.agreeTerms);
        
        if (!req.session || !req.session.userId) {
            console.log('❌ 세션 없음, 로그인 페이지로');
            return res.redirect('/auth/login');
        }

        // 약관 동의 여부 확인
        if (!req.body.agreeTerms) {
            console.log('❌ 약관 미동의');
            return res.render('oauth-terms', {
                title: '서비스 약관 동의',
                error: '서비스 이용약관에 동의해주세요',
                csrfToken: ''
            });
        }
        
        // isFirstLogin 플래그 해제
        const result = await User.findByIdAndUpdate(req.session.userId, {
            isFirstLogin: false
        });
        
        console.log('✅ 약관 동의 완료:', result.username);
        console.log('🔄 /polls로 리디렉션');
        
        res.redirect('/polls');
        
    } catch (error) {
        console.error('약관 동의 처리 오류:', error);
        res.redirect('/');
    }
});

module.exports = router;