import React, { useState } from "react";
import { Chess } from "chess.js";
import { Chessboard } from "react-chessboard";
import { FaRobot, FaUndo, FaHome, FaBrain } from "react-icons/fa";

export default function GameAI({ onBack }) {
    const [game, setGame] = useState(new Chess());
    const [difficulty, setDifficulty] = useState("Medium");
    const [status, setStatus] = useState("");

    const moveSound = new Audio('/sounds/move.mp3');
    const safePlay = () => { try { moveSound.currentTime=0.1; moveSound.play().catch(()=>{}); } catch(e){} };

    // --- ENGINE MINIMAX ĐƠN GIẢN ---
    const evaluateBoard = (g) => {
        const pieceValues = { p: 10, n: 30, b: 30, r: 50, q: 90, k: 900 };
        let total = 0;
        g.board().forEach(row => {
            row.forEach(piece => {
                if (piece) {
                    const val = pieceValues[piece.type];
                    total += piece.color === 'w' ? val : -val;
                }
            });
        });
        return total;
    };

    const minimax = (g, depth, alpha, beta, isMaximizing) => {
        if (depth === 0 || g.game_over()) return evaluateBoard(g);
        const moves = g.moves();
        if (isMaximizing) {
            let maxEval = -Infinity;
            for (let i = 0; i < moves.length; i++) {
                g.move(moves[i]);
                const evalVal = minimax(g, depth - 1, alpha, beta, false);
                g.undo();
                maxEval = Math.max(maxEval, evalVal);
                alpha = Math.max(alpha, evalVal);
                if (beta <= alpha) break;
            }
            return maxEval;
        } else {
            let minEval = Infinity;
            for (let i = 0; i < moves.length; i++) {
                g.move(moves[i]);
                const evalVal = minimax(g, depth - 1, alpha, beta, true);
                g.undo();
                minEval = Math.min(minEval, evalVal);
                beta = Math.min(beta, evalVal);
                if (beta <= alpha) break;
            }
            return minEval;
        }
    };

    const getBestMove = (g) => {
        const moves = g.moves();
        if (moves.length === 0) return null;

        // Dễ: Đi ngẫu nhiên
        if (difficulty === "Easy") return moves[Math.floor(Math.random() * moves.length)];

        // Trung bình / Khó: Minimax
        let bestMove = null;
        let bestValue = Infinity;
        const depth = difficulty === "Medium" ? 2 : 3; // Độ sâu suy nghĩ

        for (let i = 0; i < moves.length; i++) {
            g.move(moves[i]);
            const boardValue = minimax(g, depth, -Infinity, Infinity, true);
            g.undo();
            if (boardValue < bestValue) {
                bestValue = boardValue;
                bestMove = moves[i];
            }
        }
        return bestMove || moves[0];
    };

    function onDrop(source, target) {
        if (game.game_over()) return false;
        const gameCopy = new Chess(game.fen());
        try {
            const move = gameCopy.move({ from: source, to: target, promotion: "q" });
            if (!move) return false;
            setGame(gameCopy);
            safePlay();

            // AI ĐI
            setStatus("Máy đang nghĩ...");
            setTimeout(() => {
                if (gameCopy.game_over()) { setStatus("Kết thúc!"); return; }
                const aiMove = getBestMove(gameCopy);
                if (aiMove) {
                    gameCopy.move(aiMove);
                    setGame(new Chess(gameCopy.fen()));
                    safePlay();
                    setStatus("");
                }
            }, 200);
            return true;
        } catch(e) { return false; }
    }

    return (
        <div className="game-layout">
            <div className="board-container" style={{width: 560, height: 560}}>
                <Chessboard position={game.fen()} onPieceDrop={onDrop} boardWidth={560}
                            customDarkSquareStyle={{ backgroundColor: '#779954' }}
                            customLightSquareStyle={{ backgroundColor: '#e9edcc' }}
                />
            </div>
            <div className="game-sidebar">
                <div className="sidebar-header" style={{color: '#f1b000'}}><h3><FaRobot/> ĐẤU VỚI MÁY</h3></div>
                <div style={{padding: 20}}>
                    <label style={{color:'#ccc'}}>Độ khó:</label>
                    <select className="input-dark" value={difficulty} onChange={(e) => setDifficulty(e.target.value)}>
                        <option value="Easy">Dễ (Ngẫu nhiên)</option>
                        <option value="Medium">Trung Bình</option>
                        <option value="Hard">Khó</option>
                    </select>
                    <p style={{color:'#81b64c', height: 20, fontStyle:'italic'}}>{status}</p>
                    <button className="btn-primary" onClick={() => {setGame(new Chess()); setStatus("");}} style={{marginBottom: 10}}><FaUndo/> Ván Mới</button>
                    <button className="btn-reset" onClick={onBack} style={{background:'#444'}}><FaHome/> Thoát</button>
                </div>
            </div>
        </div>
    );
}