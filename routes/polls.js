const express = require('express');
const router = express.Router();
const Poll = require('../models/Poll');
const Visitor = require('../models/Visitor');
const geoip = require('geoip-lite');
const axios = require('axios');
const { requireLogin } = require('../middleware/auth');


// 모든 여론 조사 목록 - 비로그인 사용자도 목록 확인 가능
router.get('/', async (req, res) => {
    try {
        const { category, search, sort } = req.query;
        let query = {};

        if (category) {
            query.category = category;
        }

        if (search) {
            query.$or = [
                { title: { $regex: search, $options: 'i' } },
                { description: { $regex: search, $options: 'i'}}
            ];
        }

        // 정렬 옵션
        let sortOption = {};
        switch(sort) {
            case 'popular':
                sortOption = { createdAt: -1 };
                break;
            case 'participants':
                sortOption = { createdAt: -1 };
                break;
            case 'oldest':
                sortOption = { createdAt: 1};
                break;
            case 'views':
                sortOption = { views: -1, createdAt: -1};
                break;
            case 'newest':
            default: 
                sortOption = { createdAt: -1};
        }

        let polls = await Poll.find(query).sort(sortOption).lean();

        // 각 투표의 통계 계산
        polls = polls.map(poll => {
            const totalVotes = poll.options.reduce((sum, opt) => sum + opt.votes, 0);
            const uniqueVoters = poll.votedIPs ? poll.votedIPs.length : 0;

            return {
                ...poll,
                totalVotes,
                uniqueVoters
            };
        });

        // 인기순/참여자순 정렬 (메모리에서)
        if (sort === 'popular') {
            polls.sort((a, b) => b.totalVotes - a.totalVotes || b.createdAt - a.createdAt);
        } else if (sort === 'participants') {
            polls.sort((a, b) => b.uniqueVoters - a.uniqueVoters || b.createdAt - a.createdAt);
        }

        const topPolls = await Poll.find()
            .sort({ views: -1 })
            .limit(5)
            .lean();

        topPolls.forEach(poll => {
            poll.totalVotes = poll.options.reduce((sum, opt) => sum + opt.votes, 0);
        });

        console.log('📋 여론조사 목록 조회:', polls.length, '개');
        console.log('🔍 검색어:', search || '없음');
        console.log('📊 정렬:', sort || 'newest');
        console.log('🔥 TOP 5 투표:', topPolls.length, '개');

        const baseUrl = `${req.protocol}://${req.get('host')}`; // ⭐ 수정 (host → 'host')

        res.render('polls/index', { 
            polls: polls, 
            category: category || null,
            search: search || '',
            sort: sort || 'newest',
            topPolls: topPolls,  
            showRanking: true,
            pageTitle: '한국 여론조사 - 실시간 투표 플랫폼',
            pageDescription: `${polls.length}개의 여론조사가 진행 중입니다. 지금 바로 참여하세요!`,
            ogTitle: '한국 여론조사',
            ogDescription: `${polls.length}개의 여론조사가 진행 중입니다. 실시간으로 투표하고 결과를 확인하세요!`,
            ogUrl: `${baseUrl}/polls`,
            ogImage: null
        });
    } catch (error) {
        console.error('투표 목록 로드 오류:', error);
        res.status(500).send('서버 오류');
    }
});

// 새 여론조사 폼 - 로그인 필수
router.get('/new', requireLogin, (req, res) => {
    res.render('polls/new', {
        showRanking: true 
    });
});

// 여론조사 생성 - 로그인 필수 
router.post('/', async (req, res) => {
    try {
        const { title, description, options, endDate, category, tags } = req.body;

        console.log('받은 데이터:', { title, description, category, tags, endDate });

        // 빈 옵션 필터링
        const pollOptions = options.filter(opt => opt.trim() !== '').map(opt => ({
            text: opt,
            votes: 0
        }));

        // 태그 처리
        let tagArray = [];
        if (tags && tags.trim() !== '') {
            tagArray = tags.split(',')
                .map(tag => tag.trim())
                .filter(tag => tag !== '')
                .slice(0, 5);
        }

        const poll = new Poll({
            title,
            description,
            category: category || '일반',
            tags: tagArray,
            options: pollOptions,
            endDate: endDate ? new Date(endDate) : null,
            createdBy: req.session.userId,
            createdByUsername: req.session.username
        });

        await poll.save();
    
        console.log('✅ 여론조사 생성 완료:', poll._id);

        return res.redirect('/polls');
    } catch (error) {
        console.error('투표 생성 오류:', error);
        res.status(500).send('서버 오류');
    }
});

