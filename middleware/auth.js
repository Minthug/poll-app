// 관리자 인증 체크 미들웨어
function checkAuth(req, res, next) {
    if (req.session && req.session.isAdmin) {
        return next();
    }
    res.redirect('/admin/login');
}

module.exports = { checkAuth };