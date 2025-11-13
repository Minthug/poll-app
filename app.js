const express = require('express');
const mongoose = require('mongoose');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// 미들웨어 설정
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// 뷰 엔진 설정
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Socket.IO 이벤트 리스너 추가
io.on('connection', (socket) => {
  console.log('새 클라이언트 연결', socket.id);

  socket.on('disconnect', () => {
    console.log('클라이언트 연결 종료:', socket.id);
  })
});

// io 객체를 라우트에서 사용할 수 있도록 설정
app.set('io', io);

// MongoDB 연결
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('MongoDB 연결 성공'))
  .catch(err => console.error('MongoDB 연결 오류:', err));

// app.js에 추가
const pollRoutes = require('./routes/polls');

// 라우터 설정
app.use('/polls', pollRoutes);

// 라우터 불러오기(중복제거)
const pollsRouter = require('./routes/polls');
const { Socket } = require('dgram');

// 라우터 설정
app.use('/polls', pollsRouter);

// 기본 라우트
app.get('/', (req, res) => {
  res.render('index', { title: '여론조사 사이트' });
});

// 서버 시작
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`서버가 http://localhost:${PORT} 에서 실행 중입니다`);
});
