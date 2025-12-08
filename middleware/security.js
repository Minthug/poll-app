const csrf = require('csurf');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');

// CSRF 보호
const csrfProtection = csrf({ cookie: true });

// 전역 속도 제한
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15분
  max: 100,
  message: '너무 많은 요청을 보내셨습니다. 잠시 후 다시 시도해주세요.'
});

// 투표 전용 속도 제한
const voteLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1시간
  max: 10,
  message: '투표 시도가 너무 많습니다. 1시간 후 다시 시도해주세요.',
  skipSuccessfulRequests: true
});

// CSRF 토큰을 모든 뷰에 자동 전달
const addCsrfToViews = (req, res, next) => {
  res.locals.csrfToken = req.csrfToken();
  next();
};

module.exports = {
  cookieParser,
  csrfProtection,
  globalLimiter,
  voteLimiter,
  addCsrfToViews
};