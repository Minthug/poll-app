const express = require('express');
const router = express.Router();
const Poll = require('../models/Poll');
const Visitor = require('../models/Visitor');
const geoip = require('geoip-lite');
const axios = require('axios');

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
        const { title, description, options, endDate, category, tags } = req.body;

        console.log('받은 데이터:', { title, description, category, tags, endDate });

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

// 여론조사 상세 - 투표 페이지// 투표 페이지
router.get('/:id', async (req, res) => {
    try {
        const poll = await Poll.findById(req.params.id);
        
        if (!poll) {
            return res.status(404).send('여론조사를 찾을 수 없습니다');
        }

        // ⭐ IP 체크 및 이미 투표했는지 확인
        let clientIp = req.headers['x-forwarded-for'] 
            ? req.headers['x-forwarded-for'].split(',')[0].trim()
            : req.ip || req.socket.remoteAddress;

        console.log('투표 페이지 접속 IP:', clientIp);
        console.log('투표한 IP 목록:', poll.votedIPs);

        // 이미 투표한 IP면 결과 페이지로 리다이렉트
        if (poll.votedIPs && poll.votedIPs.includes(clientIp)) {
            console.log('✅ 이미 투표한 사용자 - 결과 페이지로 리다이렉트');
            return res.redirect(`/polls/${req.params.id}/result?alreadyVoted=true`);
        }

        // 투표 종료되었으면 결과 페이지로 리다이렉트
        if (poll.isEnded()) {
            console.log('✅ 투표 종료 - 결과 페이지로 리다이렉트');
            return res.redirect(`/polls/${req.params.id}/result?ended=true`);
        }

        // 투표 안 했으면 투표 페이지 표시
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


        // ⭐ 디버깅 로그 추가
        console.log('========== 투표 요청 시작 ==========');
        console.log('Headers:', JSON.stringify(req.headers, null, 2));
        console.log('req.ip:', req.ip);
        console.log('req.ips:', req.ips);
        console.log('X-Forwarded-For:', req.headers['x-forwarded-for']);
        console.log('trust proxy:', req.app.get('trust proxy'));
        

        let clientIp = req.headers['x-forwarded-for'] ? req.headers['x-forwarded-for'].split(',')[0].trim() : req.ip
        || req.socket.remoteAddress;
        const userAgent = req.headers['user-agent'];

        console.log('🔍 원본 IP:', req.ip);
        console.log('🔍 X-Forwarded-For:', req.headers['x-forwarded-for']);
        console.log('🔍 최종 사용 IP:', clientIp);

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

        const isLocalhost = clientIp === '::1' || clientIp === '127.0.0.1' || clientIp.includes('localhost');
        const isDevelopment = process.env.NODE_ENV !== 'production';

        let geo = null;
        let regionName = '알 수 없음';

        
        // localhost이고 개발 환경일 때만 특별 처리
        if (isLocalhost && isDevelopment) {
            console.log('🏠 localhost (개발 모드) - 지역 체크 건너뜀');
            regionName = '로컬 개발';
            // 개발 환경의 localhost는 지역 체크 없이 통과
        } else {
            // 그 외 모든 경우: 무조건 한국 IP 체크
            
            // localhost이지만 프로덕션이면 실제 공인 IP 조회
            if (isLocalhost) {
                try {
                    console.log('🔍 localhost (프로덕션) - 실제 공인 IP 조회 중...');
                    const response = await axios.get('https://api.ipify.org?format=json', { timeout: 5000 });
                    clientIp = response.data.ip;
                    console.log('🌐 실제 공인 IP 사용:', clientIp);
                } catch(error) {
                    console.log('⚠️ 공인 IP를 가져올 수 없음:', error.message);
                    return res.status(500).json({
                        success: false,
                        error: '네트워크 연결을 확인해주세요'
                    });
                }
            }

            geo = geoip.lookup(clientIp);
            console.log('📍 감지된 지역:', geo);
            console.log('📍 사용된 IP:', clientIp);
                            
            // // 한국이 아니면 차단
            // if (!geo || geo.country !== 'KR') {
            //     return res.status(403).json({
            //         success: false,
            //         error: '한국에서만 투표가 가능합니다',
            //         blocked: true,
            //         ip: clientIp,
            //         country: geo ? geo.country : 'unknown'
            //     });
            // }

            // 한국 지역명 설정
            regionName = regionMap[geo.region] || geo.city || '알 수 없음';
        }
     
        console.log('✅ 투표 지역:', regionName);
        console.log('투표 요청 - Poll ID:', pollId);
        console.log('투표 요청 - Option ID:', optionId);
        console.log('투표 요청 - IP:', clientIp);

        // 여론조사 찾기
        const poll = await Poll.findById(pollId);
        if (!poll) {
            return res.status(404).json({ success: false, error: '여론조사를 찾을 수 없습니다'});
        }

        // 투표 종료 체크
        if (poll.isEnded()) {
            return res.status(403).json({
                success: false,
                error: '투표가 종료되었습니다',
                ended: true
            });
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
            return res.status(404).json({ success: false, error: '옵션을 찾을 수 없습니다'});
        }

        // 투표 증가
        option.votes += 1;

        // 투표한 IP 추가
        if (!poll.votedIPs) poll.votedIPs = [];
        poll.votedIPs.push(clientIp);

        // 저장
        await poll.save();

        // Visitor 저장
        await Visitor.create({
            ip: clientIp,
            action: 'vote',
            pollId: poll._id,
            userAgent,
            location: {
                country: geo ? geo.country : 'LOCAL',
                region: geo ? geo.region : 'localhost',
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
        res.status(500).json({ success: false, error: '서버 오류', message: error.message});
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

router.get('/debug/ip', (req, res) => {
    const clientIP = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    const geo = geoip.lookup(clientIP);

    res.json({
        rawIp: req.ip,
        forwardedFor: req.headers['x-forwarded-for'],
        socketAddress: req.socket.remoteAddress,
        finalIp: clientIP,
        geoipResult: geo,
        isKorea: geo ? geo.country === 'KR' : false
    });
})

module.exports = router;

