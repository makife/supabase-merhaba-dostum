import React, { useState, useEffect, useCallback, useRef } from "react";
// React Router DOM'dan useNavigate'i içe aktarıyoruz (Eğer yüklü değilse aşağıda window.location kullanacağız)
import { useNavigate } from "react-router-dom"; 
import { Play, Pause, RotateCcw, Trophy, Target, ArrowLeft, RotateCw, ArrowDown, ArrowLeft as ArrowL, ArrowRight as ArrowR } from "lucide-react";

const BOARD_WIDTH = 10;
const BOARD_HEIGHT = 20;
const EMPTY_CELL = 0;

// HARF BLOKLARI (H, U, L, I, O, E, F)
const BLOCK_PIECES = {
  H: {
    shape: [
      [1, 0, 1],
      [1, 1, 1],
      [1, 0, 1],
    ],
    color: "#FF5733", // Turuncu
  },
  U: {
    shape: [
      [1, 0, 1],
      [1, 0, 1],
      [1, 1, 1],
    ],
    color: "#33FF57", // Yeşil
  },
  L: {
    shape: [
      [1, 0],
      [1, 0],
      [1, 1],
    ],
    color: "#3357FF", // Mavi
  },
  I: {
    shape: [[1], [1], [1], [1]],
    color: "#33FFF5", // Camgöbeği
  },
  O: {
    shape: [
      [1, 1],
      [1, 1],
    ],
    color: "#F5FF33", // Sarı
  },
  E: {
    shape: [
      [1, 1, 1],
      [1, 0, 0],
      [1, 1, 1],
    ],
    color: "#B833FF", // Mor
  },
  F: {
    shape: [
      [1, 1, 1],
      [1, 0, 0],
      [1, 0, 0],
    ],
    color: "#FF33A8", // Pembe
  },
};

const PIECE_TYPES = Object.keys(BLOCK_PIECES);

