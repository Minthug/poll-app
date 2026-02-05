const User = require('../models/User');

// 로그 제어
const debug = (...args) => {
    if (process.env.DEBUG_AUTH === 'true') {
        console.log(...args);
    }
}

// ==========================================
// 세션 복구 미들웨어
// ==========================================
async function deserializeUser(req, res, next) {
    // 정적 파일 스킵
    if (req.path.match(/\.(css|js|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot)$/i)) {
        return next();
    }

    const staticPaths = ['/css', '/js', '/images', '/favicon', '/api', '/public'];
    if (staticPaths.some(p => req.path.startsWith(p))) {
        return next();
    }

    if (req.user) {
        return next();
    }

    if (!req.session || !req.session.userId) {
        return next();
    }

    // ⬇️⬇️⬇️ 여기서 확인! ⬇️⬇️⬇️
    if (req.session.userCache) {
        req.user = req.session.userCache;
        console.log('✅ 캐시 사용 (DB 조회 안 함)');  // ⬅️ 이게 나와야 함!
        return next();
    }

    // ⬇️⬇️⬇️ 여기가 실행되면 문제! ⬇️⬇️⬇️
    try {
        console.log('🔍 DB 조회 (캐시 없음)');  // ⬅️ 이게 계속 나오면 문제!
        const user = await User.findById(req.session.userId);
        if (user) {
            req.user = user;
            saveUserCache(req, user);
            console.log('💾 캐시 저장함');
        }
    } catch (err) {
        console.error('❌ 세션 복구 오류:', err);
    }

    next();
}
// ==========================================
// 캐시 저장 헬퍼
// ==========================================
function saveUserCache(req, user) {
  req.session.userCache = {
    _id: user._id,
    username: user.username,
    email: user.email,
    displayName: user.displayName,
    isFirstLogin: user.isFirstLogin,
    notificationSettings: user.notificationSettings,
    verificationLevel: user.verificationLevel
  };
}


// ==========================================
// OAuth 첫 로그인 체크
// ==========================================
async function checkFirstLogin(req, res, next) {
    // 정적 파일 및 API 스킵
    const skipPaths = ['/css', '/js', '/images', '/favicon.ico', '/api'];
    if (skipPaths.some(path => req.path.startsWith(path))) {
        return next();
    } 

    // 제외 경로
    const excludedPaths = ['/auth/oauth-terms', '/auth/logout'];
    if (excludedPaths.some(path => req.path.startsWith(path))) {
        return next();
    }

    // 사용자가 없거나 이미 첫 로그인이 아닌 경우 스킵
    if (!req.user || req.user.isFirstLogin === false) {
        return next();
    }

    try {
        // 첫 로그인인 경우 약관 페이지로
        if (req.user.isFirstLogin === true) {
            console.log('🔄 약관 페이지로 리디렉션:', req.user.username);
            return res.redirect('/auth/oauth-terms');
        }

        // undefined/null인 경우 기존 사용자 업데이트
        if (req.user.isFirstLogin === undefined || req.user.isFirstLogin === null) {
            req.user.isFirstLogin = false;
            await req.user.save();
            console.log('✅ 기존 사용자 업데이트:', req.user.username);
        } 
    } catch (err) {
        console.error('❌ 첫 로그인 체크 오류:', err);
    }
    next();
}

// ==========================================
// 관리자 인증 체크
// ==========================================
function checkAuth(req, res, next) {
    if (req.session && req.session.isAdmin) {
        return next();
    }
    res.redirect('/admin/login');
}

// 일반 사용자 로그인 체크 (NEW)
function requireLogin(req, res, next) {
    if (req.session.userId) {
        next();
    } else {
        // 로그인 페이지로 리다이렉션하면서 원래 가려던 URL 저장
        req.session.returnTo = req.originalUrl;
        res.redirect('/auth/login?message=' + encodeURIComponent('여론조사를 만들려면 로그인이 필요합니다'));
    }
}

function isAuthenticated(req, res, next) {
    if (req.isAuthenticated()) {
        return next();
    }
    res.redirect('/auth/login');  // ✅ 페이지용은 리다이렉트
}


// API용 인증 미들웨어 (NEW!)
function isAuthenticatedAPI(req, res, next) {
    if (req.session && req.session.userId) {
        return next();
    }
    res.status(401).json({  // ✅ API는 JSON 응답
        success: false,
        message: '로그인이 필요합니다.'
    });
}

function isNotAuthenticated(req, res, next) {
    if (!req.isAuthenticated()) {
        return next();
    }
    res.redirect('/');
}

// ==========================================
// 캐시 무효화 헬퍼
// ==========================================
function invalidateUserCache(req) {
    if (req.session && req.session.userCache) {
        delete req.session.userCache;
    }
}


module.exports = {
    deserializeUser,
    saveUserCache,        
    invalidateUserCache,    
    checkFirstLogin,
    checkAuth,
    requireLogin,
    isAuthenticated,
    isAuthenticatedAPI,
    isNotAuthenticated
};