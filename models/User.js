const mongoose = require('mongoose')
const bcrypt = require('bcrypt')

const userSchema = new mongoose.Schema({
    username: {
        type: String,
        required: true,
        unique: true,
        minlength: 2,
        maxlength: 20
    },
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true
    },
    password: {
    type: String,
    required: true,
    minlength: 6
  },
  
  // 인증 레벨
  verificationLevel: {
    type: String,
    enum: ['registered', 'phone-verified', 'identity-verified'],
    default: 'registered'
  },
  
  phoneNumber: String,
  phoneVerified: { type: Boolean, default: false },
  identityVerified: { type: Boolean, default: false },
  
  createdAt: { type: Date, default: Date.now }
});