const MorlesGame = () => {
  // Geri dönüş için navigate hook'u
  const navigate = useNavigate();

  const goBack = () => {
    // Önce React Router ile deniyoruz, olmazsa window.location ile zorluyoruz
    try {
      navigate("/");
    } catch (e) {
      window.location.href = "/";
    }
  };

  const createEmptyBoard = () => {
    const board = [];
    for (let i = 0; i < BOARD_HEIGHT; i++) {
      const row = [];
      for (let j = 0; j < BOARD_WIDTH; j++) {
        row.push(EMPTY_CELL);
      }
      board.push(row);
    }
    return board;
  };

  // State Tanımları
  const [board, setBoard] = useState(createEmptyBoard);
  const [currentPiece, setCurrentPiece] = useState(null);
  const [currentPosition, setCurrentPosition] = useState({ x: 0, y: 0 });
  const [nextPiece, setNextPiece] = useState(null);
  const [gameRunning, setGameRunning] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [score, setScore] = useState(0);
  const [level, setLevel] = useState(1);
  const [lines, setLines] = useState(0);
  const [dropTime, setDropTime] = useState(1000);
  const [fastDrop, setFastDrop] = useState(false);
  const [highScore, setHighScore] = useState(0);
  
  // Referanslar
  const gameLoopRef = useRef(null);
  const fastDropRef = useRef(null);
  const dropPieceRef = useRef(null);

  useEffect(() => {
    try {
      const saved = localStorage?.getItem("morlesHighScore");
      if (saved) setHighScore(parseInt(saved));
    } catch (e) {
      console.log("LocalStorage error");
    }
  }, []);

  // --- OYUN MANTIĞI ---

  const createRandomPiece = useCallback(() => {
    const pieceType = PIECE_TYPES[Math.floor(Math.random() * PIECE_TYPES.length)];
    return {
      type: pieceType,
      shape: BLOCK_PIECES[pieceType].shape,
      color: BLOCK_PIECES[pieceType].color,
    };
  }, []);

  const rotatePiece = useCallback((piece) => {
    if (!piece) return null;
    // Güvenli matris döndürme
    if (!piece.shape || piece.shape.length === 0) return piece;
    const rotated = piece.shape[0].map((_, index) => piece.shape.map((row) => row[index]).reverse());
    return { ...piece, shape: rotated };
  }, []);

  const checkCollision = useCallback((piece, position, gameBoard) => {
    if (!piece) return false;
    for (let y = 0; y < piece.shape.length; y++) {
      for (let x = 0; x < piece.shape[y].length; x++) {
        if (piece.shape[y][x]) {
          const newX = position.x + x;
          const newY = position.y + y;
          if (newX < 0 || newX >= BOARD_WIDTH || newY >= BOARD_HEIGHT || (newY >= 0 && gameBoard[newY][newX])) {
            return true;
          }
        }
      }
    }
    return false;
  }, []);

  const placePiece = useCallback((piece, position, gameBoard) => {
    if (!piece) return gameBoard;
    const newBoard = gameBoard.map((row) => [...row]);
    for (let y = 0; y < piece.shape.length; y++) {
      for (let x = 0; x < piece.shape[y].length; x++) {
        if (piece.shape[y][x]) {
          const boardY = position.y + y;
          const boardX = position.x + x;
          if (boardY >= 0) {
            newBoard[boardY][boardX] = piece.color;
          }
        }
      }
    }
    return newBoard;
  }, []);

  const clearLines = useCallback((gameBoard) => {
    let linesCleared = 0;
    const newBoard = [];
    for (let y = BOARD_HEIGHT - 1; y >= 0; y--) {
      if (gameBoard[y].every((cell) => cell !== EMPTY_CELL)) {
        linesCleared++;
      } else {
        newBoard.unshift([...gameBoard[y]]);
      }
    }
    while (newBoard.length < BOARD_HEIGHT) {
      const emptyRow = [];
      for (let i = 0; i < BOARD_WIDTH; i++) {
        emptyRow.push(EMPTY_CELL);
      }
      newBoard.unshift(emptyRow);
    }
    return { board: newBoard, linesCleared };
  }, []);

  const spawnNewPiece = useCallback(() => {
    const piece = nextPiece || createRandomPiece();
    const next = createRandomPiece();
    const startPosition = { x: Math.floor(BOARD_WIDTH / 2) - 1, y: 0 };

    if (checkCollision(piece, startPosition, board)) {
      setGameOver(true);
      setGameRunning(false);
      return;
    }
    setCurrentPiece(piece);
    setCurrentPosition(startPosition);
    setNextPiece(next);
  }, [nextPiece, createRandomPiece, checkCollision, board]);

  const movePiece = useCallback((direction) => {
      if (!currentPiece || !gameRunning || gameOver) return;

      let newPosition = { ...currentPosition };
      if (direction === "left") newPosition.x -= 1;
      else if (direction === "right") newPosition.x += 1;
      else if (direction === "down") newPosition.y += 1;

      if (!checkCollision(currentPiece, newPosition, board)) {
        setCurrentPosition(newPosition);
      } else if (direction === "down") {
        const newBoard = placePiece(currentPiece, currentPosition, board);
        const { board: clearedBoard, linesCleared } = clearLines(newBoard);

        setBoard(clearedBoard);
        setLines((prev) => prev + linesCleared);
        setScore((prev) => {
          const newScore = prev + (linesCleared * 100 * level);
          if (newScore > highScore) {
            setHighScore(newScore);
            try { localStorage?.setItem("morlesHighScore", newScore.toString()); } catch (e) {}
          }
          return newScore;
        });

        const newLevel = Math.floor(lines / 10) + 1;
        if (newLevel > level) {
          setLevel(newLevel);
          setDropTime(Math.max(100, 1000 - (newLevel - 1) * 100));
        }
        spawnNewPiece();
      }
    },
    [currentPiece, currentPosition, gameRunning, gameOver, board, checkCollision, placePiece, clearLines, level, lines, highScore, spawnNewPiece]
  );

  const rotatePieceAction = useCallback(() => {
    if (!currentPiece || !gameRunning || gameOver) return;
    const rotated = rotatePiece(currentPiece);
    if (!checkCollision(rotated, currentPosition, board)) {
      setCurrentPiece(rotated);
    }
  }, [currentPiece, gameRunning, gameOver, rotatePiece, checkCollision, currentPosition, board]);

  const pauseGame = () => {
    setGameRunning(false);
  };

  const startGame = () => {
    setGameRunning(true);
    setGameOver(false);
    if (!currentPiece) spawnNewPiece();
  };

  const resetGame = () => {
    setBoard(createEmptyBoard());
    setCurrentPiece(null);
    setCurrentPosition({ x: 0, y: 0 });
    setNextPiece(null);
    setGameRunning(false);
    setGameOver(false);
    setScore(0);
    setLevel(1);
    setLines(0);
    setDropTime(1000);
    setFastDrop(false);
  };

  // Zamanlayıcılar (Timers)
  useEffect(() => {
    dropPieceRef.current = () => movePiece("down");
  });

  useEffect(() => {
    if (gameRunning && !gameOver) {
      gameLoopRef.current = setInterval(() => {
        if (dropPieceRef.current) dropPieceRef.current();
      }, dropTime);
    } else {
      clearInterval(gameLoopRef.current);
    }
    return () => clearInterval(gameLoopRef.current);
  }, [gameRunning, gameOver, dropTime]);

  useEffect(() => {
    if (fastDrop && gameRunning && !gameOver) {
      fastDropRef.current = setInterval(() => {
        if (dropPieceRef.current) dropPieceRef.current();
      }, 50);
    } else {
      clearInterval(fastDropRef.current);
    }
    return () => clearInterval(fastDropRef.current);
  }, [fastDrop, gameRunning, gameOver]);

  // Klavye Kontrolleri
  useEffect(() => {
    const handleKeyPress = (e) => {
      if (gameOver) return;
      switch (e.key) {
        case "ArrowLeft": movePiece("left"); break;
        case "ArrowRight": movePiece("right"); break;
        case "ArrowDown": if (!fastDrop) setFastDrop(true); break;
        case "ArrowUp": case " ": rotatePieceAction(); break;
      }
    };
    const handleKeyUp = (e) => {
      if (e.key === "ArrowDown") setFastDrop(false);
    };
    window.addEventListener("keydown", handleKeyPress);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyPress);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [gameOver, movePiece, rotatePieceAction, fastDrop]);

  // --- RENDER YARDIMCILARI ---
  
  const renderBoard = () => {
    let displayBoard = board.map((row) => [...row]);
    if (currentPiece) {
      for (let y = 0; y < currentPiece.shape.length; y++) {
        for (let x = 0; x < currentPiece.shape[y].length; x++) {
          if (currentPiece.shape[y][x]) {
            const boardY = currentPosition.y + y;
            const boardX = currentPosition.x + x;
            if (boardY >= 0 && boardY < BOARD_HEIGHT && boardX >= 0 && boardX < BOARD_WIDTH) {
              displayBoard[boardY][boardX] = currentPiece.color;
            }
          }
        }
      }
    }
    return displayBoard;
  };

  const renderNextPieceGrid = () => {
    const cells = [];
    for (let y = 0; y < 4; y++) {
      for (let x = 0; x < 4; x++) {
        const isPart = nextPiece && nextPiece.shape[y] && nextPiece.shape[y][x];
        cells.push(
          <div key={`n-${y}-${x}`} style={{
            width: "12px", height: "12px",
            background: isPart ? nextPiece.color : "transparent",
            opacity: isPart ? 1 : 0.1,
            border: "1px solid rgba(255,255,255,0.05)"
          }} />
        );
      }
    }
    return cells;
  };

  const controlBtnStyle = (colorStart, colorEnd) => ({
    background: `linear-gradient(135deg, ${colorStart}, ${colorEnd})`,
    border: "none",
    borderRadius: "15px",
    color: "white",
    padding: "0",
    boxShadow: "0 4px 6px rgba(0,0,0,0.2)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    transition: "transform 0.1s",
    width: "60px",
    height: "60px",
    touchAction: "manipulation",
  });

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "linear-gradient(to bottom right, #2c3e50, #4ca1af)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "flex-start",
        padding: "10px",
        fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
        overflow: "hidden",
        position: "relative" // Sabit konumlandırma için
      }}
    >
      {/* ÜST BAR */}
      <div style={{
        width: "100%",
        maxWidth: "500px",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: "10px",
        background: "rgba(255,255,255,0.1)",
        padding: "10px",
        borderRadius: "16px",
        backdropFilter: "blur(5px)"
      }}>
        <button 
            onClick={goBack} 
            style={{
                background: "rgba(255,255,255,0.2)", 
                border: "none", 
                color: "white", 
                borderRadius: "50%", 
                width: "40px", 
                height: "40px", 
                display: "flex", 
                alignItems: "center", 
                justifyContent: "center",
                cursor: "pointer"
            }}
        >
          <ArrowLeft size={24} />
        </button>
        <div style={{textAlign: "center"}}>
           <h1 style={{margin: 0, fontSize: "1.2rem", color: "#ffd700", fontWeight: "bold"}}>ALFABE KULE</h1>
           <span style={{fontSize: "0.8rem", color: "white", opacity: 0.8}}>Seviye {level}</span>
        </div>
        <div style={{display: "flex", flexDirection: "column", alignItems: "flex-end"}}>
          <div style={{display: "flex", alignItems: "center", gap: "4px", color: "#fff"}}>
             <Trophy size={14} color="gold"/> <span style={{fontSize: "0.9rem"}}>{highScore}</span>
          </div>
          <div style={{display: "flex", alignItems: "center", gap: "4px", color: "#fff"}}>
             <Target size={14} color="#60a5fa"/> <span style={{fontSize: "0.9rem"}}>{score}</span>
          </div>
        </div>
      </div>

      {/* OYUN ALANI VE YAN PANEL */}
      <div style={{
        display: "flex",
        gap: "10px",
        maxWidth: "500px",
        width: "100%",
        justifyContent: "center",
        flex: 1,
        // Yükseklik hatasını düzelten kısım:
        minHeight: "0" 
      }}>
        {/* SOL: Oyun Tahtası */}
        {/* Tahtanın görünmemesini düzelten kapsayıcı */}
        <div
          style={{
            position: "relative",
            background: "rgba(0, 0, 0, 0.85)",
            borderRadius: "12px",
            border: "4px solid rgba(255, 255, 255, 0.2)",
            padding: "4px",
            // Sabit yükseklik ve en-boy oranı ile görünürlüğü garanti ediyoruz
            height: "65vh", 
            width: "auto",
            aspectRatio: "1/2", // 10 birim en / 20 birim boy oranı
            display: "flex",
            alignItems: "center",
            justifyContent: "center"
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: `repeat(${BOARD_WIDTH}, 1fr)`,
              gridTemplateRows: `repeat(${BOARD_HEIGHT}, 1fr)`,
              gap: "1px",
              width: "100%",
              height: "100%",
            }}
          >
            {renderBoard().map((row, y) =>
              row.map((cell, x) => (
                <div
                  key={`${y}-${x}`}
                  style={{
                    background: cell === EMPTY_CELL ? "transparent" : cell,
                    border: cell === EMPTY_CELL ? "1px solid rgba(255, 255, 255, 0.05)" : "none", // Boş hücreleri görünür kılan kenarlık
                    borderRadius: "2px",
                    boxShadow: cell !== EMPTY_CELL ? "inset 0 0 4px rgba(0,0,0,0.5)" : "none",
                  }}
                />
              ))
            )}
          </div>

          {/* Game Over Overlay */}
          {gameOver && (
            <div style={{
              position: "absolute", inset: 0, background: "rgba(0,0,0,0.9)", 
              display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
              color: "white", zIndex: 10, borderRadius: "8px"
            }}>
              <h2 style={{fontSize: "2rem", color: "#ff4757", margin: "0 0 10px 0"}}>Oyun Bitti!</h2>
              <p style={{fontSize: "1.2rem", margin: "0 0 20px 0"}}>Skor: {score}</p>
              <button onClick={resetGame} style={{
                padding: "12px 24px", background: "#2ed573", border: "none", 
                borderRadius: "8px", color: "white", fontWeight: "bold", fontSize: "1.1rem", cursor: "pointer"
              }}>
                Tekrar Dene
              </button>
            </div>
          )}
        </div>

        {/* SAĞ: Sonraki Parça ve Butonlar */}
        <div style={{display: "flex", flexDirection: "column", gap: "10px", width: "80px"}}>
          <div style={{
             background: "rgba(0,0,0,0.5)", borderRadius: "10px", padding: "8px",
             display: "flex", flexDirection: "column", alignItems: "center",
             border: "1px solid rgba(255,255,255,0.1)"
          }}>
            <span style={{color: "white", fontSize: "0.7rem", marginBottom: "5px", fontWeight: "bold"}}>SONRAKİ</span>
            <div style={{
              display: "grid", gridTemplateColumns: "repeat(4, 12px)", gridTemplateRows: "repeat(4, 12px)", gap: "1px"
            }}>
              {renderNextPieceGrid()}
            </div>
          </div>

          <div style={{display: "flex", flexDirection: "column", gap: "8px", marginTop: "auto"}}>
             {!gameRunning && !gameOver && (
               <button onClick={startGame} style={{...controlBtnStyle("#2ed573", "#7bed9f"), width: "100%", height: "45px", fontSize: "0.9rem"}}>
                 <Play size={20} />
               </button>
             )}
             {gameRunning && (
               <button onClick={pauseGame} style={{...controlBtnStyle("#ffa502", "#eccc68"), width: "100%", height: "45px", fontSize: "0.9rem"}}>
                 <Pause size={20} />
               </button>
             )}
             <button onClick={resetGame} style={{...controlBtnStyle("#ff4757", "#ff6b81"), width: "100%", height: "45px", fontSize: "0.9rem"}}>
                 <RotateCcw size={20} />
             </button>
          </div>
        </div>
      </div>

      {/* ALT: Mobil Kontroller */}
      <div style={{
        marginTop: "15px",
        marginBottom: "10px",
        width: "100%",
        maxWidth: "400px",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-end",
        padding: "0 10px",
        gap: "10px"
      }}>
        <div style={{display: "flex", gap: "10px", alignItems: "center"}}>
           <button 
             onClick={() => movePiece("left")} disabled={gameOver}
             style={controlBtnStyle("#3742fa", "#5352ed")}
             onTouchStart={(e) => { e.preventDefault(); movePiece("left"); }}
           >
             <ArrowL size={28}/>
           </button>
           
           <button 
             disabled={gameOver}
             onMouseDown={() => setFastDrop(true)}
             onMouseUp={() => setFastDrop(false)}
             onTouchStart={(e) => { e.preventDefault(); setFastDrop(true); }}
             onTouchEnd={(e) => { e.preventDefault(); setFastDrop(false); }}
             style={controlBtnStyle("#3742fa", "#5352ed")}
           >
             <ArrowDown size={28}/>
           </button>

           <button 
             onClick={() => movePiece("right")} disabled={gameOver}
             style={controlBtnStyle("#3742fa", "#5352ed")}
             onTouchStart={(e) => { e.preventDefault(); movePiece("right"); }}
           >
             <ArrowR size={28}/>
           </button>
        </div>

        <button 
          onClick={rotatePieceAction} disabled={gameOver}
          style={{
             ...controlBtnStyle("#ff4757", "#ff6b81"),
             width: "70px", height: "70px", borderRadius: "50%"
          }}
          onTouchStart={(e) => { e.preventDefault(); rotatePieceAction(); }}
        >
           <RotateCw size={32} />
        </button>
      </div>
    </div>
  );
};

export default MorlesGame;
