const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const NaverStrategy = require('passport-naver').Strategy;
const User = require('../models/User');

console.log('🔧 Passport 설정 시작');

// ========================================
// 세션에 사용자 정보 저장
// ========================================
passport.serializeUser((user, done) => {
    console.log('💾 사용자 세션 저장:', user._id);
    done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
    try {
        console.log('🔍 사용자 세션 복구:', id);
        const user = await User.findById(id);
        done(null, user);
    } catch (error) {
        console.error('❌ 세션 복구 실패:', error);
        done(error, null);
    }
});


// ========================================
// Google OAuth 전략
// ========================================
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    console.log('✅ Google OAuth 설정됨');
    console.log('GOOGLE_CALLBACK_URL:', process.env.GOOGLE_CALLBACK_URL);
    
    passport.use(new GoogleStrategy({
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: process.env.GOOGLE_CALLBACK_URL || '/oauth/google/callback'
    },
    async (accessToken, refreshToken, profile, done) => {
        try {
            console.log('🔵 Google 프로필 수신:', profile.id, profile.displayName);
            
            // 기존 사용자 찾기
            let user = await User.findOne({
                oauthProvider: 'google',
                oauthId: profile.id
            });

            if (user) {
                console.log('✅ 기존 Google 사용자 로그인:', user.username);
                return done(null, user);
            }

            // 이메일로 기존 계정 확인
            user = await User.findOne({ email: profile.emails[0].value });

            if (user) {
                console.log('🔗 기존 계정에 Google 연동:', user.username);
                user.oauthProvider = 'google';
                user.oauthId = profile.id;
                user.profileImage = profile.photos[0]?.value;  // ✅ 수정
                user.isFirstLogin = true;
                await user.save();
                return done(null, user);
            }

            // 새 사용자 생성
            console.log('🆕 새 Google 사용자 생성');
            user = await User.create({
                username: profile.displayName,
                email: profile.emails[0].value,
                oauthProvider: 'google',
                oauthId: profile.id,
                profileImage: profile.photos[0]?.value,  // ✅ 수정
                password: null,
                isFirstLogin: true
            });
            console.log('✅ 사용자 생성 완료:', user.username);
            done(null, user);
        } catch (error) {
            console.error('❌ Google OAuth 에러:', error);
            done(error, null);
        }
    }
    ));
} else {
    console.warn('⚠️ Google OAuth 환경변수 누락');
}


// ========================================
// Naver OAuth 전략
// ========================================
if (process.env.NAVER_CLIENT_ID && process.env.NAVER_CLIENT_SECRET) {
    console.log('✅ Naver OAuth 설정됨');
    console.log('NAVER_CALLBACK_URL:', process.env.NAVER_CALLBACK_URL);
    
    passport.use(new NaverStrategy({
        clientID: process.env.NAVER_CLIENT_ID,
        clientSecret: process.env.NAVER_CLIENT_SECRET,
        callbackURL: process.env.NAVER_CALLBACK_URL || '/auth/naver/callback'  // ✅ 수정
    },
    async (accessToken, refreshToken, profile, done) => {
        try {
            console.log('🟢 Naver 프로필 수신:', profile.id, profile.displayName);
            
            let user = await User.findOne({
                oauthProvider: 'naver',
                oauthId: profile.id
            });

            if (user) {
                console.log('✅ 기존 Naver 사용자 로그인:', user.username);
                return done(null, user);
            }

            user = await User.findOne({ email: profile.emails[0].value });

            if (user) {
                console.log('🔗 기존 계정에 Naver 연동:', user.username);
                user.oauthProvider = 'naver';
                user.oauthId = profile.id;
                user.profileImage = profile._json.profile_image;
                user.isFirstLogin = true;  // ✅ 수정
                await user.save();
                return done(null, user);
            }

            console.log('🆕 새 Naver 사용자 생성');
            user = await User.create({
                username: profile.displayName,
                email: profile.emails[0].value,
                oauthProvider: 'naver',
                oauthId: profile.id,
                profileImage: profile._json.profile_image,
                password: null,
                isFirstLogin: true
            });
            console.log('✅ 사용자 생성 완료:', user.username);
            done(null, user);
        } catch (error) {
            console.error('❌ Naver OAuth 에러:', error);
            done(error, null);
        }
    }        
    ));
} else {
    console.warn('⚠️ Naver OAuth 환경변수 누락');
}


console.log('🔧 Passport 설정 완료');
console.log('등록된 Strategies:', passport._strategies ? Object.keys(passport._strategies) : 'none');

module.exports = passport;