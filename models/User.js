const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const userSchema = new mongoose.Schema({
  username: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String },
  
  // OAuth 관련
  oauthProvider: { type: String, enum: ['local', 'google', 'naver'], default: 'local' },
  oauthId: String,
  profileImage: String,
  
  // ✅ 이메일 인증 추가
  emailVerified: { type: Boolean, default: false },
  emailVerificationToken: String,
  emailVerificationExpires: Date,
  
  // 인증 레벨
  verificationLevel: {
    type: String,
    enum: ['email', 'email_verified', 'oauth', 'phone_verified', 'identity_verified'],
    default: 'email'
  },
  
  // 추가 정보 (선택)
  phoneNumber: String,
  phoneVerified: { type: Boolean, default: false },
  birthYear: Number,
  gender: { type: String, enum: ['male', 'female'] },
  region: String,
  
  isFirstLogin: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },

  notificationSettings: {
    enabled: {
        type: Boolean,
        default: true
    },
    comments: {
        type: Boolean,
        default: true
    },
    replies: {
        type: Boolean,
        default: true
    },
    votes: {
        type: Boolean,
        default: true
    },
    pollend: {
        type: Boolean,
        default: true
    },
    email: {
        enabled: {
            type: Boolean,
            default: false
        },
        comments: {
            type: Boolean,
            default: false
        }
    }
  }
});

// 비밀번호 해싱
userSchema.pre('save', async function(next) {
  if (!this.isModified('password') || !this.password) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

// 비밀번호 비교
userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', userSchema);