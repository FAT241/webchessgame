import React, {useState, useEffect} from "react";
import {Chess} from "chess.js";
import {Chessboard} from "react-chessboard";
import {FaStepBackward, FaChevronLeft, FaChevronRight, FaStepForward, FaTimes} from "react-icons/fa";

const ReplayBoard = ({pgn, onBack}) => {
    const [game, setGame] = useState(new Chess());
    const [moveIndex, setMoveIndex] = useState(-1); // -1: Chưa đi nước nào
    const [history, setHistory] = useState([]);

    useEffect(() => {
        if (pgn) {
            // Load toàn bộ lịch sử nước đi từ PGN
            const tempGame = new Chess();
            tempGame.load_pgn(pgn);
            setHistory(tempGame.history());

            // Reset bàn cờ về đầu
            setGame(new Chess());
            setMoveIndex(-1);
        }
    }, [pgn]);

    // Hàm nhảy đến nước đi bất kỳ (Chính xác 100%)
    const jumpTo = (targetIndex) => {
        // Giới hạn index không được vượt quá phạm vi
        if (targetIndex < -1) targetIndex = -1;
        if (targetIndex >= history.length) targetIndex = history.length - 1;

        const newGame = new Chess();
        // Đi lại từ đầu đến nước thứ targetIndex
        for (let i = 0; i <= targetIndex; i++) {
            newGame.move(history[i]);
        }
        setGame(newGame);
        setMoveIndex(targetIndex);
    };

    // Nút Lùi: Đơn giản là nhảy về (index - 1)
    const handlePrev = () => {
        jumpTo(moveIndex - 1);
    };

    // Nút Tiến: Nhảy đến (index + 1)
    const handleNext = () => {
        jumpTo(moveIndex + 1);
    };

    return (
        <div className="game-layout">
            <div className="board-container" style={{width: 560, height: 560}}>
                <Chessboard
                    position={game.fen()}
                    arePiecesDraggable={false} // Khóa kéo thả
                    boardWidth={560}
                    // --- MÀU BÀN CỜ HOLOGRAM (SÁNG ĐẸP) ---
                    customDarkSquareStyle={{backgroundColor: '#006064'}}
                    customLightSquareStyle={{backgroundColor: '#b2ebf2'}}
                    // --------------------------------------
                />
            </div>

            <div className="game-sidebar" style={{justifyContent: 'space-between'}}>
                <div className="sidebar-header" style={{color: 'var(--neon-cyan)'}}>
                    <h3>🎥 REPLAY MODE</h3>
                    <small style={{color: '#888'}}>Nước đi: {moveIndex + 1} / {history.length}</small>
                </div>

                {/* Danh sách nước đi */}
                <div className="move-list">
                    {history.map((move, i) => {
                        if (i % 2 === 0) {
                            return (
                                <div key={i} className="move-item" style={{
                                    background: (i === moveIndex || i + 1 === moveIndex) ? 'rgba(0, 243, 255, 0.2)' : 'transparent',
                                    borderLeft: (i === moveIndex || i + 1 === moveIndex) ? '2px solid var(--neon-cyan)' : 'none'
                                }}>
                                    <div style={{width: 30, color: '#666'}}>{(i / 2) + 1}.</div>
                                    <div style={{
                                        flex: 1,
                                        color: i === moveIndex ? 'white' : '#aaa',
                                        fontWeight: i === moveIndex ? 'bold' : 'normal'
                                    }}>{move}</div>
                                    <div style={{
                                        flex: 1,
                                        color: (i + 1) === moveIndex ? 'white' : '#aaa',
                                        fontWeight: (i + 1) === moveIndex ? 'bold' : 'normal'
                                    }}>{history[i + 1] || ''}</div>
                                </div>
                            );
                        }
                        return null;
                    })}
                </div>

                {/* Bộ điều khiển */}
                <div style={{display: 'flex', gap: 5, marginBottom: 10}}>
                    <button className="btn-game" style={{background: '#333'}} onClick={() => jumpTo(-1)} title="Về đầu">
                        <FaStepBackward/>
                    </button>
                    <button className="btn-game" style={{background: '#444'}} onClick={handlePrev}
                            disabled={moveIndex < 0}>
                        <FaChevronLeft/>
                    </button>
                    <button className="btn-game" style={{background: '#444'}} onClick={handleNext}
                            disabled={moveIndex >= history.length - 1}>
                        <FaChevronRight/>
                    </button>
                    <button className="btn-game" style={{background: '#333'}} onClick={() => jumpTo(history.length - 1)}
                            title="Về cuối">
                        <FaStepForward/>
                    </button>
                </div>

                <button className="btn-reset" onClick={onBack} style={{background: 'var(--danger)', color: 'white'}}>
                    <FaTimes/> ĐÓNG REPLAY
                </button>
            </div>
        </div>
    );
};

export default ReplayBoard;