const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const expressLayouts = require('express-ejs-layouts');
require('dotenv').config();

const app = express();
const server = http.createServer(app);

// ========================================
// 1. 기본 설정
// ========================================
app.set('trust proxy', true);
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(expressLayouts);
app.set('layout', 'layouts/main');
app.set('layout extractScripts', true);
app.set('layout extractStyles', true);

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
// 3. MongoDB 연결 (세션 전에!)
// ========================================
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('✅ MongoDB 연결 성공'))
  .catch(err => console.error('❌ MongoDB 연결 오류:', err));

// ========================================
// 4. 모델
// ========================================
const Poll = require('./models/Poll');
const Visitor = require('./models/Visitor');
const User = require('./models/User');
const IPConsent = require('./models/IPConsent');

// ========================================
// 5. 미들웨어
// ========================================
const passport = require('./config/passport');

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

// 보안 미들웨어
app.use(cookieParser());
app.use(globalLimiter);

// ⬇️⬇️⬇️ 세션을 먼저 초기화! ⬇️⬇️⬇️
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    client: mongoose.connection.getClient(),
    touchAfter: 24 * 3600
  }),
  cookie: { 
    maxAge: 1000 * 60 * 60,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production'
  }
}));

// 세션 활동 체크
app.use(sessionActivity);
app.use(checkSessionWarning);
app.use(passport.initialize());
app.use(passport.session());

// ⬇️⬇️⬇️ CSRF 보호 전에 예외 라우트 등록 ⬇️⬇️⬇️
const consentRoutes = require('./routes/consent');
app.use('/admin/consent', consentRoutes);

// OAuth 약관 동의 라우트 (CSRF 예외)
app.get('/auth/oauth-terms', async (req, res) => {
  console.log('🔍 GET /auth/oauth-terms');
  console.log('세션:', req.session);
  console.log('세션 ID:', req.session?.userId);
  
  if (!req.session || !req.session.userId) {
    console.log('❌ 세션 없음, 로그인으로');
    return res.redirect('/auth/login');
  }

  console.log('✅ 약관 페이지 렌더링');
  res.render('oauth-terms', {
    title: '서비스 약관 동의',
    error: null,
    csrfToken: ''
  });
});

app.post('/auth/oauth-terms', async (req, res) => {
  try {
    console.log('📝 POST /auth/oauth-terms');
    console.log('세션 ID:', req.session?.userId);
    console.log('동의:', req.body.agreeTerms);
    
    if (!req.session || !req.session.userId) {
      console.log('❌ 세션 없음');
      return res.redirect('/auth/login');
    }

    if (!req.body.agreeTerms) {
      console.log('❌ 동의 안 함');
      return res.render('oauth-terms', {
        title: '서비스 약관 동의',
        error: '서비스 이용약관에 동의해주세요',
        csrfToken: ''
      });
    }
    
    const result = await User.findByIdAndUpdate(
      req.session.userId,
      { isFirstLogin: false },
      { new: true }
    );

    console.log('✅ 동의 완료:', result?.username, 'isFirstLogin:', result?.isFirstLogin);
    console.log('🔄 /polls로 리디렉션');
    res.redirect('/polls');
    
  } catch (error) {
    console.error('❌ 오류:', error);
    res.redirect('/');
  }
});

// ⬇️⬇️⬇️ CSRF 보호 적용 ⬇️⬇️⬇️
app.use(csrfProtection);
app.use(addCsrfToViews);

