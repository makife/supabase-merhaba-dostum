import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Play, Pause, RotateCcw, Trophy, Target, ArrowLeft, RotateCw } from 'lucide-react';

const BOARD_WIDTH = 10;
const BOARD_HEIGHT = 20;
const EMPTY_CELL = 0;

// Özgün blok şekilleri - Her biri 4 birimden oluşur (telif sorunu yok)
const BLOCK_PIECES = {
  I: { shape: [[1, 1], [1, 1]], color: '#00f5ff' },                    // Kare 2x2
  O: { shape: [[1, 1, 0], [0, 1, 1]], color: '#ffff00' },              // Basamak
  PLUS: { shape: [[0, 1, 0], [1, 1, 1], [0, 1, 0]], color: '#800080' }, // + işareti
  S: { shape: [[1, 0], [1, 1], [0, 1]], color: '#00ff00' },            // Diagonal S
  Z: { shape: [[0, 1], [1, 1], [1, 0]], color: '#ff0000' },            // Diagonal Z
  J: { shape: [[1, 1], [1, 0], [1, 0]], color: '#0000ff' },            // Kanca (T değil)
  L: { shape: [[1, 0], [1, 1]], color: '#ffa500' }                     // Kısa L (3 kare)
};

const PIECE_TYPES = Object.keys(BLOCK_PIECES);

