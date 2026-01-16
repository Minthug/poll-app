require('dotenv').config();

const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
    host: 'stmp.gmail.com',
    port: 587,
    secure: false,
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD
    }
});

const mailOptions = {
    from: process.env.EMAIL_USER,
    to: process.env.EMAIL_USER,  // 자기 자신에게 테스트
    subject: '테스트 메일',
    text: '이메일 설정이 제대로 되었습니다!'
};

transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
        console.log('❌ 실패:', error);
    } else {
        console.log('✅ 성공:', info.response);
    }
});