// 여론조사 상세 - 투표 페이지
router.get('/:id', async (req, res) => {
    try {
        const poll = await Poll.findById(req.params.id);
        
        await Poll.findByIdAndUpdate(req.params.id, { $inc: { views: 1 }});

        if (!poll) {
            return res.status(404).send('여론조사를 찾을 수 없습니다');
        }

        let clientIp = req.headers['x-forwarded-for'] 
            ? req.headers['x-forwarded-for'].split(',')[0].trim()
            : req.ip || req.socket.remoteAddress;

        console.log('투표 페이지 접속 IP:', clientIp);

        const isOwner = req.session.userId &&
                        poll.createdBy &&
                        poll.createdBy.toString() === req.session.userId.toString();
        
        if (poll.votedIPs && poll.votedIPs.includes(clientIp)) {
            console.log('✅ 이미 투표한 사용자 - 결과 페이지로 리다이렉트');
            return res.redirect(`/polls/${req.params.id}/result?alreadyVoted=true`);
        }

        if (poll.isEnded()) {
            console.log('✅ 투표 종료 - 결과 페이지로 리다이렉트');
            return res.redirect(`/polls/${req.params.id}/result?ended=true`);
        }

        const totalVotes = poll.options.reduce((sum, opt) => sum + opt.votes, 0);
        const baseUrl = `${req.protocol}://${req.get('host')}`; // ⭐ 수정

        res.render('polls/show', { 
            poll, 
            isOwner, 
            showRanking: true,
            pageTitle: `${poll.title} - 한국 여론조사`,
            pageDescription: poll.description || `${poll.title}에 투표하세요. 현재 ${totalVotes}명이 참여했습니다.`,
            ogTitle: poll.title,
            ogDescription: poll.description || `${poll.title}에 투표하세요. 현재 ${totalVotes}명이 참여했습니다.`,
            ogUrl: `${baseUrl}/polls/${poll._id}`,
            ogImage: poll.image || null
        });
    } catch (error) {
        console.error(error);
        res.status(500).send('서버 오류');
    }
});

// 결과 페이지
router.get('/:id/result', async (req, res) => {
    try {
        const poll = await Poll.findById(req.params.id);
        
        if (!poll) {
            return res.status(404).send('여론조사를 찾을 수 없습니다');
        }

        const locationStats = await Visitor.aggregate([
            { $match: { pollId: poll._id, action: 'vote' } },
            { $group: { _id: '$location.city', count: { $sum: 1 } } },
            { $sort: { count: -1 } }
        ]);

        const alreadyVoted = req.query.alreadyVoted === 'true';
        const ended = req.query.ended === 'true';

        const isOwner = req.session.userId &&
                        poll.createdBy &&
                        poll.createdBy.toString() === req.session.userId.toString();

        const totalVotes = poll.options.reduce((sum, opt) => sum + opt.votes, 0);
        const sortedOptions = [...poll.options].sort((a, b) => b.votes - a.votes);
        const topOption = sortedOptions[0];
        const baseUrl = `${req.protocol}://${req.get('host')}`; // ⭐ 추가

        res.render('polls/result', { 
            poll, 
            locationStats,
            alreadyVoted,
            ended,
            isOwner,
            showRanking: true,
            baseUrl, // ⭐ 추가
            pageTitle: `${poll.title} - 투표 결과`,
            pageDescription: totalVotes > 0 
                ? `"${topOption.text}"가 ${totalVotes}표 중 ${topOption.votes}표(${((topOption.votes / totalVotes) * 100).toFixed(1)}%)로 1위입니다.`
                : '아직 투표 결과가 없습니다.',
            ogTitle: `${poll.title} - 투표 결과`,
            ogDescription: totalVotes > 0 
                ? `"${topOption.text}"가 ${totalVotes}표 중 ${topOption.votes}표(${((topOption.votes / totalVotes) * 100).toFixed(1)}%)로 1위입니다.`
                : '아직 투표 결과가 없습니다.',
            ogUrl: `${baseUrl}/polls/${poll._id}/result`,
            ogImage: poll.image || null
        });
    } catch (error) {
        console.error('결과 페이지 로딩 오류:', error);
        res.status(500).send('서버 오류');
    }
});

