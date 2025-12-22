const express = require('express');
const router = express.Router();
const Visitor = require('../models/Visitor');
const Poll = require('../models/Poll');
const IPConsent = require('../models/IPConsent');
const { checkAuth } = require('../middleware/auth');

router.get('/login', (req, res) => {
    res.render('admin/login', { error: null, csrfToken: req.csrfToken() });
});

router.post('/login', (req, res) => {
    const { username, password } = req.body;

    if (username === process.env.ADMIN_USERNAME &&
        password === process.env.ADMIN_PASSWORD) {
            req.session.isAdmin = true;
            res.redirect('/admin');
        } else {
            res.render('admin/login', { 
                error: '아이디 또는 비밀번호가 틀렸습니다.',
                csrfToken: req.csrfToken()
            });
        }
});

router.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/admin/login');
});

router.use(checkAuth);

// ========================================
// 메인 대시보드 (모든 데이터 포함)
// ========================================
router.get('/', async (req, res) => {
    try {
        // 모든 poll 가져오기
        const polls = await Poll.find().sort({ createdAt: -1 });

        // 약관 동의한 고유 IP 수
        const agreeIPs = await Visitor.distinct('ip', { action: 'agree_terms'});

        // 투표한 고유 IP 수
        const voteIPs = await Visitor.distinct('ip', { action: 'vote' });

        // 전체 약관 동의 수
        const totalAgrees = await Visitor.countDocuments({ action: 'agree_terms'});

        // 총 투표수 계산
        const totalVotes = polls.reduce((sum, poll) => {
            return sum + poll.options.reduce((optSum, opt) => optSum + opt.votes, 0);
        }, 0);

        // 총 조회수 계산
        const totalViews = polls.reduce((sum, poll) => sum + (poll.views || 0), 0);

        // TOP 5 인기 투표 (조회수 기준)
        const topPollsByViews = await Poll.find()
            .sort({ views: -1 })
            .limit(5)
            .lean();

        // 최근 활동 (100개)
        const recentActivities = await Visitor.find()   
            .populate('pollId', 'title')
            .sort({ timestamp: -1 })
            .limit(100);

        // IP별 활동 통계
        const ipStats = await Visitor.aggregate([
            {
                $group: {
                    _id: '$ip',
                    agreeCount: {
                        $sum: { $cond: [{ $eq: ['$action', 'agree_terms'] }, 1, 0] }
                    },
                    voteCount: {
                        $sum: { $cond: [{ $eq: ['$action', 'vote'] }, 1, 0] }
                    },
                    lastActivity: { $max: '$timestamp' }
                }
            },
            { $sort: { lastActivity: -1 } },
            { $limit: 100 }
        ]);

        const ipConsents = await IPConsent.find()
            .sort({ consentDate: -1 })
            .lean();

        res.render('admin/dashboard', {
            polls,
            totalPolls: polls.length,  // ⬅️ 추가
            totalVotes,
            totalViews,
            agreeTermsCount: agreeIPs.length,  // ⬅️ 이름 변경
            voteIpCount: voteIPs.length,  // ⬅️ 이름 변경
            totalAgrees,
            topPolls: topPollsByViews,  // ⬅️ 이름 변경
            recentActivities,
            ipStats,
            ipConsents,  // ⬇️⬇️⬇️ 추가 ⬇️⬇️⬇️
            showRanking: false,  // ⬅️ 추가
            csrfToken: req.csrfToken()  // ⬅️ 추가
        });
    } catch (error) {
        console.error('대시보드 로딩 에러:', error);
        res.status(500).send('서버 에러');
    }
});

// ========================================
// /dashboard 라우터는 제거하거나 /로 리다이렉트
// ========================================
router.get('/dashboard', (req, res) => {
    res.redirect('/admin');
});

// 약관 동의 IP 목록 
router.get('/agreed-ips', async (req, res) => {
    try {
        const agreedVisitors = await Visitor.find({ action: 'agree_terms' }).sort({ timestamp: -1});

        res.render('admin/agreed-ips', { visitors: agreedVisitors })
    } catch (error) {
        console.error(error);
        res.status(500).send('서버오류');
    } 
});

// 투표 IP 목록
router.get('/voted-ips', async (req, res) => {
    try {
        const votedVisitors = await Visitor.find({ action: 'vote' })
            .populate('pollId', 'title')
            .sort({ timestamp: -1});
        
        res.render('admin/voted-ips', { visitors: votedVisitors });
    } catch (error) {
        console.error(error);
        res.status(500).send('서버오류');
    }
});

// 특정 IP 상세 정보
router.get('/ip/:ip', async (req, res) => {
    try {
        const ipAddress = decodeURIComponent(req.params.ip);

        const polls = await Visitor.find( { votedIPs: ipAddress });

        res.render('admin/ip-detail', {
            ipAddress,
            polls,
            voteCount: polls.length
        });
    } catch (error) {
        console.error('IP 상세 조회 오류:', error);
        res.status(500).send('서버오류');
    }
});

router.post('/poll/:id/delete', async (req, res) => {
    try {
        await Poll.findByIdAndDelete(req.params.id);
        res.redirect('/admin');
    } catch (error) {
        console.error('Poll 삭제 에러:', error);
        res.status(500).send('서버 에러');
    }
});

router.get('/consents', checkAuth, async (req, res) => {
    try {
        const consents = await IPConsent.find()
            .sort({ consentDate: -1 })
            .lean();

        res.router('/admin/consents', {
            consents,
            showRanking: false,
            csrfToken: req.csrfToken()
        });
    } catch (error) {
        console.error('동의 목록 조회 오류:', error);
        res.status(500).send('서버 오류');
    }
});


module.exports = router;