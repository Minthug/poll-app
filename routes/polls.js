const express = require('express');
const router = express.Router();
const Poll = require('../models/Poll');
const Visitor = require('../models/Visitor');
const geoip = require('geoip-lite');

// 모든 여론 조사 목록
router.get('/', async (req, res) => {
    try {
        const { category } = req.query;
        let query = {};

        if (category) {
            query.category = category;
        }

        const polls = await Poll.find().sort({ createdAt: -1 });
        res.render('polls/index', { polls: polls, category: category || null });
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
        const { title, description, options, endDate } = req.body;

        // 빈 옵션 필터링
        const pollOptions = options.filter(opt => opt.trim() !== '').map(opt => ({
            text: opt,
            votes: 0
        }));

        // 태그 처리 (쉼표로 구분된 문자열을 배열로 변환)
        let tagArray = [];
        if (tags && tags.trim() !== '') {
            tagArray = tags.split(',')
                .map(tag => tag.trim())
                .filter(tag => tag !== '')
                .slice(0, 5); // 최대 5개
        }

        const poll = new Poll({
            title,
            description,
            category: category || '일반',
            tags: tagArray,
            options: pollOptions,
            endDate: endDate ? new Date(endDate) : null // 종료 시간이 있으면 Date 객체로 변환 
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

        // 투표가 종료되었으면 결과 페이지로 리다이렉트
        if (poll.isEnded()) {
            return res.redirect(`/polls/${poll._id}/results?ended=true`);
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

        let clientIp = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress;
        const userAgent = req.headers['user-agent'];

        // ⭐ 테스트 모드 체크
        if (process.env.TEST_MODE === 'true') {
            const testIPs = {
                seoul: '211.36.148.123',       // 서울
                gyeonggi: '14.63.180.1',       // 경기 수원 (수정)
                busan: '121.162.45.78',        // 부산
                daegu: '175.209.0.1',          // 대구
                incheon: '121.165.0.1',        // 인천
                gwangju: '118.235.0.1',        // 광주
                daejeon: '121.254.0.1',        // 대전
                ulsan: '112.217.0.1',          // 울산
                gangwon: '175.193.0.1',        // 강원
                chungbuk: '125.129.0.1',       // 충북
                chungnam: '121.162.0.1',       // 충남
                jeonbuk: '121.162.100.1',      // 전북
                jeonnam: '121.162.150.1',      // 전남
                gyeongbuk: '125.180.0.1',      // 경북
                gyeongnam: '211.246.200.1',    // 경남 (실제 이 IP가 경남임)
                jeju: '125.177.0.1'            // 제주
            };
            
            const testRegion = process.env.TEST_REGION || 'seoul';
            clientIp = testIPs[testRegion] || clientIp;
            console.log(`🧪 테스트 모드: ${testRegion} IP 사용 (${clientIp})`);
        }

        let geo = geoip.lookup(clientIp);
        console.log('📍 감지된 지역:', geo);

        if (!geo || geo.country !== 'KR') {
            return res.status(403).json({
                success: false,
                error: '한국에서만 투표가 가능합니다',
                blocked: true
            });
        }

        // 한국 지역 코드 매핑
        const regionMap = {
            '11': '서울',
            '26': '부산',
            '27': '대구',
            '28': '인천',
            '29': '광주',
            '30': '대전',
            '31': '울산',
            '36': '세종',
            '41': '경기',
            '42': '강원',
            '43': '충북',
            '44': '충남',
            '45': '전북',
            '46': '전남',
            '47': '경북',
            '48': '경남',
            '50': '제주'
        };

        const regionName = regionMap[geo.region] || geo.city || '알 수 없음';
        console.log('✅ 투표 지역:', regionName);

        console.log('투표 요청 - Poll ID:', pollId);
        console.log('투표 요청 - Option ID:', optionId);
        console.log('투표 요청 - IP:', clientIp);

        // 여론조사 찾기
        const poll = await Poll.findById(pollId);
        if (!poll) {
            return res.status(404).json({ success: false, error: '여론조사를 찾을 수 없습니다'});
        }

        // 투표 종료 체크 추가
        if (poll.isEnded()) {
            return res.status(403).json({
                success: false,
                error: '투표가 종료되었습니다',
                ended: true
            })
        }

        // IP 주소로 중복 투표 확인
        if (poll.votedIPs && poll.votedIPs.includes(clientIp)) {
            return res.status(403).json({
                success: false,
                error: '이미 투표하셨습니다',
                alreadyVoted: true
            });
        }

        // 옵션 찾기
        const option = poll.options.id(optionId);
        if (!option) {
            console.log('옵션을 찾을 수 없음:', optionId);
            return res.status(404).json({ success: false, error: '옵션을 찾을 수 없습니다'})
        }

        // 투표 증가
        option.votes += 1;

        // 투표한 IP 추가
        if (!poll.votedIPs) poll.votedIPs = [];
        poll.votedIPs.push(clientIp);

        // 저장
        await poll.save();

        // Visitor 저장 시 한글 지역명 사용
        await Visitor.create({
            ip: clientIp,
            action: 'vote',
            pollId: poll._id,
            userAgent,
            location: {
                country: geo.country,
                region: geo.region,
                city: regionName
            }
        });

        console.log('투표 성공 - 옵션:', option.text, '투표수:', option.votes);
        console.log('투표 성공 - 지역:', regionName);
        console.log('투표 IP 기록 완료:', clientIp);

        const io = req.app.get('io');
        if (io) {
            const pollObject = poll.toObject();

            console.log('Socket.IO 전송 데이터:', {
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
        res.status(500).json({ success: false, error: '서버 오류', message: error.message})
    }
});

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

