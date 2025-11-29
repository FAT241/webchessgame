import React, { useState } from 'react';
import axios from 'axios';
import './App.css'; // Dùng chung CSS

const Profile = ({ user, onBack, onUpdateUser }) => {
    const [avatar, setAvatar] = useState(user.avatar || '♟️');
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [message, setMessage] = useState('');

    const avatars = ['♟️', '♞', '♝', '♜', '♛', '♚', '🐶', '🐱', '🐉', '🔥'];

    const handleUpdate = async (e) => {
        e.preventDefault();
        setMessage('');
        const token = localStorage.getItem('token');
        try {
            const res = await axios.put('http://localhost:3001/api/user/profile',
                { avatar, currentPassword, newPassword },
                { headers: { 'x-auth-token': token } }
            );
            setMessage('✅ ' + res.data.msg);
            onUpdateUser(res.data.user); // Cập nhật lại state user ở App.js
            setCurrentPassword(''); setNewPassword('');
        } catch (err) {
            setMessage('❌ ' + (err.response?.data?.msg || 'Lỗi cập nhật'));
        }
    };

    return (
        <div className="dashboard-container" style={{justifyContent:'center', alignItems:'center', padding: 40}}>
            <div className="play-card" style={{width: 400, border:'2px solid #444'}}>
                <h2 style={{color:'#f1b000'}}>HỒ SƠ CÁ NHÂN</h2>
                <div style={{fontSize:60, marginBottom:20}}>{avatar}</div>

                <div style={{display:'flex', gap:10, justifyContent:'center', marginBottom:20}}>
                    {avatars.map(a => (
                        <span key={a} style={{cursor:'pointer', fontSize:24, border: avatar===a?'2px solid #81b64c':'none', borderRadius:5}} onClick={() => setAvatar(a)}>{a}</span>
                    ))}
                </div>

                <form onSubmit={handleUpdate} style={{textAlign:'left'}}>
                    <p style={{marginBottom:5}}>Đổi mật khẩu (Bỏ trống nếu không đổi):</p>
                    <input className="input-field" type="password" placeholder="Mật khẩu hiện tại (Bắt buộc)" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} style={{marginBottom:10}} />
                    <input className="input-field" type="password" placeholder="Mật khẩu mới (>= 6 ký tự)" value={newPassword} onChange={e => setNewPassword(e.target.value)} style={{marginBottom:20}} />

                    {message && <p style={{textAlign:'center', fontWeight:'bold'}}>{message}</p>}

                    <button className="btn-primary" type="submit">Lưu Thay Đổi</button>
                    <button className="btn-reset" type="button" onClick={onBack} style={{width:'100%', textAlign:'center', marginTop:10}}>Quay Lại</button>
                </form>
            </div>
        </div>
    );
};

export default Profile;