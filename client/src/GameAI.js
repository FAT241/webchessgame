import React, {useState} from "react";
import {Chess} from "chess.js";
import {Chessboard} from "react-chessboard";
import {FaUndo, FaHome, FaBrain} from "react-icons/fa";

const pst = {
    p: [[0, 0, 0, 0, 0, 0, 0, 0], [50, 50, 50, 50, 50, 50, 50, 50], [10, 10, 20, 30, 30, 20, 10, 10], [5, 5, 10, 25, 25, 10, 5, 5], [0, 0, 0, 20, 20, 0, 0, 0], [5, -5, -10, 0, 0, -10, -5, 5], [5, 10, 10, -20, -20, 10, 10, 5], [0, 0, 0, 0, 0, 0, 0, 0]],
    n: [[-50, -40, -30, -30, -30, -30, -40, -50], [-40, -20, 0, 0, 0, 0, -20, -40], [-30, 0, 10, 15, 15, 10, 0, -30], [-30, 5, 15, 20, 20, 15, 5, -30], [-30, 0, 15, 20, 20, 15, 0, -30], [-30, 5, 10, 15, 15, 10, 5, -30], [-40, -20, 0, 5, 5, 0, -20, -40], [-50, -40, -30, -30, -30, -30, -40, -50]],
    b: [[-20, -10, -10, -10, -10, -10, -10, -20], [-10, 0, 0, 0, 0, 0, 0, -10], [-10, 0, 5, 10, 10, 5, 0, -10], [-10, 5, 5, 10, 10, 5, 5, -10], [-10, 0, 10, 10, 10, 10, 0, -10], [-10, 10, 10, 10, 10, 10, 10, -10], [-10, 5, 0, 0, 0, 0, 5, -10], [-20, -10, -10, -10, -10, -10, -10, -20]],
    r: [[0, 0, 0, 0, 0, 0, 0, 0], [5, 10, 10, 10, 10, 10, 10, 5], [-5, 0, 0, 0, 0, 0, 0, -5], [-5, 0, 0, 0, 0, 0, 0, -5], [-5, 0, 0, 0, 0, 0, 0, -5], [-5, 0, 0, 0, 0, 0, 0, -5], [-5, 0, 0, 0, 0, 0, 0, -5], [0, 0, 0, 5, 5, 0, 0, 0]],
    q: [[-20, -10, -10, -5, -5, -10, -10, -20], [-10, 0, 0, 0, 0, 0, 0, -10], [-10, 0, 5, 5, 5, 5, 0, -10], [-5, 0, 5, 5, 5, 5, 0, -5], [0, 0, 5, 5, 5, 5, 0, -5], [-10, 5, 5, 5, 5, 5, 0, -10], [-10, 0, 5, 0, 0, 0, 0, -10], [-20, -10, -10, -5, -5, -10, -10, -20]],
    k: [[-30, -40, -40, -50, -50, -40, -40, -30], [-30, -40, -40, -50, -50, -40, -40, -30], [-30, -40, -40, -50, -50, -40, -40, -30], [-30, -40, -40, -50, -50, -40, -40, -30], [-20, -30, -30, -40, -40, -30, -30, -20], [-10, -20, -20, -20, -20, -20, -20, -10], [20, 20, 0, 0, 0, 0, 20, 20], [20, 30, 10, 0, 0, 10, 30, 20]]
};
const pieceValues = {p: 100, n: 320, b: 330, r: 500, q: 900, k: 20000};

