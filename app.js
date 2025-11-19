const express = require('express');
const mongoose = require('mongoose');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const Poll = require('./models/Poll');

// 미들웨어 설정
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

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
          <li>누구나 자유롭게 여론조사를 만들고 참여할 수 있습니다</li>
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

// 서버 시작
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`서버가 http://localhost:${PORT} 에서 실행 중입니다`);
});