const express = require("express")
const router = express.Router();
const comment = require('../models/Comment');
const poll = require('../models/Poll');
const { isAuthenticated } = require('../middleware/auth');

// 댓글 작성
router.post('/polls/:pollId/comments', async (req, res) => {
    try {
        const { pollId } = req.params;
        const { content, isAnonymous } = req.body;

        // 입력 검증
        if (!content || content.trim().length === 0) {
            return res.status(400).json({
                success: false,
                message: '댓글 내용을 입력해주세요.'
            });
        }

        if (content.length > 1000) {
            return res.status(400).json({
                success: false,
                message: '댓글은 1000자를 초과할 수 없습니다.'
            });
        }

        // 투표 존재 확인
        const poll = await Poll.findById(pollId);
        if (!poll) {
            return res.status(404).json({
                success: false,
                message: '투표를 찾을 수 없습니다.'
            });
        }

        // 댓글 작성자 정보 설정
        let author = {
            displayName: '익명',
            isAnonymous: true,
            isPollCreator: false
        };

        if (res.isAuthenticated()) {
            const user = req.user;

            if (isAnonymous === 'true' || isAnonymous === true) {
                // 로그인 상태지만 익명으로 작성
                author = {
                    userId: user._id,
                    displayName: '익명',
                    isAnonymous: true,
                    isPollCreator: poll.createdBy.toString() === user._id.toString()
                };
            } else {
                // 닉네임으로 작성
                author = {
                    userId: user._id,
                    displayName: user.displayName || user.email.split('@')[0],
                    isAnonymous: false,
                    isPollCreator: poll.createdBy.toString() === user._id.toString()
                };
            }
        }

        // 댓글 생성
        const comment = new Comment({
            pollId,
            author,
            content: content.trim(),
            ipAddress: req.ip
        });

        await comment.save();

    }
});