const mongoose = require('mongoose');

const connectDB = async () => {
    try {
        await mongoose.connect('mongodb://127.0.0.1:27017/chess_game');
        console.log('✅ Đã kết nối MongoDB thành công!');
    } catch (error) {
        console.error('❌ Lỗi kết nối MongoDB:', error.message);
        process.exit(1);
    }
};

module.exports = connectDB;