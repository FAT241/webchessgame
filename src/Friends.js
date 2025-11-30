import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { FaUserPlus, FaUserCheck, FaUserTimes, FaTrash, FaCircle } from 'react-icons/fa';
import { toast } from 'react-toastify'; // <--- IMPORT TOAST

const Friends = () => {
    const [friends, setFriends] = useState([]);
    const [requests, setRequests] = useState([]);
    const [searchName, setSearchName] = useState('');
    const [loading, setLoading] = useState(false);
    const getToken = () => localStorage.getItem('token');

    const fetchData = useCallback(async () => {
        const token = getToken();
        if (!token) return;
        setLoading(true);
        try {
            const res = await axios.get('http://localhost:3001/api/user/friends', { headers: { 'x-auth-token': token } });
            setFriends(res.data.friends);
            setRequests(res.data.requests);
        } catch (err) { console.error(err); }
        setLoading(false);
    }, []);

    useEffect(() => { fetchData(); }, [fetchData]);

    const sendRequest = async () => {
        if (!searchName) return;
        try {
            await axios.post('http://localhost:3001/api/user/friend-request', { targetUsername: searchName }, { headers: { 'x-auth-token': getToken() } });
            toast.success(`✅ Đã gửi lời mời tới ${searchName}`, { theme: "dark" });
            setSearchName('');
        } catch (err) { toast.error(err.response?.data?.msg || "Lỗi", { theme: "dark" }); }
    };

    const respondRequest = async (senderUsername, action) => {
        try {
            await axios.post('http://localhost:3001/api/user/friend-respond', { senderUsername, action }, { headers: { 'x-auth-token': getToken() } });
            toast.info(action === 'accept' ? "Đã chấp nhận" : "Đã từ chối", { theme: "dark" });
            fetchData();
        } catch (err) { toast.error("Lỗi xử lý", { theme: "dark" }); }
    };

    const removeFriend = async (friendUsername) => {
        if (!window.confirm(`Xóa ${friendUsername}?`)) return;
        try {
            await axios.post('http://localhost:3001/api/user/friend-remove', { friendUsername }, { headers: { 'x-auth-token': getToken() } });
            toast.warn("Đã hủy kết bạn", { theme: "dark" });
            fetchData();
        } catch (err) { toast.error("Lỗi", { theme: "dark" }); }
    };

    return (
        <div className="friends-view">
            <h2 style={{color:'var(--neon-green)', borderBottom:'1px solid #444', paddingBottom:10}}>🤝 BẠN BÈ</h2>
            <div className="friends-container">
                <div className="friends-list-box">
                    <h4 style={{color:'#ccc'}}>Danh Sách ({friends.length})</h4>
                    {loading ? <p style={{color:'#888'}}>Đang tải...</p> : friends.map(f => (
                        <div key={f._id} className="friend-item">
                            <div className="friend-name"><FaCircle color={f.isBanned ? 'red' : 'lime'} size={10} /> {f.username} <span style={{fontSize:12, color:'#888'}}>({f.elo} Elo)</span></div>
                            <div className="friend-actions"><button className="btn-icon danger" onClick={() => removeFriend(f.username)} title="Xóa bạn"><FaTrash /></button></div>
                        </div>
                    ))}
                    {friends.length === 0 && !loading && <p style={{color:'#666', fontStyle:'italic'}}>Chưa có bạn bè.</p>}
                </div>
                <div className="friend-add-box">
                    <div>
                        <h4 style={{color:'#ccc'}}>Thêm Bạn Mới</h4>
                        <div style={{display:'flex', gap:10}}><input className="input-dark" style={{marginBottom:0}} placeholder="Nhập tên..." value={searchName} onChange={e=>setSearchName(e.target.value)} /><button className="btn-primary" style={{width:'auto', padding:'0 15px'}} onClick={sendRequest}><FaUserPlus /></button></div>
                    </div>
                    {requests.length > 0 && (
                        <div style={{marginTop: 20}}>
                            <h4 style={{color:'var(--neon-yellow)'}}>Lời Mời ({requests.length})</h4>
                            {requests.map((req, idx) => (
                                <div key={idx} className="req-item">
                                    <div style={{fontWeight:'bold', marginBottom:5, color:'white'}}>{req}</div>
                                    <div style={{display:'flex', gap:10}}><button className="btn-primary" onClick={() => respondRequest(req, 'accept')} style={{background:'var(--neon-green)', color:'black', fontSize:12}}>Đồng ý</button><button className="btn-primary" onClick={() => respondRequest(req, 'reject')} style={{background:'var(--neon-pink)', color:'white', fontSize:12}}>Xóa</button></div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
export default Friends;