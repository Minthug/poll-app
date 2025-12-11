function sessionActivity(req, res, next) {
    if (req.session && req.session.userId) {
        //마지막 활동 시간 확인
        const now = Date.now();
        const lastActivity = req.session.lastActivity || now;
        const timeDiff = now - lastActivity;

        // 1시간 (3600000ms) 이상이면 비활성이면 로그아웃
        if (timeDiff > 3600000) {
            console.log('⏳ 세션 만료 - 자동 로그아웃:', req.session.username);

            req.session.destroy((err) => {
                if (err) {
                    console.error('세션 삭제 오류', err);
                }
            });
            return res.redirect('/auth/login?timeout=true');
        }

        // 활동 시간 갱신
        req.session.lastActivity = now;
    }
    next();
}

// 세션 만료 경고 
function checkSessionWarning(req, res, next) {

    if (req.session && req.session.userId && req.session.lastActivity) {
        const now = Date.now();
        const timeDiff = now - req.session.lastActivity;

        //30분 이상 비활성 (세션만료까지 30분 남음)
        if (timeDiff > 1800000 && timeDiff < 3600000) {
            res.locals.sessionWarning = true;
            res.locals.timeRemaining = Math.floor((3600000 - timeDiff) / 60000);
        } 
    }
    next();
}

module.exports = {
    sessionActivity,
    checkSessionWarning
};