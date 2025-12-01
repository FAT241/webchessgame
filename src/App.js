import React, {useState, useEffect, useRef} from "react";
import axios from "axios";
import {Chess} from "chess.js";
import {Chessboard} from "react-chessboard";
import io from "socket.io-client";
import {
    FaChessPawn,
    FaTrophy,
    FaSignOutAlt,
    FaGamepad,
    FaSearch,
    FaPlus,
    FaUserAlt,
    FaHistory,
    FaFlag,
    FaHandshake,
    FaCog,
    FaExclamationTriangle,
    FaTrash,
    FaRobot,
    FaUserFriends,
    FaPaperPlane
} from "react-icons/fa";
import {ToastContainer, toast} from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import "./App.css";
import Auth from "./Auth";
import AdminDashboard from "./AdminDashboard";
import Profile from "./Profile";
import GameAI from "./GameAI";
import Friends from "./Friends";
import ReplayBoard from "./ReplayBoard";

const socket = io.connect("http://localhost:3001");

const setAuthToken = token => {
    if (token) axios.defaults.headers.common['x-auth-token'] = token;
    else delete axios.defaults.headers.common['x-auth-token'];
};

const moveAudio = new Audio('/sounds/move.mp3');
const notifyAudio = new Audio('/sounds/move.mp3');
const playSoundInstant = (audioObj) => {
    try {
        audioObj.currentTime = 0.1;
        const p = audioObj.play();
        if (p) p.catch(() => {
        });
    } catch (e) {
    }
};
const formatTime = (seconds) => {
    if (typeof seconds !== 'number') return "--:--";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
};

