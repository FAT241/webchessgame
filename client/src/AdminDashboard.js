import React, {useState, useEffect, useCallback} from 'react';
import axios from 'axios';
import './Admin.css';

const AdminDashboard = ({user, onLogout}) => {
    const [tab, setTab] = useState('users');
    const [users, setUsers] = useState([]);
    const [reports, setReports] = useState([]);
    const [loading, setLoading] = useState(false);
    const [selectedUser, setSelectedUser] = useState(null);

    const getToken = () => localStorage.getItem('token');

    const fetchUsers = useCallback(async () => {
        setLoading(true);
        try {
            const res = await axios.get('http://localhost:3001/api/admin/users', {headers: {'x-auth-token': getToken()}});
            setUsers(res.data);
        } catch (err) {
            if (err.response?.status === 401) onLogout();
        }
        setLoading(false);
    }, [onLogout]);

    const fetchReports = useCallback(async () => {
        setLoading(true);
        try {
            const res = await axios.get('http://localhost:3001/api/admin/reports', {headers: {'x-auth-token': getToken()}});
            setReports(res.data);
        } catch (err) {
            alert("Lỗi tải báo cáo");
        }
        setLoading(false);
    }, []);

    useEffect(() => {
        if (tab === 'users') fetchUsers();
        else fetchReports();
    }, [tab, fetchUsers, fetchReports]);

    const toggleBan = async (id) => {
        if (!window.confirm("Xác nhận đổi trạng thái khóa?")) return;
        try {
            await axios.put(`http://localhost:3001/api/admin/ban/${id}`, {}, {headers: {'x-auth-token': getToken()}});
            fetchUsers();
        } catch (err) {
            alert("Lỗi");
        }
    };

    const resolveReport = async (id) => {
        try {
            await axios.put(`http://localhost:3001/api/admin/report/resolve/${id}`, {}, {headers: {'x-auth-token': getToken()}});
            fetchReports();
        } catch (err) {
            alert("Lỗi");
        }
    };

    const deleteReport = async (id) => {
        if (!window.confirm("Bạn có chắc muốn xóa vĩnh viễn?")) return;
        try {
            await axios.delete(`http://localhost:3001/api/admin/report/${id}`, {headers: {'x-auth-token': getToken()}});
            fetchReports();
        } catch (err) {
            alert("Lỗi xóa đơn: " + (err.response?.statusText || "Server Error"));
        }
    };

    const calculateWinRate = (wins, total) => (!total ? 0 : ((wins / total) * 100).toFixed(1));

    // Style cho nút Tab để không bị chìm
    const getTabStyle = (isActive, color = '#00f3ff') => ({
        padding: '10px 20px',
        marginRight: 15,
        backgroundColor: isActive ? color : 'transparent',
        color: isActive ? '#000' : color,
        border: `1px solid ${color}`,
        borderRadius: '4px',
        cursor: 'pointer',
        fontWeight: 'bold',
        transition: 'all 0.3s',
        fontSize: '14px'
    });

    return (
        <div className="admin-container">
            <div className="admin-header">
                <h2>🛡️ QUẢN TRỊ HỆ THỐNG</h2>
                <div style={{display: 'flex', gap: 20, alignItems: 'center'}}>
                    <span>Admin: <strong>{user.username}</strong></span>
                    <button className="btn-logout" onClick={onLogout}>Đăng Xuất</button>
                </div>
            </div>

            <div className="admin-content">
                {/* --- ĐÃ SỬA PHẦN NÀY: Dùng style getTabStyle để nổi bật --- */}
                <div style={{marginBottom: 20, display: 'flex'}}>
                    <button
                        style={getTabStyle(tab === 'users', '#00f3ff')}
                        onClick={() => setTab('users')}
                    >
                        👥 QUẢN LÝ NGƯỜI DÙNG
                    </button>
                    <button
                        style={getTabStyle(tab === 'reports', '#ff0055')} // Màu đỏ cho báo cáo
                        onClick={() => setTab('reports')}
                    >
                        🚨 ĐƠN TỐ CÁO
                    </button>
                </div>
                {/* -------------------------------------------------------- */}

                {loading ? <p style={{textAlign: 'center', color: '#888'}}>⏳ Đang tải dữ liệu...</p> : (
                    <>
                        {tab === 'users' ? (
                            <table className="admin-table">
                                <thead>
                                <tr>
                                    <th>User</th>
                                    <th>Elo</th>
                                    <th>Trận</th>
                                    <th>Trạng thái</th>
                                    <th>Hành động</th>
                                </tr>
                                </thead>
                                <tbody>
                                {users.map(u => (
                                    <tr key={u._id} className={u.isBanned ? 'row-banned' : ''}>
                                        <td>{u.username}</td>
                                        <td style={{color: '#f1b000'}}>{u.elo}</td>
                                        <td>{u.gamesPlayed}</td>
                                        <td>{u.isBanned ? <span className="badge badge-banned">ĐÃ KHÓA</span> :
                                            <span className="badge badge-active">Hoạt động</span>}</td>
                                        <td>
                                            <button className="btn-view" onClick={() => setSelectedUser(u)} title="Xem chi tiết">👁️</button>
                                            <button className={u.isBanned ? "btn-unban" : "btn-ban"}
                                                    onClick={() => toggleBan(u._id)}>{u.isBanned ? "Mở Khóa" : "Khóa Nick"}</button>
                                        </td>
                                    </tr>
                                ))}
                                </tbody>
                            </table>
                        ) : (
                            <table className="admin-table">
                                <thead>
                                <tr>
                                    <th>Người tố</th>
                                    <th>Bị tố cáo</th>
                                    <th>Lý do</th>
                                    <th>Trạng thái</th>
                                    <th>Xử lý</th>
                                </tr>
                                </thead>
                                <tbody>
                                {reports.length === 0 ?
                                    <tr>
                                        <td colSpan="5" style={{textAlign: 'center', padding: 20, color: '#888'}}>
                                            ✅ Không có đơn tố cáo nào.
                                        </td>
                                    </tr> :
                                    reports.map(r => (
                                        <tr key={r._id} style={{opacity: r.status === 'resolved' ? 0.5 : 1}}>
                                            <td>{r.reporter}</td>
                                            <td style={{color: '#ff4444', fontWeight: 'bold'}}>{r.reportedUser}</td>
                                            <td>{r.reason} <br/><small style={{color:'#aaa'}}>{r.description}</small></td>
                                            <td>{r.status === 'pending' ?
                                                <span className="badge badge-banned" style={{background:'#ff9800', color:'black'}}>Chờ xử lý</span> :
                                                <span className="badge badge-active">Đã xong</span>}</td>
                                            <td>
                                                {r.status === 'pending' && <button className="btn-view"
                                                                                   onClick={() => resolveReport(r._id)} title="Đánh dấu đã xong">✅</button>}
                                                <button className="btn-ban" style={{background: '#444', marginLeft: 5}}
                                                        onClick={() => deleteReport(r._id)} title="Xóa đơn">🗑️
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </>
                )}
            </div>

            {selectedUser && (
                <div className="modal-overlay" onClick={() => setSelectedUser(null)}>
                    <div className="modal-content admin-modal" onClick={(e) => e.stopPropagation()}>
                        <h3>Hồ Sơ: <span style={{color: '#81b64c'}}>{selectedUser.username}</span></h3>
                        <div className="stats-row">
                            <div className="stat-box"><h4>Elo</h4>
                                <div className="stat-value" style={{color: '#f1b000'}}>{selectedUser.elo}</div>
                            </div>
                            <div className="stat-box"><h4>Tổng Trận</h4>
                                <div className="stat-value">{selectedUser.gamesPlayed}</div>
                            </div>
                            <div className="stat-box"><h4>Tỉ Lệ Thắng</h4>
                                <div className="stat-value"
                                     style={{color: '#81b64c'}}>{calculateWinRate(selectedUser.wins, selectedUser.gamesPlayed)}%
                                </div>
                            </div>
                        </div>
                        <div className="detail-list">
                            <p>🟢 Thắng: {selectedUser.wins} | 🔴 Thua: {selectedUser.losses} | ⚪
                                Hòa: {selectedUser.draws}</p>
                            <p>📅 Ngày tạo: {new Date(selectedUser.createdAt).toLocaleDateString()}</p>
                        </div>
                        <div style={{marginTop: 20, textAlign: 'right'}}>
                            <button className="btn-close" onClick={() => setSelectedUser(null)}>Đóng</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
export default AdminDashboard;