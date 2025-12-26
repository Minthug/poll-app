const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const NaverStrategy = require('passport-naver').Strategy;
const User = require('../models/User');

// ========================================
// 세션에 사용자 정보 저장
// ========================================
passport.serializeUser((user, done) => {
    done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
    try {
        const user = await User.findById(id);
        done(null, user);
    } catch (error) {
        done(error, null);
    }
});


// ========================================
// Google OAuth 전략
// ========================================
passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: process.env.GOOGLE_CALLBACK_URL || '/auth/google/callback'
},
async (accessToken, refreshToken, profile, done) => {
    try {
        // 기존 사용자 찾기
        let user = await User.findOne({
            oauthProvider: 'google',
            oauthId: profile.id
        });

        if (user) {
            return done(null, user);
        }

        // 이메일로 기존 계정 확인
        user = await User.findOne({ email: profile.emails[0].value });

        if (user) {
            user.oauthProvider = 'google';
            user.oauthId = profile.id;
            user.profileImage = profile.photos[0]?.value;
            user.isFirstLogin = true;
            await user.save();
            return done(null, user);
        }

        // 새 사용자 생성
        user = await User.create({
            username: profile.displayName,
            email: profile.emails[0].value,
            oauthProvider: 'google',
            oauthId: profile.id,
            profileImage: profile._json.profile_image,
            password: null,
            isFirstLogin: true
        });
        done(null, user);
    } catch (error) {
        done(error, null);
    }
}
));


// ========================================
// Naver OAuth 전략
// ========================================
passport.use(new NaverStrategy({
    clientID: process.env.NAVER_CLIENT_ID,
    clientSecret: process.env.NAVER_CLIENT_SECRET,
    callbackURL: process.env.NAVER_CALLBACK_URL || '/oauth/naver/callback'
},
 async (accessToken, refreshToken, profile, done) => {
    try {
        let user = await User.findOne({
            oauthProvider: 'naver',
            oauthId: profile.id
        });

        if (user) {
            return done(null, user);
        }

        user = await User.findOne({ email: profile.emails[0].value });

        if (user) {
            user.oauthProvider = 'naver';
            user.oauthId = profile.id;
            user.profileImage = profile._json.profile_image;
            isFirstLogin: true;
            await user.save();
            return done(null, user);
        }

        user = await User.create({
            username: profile.displayName,
            email: profile.emails[0].value,
            oauthProvider: 'naver',
            oauthId: profile.id,
            profileImage: profile._json.profile_image,
            password: null,
            isFirstLogin: true
        });

        done(null, user);
    } catch (error) {
        done(error, null);
    }
 }        
));

module.exports = passport;