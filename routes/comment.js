const express = require("express")
const router = express.Router();
const Comment = require('../models/Comment');
const Poll = require('../models/Poll');
const { isAuthenticatedAPI } = require('../middleware/auth');

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

        if (req.session && req.session.userId) {
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

        // 투표의 댓글 카운트 증가
        await Poll.findByIdAndUpdate(pollId, {
            $inc: { commentCount: 1 }
        });

        console.log(`💬 새 댓글 작성 - Poll: ${pollId}, Author: ${author.displayName}`);

        res.json({
            success: true,
            comment: {
                _id: comment._id,
                author: comment.author,
                content: comment.content,
                createdAt: comment.createdAt
            }
        });
    } catch (error) {
        console.error('❌ 댓글 작성 오류:', error);
        res.status(500).json({
            success: true,
            message: '댓글 작성에 실패했습니다.'
        });
    }
});

// 댓글 목록 조회
router.get('/polls/:pollId/comments', async (req, res) => {
    try {
        const { pollId } = req.params;
        const page = parseInt(req.query.page) || 1;
        const limit = 20;
        const skip = (page - 1) * limit;

        // 삭제되지 않은 댓글만 조회
        const comments = await Comment.find({
            pollId,
            isDeleted: false
        })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean();

        const totalComments = await Comment.countDocuments({
            pollId,
            isDeleted: false
        });

        // 현재 사용자가 작성자인지 확인
        const poll = await Poll.findById(pollId);
        const isPollCreator = req.isAuthenticated() && poll.createdBy.toString() === req.user._id.toString();

        res.json({
            success: true,
            comments,
            pagination: {
                currentPage: page,
                totalPages: Math.ceil(totalComments / limit),
                totalComments,
                hasMore: skip + comments.length < totalComments
            },
            isPollCreator
        });
    } catch (error) {

    console.error('❌ 댓글 조회 오류:', error);
    res.status(500).json({ 
      success: false, 
      message: '댓글을 불러오는데 실패했습니다.' 
        });
    }
});

// 댓글 삭제(작성자 또는 투표 생성자)
router.delete('/polls/:pollId/comments/:commentId', isAuthenticatedAPI, async (req, res) => {
    try {
        const { pollId, commentId } = req.params;
        const userId = req.user._id;

        // 댓글 조회
        const omment = await Comment.findById(commentId);
        if (!comment) {
            return res.status(404).json({
                success: false,
                message: '댓글을 찾을 수 없습니다.'
            });
        }

        // 투표 조회
        const poll = await Poll.findById(pollId);
        if (!poll) {
            return res.status(404).json({
                success: false,
                message: '투표를 찾을 수 없습니다.'
            });
        }

        // 권한 확인: 댓글 작성자 또는 투표 생성자
        const isCommentAuthor = comment.author.userId && comment.author.userId.toString() === userId.toString();
        const isPollCreator = poll.createdBy.toString() === userId.toString();

        if (!isCommentAuthor && !isPollCreator) {
            return res.status(403).json({
                success: false,
                message: '댓글을 삭제할 권한이 없습니다'
            })
        };

        // 소프트 삭제
        comment.isDeleted = true;
        comment.deleteAt = new Date();
        comment.deleteBy = userId;
        await comment.save();

        // 투표의 댓글 카운트 감소
        await Poll.findByIdAndUpdate(pollId, {
            $inc: { commentCount: -1 }
        });

        console.log(`🗑️ 댓글 삭제 - Comment: ${commentId}, DeletedBy: ${req.user.email}`);

        res.json({
            success: true,
            message: '댓글이 삭제되었습니다'
        });
    } catch (error) {
        console.error('❌ 댓글 삭제 오류:', error);
        res.status(500).json({
            success: false,
            message: '댓글 삭제에 실패했습니다'
        });
    }
});

// 댓글 수정(본인만 가능)
router.put('/polls/:pollId/comments/:commentId', isAuthenticatedAPI, async (req, res) => {
    try {
        const { commentId } = req.params;
        const { content } = req.body;
        const userId = req.user._id;
    
        // 입력 검증
        if (!content || content.trim().length === 0) {
            return res.status(400).json({
                success: false,
                message: '댓글 내용을 입력해주세요'
            });
        }

        if (content.length > 1000) {
            return res.status(400).json({
                success: false,
                message: '댓글을 1000자 이상 초과할 수 없습니다'
            });
        }

        // 댓글 조회
        const comment = await Comment.findById(commentId);
        if (!comment) {
            return res.status(404).json({
                success: false,
                message: '댓글을 찾을 수 없습니다'
            });
        }

        // 권한 확인: 본인만 수정 가능
        if (!comment.author.userId || comment.author.userId.toString() !== userId.toString()) {
            return res.status(403).json({
                success: false,
                message: '본인의 댓글만 수정할 수 있습니다'
            });
        }

        // 댓글 수정
        comment.content = content.trim();
        comment.updatedAt = new Date();
        await comment.save();

        console.log(`✏️ 댓글 수정 - Comment: ${commentId}`);

        res.json({
            success: true,
            comment: {
                _id: comment._id,
                content: comment.content,
                updatedAt: comment.updatedAt 
            }
        });
    } catch (error) {
        console.error('❌ 댓글 수정 오류:', error);
        res.status(500).json({
            success: false,
            message: '댓글 수정에 실패했습니다'
        });
    }
});

module.exports = router;