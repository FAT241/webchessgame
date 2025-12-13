import React, {useState} from 'react';
import axios from 'axios';
import './Auth.css';

const Auth = ({onLoginSuccess}) => {
    const [isRegister, setIsRegister] = useState(false);
    const [formData, setFormData] = useState({username: '', password: '', confirmPassword: ''});
    const [message, setMessage] = useState('');

    const {username, password, confirmPassword} = formData;
    const onChange = e => setFormData({...formData, [e.target.name]: e.target.value});

    const onSubmit = async e => {
        e.preventDefault();
        setMessage('');

        // Validate phía Client
        if (isRegister) {
            if (password !== confirmPassword) {
                setMessage('❌ Mật khẩu xác nhận không khớp!');
                return;
            }
            if (password.length < 6) {
                setMessage('❌ Mật khẩu phải có ít nhất 6 ký tự');
                return;
            }
        }

        const url = isRegister
            ? 'http://localhost:3001/api/auth/register'
            : 'http://localhost:3001/api/auth/login';

        try {
            const res = await axios.post(url, {username, password});
            if (isRegister) {
                setMessage('✅ Đăng ký thành công! Hãy đăng nhập.');
                setIsRegister(false);
                setFormData({username: '', password: '', confirmPassword: ''});
            } else {
                localStorage.setItem('token', res.data.token);
                onLoginSuccess(res.data.user);
            }
        } catch (err) {
            setMessage(err.response?.data?.msg || '❌ Có lỗi xảy ra');
        }
    };

    return (
        <div className="auth-container">
            <div className="auth-box">
                <h2>{isRegister ? 'ĐĂNG KÝ' : 'ĐĂNG NHẬP'}</h2>
                {message && <div className="alert-msg"
                                 style={{color: message.startsWith('✅') ? 'green' : '#ffeb3b'}}>{message}</div>}
                <form onSubmit={onSubmit}>
                    <div className="form-group">
                        <label>Tên đăng nhập</label>
                        <input type="text" name="username" value={username} onChange={onChange} required/>
                    </div>
                    <div className="form-group">
                        <label>Mật khẩu</label>
                        <input type="password" name="password" value={password} onChange={onChange} required/>
                    </div>
                    {isRegister && (
                        <div className="form-group">
                            <label>Nhập lại mật khẩu</label>
                            <input type="password" name="confirmPassword" value={confirmPassword} onChange={onChange}
                                   required placeholder="Xác nhận..."/>
                        </div>
                    )}
                    <button type="submit" className="btn-auth">{isRegister ? 'Đăng Ký' : 'Vào Chơi'}</button>
                </form>
                <p className="switch-mode">
                    <span onClick={() => {
                        setIsRegister(!isRegister);
                        setMessage('')
                    }}>
                        {isRegister ? 'Quay lại Đăng nhập' : 'Tạo tài khoản mới'}
                    </span>
                </p>
            </div>
        </div>
    );
};
export default Auth;