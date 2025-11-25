const express = require('express');
const router = express.Router();
const Poll = require('../models/Poll');
const Visitor = require('../models/Visitor');
const geoip = require('geoip-lite');

// 모든 여론 조사 목록
router.get('/', async (req, res) => {
    try {
        const polls = await Poll.find().sort({ createdAt: -1 });
        res.render('polls/index', { polls });
    } catch (error) {
        console.error(error);
        res.status(500).send('서버 오류');
    }
});

// 새 여론조사 폼   
router.get('/new', (req, res) => {
    res.render('polls/new');
});


// 여론조사 생성
router.post('/', async (req, res) => {
    try {
        const { title, description, options } = req.body;

        // 빈 옵션 필터링
        const pollOptions = options.filter(opt => opt.trim() !== '').map(opt => ({
            text: opt,
            votes: 0
        }));

        const poll = new Poll({
            title,
            description,
            options: pollOptions
        });

        await poll.save();
        res.redirect(`/polls/${poll._id}`);
    } catch (error) {
        res.status(500).send('서버 오류');
    }
});

// 여론조사 상세 - 투표 페이지
router.get('/:id', async (req, res) => {
    try {
        const poll = await Poll.findById(req.params.id);
        if (!poll) { 
            return res.status(404).send('여론조사를 찾을 수 없습니다');
        }
        
        // 이미 투표한 IP인지 확인
        const clientIP = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress;
        const hasVoted = poll.votedIPs && poll.votedIPs.includes(clientIP);

        // 이미 투표했으면 결과 페이지로 리다이렉트
        if (hasVoted) {
            return res.redirect(`/polls/${poll._id}/result?already_voted=true`);
        }

            res.render('polls/show', { poll });
        } catch (error) {
            console.error(error);
        res.status(500).send('서버 오류');
    }
});

router.get('/:id/result', async (req, res) => {
    try {
        const poll = await Poll.findById(req.params.id);
        if (!poll) {
            return res.status(404).send('여론조사를 찾을 수 없습니다');
        }

        const alreadyVoted = req.query.already_voted === 'true';

        // 지역별 투표 통계
        const locationStats = await Visitor.aggregate([
            {
                $match: {
                    pollId: poll._id,
                    action: 'vote'
                }
            },
            {
                $group: {
                    _id: '$location.city',
                    count: { $sum: 1 }
                }
            },
            {
                $sort: { count: -1 } // 투표 많은 순으로 정리
            }
    ]);
        
        res.render('polls/result', { 
            poll, 
            alreadyVoted,
            locationStats // EJS로 전달
         });
    } catch (error) {
        console.error(error);
        res.status(500).send('서버 오류');
    }
});


// 투표 처리
router.post('/:id/vote', async (req, res) => {
    try {
        const { optionId } = req.body;
        const pollId = req.params.id;

        // 클라이언트 IP 가져오기
        const clientIp = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress;
        const userAgent = req.headers['user-agent'];

           // ⭐ 개발 환경 체크
        const isDevelopment = process.env.NODE_ENV !== 'production';
        const isLocalhost = clientIp === '::1' || clientIp === '127.0.0.1' || clientIp === '::ffff:127.0.0.1';

        // ⭐ 여기에 지역 체크 추가
        const geo = geoip.lookup(ip);

        // 로컬 개발 환경이면 가짜 한국 지역 정보 사용
        if (isDevelopment && isLocalhost) {
            geo = {
                country: 'KR',
                region: '11',
                city: 'Seoul'
            };
            console.log('🔧 개발 모드: 가짜 한국 IP 사용');
        }

        // 한국 IP가 아니면 차단
        if (!geo || geo.country !== 'KR') {
            return res.status(403).json({
                success: false,
                error: '한국에서만 투표가 가능합니다',
                blocked: true
            });
        }

        console.log('투표 요청 - Poll ID:', pollId);
        console.log('투표 요청 - Option ID:', optionId);
        console.log('투표 요청 - IP:', clientIp);
        console.log('투표 요청 - 지역:', geo);

        // 여론조사 찾기
        const poll = await Poll.findById(pollId);
        if (!poll) {
            return res.status(404).json({ success: false, error: '여론조사를 찾을 수 없습니다'});
        }

        // IP 주소로 중복 투표 확인 (Poll 모델에 voteIps 필드가 추가 되어야함)
        if (poll.votedIPs && poll.votedIPs.includes(clientIp)) {
            return res.status(403).json({
                success: false,
                error: '이미 투표하셨습니다',
                alreadyVoted: true
            });
        }

        // 옵션 찾기 (오류 수정: !poll -> !option)
        const option = poll.options.id(optionId);
        if (!option) {
            console.log('옵션을 찾을 수 없음:', optionId);
            return res.status(404).json({ success: false, error: '옵션을 찾을 수 없습니다'})
        }

        // 투표 증가
        option.votes += 1;

        // 투표한 IP 추가 (Poll 모델에 voteIps 필드가 추가 되어야 함)
        if (!poll.votedIPs) poll.votedIPs = [];
        poll.votedIPs.push(clientIp);

        // 저장
        await poll.save();

        await Visitor.create({
            ip: clientIp,
            action: 'vote',
            pollId: poll._id,
            userAgent,
            location: {
                country: geo.country,
                region: geo.region,
                city: geo.city
            }
        });

        console.log('투표 성공 - 옵션:', option.text, '투표수:', option.votes);
        console.log('투표 IP 기록 완료:', clientIp);

        const io = req.app.get('io');
        if (io) {
            const pollObject = poll.toObject();

            console.log('Socket .IO 전송 데이터:', {
                pollId: poll._id.toString(),
                poll: pollObject
            });
            
            io.emit('vote-update', {
                pollId: poll._id.toString(),
                poll: pollObject
            });
        }

        res.json({
            success: true,
            poll: poll,
            votes: option.votes,
            totalVotes: poll.totalVotes
        });
    } catch(error) {
        console.error(error);
        res.status(500).json({ success: false, error: '서버 오류', error: error.message})
    }
})

// 결과 보기 API
router.get('/:id/results', async (req, res ) => {
    try {
        const poll = await Poll.findById(req.params.id);
    
        if (!poll) {
            return res.status(404).json({ success: false, error: '여론 조사를 찾을 수 없습니다'});
        }


        const pollObj = poll.toJSON ? poll.toJSON() : poll;

        res.json({
            success: true,
            poll: pollObj
        });
    } catch (error) {
        console.error('결과 조회 오류', error);
        res.status(500).json({ success: false, error: '결과를 불러오는 중 오류가 발생 했습니다.'})
    }
})

router.get('/:id/voted-ips', async (req, res) => {
    try {
        const poll = await Poll.findById(req.params.id);
        if (!poll) {
            return res.status(404).send('여론조사를 찾을 수 없습니다');
        }

        res.render('polls/voted-ips', { poll });
    } catch (error) {
        console.error(error)
        res.render(500).send('서버 오류');
    }
})

module.exports = router;

