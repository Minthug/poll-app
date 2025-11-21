const express = require('express');
const router = express.Router();
const Visitor = require('../models/Visitor');
const Poll = require('../models/Poll');
const { checkAuth } = require('../middleware/auth');

router.get('/login', (req, res) => {
    res.render('admin/login', { error: null });
});

router.post('/login', (req, res) => {
    const { username, password } = req.body;

    // 환경변수와 비교
    if (username === process.env.ADMIN_USERNAME &&
        password === process.env.ADMIN_PASSWORD) {
            req.session.isAdmin = true;
            res.redirect('/admin');
        } else {
            res.render('admin/login', { error: '아이디 또는 비밀번호가 틀렸습니다.' });
        }
});

router.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/admin/login');
});

router.use(checkAuth);

router.get('/', async (req, res) => {
    try {
        // 모든 poll 가져오기
        const polls = await Poll.find().sort({ createdAt: -1 });

        const totalVotes = polls.reduce((sum, poll) => {
            return sum + poll.options.reduce((optSum, opt) => optSum + opt.votes, 0);
        }, 0);

        res.render('admin/dashboard', {
            polls,
            totalVotes
        });
    } catch (error) {
        console.error('대시보드 로딩 에러:', error);
        res.status(500).send('서버 에러');
    }
});

// IP 통계 대시보드
router.get('/dashboard', async (req, res) => {
    try {
        // Poll 데이터 추가
        const polls = await Poll.find().sort({ createdAt: -1 });

        // 약관 동의한 고유 IP 수
        const agreeIPs = await Visitor.distinct('ip', { action: 'agree_terms'});

        // 투표한 고유 IP 수
        const voteIPs = await Visitor.distinct('ip', { action: 'vote' });

        // 전체 약관 동의 수
        const totalAgrees = await Visitor.countDocuments({ action: 'agree_terms'});

        // 전체 투표 수(수정)
        const totalVotes = await polls.reduce((sum, poll) => {
            return sum + poll.options.reduce((optSum, opt) => optSum + opt.votes, 0); 
        }, 0);

        // 최근 활동 (100개)
        const recentActivities = await Visitor.find()
            .populate('pollId', 'title')
            .sort({ timestamps: -1 })
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

        res.render('admin/dashboard', {
            polls,
            agreeIPCount: agreeIPs.length,
            voteIPCount: voteIPs.length,
            totalAgrees,
            totalVotes,
            recentActivities,
            ipStats
        });
    } catch (error) {
        console.error(error);
        res.status(500).send('서버오류');
        }
    });
        // IP별 지역 통계 (추가 예정)

        //약관 동의 IP 목록 
        router.get('/agreed-ips', async (req, res) => {
            try {
                const agreedVisitors = await Visitor.find({ action: 'agree_terms' }).sort({ timestamps: -1});

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
                    .sort({ timestamps: -1});
                
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
module.exports = router;