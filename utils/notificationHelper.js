const Notification = require('../models/Notification');
const User = require('../models/User');
const user = require('../models/User');
const nodemailer = require('nodemailer');

class NotificationHelper {
    static async createNotification({
        recipientId,
        senderId,
        type,
        pollId,
        commentId,
        message,
        link
    }) {
        try {
            // 수신자의 알림 설정 확인
            const recipient = await User.findById(recipientId);
            if (!recipient || !recipient.notificationSettings.enabled) {
                return null;
            }

            const settingMap = {
                'comment': 'comments',
                'reply': 'replies',
                'vote': 'votes',
                'poll_end': 'pollEnd'
            };

            const settingKey = settingMap[type];
            if (settingKey && !recipient.notificationSettings[settingKey]) {
                return null;
            }

            // 자기 자신에게 알림 보내지않기
            if (senderId && recipientId.toString() === senderId.toString()) {
                return null;
            }

            const notification = await Notification.create({
                recipient: recipientId,
                sender: senderId,
                type,
                poll: pollId,
                comment: commentId,
                message,
                link
            });

            if (recipient.notificationSettings.email.enabled) {
                const emailSettingMap = {
                    'comment': 'comments',
                    'reply': 'replies'
                };

                const emailSettingKey = emailSettingMap[type];
                if (emailSettingKey && recipient.notificationSettings.email[emailSettingKey]) {
                    await this.sendEmailNotification(recipient.email, notification);
                }
            }

            return notification;
        } catch (error) {
            console.error('알림 생성 오류:', error);
            return null;
        }
    }

    static async notifyComment(poll, comment, commenter) {
        const message = `"${poll.question.substring(0, 30)}..." 투표에 새 댓글이 달렸습니다.`;
        const link = `/poll/${poll._id}#comment-${comment._id}`;

        return await this.createNotification({
            recipientId: poll.creator,
            senderId: commenter._id,
            type: 'comment',
            pollId: poll._id,
            commentId: comment._id,
            message,
            link
        });
    }

    // 대댓글 알림
    static async notifyReply(poll, comment, parentComment, replier) {
        const message = `회원님의 댓글에 답글이 달렸습니다.`;
        const link = `/poll/${poll._id}#comment-${comment._id}`;
    
        return await this.createNotification({
            recipientId: parentComment.author,
            senderId: replier._id,
            type: 'reply',
            pollId: poll._id,
            commentId: comment._id,
            message,
            link
        });
    }

    // 투표 종료 알림
    static async notifyPollEnd(poll) {
        const message = `"${poll.question.substring(0, 30)}..." 투표가 종료되었습니다.`;
        const link = `/poll/${poll._id}`;

        return await this.createNotification({
            recipientId: poll.creator,
            senderId: null,
            type: 'poll_end',
            pollId: poll._id,
            commentId: null,
            message,
            link
        });
    }

    // 이메일 발송
    static async sendEmailNotification(email, notification) {
        try {
            const transporter = nodemailer.createTransport({
                service: 'gmail',
                auth: {
                    user: process.env.EMAIL_USER,
                    pass: process.env.EMAIL_PASS
                }
            });

            const mailOptions = {
                from: process.env.EMAIL_USER,
                to: email,
                subject: '[투표 앱] 새 알림이 있습니다',
                html: `
                    <h2>새 알림</h2>  
                    <p>${notification.message}</p>
                    <a href="${process.env.BASE_URL}${notification.link}">바로가기</a>
                    `
            };
            await transporter.sendMail(mailOptions);
        } catch (error) {
            console.error('이메일 발송 오류:', error);
        }
    }


    // 읽지 않은 알림 개수
    static async getUnreadCount(userId) {
        return await Notification.countDocuments({
            recipient: userId,
            read: false
        });
    }

    // 알림 목록 조회
    static async getNotifications(userId, page = 1, limit = 20) {
        const skip = (page - 1) * limit;

        const notifications = await Notification.find({ recipient: userId })
        .populate('sender', 'username displayName')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit);

        const total = await Notification.countDocuments({ recipient: userId });

        return {
            notifications,
            total,
            pages: Math.ceil(total / limit),
            currentPage: page
        };
    }

    
}