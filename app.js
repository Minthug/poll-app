const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
require('dotenv').config();

const app = express();
const server = http.createServer(app);

// ========================================
// 1. 기본 설정
// ========================================
app.set('trust proxy', true);
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// ========================================
// 2. Socket.IO 설정
// ========================================
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  },
  transports: ['websocket', 'polling'],
  allowEIO3: true
});

app.set('io', io);

io.on('connection', (socket) => {
  console.log('새 클라이언트 연결:', socket.id);
  socket.on('disconnect', () => {
    console.log('클라이언트 연결 종료:', socket.id);
  });
});

// ========================================
// 3. 모델
// ========================================
const Poll = require('./models/Poll');
const Visitor = require('./models/Visitor');
const User = require('./models/User');


// ========================================
// 4. 미들웨어
// ========================================
const {
  cookieParser,
  csrfProtection,
  globalLimiter,
  addCsrfToViews
} = require('./middleware/security');

const {
  sessionActivity,
  checkSessionWarning
} = require('./middleware/session');

// 기본 미들웨어
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// ⭐ 보안 미들웨어 적용 (순서 중요!)
app.use(cookieParser());        // 1. 쿠키 파서
app.use(globalLimiter);         // 2. 속도 제한
app.use(csrfProtection);        // 3. CSRF 보호
app.use(addCsrfToViews);        // 4. CSRF 토큰을 뷰에 전달

// 세션
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: { 
    maxAge: 1000 * 60 * 60, // 1시간 ()
    httpOnly: true, // XSS 공격방지
    secure: process.env.NODE_ENV === 'production' // https에서만 쿠키 전송
   }
}));

// 세션 활동 체크 미들웨어
app.use(sessionActivity);
app.use(checkSessionWarning);

// 모든 뷰에 세션 정보 전달
app.use((req, res, next) => {
  res.locals.user = req.session.userId ? {
    id: req.session.userId,
    username: req.session.username
  } : null;
  next();
});


// ========================================
// 5. MongoDB 연결
// ========================================
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('✅ MongoDB 연결 성공'))
  .catch(err => console.error('❌ MongoDB 연결 오류:', err));

// ========================================
// 6. 라우터
// ========================================
const pollRoutes = require('./routes/polls');
const adminRoutes = require('./routes/admin');
const authRoutes = require('./routes/auth');

app.use('/polls', pollRoutes);
app.use('/admin', adminRoutes);
app.use('/auth', authRoutes);

// ========================================
// 7. 홈 라우트
// ========================================
app.get('/', async (req, res) => {
  try {
    const recentPolls = await Poll.find().sort({ createdAt: -1 }).limit(3);
    
    res.render('index', { 
      title: '여론조사 사이트',
      recentPolls
    });
  } catch (error) {
    console.error('홈페이지 로딩 오류:', error);
    res.render('index', {
      title: '여론조사 사이트',
      recentPolls: []
    });
  }
});

// 약관 동의 API
app.post('/api/agree-terms', async (req, res) => {
  try {
    const ip = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'];

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

// ========================================
// 8. 서버 시작
// ========================================
const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 서버가 http://localhost:${PORT} 에서 실행 중입니다`);
});