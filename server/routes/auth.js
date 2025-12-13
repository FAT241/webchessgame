const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const auth = require('../middleware/auth');
const User = require('../models/User');

router.get('/', auth, async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select('-password');
        res.json(user);
    } catch (err) {
        res.status(500).send('Server Error');
    }
});

router.post('/register', async (req, res) => {
    try {
        const {username, password} = req.body;

        if (!username || !password) return res.status(400).json({msg: 'Vui lòng nhập đủ thông tin'});
        if (username.length < 3) return res.status(400).json({msg: 'Tên đăng nhập quá ngắn (tối thiểu 3 ký tự)'});
        if (password.length < 6) return res.status(400).json({msg: 'Mật khẩu quá ngắn (tối thiểu 6 ký tự)'});
        //

        let user = await User.findOne({username});
        if (user) return res.status(400).json({msg: 'Tài khoản đã tồn tại'});

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        user = new User({username, password: hashedPassword});
        await user.save();

        const payload = {user: {id: user.id, username: user.username, elo: user.elo, role: user.role}};
        jwt.sign(payload, process.env.JWT_SECRET || "secret", {expiresIn: '1d'},
            (err, token) => {
                if (err) throw err;
                res.status(201).json({token, user: payload.user});
            }
        );
    } catch (err) {
        res.status(500).send('Server Error');
    }
});

router.post('/login', async (req, res) => {
    try {
        const {username, password} = req.body;
        let user = await User.findOne({username});
        if (!user) return res.status(400).json({msg: 'Sai tài khoản hoặc mật khẩu'});
        if (user.isBanned) return res.status(403).json({msg: 'Tài khoản đã bị KHÓA'});

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(400).json({msg: 'Sai tài khoản hoặc mật khẩu'});

        const payload = {user: {id: user.id, username: user.username, elo: user.elo, role: user.role}};
        jwt.sign(payload, process.env.JWT_SECRET || "secret", {expiresIn: '1d'},
            (err, token) => {
                if (err) throw err;
                res.json({token, user: payload.user});
            }
        );
    } catch (err) {
        res.status(500).send('Server Error');
    }
});

module.exports = router;