const TetrisGame = () => {
  const goBack = () => {
    if (window.history.length > 1) {
      window.history.back();
    } else {
      window.location.href = '/';
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

  const gameLoopRef = useRef(null);
  const fastDropRef = useRef(null);
  const touchStartRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    try {
      const saved = localStorage?.getItem('tetrisHighScore');
      if (saved) setHighScore(parseInt(saved));
    } catch (e) {
      console.log('LocalStorage error');
    }
  }, []);

  const createRandomPiece = useCallback(() => {
    const pieceType = PIECE_TYPES[Math.floor(Math.random() * PIECE_TYPES.length)];
    return {
      type: pieceType,
      shape: BLOCK_PIECES[pieceType].shape,
      color: BLOCK_PIECES[pieceType].color
    };
  }, []);

  const rotatePiece = useCallback((piece) => {
    if (!piece) return null;
    const rotated = piece.shape[0].map((_, index) =>
      piece.shape.map(row => row[index]).reverse()
    );
    return { ...piece, shape: rotated };
  }, []);

  const checkCollision = useCallback((piece, position, gameBoard) => {
    if (!piece) return false;
    
    for (let y = 0; y < piece.shape.length; y++) {
      for (let x = 0; x < piece.shape[y].length; x++) {
        if (piece.shape[y][x]) {
          const newX = position.x + x;
          const newY = position.y + y;
          
          if (newX < 0 || newX >= BOARD_WIDTH || newY >= BOARD_HEIGHT || 
              (newY >= 0 && gameBoard[newY][newX])) {
            return true;
          }
        }
      }
    }
    return false;
  }, []);

  const placePiece = useCallback((piece, position, gameBoard) => {
    if (!piece) return gameBoard;
    const newBoard = gameBoard.map(row => [...row]);
    
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
      if (gameBoard[y].every(cell => cell !== EMPTY_CELL)) {
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

  const calculateScore = useCallback((linesCleared, currentLevel) => {
    const basePoints = [0, 40, 100, 300, 1200];
    return basePoints[linesCleared] * currentLevel;
  }, []);

  const spawnNewPiece = useCallback(() => {
    const piece = nextPiece || createRandomPiece();
    const newNextPiece = createRandomPiece();
    const startPosition = { x: Math.floor(BOARD_WIDTH / 2) - 1, y: 0 };
    
    if (checkCollision(piece, startPosition, board)) {
      setGameOver(true);
      setGameRunning(false);
      return;
    }
    
    setCurrentPiece(piece);
    setCurrentPosition(startPosition);
    setNextPiece(newNextPiece);
  }, [nextPiece, createRandomPiece, checkCollision, board]);

  const movePiece = useCallback((direction) => {
    if (!currentPiece || !gameRunning || gameOver) return;

    let newPosition = { ...currentPosition };
    
    if (direction === 'left') newPosition.x -= 1;
    else if (direction === 'right') newPosition.x += 1;
    else if (direction === 'down') newPosition.y += 1;
    
    if (!checkCollision(currentPiece, newPosition, board)) {
      setCurrentPosition(newPosition);
    } else if (direction === 'down') {
      const newBoard = placePiece(currentPiece, currentPosition, board);
      const { board: clearedBoard, linesCleared } = clearLines(newBoard);
      
      setBoard(clearedBoard);
      setLines(prev => prev + linesCleared);
      setScore(prev => {
        const newScore = prev + calculateScore(linesCleared, level);
        if (newScore > highScore) {
          setHighScore(newScore);
          try {
            localStorage?.setItem('tetrisHighScore', newScore.toString());
          } catch (error) {
            console.log('LocalStorage error:', error);
          }
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
  }, [currentPiece, currentPosition, gameRunning, gameOver, board, checkCollision, placePiece, clearLines, calculateScore, level, lines, highScore, spawnNewPiece]);

  const rotatePieceAction = useCallback(() => {
    if (!currentPiece || !gameRunning || gameOver) return;
    const rotated = rotatePiece(currentPiece);
    if (!checkCollision(rotated, currentPosition, board)) {
      setCurrentPiece(rotated);
    }
  }, [currentPiece, gameRunning, gameOver, rotatePiece, checkCollision, currentPosition, board]);

  // Stable drop function ref to prevent timer resets
  const dropPieceRef = useRef<(() => void) | null>(null);
  
  useEffect(() => {
    dropPieceRef.current = () => {
      movePiece('down');
    };
  });

  useEffect(() => {
    if (gameRunning && !gameOver) {
      gameLoopRef.current = setInterval(() => {
        if (dropPieceRef.current) {
          dropPieceRef.current();
        }
      }, dropTime);
    } else {
      clearInterval(gameLoopRef.current);
    }
    return () => clearInterval(gameLoopRef.current);
  }, [gameRunning, gameOver, dropTime]);

  // Hızlı düşüş için ayrı timer
  useEffect(() => {
    if (fastDrop && gameRunning && !gameOver) {
      fastDropRef.current = setInterval(() => {
        if (dropPieceRef.current) {
          dropPieceRef.current();
        }
      }, 50);
    } else {
      clearInterval(fastDropRef.current);
    }
    return () => clearInterval(fastDropRef.current);
  }, [fastDrop, gameRunning, gameOver]);

  useEffect(() => {
    const handleKeyPress = (e) => {
      if (gameOver) return;
      switch (e.key) {
        case 'ArrowLeft':
          movePiece('left');
          break;
        case 'ArrowRight':
          movePiece('right');
          break;
        case 'ArrowDown':
          if (!fastDrop) {
            setFastDrop(true);
          }
          break;
        case 'ArrowUp':
        case ' ':
          rotatePieceAction();
          break;
      }
    };

    const handleKeyUp = (e) => {
      if (e.key === 'ArrowDown') {
        setFastDrop(false);
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyPress);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [gameOver, movePiece, rotatePieceAction, fastDrop]);

  const handleTouchStart = (e) => {
    e.preventDefault();
    const touch = e.touches[0];
    touchStartRef.current = { x: touch.clientX, y: touch.clientY };
  };

  const handleTouchEnd = (e) => {
    e.preventDefault();
    if (gameOver) return;
    const touch = e.changedTouches[0];
    const deltaX = touch.clientX - touchStartRef.current.x;
    const deltaY = touch.clientY - touchStartRef.current.y;
    const absX = Math.abs(deltaX);
    const absY = Math.abs(deltaY);
    if (Math.max(absX, absY) < 30) return;
    if (absX > absY) {
      if (deltaX > 0) movePiece('right');
      else movePiece('left');
    } else if (deltaY > 0) {
      movePiece('down');
    }
  };

  const startGame = () => {
    setGameRunning(true);
    setGameOver(false);
    if (!currentPiece) spawnNewPiece();
  };

  const pauseGame = () => setGameRunning(false);

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

  const renderBoard = () => {
    let displayBoard = board.map(row => [...row]);
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

  const getLevelColor = () => {
    const colors = ['#10b981', '#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444', '#06b6d4', '#84cc16'];
    return colors[(level - 1) % colors.length];
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      padding: '16px',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center'
    }}>
      <div style={{
        background: 'rgba(255, 255, 255, 0.1)',
        borderRadius: '24px',
        backdropFilter: 'blur(10px)',
        border: '1px solid rgba(255, 255, 255, 0.2)',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
        padding: '24px',
        maxWidth: '600px',
        width: '100%'
      }}>
        
        {/* Geri Dön Butonu */}
        <div style={{ marginBottom: '16px' }}>
          <button
            onClick={goBack}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              color: 'rgba(255, 255, 255, 0.8)',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              fontSize: '14px',
              transition: 'color 0.3s ease'
            }}
            onMouseOver={(e) => (e.target as HTMLButtonElement).style.color = 'white'}
            onMouseOut={(e) => (e.target as HTMLButtonElement).style.color = 'rgba(255, 255, 255, 0.8)'}
          >
            <ArrowLeft size={20} />
            Geri Dön
          </button>
        </div>

        <div style={{ textAlign: 'center', marginBottom: '20px' }}>
          <h1 style={{ 
            fontSize: '24px', 
            fontWeight: 'bold', 
            color: 'white', 
            marginBottom: '16px',
            textShadow: '2px 2px 4px rgba(0,0,0,0.3)'
          }}>
            🎮 Block Stack 🎮
          </h1>
          
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(2, 1fr)', 
            gap: '12px', 
            fontSize: '14px',
            marginBottom: '16px'
          }}>
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '8px', 
              color: '#FFD700',
              background: 'rgba(255, 215, 0, 0.1)',
              padding: '8px 12px',
              borderRadius: '20px',
              backdropFilter: 'blur(10px)'
            }}>
              <Trophy size={16} />
              <span>En Yüksek: {highScore}</span>
            </div>
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '8px', 
              color: '#60A5FA',
              background: 'rgba(96, 165, 250, 0.1)',
              padding: '8px 12px',
              borderRadius: '20px',
              backdropFilter: 'blur(10px)'
            }}>
              <Target size={16} />
              <span>Skor: {score}</span>
            </div>
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '8px', 
              color: '#34D399',
              background: 'rgba(52, 211, 153, 0.1)',
              padding: '8px 12px',
              borderRadius: '20px',
              backdropFilter: 'blur(10px)'
            }}>
              📊
              <span>Satır: {lines}</span>
            </div>
            <div 
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 12px',
                borderRadius: '20px',
                color: 'white',
                fontWeight: 'bold',
                backgroundColor: getLevelColor(),
                textShadow: '1px 1px 2px rgba(0,0,0,0.3)',
                boxShadow: `0 0 15px ${getLevelColor()}40`
              }}
            >
              🎯 Seviye {level}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', alignItems: 'flex-start' }}>
          
          <div 
            style={{
              position: 'relative',
              background: 'rgba(0, 0, 0, 0.4)',
              borderRadius: '12px',
              border: '3px solid rgba(255, 255, 255, 0.3)',
              padding: '8px',
              backdropFilter: 'blur(10px)',
              boxShadow: 'inset 0 0 20px rgba(0, 0, 0, 0.2)'
            }}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
          >
            <div style={{
              display: 'grid',
              gridTemplateColumns: `repeat(${BOARD_WIDTH}, 20px)`,
              gridTemplateRows: `repeat(${BOARD_HEIGHT}, 20px)`,
              gap: '1px',
              background: 'rgba(255, 255, 255, 0.1)',
              padding: '4px',
              borderRadius: '8px'
            }}>
              {renderBoard().map((row, y) =>
                row.map((cell, x) => (
                  <div
                    key={`${y}-${x}`}
                    style={{
                      width: '18px',
                      height: '18px',
                      background: cell === EMPTY_CELL 
                        ? 'rgba(255, 255, 255, 0.1)' 
                        : cell,
                      border: cell === EMPTY_CELL 
                        ? '1px solid rgba(255, 255, 255, 0.1)' 
                        : `2px solid ${cell}`,
                      borderRadius: '2px',
                      boxShadow: cell !== EMPTY_CELL 
                        ? 'inset 0 0 8px rgba(255, 255, 255, 0.3)' 
                        : 'none'
                    }}
                  />
                ))
              )}
            </div>

            {gameOver && (
              <div style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: 'rgba(0, 0, 0, 0.8)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '12px',
                backdropFilter: 'blur(5px)'
              }}>
                <div style={{ textAlign: 'center', color: 'white' }}>
                  <h2 style={{ 
                    fontSize: '28px', 
                    fontWeight: 'bold', 
                    marginBottom: '12px',
                    textShadow: '2px 2px 4px rgba(0,0,0,0.5)'
                  }}>
                    💥 Oyun Bitti!
                  </h2>
                  <p style={{ fontSize: '18px', marginBottom: '8px' }}>Skor: {score}</p>
                  <p style={{ fontSize: '16px', marginBottom: '8px' }}>Seviye: {level}</p>
                  <p style={{ fontSize: '16px', marginBottom: '16px' }}>Satır: {lines}</p>
                  {score === highScore && score > 0 && (
                    <p style={{ 
                      color: '#FFD700', 
                      fontWeight: 'bold', 
                      marginBottom: '16px',
                      textShadow: '0 0 10px rgba(255, 215, 0, 0.5)'
                    }}>
                      🎉 Yeni Rekor!
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Sağ Panel - Sonraki Parça ve Kontroller */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            
            {/* Sonraki Parça */}
            <div style={{
              padding: '8px',
              minWidth: '80px'
            }}>
              <h3 style={{ color: 'white', fontSize: '14px', marginBottom: '8px', textAlign: 'center' }}>
                Sonraki
              </h3>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(4, 15px)',
                gridTemplateRows: 'repeat(4, 15px)',
                gap: '1px',
                justifyContent: 'center'
              }}>
                {(() => {
                  const cells = [];
                  for (let y = 0; y < 4; y++) {
                    for (let x = 0; x < 4; x++) {
                      const isPartOfPiece = nextPiece && 
                        nextPiece.shape[y] && 
                        nextPiece.shape[y][x];
                      
                      cells.push(
                        <div
                          key={`next-${y}-${x}`}
                          style={{
                            width: '13px',
                            height: '13px',
                            background: isPartOfPiece 
                              ? nextPiece.color 
                              : 'rgba(255, 255, 255, 0.1)',
                            border: isPartOfPiece 
                              ? `1px solid ${nextPiece.color}` 
                              : '1px solid rgba(255, 255, 255, 0.1)',
                            borderRadius: '2px',
                            boxShadow: isPartOfPiece 
                              ? 'inset 0 0 5px rgba(255, 255, 255, 0.3)' 
                              : 'none'
                          }}
                        />
                      );
                    }
                  }
                  return cells;
                })()}
              </div>
            </div>

            {/* Oyun Kontrol Butonları */}
            <div style={{ 
              display: 'flex', 
              flexDirection: 'column', 
              alignItems: 'center',
              gap: '6px'
            }}>
              {!gameRunning && !gameOver && (
                <button
                  onClick={startGame}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '4px',
                    background: 'linear-gradient(45deg, #10b981, #34d399)',
                    color: 'white',
                    padding: '6px 10px',
                    borderRadius: '6px',
                    fontWeight: 'bold',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: '11px',
                    width: '64px',
                    height: '28px'
                  }}
                >
                  <Play size={12} />
                  Başlat
                </button>
              )}
              
              {gameRunning && !gameOver && (
                <button
                  onClick={pauseGame}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '4px',
                    background: 'linear-gradient(45deg, #f59e0b, #fbbf24)',
                    color: 'white',
                    padding: '6px 10px',
                    borderRadius: '6px',
                    fontWeight: 'bold',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: '11px',
                    width: '64px',
                    height: '28px'
                  }}
                >
                  <Pause size={12} />
                  Durdur
                </button>
              )}
              
              <button
                onClick={resetGame}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '4px',
                  background: 'linear-gradient(45deg, #ef4444, #f87171)',
                  color: 'white',
                  padding: '6px 10px',
                  borderRadius: '6px',
                  fontWeight: 'bold',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '11px',
                  width: '64px',
                  height: '28px'
                }}
              >
                <RotateCcw size={12} />
                Yenile
              </button>
            </div>

          </div>
        </div>

        <div style={{ marginTop: '24px' }}>
          <div style={{ 
            display: 'flex', 
            flexDirection: 'column', 
            alignItems: 'center', 
            marginBottom: '20px',
            gap: '8px'
          }}>
            <button
              onClick={rotatePieceAction}
              disabled={gameOver}
              style={{
                width: '50px',
                height: '50px',
                borderRadius: '12px',
                background: 'linear-gradient(45deg, #667eea, #764ba2)',
                border: '2px solid rgba(255, 255, 255, 0.3)',
                color: 'white',
                cursor: !gameOver ? 'pointer' : 'not-allowed',
                opacity: gameOver ? 0.5 : 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <RotateCw size={24} />
            </button>
            
            <div style={{ display: 'flex', gap: '30px', alignItems: 'center' }}>
              <button
                onClick={() => movePiece('left')}
                disabled={gameOver}
                style={{
                  width: '50px',
                  height: '50px',
                  borderRadius: '12px',
                  background: 'linear-gradient(45deg, #667eea, #764ba2)',
                  border: '2px solid rgba(255, 255, 255, 0.3)',
                  color: 'white',
                  cursor: !gameOver ? 'pointer' : 'not-allowed',
                  opacity: gameOver ? 0.5 : 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                ⬅️
              </button>
              
              <button
                onMouseDown={() => setFastDrop(true)}
                onMouseUp={() => setFastDrop(false)}
                onMouseLeave={() => setFastDrop(false)}
                onTouchStart={(e) => {
                  e.preventDefault();
                  setFastDrop(true);
                }}
                onTouchEnd={(e) => {
                  e.preventDefault();
                  setFastDrop(false);
                }}
                disabled={gameOver}
                style={{
                  width: '50px',
                  height: '50px',
                  borderRadius: '12px',
                  background: fastDrop 
                    ? 'linear-gradient(45deg, #f59e0b, #fbbf24)' 
                    : 'linear-gradient(45deg, #667eea, #764ba2)',
                  border: '2px solid rgba(255, 255, 255, 0.3)',
                  color: 'white',
                  cursor: !gameOver ? 'pointer' : 'not-allowed',
                  opacity: gameOver ? 0.5 : 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transform: fastDrop ? 'scale(0.95)' : 'scale(1)',
                  transition: 'all 0.1s ease'
                }}
              >
                ⬇️
              </button>
              
              <button
                onClick={() => movePiece('right')}
                disabled={gameOver}
                style={{
                  width: '50px',
                  height: '50px',
                  borderRadius: '12px',
                  background: 'linear-gradient(45deg, #667eea, #764ba2)',
                  border: '2px solid rgba(255, 255, 255, 0.3)',
                  color: 'white',
                  cursor: !gameOver ? 'pointer' : 'not-allowed',
                  opacity: gameOver ? 0.5 : 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                ➡️
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TetrisGame;