// ⬇️⬇️⬇️ OAuth 첫 로그인 체크 미들웨어 ⬇️⬇️⬇️
app.use(async (req, res, next) => {
  if (req.session && req.session.userId) {
    try {
      // 제외할 경로들
      const excludedPaths = [
        '/auth/oauth-terms',
        '/auth/logout',
        '/api/',
        '/public/',
        '/images/',
        '/css/',
        '/js/'
      ];
      
      if (excludedPaths.some(path => req.path.startsWith(path))) {
        console.log('⏭️  제외 경로:', req.path);
        return next();
      }

      const user = await User.findById(req.session.userId);
      
      console.log('👤 체크:', user?.username, 'isFirstLogin:', user?.isFirstLogin);

      if (user && user.isFirstLogin === true) {
        console.log('🔄 약관 페이지로 리디렉션');
        return res.redirect('/auth/oauth-terms');
      }

      if (user && (user.isFirstLogin === undefined || user.isFirstLogin === null)) {
        await User.findByIdAndUpdate(user._id, { isFirstLogin: false });
        console.log('✅ 기존 사용자 업데이트');
      }
    } catch (error) {
      console.error('❌ 첫 로그인 체크 오류:', error);
    }
  }
  next();
});

// 모든 뷰에 세션 정보 전달
app.use((req, res, next) => {
  res.locals.user = req.session.userId ? {
    id: req.session.userId,
    username: req.session.username
  } : null;
  next();
});

// TOP 5 투표
app.use(async (req, res, next) => {
  try {
    const topPolls = await Poll.find()
      .sort({ views: -1 })
      .limit(5)
      .lean();

    topPolls.forEach(poll => {
      poll.totalVotes = poll.options.reduce((sum, opt) => sum + opt.votes, 0);
    });

    res.locals.topPolls = topPolls;
  } catch (error) {
    console.error('TOP 5 로딩 에러', error);
    res.locals.topPolls = [];
  }
  next();
});

// ========================================
// 6. 라우터
// ========================================
const pollRoutes = require('./routes/polls');
const adminRoutes = require('./routes/admin');
const authRoutes = require('./routes/auth');
const oauthRoutes = require('./routes/oauth');
const profileRoutes = require('./routes/profile');

app.use('/polls', pollRoutes);
app.use('/admin', adminRoutes);
app.use('/auth', authRoutes);
app.use('/oauth', oauthRoutes);
app.use('/profile', profileRoutes);

// ========================================
// 7. 홈 라우트
// ========================================
app.get('/', async (req, res) => {
  try {
    const recentPolls = await Poll.find().sort({ createdAt: -1 }).limit(3);
    
    res.render('index', { 
      title: '여론조사 사이트',
      recentPolls,
      showRanking: true
    });
  } catch (error) {
    console.error('홈페이지 로딩 오류:', error);
    res.render('index', {
      title: '여론조사 사이트',
      recentPolls: [],
      showRanking: true
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
const ENV = process.env.NODE_ENV || 'development';

// base_URL 자동 감지
const getBaseUrl = () => {
  // 1순위 환경변수에 명시적으로 설정된 경우
  if (process.env.BASE_URL) {
    return process.env.BASE_URL;
  }

  // 2순위 Render 배포 환경
  if (process.env.RENDER_EXTERNAL_URL) {
    return process.env.RENDER_EXTERNAL_URL;
  }

  // 3순위 프로덕션 환경 (호스팅 플랫폼별로 추가 가능)
  if (ENV === 'production') {
    // NCP 등등
    return `https://your-domain.com`;
  }

  // 4순위 로컬 개발 환경
  return `https://localhost:${PORT}`;
};

const BASE_URL = getBaseUrl();

// OAuth Callback URL 자동 설정
const GOOGLE_CALLBACK_URL = process.env.GOOGLE_CALLBACK_URL || `${BASE_URL}/oauth/google/callback`;
const NAVER_CALLBACK_URL = process.env.NAVER_CALLBACK_URL || `${BASE_URL}/oauth/naver/callback`;

// 8. 서버 시작
server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 서버가 실행 중입니다`);
  console.log(`📌 환경: ${ENV}`);
  console.log(`🌐 BASE_URL: ${BASE_URL}`);
  console.log(`🔐 Google Callback: ${GOOGLE_CALLBACK_URL}`);
  console.log(`🔐 Naver Callback: ${NAVER_CALLBACK_URL}`);

  if (ENV === 'development') {
    console.log(`💡 로컬 접속: http://localhost:${PORT}`);
  }
});