// 투표 처리
router.post('/:id/vote', async (req, res) => {
    try {
        const { optionId } = req.body;
        const pollId = req.params.id;

        console.log('========== 투표 요청 시작 ==========');

        let clientIp = req.headers['x-forwarded-for'] 
            ? req.headers['x-forwarded-for'].split(',')[0].trim() 
            : req.ip || req.socket.remoteAddress;
        const userAgent = req.headers['user-agent'];

        console.log('🔍 최종 사용 IP:', clientIp);

        const regionMap = {
            '11': '서울', '26': '부산', '27': '대구', '28': '인천',
            '29': '광주', '30': '대전', '31': '울산', '36': '세종',
            '41': '경기', '42': '강원', '43': '충북', '44': '충남',
            '45': '전북', '46': '전남', '47': '경북', '48': '경남', '50': '제주'
        };

        const isLocalhost = clientIp === '::1' || clientIp === '127.0.0.1' || clientIp.includes('localhost');
        const isDevelopment = process.env.NODE_ENV !== 'production';

        let geo = null;
        let regionName = '알 수 없음';

        if (isLocalhost && isDevelopment) {
            console.log('🏠 localhost (개발 모드) - 지역 체크 건너뜀');
            regionName = '로컬 개발';
        } else {
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
            regionName = regionMap[geo?.region] || geo?.city || '알 수 없음';
        }
    
        console.log('✅ 투표 지역:', regionName);

        const poll = await Poll.findById(pollId);
        if (!poll) {
            return res.status(404).json({ success: false, error: '여론조사를 찾을 수 없습니다'});
        }

        if (poll.isEnded()) {
            return res.status(403).json({
                success: false,
                error: '투표가 종료되었습니다',
                ended: true
            });
        }

        if (poll.votedIPs && poll.votedIPs.includes(clientIp)) {
            return res.status(403).json({
                success: false,
                error: '이미 투표하셨습니다',
                alreadyVoted: true
            });
        }

        const option = poll.options.id(optionId);
        if (!option) {
            return res.status(404).json({ success: false, error: '옵션을 찾을 수 없습니다'});
        }

        // 회원 여부 확인
        const isMember = req.session && req.session.userId;

        // 투표수 증가
        option.votes += 1;

        // 회원/익명 구분 카운트
        if (isMember) {
            option.memberVotes = (option.memberVotes || 0) + 1;
        } else {
            option.anonymousVotes = (option.anonymousVotes || 0) + 1;
        }

        if (!poll.votedIPs) poll.votedIPs = [];
        poll.votedIPs.push(clientIp);

        await poll.save();

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

        const io = req.app.get('io');
        if (io) {
            io.emit('vote-update', {
                pollId: poll._id.toString(),
                poll: poll.toObject()
            });
        }

        res.json({
            success: true,
            poll: poll,
            votes: option.votes,
            memberVotes: option.memberVotes,
            anonymousVotes: option.anonymousVotes,
            totalVotes: poll.options.reduce((sum, opt) => sum + opt.votes, 0)
        });
    } catch(error) {
        console.error(error);
        res.status(500).json({ success: false, error: '서버 오류', message: error.message});
    }
});

// 결과 보기 API
router.get('/:id/results', async (req, res) => {
    try {
        const poll = await Poll.findById(req.params.id);
    
        if (!poll) {
            return res.status(404).json({ success: false, error: '여론 조사를 찾을 수 없습니다'});
        }

        res.json({
            success: true,
            poll: poll.toObject()
        });
    } catch (error) {
        console.error('결과 조회 오류', error);
        res.status(500).json({ success: false, error: '결과를 불러오는 중 오류가 발생 했습니다.'})
    }
});

router.get('/:id/voted-ips', async (req, res) => {
    try {
        const poll = await Poll.findById(req.params.id);
        if (!poll) {
            return res.status(404).send('여론조사를 찾을 수 없습니다');
        }

        res.render('polls/voted-ips', { poll, showRanking: true });
    } catch (error) {
        console.error(error)
        res.status(500).send('서버 오류');
    }
});

router.get('/debug/ip', (req, res) => {
    const clientIp = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    const geo = geoip.lookup(clientIp);

    res.json({
        rawIp: req.ip,
        forwardedFor: req.headers['x-forwarded-for'],
        socketAddress: req.socket.remoteAddress,
        finalIp: clientIp,
        geoipResult: geo,
        isKorea: geo ? geo.country === 'KR' : false
    });
});