export default function GameAI({onBack}) {
    const [game, setGame] = useState(new Chess());
    const [difficulty, setDifficulty] = useState("Medium");
    const [status, setStatus] = useState("");
    const [optionSquares, setOptionSquares] = useState({});

    const moveAudio = new Audio('/sounds/move.mp3');
    const safePlay = () => {
        try {
            moveAudio.currentTime = 0.1;
            moveAudio.play().catch(() => {
            });
        } catch (e) {
        }
    };

    const evaluateBoard = (g) => {
        let total = 0;
        const board = g.board();
        for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) {
            const p = board[i][j];
            if (p) {
                let v = pieceValues[p.type];
                if (p.color === 'w') v += pst[p.type][i][j]; else v += pst[p.type][7 - i][7 - j];
                total += p.color === 'w' ? v : -v;
            }
        }
        return total;
    };
    const minimax = (g, depth, alpha, beta, isMax) => {
        if (depth === 0 || g.game_over()) return evaluateBoard(g);
        let moves = g.moves({verbose: true});
        moves.sort((a, b) => {
            let sA = a.captured ? 10 : 0;
            let sB = b.captured ? 10 : 0;
            return sB - sA;
        });
        if (isMax) {
            let max = -Infinity;
            for (let m of moves) {
                g.move(m);
                max = Math.max(max, minimax(g, depth - 1, alpha, beta, false));
                g.undo();
                alpha = Math.max(alpha, max);
                if (beta <= alpha) break;
            }
            return max;
        } else {
            let min = Infinity;
            for (let m of moves) {
                g.move(m);
                min = Math.min(min, minimax(g, depth - 1, alpha, beta, true));
                g.undo();
                min = Math.min(min, min);
                beta = Math.min(beta, min);
                if (beta <= alpha) break;
            }
            return min;
        }
    };
    const getBestMove = (g) => {
        const moves = g.moves({verbose: true});
        if (moves.length === 0) return null;
        if (difficulty === "Easy") return moves[Math.floor(Math.random() * moves.length)];
        let bestMove = null;
        let bestValue = Infinity;
        const depth = difficulty === "Medium" ? 2 : 3;
        moves.sort((a, b) => {
            let sA = a.captured ? 10 : 0;
            let sB = b.captured ? 10 : 0;
            return sB - sA;
        });
        for (let m of moves) {
            g.move(m);
            const val = minimax(g, depth - 1, -Infinity, Infinity, true);
            g.undo();
            if (val < bestValue) {
                bestValue = val;
                bestMove = m;
            }
        }
        return bestMove || moves[0];
    };

    const undoMove = () => {
        const g = new Chess(game.fen());
        const m1 = g.undo();
        if (m1) {
            g.undo();
            setGame(g);
            setStatus("Đã đi lại!");
        }
    };

    function onPieceDragBegin(piece, sourceSquare) {
        if (piece[0] !== 'w') return;
        const moves = game.moves({square: sourceSquare, verbose: true});
        const newSquares = {};
        moves.map((move) => {
            newSquares[move.to] = {
                background: game.get(move.to) ? "radial-gradient(circle, rgba(255,0,0,.6) 25%, transparent 25%)" : "radial-gradient(circle, rgba(255, 238, 0, 0.6) 25%, transparent 25%)",
                borderRadius: "50%",
            };
            return move;
        });
        newSquares[sourceSquare] = {background: "rgba(255, 238, 0, 0.4)"};
        setOptionSquares(newSquares);
    }

    function onDrop(source, target) {
        if (game.game_over()) return false;
        const g = new Chess(game.fen());
        try {
            if (!g.move({from: source, to: target, promotion: "q"})) return false;
            setGame(g);
            setOptionSquares({});
            safePlay();
        } catch (e) {
            return false;
        }
        setStatus("Máy đang tính...");
        setTimeout(() => {
            if (g.game_over()) {
                setStatus("KẾT THÚC!");
                return;
            }
            const aiMove = getBestMove(g);
            if (aiMove) {
                g.move(aiMove);
                setGame(new Chess(g.fen()));
                safePlay();
                setStatus(difficulty === "Hard" ? "MÁY ĐÃ ĐI" : "ĐẾN LƯỢT BẠN");
            }
        }, 100);
        return true;
    }

    return (<div className="game-layout">
        <div className="board-container" style={{width: 560, height: 560}}>
            <Chessboard position={game.fen()} onPieceDrop={onDrop} boardWidth={560}
                        customDarkSquareStyle={{backgroundColor: '#006064'}}
                        customLightSquareStyle={{backgroundColor: '#b2ebf2'}}
                        customSquareStyles={optionSquares}
                        onPieceDragBegin={onPieceDragBegin}
                        onPieceDragEnd={() => setOptionSquares({})}
            />
        </div>
        <div className="game-sidebar">
            <div className="sidebar-header" style={{color: 'var(--neon-yellow)', borderBottom: '1px solid #333'}}>
                <h3><FaBrain/> TRÍ TUỆ NHÂN TẠO</h3></div>
            <div style={{padding: 20, display: 'flex', flexDirection: 'column', gap: 20}}>
                <div><label style={{color: '#888', display: 'block', marginBottom: 5}}>ĐỘ KHÓ:</label><select
                    className="input-dark" value={difficulty} onChange={(e) => setDifficulty(e.target.value)}>
                    <option value="Easy">DỄ</option>
                    <option value="Medium">TRUNG BÌNH</option>
                    <option value="Hard">KHÓ</option>
                </select></div>
                <div style={{
                    background: 'rgba(255,255,255,0.05)', padding: 20, borderRadius: 8, border: '1px solid #333'
                }}><p style={{color: 'var(--neon-cyan)', margin: 0, fontWeight: 'bold'}}>TRẠNG THÁI:</p><p
                    style={{color: '#fff', margin: '10px 0 0 0', fontFamily: 'Orbitron'}}>{status || "SẴN SÀNG"}</p>
                </div>
                <div style={{marginTop: 'auto', display: 'flex', gap: 10, flexDirection: 'column'}}>
                    <div style={{display: 'flex', gap: 10}}>
                        <button className="btn-primary" onClick={() => {
                            setGame(new Chess());
                            setStatus("");
                        }} style={{flex: 1, background: 'var(--neon-cyan)', color: 'black'}}>VÁN MỚI
                        </button>
                        <button className="btn-primary" onClick={undoMove}
                                style={{flex: 1, background: 'var(--neon-yellow)', color: 'black'}}><FaUndo/> ĐI LẠI
                        </button>
                    </div>
                    <button className="btn-reset" onClick={onBack}
                            style={{background: '#222', width: '100%', border: '1px solid #444'}}><FaHome/> QUAY LẠI
                    </button>
                </div>
            </div>
        </div>
    </div>);
}