function App() {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [view, setView] = useState("home");
    const [leaderboard, setLeaderboard] = useState([]);
    const [matchHistory, setMatchHistory] = useState([]);
    const [isSearching, setIsSearching] = useState(false);

    const [game, setGame] = useState(new Chess());
    const [roomId, setRoomId] = useState("");
    const [inputRoomId, setInputRoomId] = useState("");
    const [isInGame, setIsInGame] = useState(false);
    const [playerColor, setPlayerColor] = useState(null);
    const [history, setHistory] = useState([]);
    const [gameOver, setGameOver] = useState(null);
    const [timers, setTimers] = useState({w: 600, b: 600});
    const [optionSquares, setOptionSquares] = useState({});
    const [gameNames, setGameNames] = useState({w: 'Trắng', b: 'Đen'});
    const [showDrawOffer, setShowDrawOffer] = useState(false);
    const [timeConfig, setTimeConfig] = useState({minutes: 10, increment: 0});
    const [gameTimeConfig, setGameTimeConfig] = useState(null);

    const [replayPgn, setReplayPgn] = useState("");
    const [chatMsg, setChatMsg] = useState("");
    const [chatHistory, setChatHistory] = useState([]);
    const chatEndRef = useRef(null);

    const initAudio = () => {
        moveAudio.volume = 0.1;
        moveAudio.play().then(() => {
            moveAudio.pause();
            moveAudio.currentTime = 0;
            moveAudio.volume = 1.0;
        }).catch(() => {
        });
    };
    const loadUser = async () => {
        const token = localStorage.getItem('token');
        if (!token) {
            setLoading(false);
            return;
        }
        setAuthToken(token);
        try {
            const res = await axios.get('http://localhost:3001/api/auth');
            setUser(res.data);
        } catch (err) {
            localStorage.removeItem('token');
            setAuthToken(null);
        }
        setLoading(false);
    };

    useEffect(() => {
        loadUser();
        socket.on("room_created", (id) => setRoomId(id));
        socket.on("player_color", (color) => setPlayerColor(color));

        socket.on("game_start", ({fen, pgn, roomId, timers, names, timeConfig}) => {
            setRoomId(roomId);
            setIsInGame(true);
            setView("game");
            setIsSearching(false);
            const newGame = new Chess();
            if (pgn) newGame.load_pgn(pgn); else newGame.load(fen);
            setGame(newGame);
            setTimers(timers || {w: 600, b: 600});
            if (names) setGameNames(names);
            if (timeConfig) setGameTimeConfig(timeConfig);
            setHistory([]);
            setGameOver(null);
            setShowDrawOffer(false);
            setChatHistory([]);
            toast.success(`⚔️ Trận đấu bắt đầu!`, {theme: "dark"});
        });

        socket.on("move_made", ({fen, pgn}) => {
            const newGame = new Chess();
            const loaded = newGame.load_pgn(pgn);
            if (!loaded) newGame.load(fen);
            setGame(newGame);
            updateHistory(newGame);
            playSoundInstant(moveAudio);
            setOptionSquares({});
        });

        socket.on("time_update", (t) => {
            if (t) setTimers(t);
        });
        socket.on("game_over", ({winner, reason}) => {
            setGameOver({winner, reason});
            playSoundInstant(notifyAudio);
            loadUser();
            setShowDrawOffer(false);
        });
        socket.on("error_message", (msg) => {
            toast.error(msg, {theme: "dark"});
            setRoomId("");
            setIsInGame(false);
            setIsSearching(false);
        });
        socket.on("draw_offered", () => {
            setShowDrawOffer(true);
            playSoundInstant(notifyAudio);
        });
        socket.on("draw_declined", () => toast.info("❌ Đối thủ từ chối hòa!", {theme: "dark"}));
        socket.on("opponent_disconnected", ({msg}) => {
            toast.warning(msg, {autoClose: 10000, theme: "dark"});
        });
        socket.on("opponent_reconnected", () => {
            toast.success("⚡ Đối thủ đã kết nối lại!", {theme: "dark"});
        });

        socket.on("receive_chat", (data) => {
            setChatHistory((prev) => [...prev, data]);
            setTimeout(() => chatEndRef.current?.scrollIntoView({behavior: "smooth"}), 100);
        });

        return () => {
            socket.off("room_created");
            socket.off("player_color");
            socket.off("game_start");
            socket.off("move_made");
            socket.off("game_over");
            socket.off("time_update");
            socket.off("error_message");
            socket.off("draw_offered");
            socket.off("draw_declined");
            socket.off("opponent_disconnected");
            socket.off("opponent_reconnected");
            socket.off("receive_chat");
        };
    }, [roomId]);

    const fetchLeaderboard = async () => {
        try {
            const res = await axios.get('http://localhost:3001/api/leaderboard');
            setLeaderboard(res.data);
        } catch (e) {
        }
    };
    const fetchHistory = async () => {
        if (!user) return;
        try {
            const res = await axios.get(`http://localhost:3001/api/history/${user.username}`);
            setMatchHistory(res.data);
        } catch (e) {
        }
    };
    const deleteMatch = async (id) => {
        if (!window.confirm("Xóa trận này?")) return;
        try {
            await axios.delete(`http://localhost:3001/api/user/history/${id}`);
            fetchHistory();
            toast.success("Đã xóa", {theme: "dark"});
        } catch (err) {
            toast.error("Lỗi", {theme: "dark"});
        }
    };
    const reportPlayer = async () => {
        const reason = prompt("Nhập lý do:");
        if (!reason) return;
        const allNames = Object.values(gameNames);
        const opponentName = allNames.find(name => name !== user.username);
        if (!opponentName) {
            toast.error("Không tìm thấy đối thủ!", {theme: "dark"});
            return;
        }
        try {
            await axios.post('http://localhost:3001/api/user/report', {
                reportedUser: opponentName,
                reason: reason,
                description: `Tố cáo trận ${roomId}`
            });
            toast.success("✅ Đã gửi tố cáo!", {theme: "dark"});
        } catch (err) {
            toast.error(err.response?.data?.msg, {theme: "dark"});
        }
    };

    const sendChat = (e) => {
        e.preventDefault();
        if (!chatMsg.trim()) return;
        socket.emit("send_chat", {roomId, message: chatMsg, sender: user.username});
        setChatMsg("");
    };
    const findMatch = () => {
        initAudio();
        setIsSearching(true);
        socket.emit('find_match', user.username);
    };
    const cancelSearch = () => {
        setIsSearching(false);
        socket.emit('cancel_find_match');
    };
    const handleTimeChange = (e) => {
        const [min, inc] = e.target.value.split(',').map(Number);
        setTimeConfig({minutes: min, increment: inc});
    };
    const createRoom = () => {
        initAudio();
        socket.emit("create_room", {username: user.username, time: timeConfig});
    };
    const joinRoom = () => {
        if (inputRoomId) {
            const id = inputRoomId.trim();
            setRoomId(id);
            initAudio();
            socket.emit("join_room", {roomId: id, username: user.username});
        } else {
            toast.warn("Vui lòng nhập ID!", {theme: "dark"});
        }
    };
    const handleResign = () => {
        if (window.confirm("Đầu hàng?")) socket.emit("resign", roomId);
    };
    const handleOfferDraw = () => {
        if (window.confirm("Cầu hòa?")) {
            socket.emit("offer_draw", roomId);
            toast.info("Đã gửi lời mời...", {theme: "dark"});
        }
    };
    const respondDraw = (accepted) => {
        socket.emit("respond_draw", {roomId, accepted});
        setShowDrawOffer(false);
    };
    const goHome = () => {
        setGameOver(null);
        setView("home");
        setRoomId("");
    };
    const logout = () => {
        localStorage.removeItem('token');
        setAuthToken(null);
        setUser(null);
        setView("home");
    };
    const handleReplay = (pgn) => {
        setReplayPgn(pgn);
        setView('replay');
    };

    const updateHistory = (g) => {
        const h = g.history({verbose: true});
        const f = [];
        for (let i = 0; i < h.length; i += 2) f.push({white: h[i].san, black: h[i + 1]?.san || ""});
        setHistory(f);
    };

    // --- SỬA LẠI HÀM NÀY ĐỂ ĐỔI MÀU CHẤM GỢI Ý ---
    function onPieceDragBegin(p, s) {
        if (game.turn() === playerColor && p[0] === playerColor) {
            const m = game.moves({square: s, verbose: true});
            const sq = {};
            m.forEach(x => sq[x.to] = {
                // Dùng màu Vàng Neon (Yellow) cho nước đi thường
                // Dùng màu Đỏ Neon (Red) cho nước ăn quân
                background: game.get(x.to)
                    ? "radial-gradient(circle, rgba(255,0,0,.8) 25%, transparent 25%)"
                    : "radial-gradient(circle, rgba(255, 238, 0, 0.8) 25%, transparent 25%)",
                borderRadius: "50%"
            });
            setOptionSquares(sq);
        }
    }

    function onDrop(s, t) {
        if (game.turn() !== playerColor) return false;
        const g = new Chess(game.fen());
        const m = g.move({from: s, to: t, promotion: "q"});
        if (!m) return false;
        playSoundInstant(moveAudio);
        setGame(g);
        setOptionSquares({});
        updateHistory(g);
        socket.emit("make_move", {roomId, move: m});
        return true;
    }

    const PlayerInfo = ({color, time}) => {
        const isTurn = game.turn() === color;
        const name = gameNames[color];
        return (
            <div className={`player-card ${isTurn ? 'active' : ''}`}>
                <div style={{display: 'flex', gap: 10, alignItems: 'center'}}>
                    <div
                        style={{fontSize: 24, color: color === 'w' ? '#fff' : '#888'}}>{color === 'w' ? '♔' : '♚'}</div>
                    <div><b style={{color: 'white'}}>{name}</b>{isTurn &&
                        <span style={{color: 'var(--neon-cyan)', fontSize: 12, marginLeft: 5}}>Thinking...</span>}</div>
                </div>
                <div className={`timer ${time < 30 ? 'low-time' : ''}`}>{formatTime(time)}</div>
            </div>
        );
    };

    if (loading) return <div
        style={{color: 'white', textAlign: 'center', marginTop: 100, fontFamily: 'Orbitron'}}>LOADING SYSTEM...</div>;
    if (!user) return <Auth onLoginSuccess={(u) => {
        setUser(u);
        loadUser();
    }}/>;
    if (user.role === 'admin') return <AdminDashboard user={user} onLogout={logout}/>;

    return (
        <div className="app-container">
            <ToastContainer position="top-right" autoClose={3000} theme="dark"/>
            <div className="sidebar-menu">
                <div className="logo-area"><FaChessPawn/> VKU CHESS</div>
                <button className={`nav-btn ${view === 'home' ? 'active' : ''}`} onClick={() => setView('home')}>
                    <FaGamepad/> TRANG CHỦ
                </button>
                <button className={`nav-btn ${view === 'profile' ? 'active' : ''}`} onClick={() => setView('profile')}>
                    <FaCog/> HỒ SƠ
                </button>
                <button className={`nav-btn ${view === 'leaderboard' ? 'active' : ''}`} onClick={() => {
                    setView('leaderboard');
                    fetchLeaderboard();
                }}><FaTrophy/> Xếp Hạng
                </button>
                <button className={`nav-btn ${view === 'history' ? 'active' : ''}`} onClick={() => {
                    setView('history');
                    fetchHistory();
                }}><FaHistory/> Lịch Sử
                </button>
                <button className={`nav-btn ${view === 'friends' ? 'active' : ''}`} onClick={() => setView('friends')}>
                    <FaUserFriends/> BẠN BÈ
                </button>
                <div style={{flex: 1}}></div>
                <button className="nav-btn" onClick={logout}><FaSignOutAlt/> ĐĂNG XUẤT</button>
            </div>
            <div className="main-content">
                {view === 'home' && (
                    <div className="home-dashboard">
                        <div className="hero-section">
                            <div className="hero-text"><h1>HELLO, {user.avatar || '♟️'} {user.username}!</h1><p>Chiến
                                thôi nào!</p></div>
                            {isSearching ?
                                <button className="btn-large searching-btn" onClick={cancelSearch}>HỦY TÌM</button> :
                                <button className="btn-large" onClick={findMatch}><FaSearch
                                    style={{marginRight: 10}}/> TÌM TRẬN</button>}</div>
                        <div className="action-grid">
                            <div className="play-card">
                                <div style={{fontSize: 40, color: '#81b64c'}}><FaPlus/></div>
                                <h2>Tạo Phòng & Cờ Chớp</h2>
                                {!roomId ? (<>
                                    <div style={{marginBottom: 10, color: '#ccc'}}>Thời gian: <select
                                        className="input-dark" style={{width: 140, marginLeft: 10, padding: 5}}
                                        onChange={handleTimeChange}>
                                        <option value="10,0">10 phút</option>
                                        <option value="5,0">5 phút</option>
                                        <option value="3,2">3p + 2s</option>
                                        <option value="1,0">1 phút</option>
                                    </select></div>
                                    <button className="btn-primary" onClick={createRoom}>Tạo</button>
                                    <button className="btn-reset"
                                            style={{marginTop: 10, width: '100%', border: '1px solid #555'}}
                                            onClick={() => setView('ai')}><FaRobot/> Đấu Với Máy
                                    </button>
                                </>) : (<div style={{
                                    marginTop: 15,
                                    background: '#222',
                                    padding: 10,
                                    borderRadius: 8,
                                    border: '1px solid var(--neon-cyan)'
                                }}>Mã: <b style={{
                                    color: 'var(--neon-cyan)',
                                    fontSize: 24
                                }}>{roomId}</b><br/><small>Time: {timeConfig.minutes}p + {timeConfig.increment}s</small>
                                </div>)}</div>
                            <div className="play-card">
                                <div style={{fontSize: 40, color: '#ccc'}}><FaGamepad/></div>
                                <h2>Vào Phòng</h2>
                                <div className="input-group"><input className="input-dark" placeholder="ID..."
                                                                    value={inputRoomId}
                                                                    onChange={e => setInputRoomId(e.target.value)}/>
                                    <button className="btn-primary" style={{width: 'auto'}} onClick={joinRoom}>Go
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
                {view === 'ai' && <GameAI onBack={() => setView('home')}/>}
                {view === 'profile' && <Profile user={user} onBack={() => setView('home')} onUpdateUser={setUser}/>}
                {view === 'friends' && <Friends/>}
                {view === 'replay' && <ReplayBoard pgn={replayPgn} onBack={() => setView('history')}/>}
                {view === 'leaderboard' && (
                    <div className="leaderboard-view"><h2 style={{color: 'var(--neon-yellow)'}}>🏆 BẢNG XẾP HẠNG</h2>
                        <table className="leaderboard-table">
                            <thead>
                            <tr>
                                <th>#</th>
                                <th>User</th>
                                <th>Elo</th>
                                <th>W/T</th>
                            </tr>
                            </thead>
                            <tbody>{leaderboard.map((u, i) => (<tr key={u._id}>
                                <td>{i + 1}</td>
                                <td>{u.username}</td>
                                <td style={{color: 'var(--neon-yellow)'}}>{u.elo}</td>
                                <td>{u.wins}/{u.gamesPlayed}</td>
                            </tr>))}</tbody>
                        </table>
                    </div>)}
                {view === 'history' && (
                    <div className="history-view"><h2 style={{color: 'var(--neon-cyan)'}}>⏱️ LỊCH SỬ ĐẤU</h2>
                        <table className="leaderboard-table">
                            <thead>
                            <tr>
                                <th>Ngày</th>
                                <th>Đối thủ</th>
                                <th>Kết quả</th>
                                <th>Hành động</th>
                            </tr>
                            </thead>
                            <tbody>{matchHistory.map(m => {
                                const myColor = m.whitePlayer === user.username ? 'white' : 'black';
                                const res = m.winner === myColor ? 'THẮNG' : (m.winner === 'draw' ? 'HÒA' : 'THUA');
                                return (<tr key={m._id}>
                                    <td>{new Date(m.date).toLocaleDateString()}</td>
                                    <td>{myColor === 'white' ? m.blackPlayer : m.whitePlayer}</td>
                                    <td style={{color: res === 'THẮNG' ? 'var(--neon-cyan)' : res === 'THUA' ? 'var(--danger)' : '#ccc'}}>{res}</td>
                                    <td>
                                        <button className="btn-reset"
                                                style={{fontSize: 12, width: 'auto', marginRight: 5}}
                                                onClick={() => handleReplay(m.pgn)}>🎥 Xem
                                        </button>
                                        <button className="btn-reset" style={{color: 'red', width: 'auto'}}
                                                onClick={() => deleteMatch(m._id)}><FaTrash/></button>
                                    </td>
                                </tr>)
                            })}</tbody>
                        </table>
                    </div>)}
                {view === 'game' && (
                    <div className="game-layout">
                        {gameOver && (<div className="modal-overlay">
                            <div className="modal-content">
                                <h2>{gameOver.winner === 'white' ? 'TRẮNG THẮNG' : gameOver.winner === 'black' ? 'ĐEN THẮNG' : 'HÒA!'}</h2>
                                <p>{gameOver.reason}</p>
                                <button className="btn-reset" onClick={goHome}>Về Trang Chủ</button>
                            </div>
                        </div>)}
                        {showDrawOffer && (<div className="modal-overlay">
                            <div className="modal-content"><h3>🤝 ĐỐI THỦ CẦU HÒA?</h3>
                                <div className="modal-btn-group">
                                    <button className="modal-btn-no" onClick={() => respondDraw(false)}>KHÔNG</button>
                                    <button className="modal-btn-yes" onClick={() => respondDraw(true)}>ĐỒNG Ý</button>
                                </div>
                            </div>
                        </div>)}
                        <div className="board-container">
                            <Chessboard
                                position={game.fen()}
                                onPieceDrop={onDrop}
                                boardOrientation={playerColor === 'w' ? 'white' : 'black'}
                                customDarkSquareStyle={{backgroundColor: '#006064'}}
                                customLightSquareStyle={{backgroundColor: '#b2ebf2'}}
                                customSquareStyles={optionSquares} // Kích hoạt dấu chấm mới
                                onPieceDragBegin={onPieceDragBegin}
                                onPieceDragEnd={() => setOptionSquares({})}
                            />
                        </div>
                        <div className="game-sidebar">
                            <div className="sidebar-header"><h3
                                style={{margin: 0, color: 'var(--neon-yellow)'}}>PHÒNG: {roomId}</h3>{gameTimeConfig &&
                                <small style={{color: '#888'}}>{gameTimeConfig.minutes}p
                                    + {gameTimeConfig.increment}s</small>}</div>
                            <PlayerInfo color={playerColor === 'w' ? 'b' : 'w'}
                                        time={playerColor === 'w' ? timers.b : timers.w}/>
                            <div className="chat-container">
                                <div className="chat-messages">
                                    <div className="chat-msg sys">Hệ thống: Chúc bạn chơi vui vẻ!</div>
                                    {chatHistory.map((c, i) => (
                                        <div key={i} className={`chat-msg ${c.sender === user.username ? 'me' : ''}`}>
                                            <b>{c.sender}:</b> {c.message}</div>))}
                                    <div ref={chatEndRef}/>
                                </div>
                                <form className="chat-input-area" onSubmit={sendChat}><input className="chat-input"
                                                                                             placeholder="Chat..."
                                                                                             value={chatMsg}
                                                                                             onChange={e => setChatMsg(e.target.value)}/>
                                    <button className="chat-btn"><FaPaperPlane/></button>
                                </form>
                            </div>
                            <PlayerInfo color={playerColor} time={playerColor === 'w' ? timers.w : timers.b}/>
                            {!gameOver && (<div style={{display: 'flex', gap: 10, marginTop: 10}}>
                                <button className="btn-game btn-draw" onClick={handleOfferDraw}><FaHandshake/> HÒA
                                </button>
                                <button className="btn-game btn-resign" onClick={handleResign}><FaFlag/> THUA</button>
                                <button className="btn-game"
                                        style={{background: '#333', borderBottom: '3px solid #111', color: '#ccc'}}
                                        onClick={reportPlayer}><FaExclamationTriangle/></button>
                            </div>)}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

export default App;