const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const auth = require('../middleware/auth');
const User = require('../models/User');
const Report = require('../models/Report');
const Match = require('../models/Match');

router.put('/profile', auth, async (req, res) => {
    const {avatar, currentPassword, newPassword} = req.body;
    try {
        const user = await User.findById(req.user.id);
        if (newPassword) {
            const isMatch = await bcrypt.compare(currentPassword, user.password);
            if (!isMatch) return res.status(400).json({msg: 'Mật khẩu cũ không đúng'});
            if (newPassword.length < 6) return res.status(400).json({msg: 'Mật khẩu mới quá ngắn'});

            const salt = await bcrypt.genSalt(10);
            user.password = await bcrypt.hash(newPassword, salt);
        }
        if (avatar) user.avatar = avatar;
        await user.save();
        res.json({msg: 'Cập nhật thành công!', user});
    } catch (err) {
        res.status(500).send('Lỗi Server');
    }
});

router.post('/report', auth, async (req, res) => {
    try {
        const {reportedUser, reason, description, matchId} = req.body;
        if (reportedUser === req.user.username) return res.status(400).json({msg: 'Không thể tự tố cáo'});

        const newReport = new Report({
            reporter: req.user.username, reportedUser, reason, description, matchId
        });
        await newReport.save();
        res.json({msg: 'Đã gửi tố cáo'});
    } catch (err) {
        res.status(500).send('Lỗi Server');
    }
});

router.delete('/history/:id', auth, async (req, res) => {
    try {
        const match = await Match.findById(req.params.id);
        if (!match) return res.status(404).json({msg: 'Không tìm thấy trận đấu'});
        if (match.whitePlayer !== req.user.username && match.blackPlayer !== req.user.username) {
            return res.status(403).json({msg: 'Bạn không có quyền xóa'});
        }
        await Match.findByIdAndDelete(req.params.id);
        res.json({msg: 'Đã xóa trận đấu'});
    } catch (err) {
        res.status(500).send('Lỗi Server');
    }
});

router.post('/friend-request', auth, async (req, res) => {
    try {
        const {targetUsername} = req.body;
        const me = await User.findById(req.user.id);
        const target = await User.findOne({username: targetUsername});

        if (!target) return res.status(404).json({msg: 'Người chơi không tồn tại'});
        if (targetUsername === me.username) return res.status(400).json({msg: 'Không thể kết bạn với chính mình'});
        if (me.friends.includes(targetUsername)) return res.status(400).json({msg: 'Đã là bạn bè rồi'});
        if (target.friendRequests.includes(me.username)) return res.status(400).json({msg: 'Đã gửi lời mời rồi'});

        target.friendRequests.push(me.username);
        await target.save();

        res.json({msg: 'Đã gửi lời mời kết bạn'});
    } catch (err) {
        res.status(500).send('Lỗi Server');
    }
});

router.post('/friend-respond', auth, async (req, res) => {
    try {
        const {senderUsername, action} = req.body; // action: 'accept' hoặc 'reject'
        const me = await User.findById(req.user.id);
        const sender = await User.findOne({username: senderUsername});

        me.friendRequests = me.friendRequests.filter(name => name !== senderUsername);

        if (action === 'accept' && sender) {
            if (!me.friends.includes(senderUsername)) me.friends.push(senderUsername);
            if (!sender.friends.includes(me.username)) sender.friends.push(me.username);
            await sender.save();
        }

        await me.save();
        res.json({msg: action === 'accept' ? 'Đã chấp nhận kết bạn' : 'Đã từ chối', friends: me.friends});
    } catch (err) {
        res.status(500).send('Lỗi Server');
    }
});

router.get('/friends', auth, async (req, res) => {
    try {
        const me = await User.findById(req.user.id);
        const friendsData = await User.find({username: {$in: me.friends}})
            .select('username elo avatar isBanned');

        res.json({
            friends: friendsData,
            requests: me.friendRequests
        });
    } catch (err) {
        res.status(500).send('Lỗi Server');
    }
});

router.post('/friend-remove', auth, async (req, res) => {
    try {
        const {friendUsername} = req.body;
        const me = await User.findById(req.user.id);
        const friend = await User.findOne({username: friendUsername});

        me.friends = me.friends.filter(name => name !== friendUsername);
        if (friend) {
            friend.friends = friend.friends.filter(name => name !== me.username);
            await friend.save();
        }
        await me.save();
        res.json({msg: 'Đã hủy kết bạn'});
    } catch (err) {
        res.status(500).send('Lỗi Server');
    }
});

module.exports = router;