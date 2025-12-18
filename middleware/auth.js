// 관리자 인증 체크 미들웨어
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
    }
}

module.exports = { checkAuth };