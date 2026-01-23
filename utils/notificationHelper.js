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
}