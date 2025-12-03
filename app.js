const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
require('dotenv').config();

const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
require('dotenv').config();

// ⭐ Render 프록시 신뢰 설정 (맨 위에 추가)
app.set('trust proxy', true);

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",  // 프로덕션에서는 실제 도메인으로 변경 권장
    methods: ["GET", "POST"]
  },
  transports: ['websocket', 'polling'],  // polling도 허용
  allowEIO3: true
});

const Poll = require('./models/Poll');
const Visitor = require('./models/Visitor')

// 미들웨어 설정
app.set('view engine', 'ejs');
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// 세션 설정 추가
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 1000 * 60 * 60 * 24
  }
}));


// 뷰 엔진 설정
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Socket.IO 이벤트 리스너 추가
io.on('connection', (socket) => {
  console.log('새 클라이언트 연결:', socket.id);

  socket.on('disconnect', () => {
    console.log('클라이언트 연결 종료:', socket.id);
  });
});

// io 객체를 라우트에서 사용할 수 있도록 설정
app.set('io', io);

// MongoDB 연결
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('MongoDB 연결 성공'))
  .catch(err => console.error('MongoDB 연결 오류:', err));

// 라우터 설정 (중복 제거)
const pollRoutes = require('./routes/polls');
app.use('/polls', pollRoutes);
const adminRoutes = require('./routes/admin');
app.use('/admin', adminRoutes);

// 기본 라우트 (홈페이지) - 공지사항 추가
app.get('/', async (req, res) => {
  try {
    const recentPolls = await Poll.find().sort({ createdAt: -1 }).limit(3);
    
    // 여기서 공지사항 내용을 수정할 수 있습니다
    const notice = {
      title: '📢 사이트 이용 안내',
      content: `
        <h6>여론조사 사이트에 오신 것을 환영합니다!</h6>
        <ul>
          <li>대한민국 국민을 위한 여론조사 사이트 입니다.</li>
          <li>해당 사이트를 이용하는 사용자는 공산주의 및 독재를 반대하고</li>
          <li>자유 민주주의를 수호하며, 부정 투표를 방지하는 목적으로</li>
          <li>각 여론조사는 IP 기반으로 중복 투표가 방지됩니다</li>
          <li>실시간으로 투표 결과가 업데이트됩니다</li>
        </ul>
        <p class="text-muted mb-0">문의사항이 있으시면 관리자에게 연락주세요.</p>
      `,
      isActive: true  // false로 바꾸면 공지가 안 뜹니다
    };
    
    res.render('index', { 
      title: '여론조사 사이트',
      recentPolls,
      notice  // 공지사항 전달
    });
  } catch (error) {
    console.error('홈페이지 로딩 오류:', error);
    res.render('index', {
      title: '여론조사 사이트',
      recentPolls: [],
      notice: null  // 에러 시 공지 없음
    });
  }
});

//약관 동의 기록 API
app.post('/api/agree-terms', async (req, res) => {
  try {
    const ip = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'];

    // IP 기록 저장
    await Visitor.create({
      ip,
      action: 'agree_terms',
      userAgent
    });

    console.log(`약관 동의: ${ip}`);

    res.json({ success: true, message: '약관 동의가 기록되었습니다'});
  } catch (error) {
    console.error('약관 동의 기록 오류:', error);
    res.status(500).json({ success: false, message: '기록 실패'});
  }
});

// 서버 시작
const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`서버가 http://localhost:${PORT} 에서 실행 중입니다`);
});