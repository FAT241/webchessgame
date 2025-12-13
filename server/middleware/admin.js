const User = require('../models/User');

module.exports = async function(req, res, next) {
    try {
        const user = await User.findById(req.user.id);
        if (user.role !== 'admin') {
            return res.status(403).json({ msg: 'Truy cập bị từ chối. Bạn không phải Admin!' });
        }
        next();
    } catch (err) {
        res.status(500).send('Lỗi Server');
    }
};