router.get('/:id/export-csv', async(req, res) => {
    try {
        const poll = await Poll.findById(req.params.id);

        if (!poll) {
            return res.status(404).send('투표를 찾을 수 없습니다');
        }

        let csv = '\uFEFF';
        csv += `"투표 제목","${poll.title.replace(/"/g, '""')}"\n`;
        csv += `"생성일","${new Date(poll.createdAt).toLocaleString('ko-KR')}"\n`;
        csv += '\n';
        csv += '"순위","선택지","투표수","비율"\n';

        const totalVotes = poll.options.reduce((sum, opt) => sum + opt.votes, 0);
        const sortedOptions = [...poll.options].sort((a, b) => b.votes - a.votes);
        
        sortedOptions.forEach((option, index) => {
            const percentage = totalVotes > 0 
                ? ((option.votes / totalVotes) * 100).toFixed(1) 
                : 0;
            
            csv += `${index + 1},"${option.text.replace(/"/g, '""')}",${option.votes},${percentage}%\n`;
        });
        
        csv += '\n';
        csv += `"총 투표수",${totalVotes}\n`;

        const timestamp = new Date().toISOString().slice(0, 10);
        const filename = `poll_${poll._id}_${timestamp}.csv`;
        
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.send(csv);
        
        console.log('✅ CSV 다운로드:', filename);
    } catch (error) {
        console.error('❌ CSV 내보내기 오류:', error);
        res.status(500).send('CSV 생성 중 오류가 발생했습니다');
    }
});

// 투표 수정 페이지
router.get('/:id/edit', requireLogin, async (req, res) => {
    try {
        const poll = await Poll.findById(req.params.id);

        if (!poll) {
            return res.status(404).send('투표를 찾을 수 없습니다');
        }

        if (!poll.createdBy || poll.createdBy.toString() !== req.session.userId.toString()) {
            return res.status(403).send('수정 권한이 없습니다');
        }

        res.render('polls/edit', {
            poll,
            showRanking: true
        });
    } catch (error) {
        console.error('투표 수정 페이지 오류:', error);
        res.status(500).send('서버 오류');
    }
});

// 투표 수정 처리
router.post('/:id/edit', requireLogin, async (req, res) => {
    try {
        const { title, description, options, category, tags } = req.body;
        const poll = await Poll.findById(req.params.id);

        if (!poll) {
            return res.status(404).send('투표를 찾을 수 없습니다');
        }

        if (!poll.createdBy || poll.createdBy.toString() !== req.session.userId.toString()) {
            return res.status(403).send('수정 권한이 없습니다');
        }

        poll.title = title;
        poll.description = description;
        poll.category = category || '일반';

        if (tags && tags.trim() !== '') {
            poll.tags = tags.split(',')
                .map(tag => tag.trim())
                .filter(tag => tag !== '')
                .slice(0, 5);
        } else {
            poll.tags = [];
        }

        if (options && Array.isArray(options)) {
            options.forEach((optionText, index) => {
                if (poll.options[index] && optionText.trim() !== '') {
                    poll.options[index].text = optionText.trim();
                }
            });
        }

        await poll.save();

        console.log('✅ 투표 수정 완료:', poll._id);
        res.redirect(`/polls/${poll._id}`);
    } catch (error) {
        console.error('투표 수정 오류:', error);
        res.status(500).send('서버 오류');
    }
});

// 투표 삭제
router.post('/:id/delete', requireLogin, async (req, res) => {
    try {
        const poll = await Poll.findById(req.params.id);
        
        if (!poll) {
            return res.status(404).json({ success: false, message: '투표를 찾을 수 없습니다' });
        }

        if (!poll.createdBy || poll.createdBy.toString() !== req.session.userId.toString()) {
            return res.status(403).json({ success: false, message: '삭제 권한이 없습니다' });
        }

        await Poll.findByIdAndDelete(req.params.id);
        
        console.log('✅ 투표 삭제 완료:', poll._id);
        res.json({ success: true });
    } catch (error) {
        console.error('투표 삭제 오류:', error);
        res.status(500).json({ success: false, message: '서버 오류' });
    }
});

// 임베드 전용 페이지 (iframe용)
router.get('/:id/embed', async (req, res) => {
    try {
        const poll = await Poll.findById(req.params.id);

        if (!poll) {
            return res.status(404).send('여론조사를 찾을 수 없습니다');
        }

        let clientIp = req.headers['x-forwarded-for'] 
            ? req.headers['x-forwarded-for'].split(',')[0].trim()
            : req.ip || req.socket.remoteAddress;

        const hasVoted = poll.votedIPs && poll.votedIPs.includes(clientIp);
        const isEnded = poll.isEnded();
        const totalVotes = poll.options.reduce((sum, opt) => sum + opt.votes, 0);

        res.render('polls/embed', {
            poll,
            hasVoted,
            isEnded,
            totalVotes,
            layout: false
        });
    } catch (error) {
        console.error('임베드 페이지 오류:', error);
        res.status(500).send('서버 오류');
    }
});

module.exports = router;