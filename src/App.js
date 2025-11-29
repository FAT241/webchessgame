import React, { useState, useEffect } from "react";
import axios from "axios";
import { Chess } from "chess.js";
import { Chessboard } from "react-chessboard";
import io from "socket.io-client";
import { FaChessPawn, FaTrophy, FaSignOutAlt, FaGamepad, FaSearch, FaPlus, FaUserAlt, FaHistory, FaFlag, FaHandshake, FaCog, FaExclamationTriangle, FaTrash, FaRobot } from "react-icons/fa";
import "./App.css";
import Auth from "./Auth";
import AdminDashboard from "./AdminDashboard";
import Profile from "./Profile";
import GameAI from "./GameAI"; // Import AI

const socket = io.connect("http://localhost:3001");

const setAuthToken = token => {
  if (token) axios.defaults.headers.common['x-auth-token'] = token;
  else delete axios.defaults.headers.common['x-auth-token'];
};

const moveAudio = new Audio('/sounds/move.mp3');
const notifyAudio = new Audio('/sounds/move.mp3');
const playSoundInstant = (audioObj) => { try { audioObj.currentTime = 0.1; const p = audioObj.play(); if(p) p.catch(()=>{}); } catch(e){} };
const formatTime = (seconds) => { if (typeof seconds !== 'number') return "--:--"; const mins = Math.floor(seconds / 60); const secs = seconds % 60; return `${mins}:${secs < 10 ? '0' : ''}${secs}`; };

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
  const [timers, setTimers] = useState({ w: 600, b: 600 });
  const [optionSquares, setOptionSquares] = useState({});
  const [gameNames, setGameNames] = useState({ w: 'Trắng', b: 'Đen' });
  const [showDrawOffer, setShowDrawOffer] = useState(false);

  // State chọn giờ cờ chớp
  const [selectedTime, setSelectedTime] = useState(10);

  const initAudio = () => { moveAudio.volume = 0.1; moveAudio.play().then(()=>{moveAudio.pause(); moveAudio.currentTime=0; moveAudio.volume=1.0;}).catch(()=>{}); };
  const loadUser = async () => {
    const token = localStorage.getItem('token');
    if (!token) { setLoading(false); return; }
    setAuthToken(token);
    try { const res = await axios.get('http://localhost:3001/api/auth'); setUser(res.data); } catch (err) { localStorage.removeItem('token'); setAuthToken(null); }
    setLoading(false);
  };

  useEffect(() => {
    loadUser();
    socket.on("room_created", (id) => setRoomId(id));
    socket.on("player_color", (color) => setPlayerColor(color));
    socket.on("game_start", ({ fen, pgn, roomId, timers, names }) => {
      setRoomId(roomId); setIsInGame(true); setView("game"); setIsSearching(false);
      const newGame = new Chess(); if (pgn) newGame.load_pgn(pgn); else newGame.load(fen);
      setGame(newGame); setTimers(timers || { w: 600, b: 600 }); if (names) setGameNames(names);
      setHistory([]); setGameOver(null); setShowDrawOffer(false);
    });
    socket.on("move_made", ({ fen, pgn }) => {
      const newGame = new Chess(); const loaded = newGame.load_pgn(pgn); if (!loaded) newGame.load(fen);
      setGame(newGame); updateHistory(newGame); playSoundInstant(moveAudio); setOptionSquares({});
    });
    socket.on("time_update", (t) => { if(t) setTimers(t); });
    socket.on("game_over", ({ winner, reason }) => { setGameOver({ winner, reason }); playSoundInstant(notifyAudio); loadUser(); setShowDrawOffer(false); });
    socket.on("error_message", (msg) => { alert(`⚠️ ${msg}`); setRoomId(""); setIsInGame(false); setIsSearching(false); });
    socket.on("draw_offered", (rid) => { if(rid===roomId) setShowDrawOffer(true); });
    socket.on("draw_declined", () => alert("Đối thủ từ chối hòa!"));
    socket.on("opponent_disconnected", ({ msg }) => { alert(msg); });
    socket.on("opponent_reconnected", () => { alert("Đối thủ đã kết nối lại!"); });
    return () => { socket.off("room_created"); socket.off("player_color"); socket.off("game_start"); socket.off("move_made"); socket.off("game_over"); socket.off("time_update"); socket.off("error_message"); socket.off("draw_offered"); socket.off("draw_declined"); socket.off("opponent_disconnected"); socket.off("opponent_reconnected"); };
  }, [roomId]);

  const fetchLeaderboard = async () => { try { const res = await axios.get('http://localhost:3001/api/leaderboard'); setLeaderboard(res.data); } catch (e) {} };
  const fetchHistory = async () => { if (!user) return; try { const res = await axios.get(`http://localhost:3001/api/history/${user.username}`); setMatchHistory(res.data); } catch (e) {} };
  const deleteMatch = async (id) => { if(!window.confirm("Xóa trận này?")) return; try { await axios.delete(`http://localhost:3001/api/user/history/${id}`); fetchHistory(); } catch (err) { alert("Lỗi"); } };
  const reportPlayer = async () => {
    const reason = prompt("Lý do:"); if (!reason) return;
    const allNames = Object.values(gameNames); const opponentName = allNames.find(name => name !== user.username);
    if (!opponentName) { alert("Lỗi: Không tìm thấy đối thủ!"); return; }
    try { await axios.post('http://localhost:3001/api/user/report', { reportedUser: opponentName, reason: reason, description: `Tố cáo trận ${roomId}` }); alert("✅ Đã gửi!"); } catch (err) { alert(err.response?.data?.msg); }
  };

  const findMatch = () => { initAudio(); setIsSearching(true); socket.emit('find_match', user.username); };
  const cancelSearch = () => { setIsSearching(false); socket.emit('cancel_find_match'); };

  // --- TẠO PHÒNG CÓ THỜI GIAN ---
  const createRoom = () => { initAudio(); socket.emit("create_room", { username: user.username, time: selectedTime }); };
  const joinRoom = () => { if (inputRoomId) { const id = inputRoomId.trim(); setRoomId(id); initAudio(); socket.emit("join_room", { roomId: id, username: user.username }); }};

  const handleResign = () => { if (window.confirm("Đầu hàng?")) socket.emit("resign", roomId); };
  const handleOfferDraw = () => { if (window.confirm("Cầu hòa?")) { socket.emit("offer_draw", roomId); alert("Đã gửi..."); }};
  const respondDraw = (accepted) => { socket.emit("respond_draw", { roomId, accepted }); setShowDrawOffer(false); };
  const goHome = () => { setGameOver(null); setView("home"); setRoomId(""); };
  const logout = () => { localStorage.removeItem('token'); setAuthToken(null); setUser(null); setView("home"); };
  const updateHistory = (g) => { const h = g.history({ verbose: true }); const f = []; for (let i = 0; i < h.length; i += 2) f.push({ white: h[i].san, black: h[i+1]?.san || "" }); setHistory(f); };
  function onPieceDragBegin(p, s) { if (game.turn()===playerColor && p[0]===playerColor) { const m = game.moves({ square: s, verbose: true }); const sq = {}; m.forEach(x => sq[x.to] = { background: "radial-gradient(circle, rgba(0,0,0,.2) 25%, transparent 25%)", borderRadius: "50%" }); setOptionSquares(sq); }}
  function onDrop(s, t) { if (game.turn()!==playerColor) return false; const g = new Chess(game.fen()); const m = g.move({ from:s, to:t, promotion:"q" }); if(!m) return false; playSoundInstant(moveAudio); setGame(g); setOptionSquares({}); updateHistory(g); socket.emit("make_move", { roomId, move:m }); return true; }

  const PlayerInfo = ({ color, time }) => {
    const isTurn = game.turn() === color; const name = gameNames[color];
    return (
        <div className={`player-info ${isTurn ? 'active-turn' : ''}`}>
          <div style={{display:'flex', gap:10, alignItems:'center'}}><div style={{fontSize:20}}>{color === 'w' ? '♔' : '♚'}</div><div><b>{name}</b>{isTurn && <span style={{color:'#81b64c', fontSize:12, marginLeft:5}}>⏳</span>}</div></div>
          <div className={`timer ${time<30?'low-time':''}`}>{formatTime(time)}</div>
        </div>
    );
  };

  if (loading) return <div style={{color:'white',textAlign:'center',marginTop:100}}>Loading...</div>;
  if (!user) return <Auth onLoginSuccess={(u) => { setUser(u); loadUser(); }} />;
  if (user.role === 'admin') return <AdminDashboard user={user} onLogout={logout} />;

  return (
      <div className="app-container">
        <div className="sidebar-menu">
          <div className="logo-area"><FaChessPawn /> VKU CHESS</div>
          <button className={`nav-btn ${view==='home'?'active':''}`} onClick={()=>setView('home')}><FaGamepad /> Trang Chủ</button>
          <button className={`nav-btn ${view==='profile'?'active':''}`} onClick={()=>setView('profile')}><FaCog /> Hồ Sơ</button>
          <button className={`nav-btn ${view==='leaderboard'?'active':''}`} onClick={()=>{setView('leaderboard'); fetchLeaderboard();}}><FaTrophy /> Xếp Hạng</button>
          <button className={`nav-btn ${view==='history'?'active':''}`} onClick={()=>{setView('history'); fetchHistory();}}><FaHistory /> Lịch Sử</button>
          <div style={{flex:1}}></div>
          <button className="nav-btn" onClick={logout}><FaSignOutAlt /> Đăng Xuất</button>
        </div>
        <div className="main-content">
          {view === 'home' && (
              <div className="home-dashboard">
                <div className="hero-section"><div className="hero-text"><h1>Xin chào, {user.avatar||'♟️'} {user.username}!</h1><p>Chiến thôi nào!</p></div>{isSearching ? <button className="btn-large searching-btn" onClick={cancelSearch}>HỦY TÌM</button> : <button className="btn-large" onClick={findMatch}><FaSearch style={{marginRight:10}}/> TÌM TRẬN</button>}</div>
                <div className="action-grid">
                  <div className="play-card">
                    <div style={{fontSize:40, color:'#81b64c'}}><FaPlus /></div><h2>Tạo Phòng & Cờ Chớp</h2>
                    {!roomId ? (
                        <>
                          {/* CHỌN GIỜ */}
                          <div style={{marginBottom:10, color:'#ccc'}}>
                            Thời gian:
                            <select className="input-dark" style={{width:100, marginLeft:10, padding:5}} value={selectedTime} onChange={e=>setSelectedTime(Number(e.target.value))}>
                              <option value={10}>10 phút</option><option value={5}>5 phút</option><option value={3}>3 phút</option><option value={1}>1 phút</option>
                            </select>
                          </div>
                          <button className="btn-primary" onClick={createRoom}>Tạo</button>
                          {/* NÚT AI */}
                          <button className="btn-reset" style={{marginTop:10, width:'100%', border:'1px solid #555'}} onClick={() => setView('ai')}><FaRobot/> Đấu Với Máy</button>
                        </>
                    ) : (
                        <div style={{marginTop:15, background:'#222', padding:10, borderRadius:8}}>Mã: <b style={{color:'#81b64c', fontSize:20}}>{roomId}</b><br/><small>Time: {selectedTime}p</small></div>
                    )}
                  </div>
                  <div className="play-card"><div style={{fontSize:40, color:'#ccc'}}><FaGamepad /></div><h2>Vào Phòng</h2><div className="input-group"><input className="input-dark" placeholder="ID..." value={inputRoomId} onChange={e=>setInputRoomId(e.target.value)} /><button className="btn-primary" style={{width:'auto'}} onClick={joinRoom}>Go</button></div></div>
                </div>
              </div>
          )}

          {view === 'ai' && <GameAI onBack={() => setView('home')} />}
          {view === 'profile' && <Profile user={user} onBack={()=>setView('home')} onUpdateUser={setUser} />}
          {view === 'leaderboard' && (<div className="leaderboard-view"><h2 style={{color:'#f1b000'}}><FaTrophy /> BẢNG XẾP HẠNG</h2><table className="leaderboard-table"><thead><tr><th>#</th><th>User</th><th>Elo</th><th>W/T</th></tr></thead><tbody>{leaderboard.map((u,i)=>(<tr key={u._id}><td>{i+1}</td><td>{u.username}</td><td style={{color:'#f1b000'}}>{u.elo}</td><td>{u.wins}/{u.gamesPlayed}</td></tr>))}</tbody></table></div>)}
          {view === 'history' && (<div className="history-view"><h2 style={{color:'white'}}><FaHistory /> LỊCH SỬ</h2><table className="leaderboard-table"><thead><tr><th>Ngày</th><th>Đối thủ</th><th>Kết quả</th><th>Xóa</th></tr></thead><tbody>{matchHistory.map(m=>{const myColor=m.whitePlayer===user.username?'white':'black'; const res=m.winner===myColor?'THẮNG':(m.winner==='draw'?'HÒA':'THUA'); return (<tr key={m._id}><td>{new Date(m.date).toLocaleDateString()}</td><td>{myColor==='white'?m.blackPlayer:m.whitePlayer}</td><td style={{color:res==='THẮNG'?'green':res==='THUA'?'red':'#ccc'}}>{res}</td><td><button className="btn-reset" style={{color:'red'}} onClick={() => deleteMatch(m._id)}><FaTrash /></button></td></tr>)})}</tbody></table></div>)}
          {view === 'game' && (
              <div className="game-layout">
                {gameOver && (<div className="modal-overlay"><div className="modal-content"><h2>{gameOver.winner==='white'?'TRẮNG THẮNG':gameOver.winner==='black'?'ĐEN THẮNG':'HÒA!'}</h2><p>{gameOver.reason}</p><button className="btn-reset" onClick={goHome}>Về Trang Chủ</button></div></div>)}
                {showDrawOffer && (<div className="modal-overlay"><div className="modal-content"><h3>🤝 Cầu Hòa?</h3><div style={{display:'flex',gap:10,justifyContent:'center'}}><button className="btn-reset" style={{background:'red'}} onClick={()=>respondDraw(false)}>No</button><button className="btn-reset" style={{background:'green'}} onClick={()=>respondDraw(true)}>Yes</button></div></div></div>)}
                <div className="board-container"><Chessboard position={game.fen()} onPieceDrop={onDrop} boardOrientation={playerColor==='w'?'white':'black'} customDarkSquareStyle={{backgroundColor:'#779954'}} customLightSquareStyle={{backgroundColor:'#e9edcc'}} customSquareStyles={optionSquares} onPieceDragBegin={onPieceDragBegin} onPieceDragEnd={()=>setOptionSquares({})} /></div>
                <div className="game-sidebar">
                  <PlayerInfo color={playerColor==='w'?'b':'w'} time={playerColor==='w'?timers.b:timers.w} />
                  <div className="move-list">{history.map((h,i)=>(<div key={i} className="move-item"><div>{i+1}.</div><div style={{marginLeft:10}}>{h.white}</div><div style={{marginLeft:10}}>{h.black}</div></div>))}</div>
                  <PlayerInfo color={playerColor} time={playerColor==='w'?timers.w:timers.b} />
                  {!gameOver && (<div style={{display:'flex',gap:10,marginTop:10}}><button className="btn-game btn-draw" onClick={handleOfferDraw}><FaHandshake /> Hòa</button><button className="btn-game btn-resign" onClick={handleResign}><FaFlag /> Thua</button><button className="btn-game" style={{background:'#555', borderBottom:'3px solid #333'}} onClick={reportPlayer}><FaExclamationTriangle /></button></div>)}
                </div>
              </div>
          )}
        </div>
      </div>
  );
}
export default App;