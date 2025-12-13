const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const admin = require('../middleware/admin');
const User = require('../models/User');
const Report = require('../models/Report');

// 1. Lấy danh sách user
router.get('/users', auth, admin, async (req, res) => {
    try {
        const users = await User.find({role: {$ne: 'admin'}}).select('-password').sort({createdAt: -1});
        res.json(users);
    } catch (err) {
        res.status(500).send('Server Error');
    }
});

// 2. Khóa / Mở khóa
router.put('/ban/:id', auth, admin, async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user) return res.status(404).json({msg: 'User not found'});
        user.isBanned = !user.isBanned;
        await user.save();
        res.json({msg: user.isBanned ? 'Đã khóa' : 'Đã mở khóa', isBanned: user.isBanned});
    } catch (err) {
        res.status(500).send('Server Error');
    }
});

// 3. Lấy danh sách tố cáo
router.get('/reports', auth, admin, async (req, res) => {
    try {
        const reports = await Report.find().sort({createdAt: -1});
        res.json(reports);
    } catch (err) {
        res.status(500).send('Server Error');
    }
});

// 4. Xử lý tố cáo (Đánh dấu đã xong)
router.put('/report/resolve/:id', auth, admin, async (req, res) => {
    try {
        const report = await Report.findById(req.params.id);
        if (!report) return res.status(404).json({msg: 'Report not found'});

        report.status = 'resolved';
        await report.save();
        res.json(report);
    } catch (err) {
        res.status(500).send('Server Error');
    }
});

// 5. XÓA ĐƠN TỐ CÁO (Đây là đoạn bạn đang thiếu)
router.delete('/report/:id', auth, admin, async (req, res) => {
    try {
        await Report.findByIdAndDelete(req.params.id);
        res.json({msg: 'Đã xóa đơn tố cáo'});
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});

module.exports = router;