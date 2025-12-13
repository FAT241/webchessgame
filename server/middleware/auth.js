const jwt = require('jsonwebtoken');
require('dotenv').config();

module.exports = function(req, res, next) {
    const token = req.header('x-auth-token');

    console.log("------------------------------------------------");
    console.log(`[REQUEST] URL: ${req.originalUrl}`);
    console.log("[HEADERS NHẬN ĐƯỢC]:", JSON.stringify(req.headers, null, 2));
    console.log("------------------------------------------------");
    console.log(`[AUTH CHECK] Đang kiểm tra request tới: ${req.originalUrl}`);
    console.log(`[AUTH CHECK] Token nhận được:`, token ? token.substring(0, 15) + "..." : "KHÔNG CÓ TOKEN");

    if (!token) {
        console.log("[AUTH ERROR] Từ chối: Không tìm thấy token.");
        return res.status(401).json({ msg: 'Không có token, từ chối truy cập' });
    }
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || "secret");
        req.user = decoded.user;

        console.log("[AUTH SUCCESS] User ID:", req.user.id, "| Role:", req.user.role);
        next();
    } catch (err) {
        console.log("[AUTH ERROR] Giải mã thất bại:", err.message);
        res.status(401).json({ msg: 'Token không hợp lệ' });
    }
};