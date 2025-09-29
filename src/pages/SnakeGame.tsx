import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Play, Pause, RotateCcw, Trophy, Target, ArrowLeft } from 'lucide-react';

const GRID_SIZE = 20;
const INITIAL_SNAKE = [{ x: 10, y: 10 }];
const INITIAL_DIRECTION = { x: 0, y: -1 };

// Meyve emojileri dizisi
const FRUIT_EMOJIS = ['🍎', '🍊', '🍋', '🍌', '🍇', '🍓', '🍑', '🍒', '🥝', '🍐', '🥭', '🍍', '🥥', '🍈', '🍉'];

const SnakeGame = () => {
  const navigate = () => {
    if (window.history.length > 1) {
      window.history.back();
    } else {
      window.location.href = '/';
    }
  };
  
  const [snake, setSnake] = useState(INITIAL_SNAKE);
  const [food, setFood] = useState({ x: 5, y: 5, emoji: FRUIT_EMOJIS[0] });
  const [direction, setDirection] = useState(INITIAL_DIRECTION);
  const [gameRunning, setGameRunning] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [score, setScore] = useState(0);
  const [level, setLevel] = useState(1);
  const [speed, setSpeed] = useState(200);
  const [highScore, setHighScore] = useState(0);
  
  const gameAreaRef = useRef(null);
  const gameLoopRef = useRef(null);
  const touchStartRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const savedScore = Number(sessionStorage.getItem('snakeHighScore')) || 0;
    setHighScore(savedScore);
  }, []);

  // Yön değiştir ve oyunu başlat (eğer durmuşsa)
  const changeDirection = useCallback((newDirection) => {
    setDirection(newDirection);
    if (!gameRunning && !gameOver) {
      setGameRunning(true);
    }
  }, [gameRunning, gameOver]);

  // Yeni yiyecek pozisyonu ve rastgele meyve oluştur
  const generateFood = useCallback((currentSnake) => {
    let newFood;
    do {
      newFood = {
        x: Math.floor(Math.random() * GRID_SIZE),
        y: Math.floor(Math.random() * GRID_SIZE),
        emoji: FRUIT_EMOJIS[Math.floor(Math.random() * FRUIT_EMOJIS.length)]
      };
    } while (currentSnake.some(segment => segment.x === newFood.x && segment.y === newFood.y));
    return newFood;
  }, []);

  // Seviye kontrolü ve hız artışı
  const checkLevelUp = useCallback((currentScore) => {
    const newLevel = Math.floor(currentScore / 50) + 1;
    if (newLevel > level) {
      setLevel(newLevel);
      setSpeed(prev => Math.max(80, prev - 15)); // Her seviyede hız artar
      return true;
    }
    return false;
  }, [level]);

  // Oyun döngüsü
  const gameLoop = useCallback(() => {
    setSnake(prevSnake => {
      if (gameOver || !gameRunning) return prevSnake;

      const newSnake = [...prevSnake];
      const head = { ...newSnake[0] };
      
      head.x += direction.x;
      head.y += direction.y;

      // Duvarlarla çarpışma kontrolü
      if (head.x < 0 || head.x >= GRID_SIZE || head.y < 0 || head.y >= GRID_SIZE) {
        setGameOver(true);
        setGameRunning(false);
        return prevSnake;
      }

      // Kendine çarpışma kontrolü
      if (newSnake.some(segment => segment.x === head.x && segment.y === head.y)) {
        setGameOver(true);
        setGameRunning(false);
        return prevSnake;
      }

      newSnake.unshift(head);

      // Yiyecek yeme kontrolü
      if (head.x === food.x && head.y === food.y) {
        const newScore = score + 10 * level; // Seviye ile çarpan
        setScore(newScore);
        setFood(generateFood(newSnake));
        
        // Level atlama kontrolü
        checkLevelUp(newScore);
        
        // High score kontrolü
        if (newScore > highScore) {
          setHighScore(newScore);
          sessionStorage.setItem('snakeHighScore', newScore.toString());
        }
      } else {
        newSnake.pop();
      }

      return newSnake;
    });
  }, [direction, food, gameOver, gameRunning, score, level, highScore, generateFood, checkLevelUp]);

  // Oyun döngüsünü başlat/durdur
  useEffect(() => {
    if (gameRunning && !gameOver) {
      gameLoopRef.current = setInterval(gameLoop, speed);
    } else {
      clearInterval(gameLoopRef.current);
    }

    return () => clearInterval(gameLoopRef.current);
  }, [gameLoop, gameRunning, gameOver, speed]);

  // Klavye kontrolleri
  useEffect(() => {
    const handleKeyPress = (e) => {
      if (gameOver) return;

      switch (e.key) {
        case 'ArrowUp':
          if (direction.y === 0) changeDirection({ x: 0, y: -1 });
          break;
        case 'ArrowDown':
          if (direction.y === 0) changeDirection({ x: 0, y: 1 });
          break;
        case 'ArrowLeft':
          if (direction.x === 0) changeDirection({ x: -1, y: 0 });
          break;
        case 'ArrowRight':
          if (direction.x === 0) changeDirection({ x: 1, y: 0 });
          break;
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [direction, gameOver, changeDirection]);

  // Dokunmatik kontroller
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

    if (Math.max(absX, absY) < 30) return; // Minimum kaydırma mesafesi

    if (absX > absY) {
      // Yatay hareket
      if (deltaX > 0 && direction.x === 0) {
        changeDirection({ x: 1, y: 0 }); // Sağ
      } else if (deltaX < 0 && direction.x === 0) {
        changeDirection({ x: -1, y: 0 }); // Sol
      }
    } else {
      // Dikey hareket
      if (deltaY > 0 && direction.y === 0) {
        changeDirection({ x: 0, y: 1 }); // Aşağı
      } else if (deltaY < 0 && direction.y === 0) {
        changeDirection({ x: 0, y: -1 }); // Yukarı
      }
    }
  };

  // Oyunu başlat
  const startGame = () => {
    setGameRunning(true);
    setGameOver(false);
  };

  // Oyunu duraklat
  const pauseGame = () => {
    setGameRunning(false);
  };

  // Oyunu sıfırla
  const resetGame = () => {
    setSnake(INITIAL_SNAKE);
    setFood({ x: 5, y: 5, emoji: FRUIT_EMOJIS[Math.floor(Math.random() * FRUIT_EMOJIS.length)] });
    setDirection(INITIAL_DIRECTION);
    setGameRunning(false);
    setGameOver(false);
    setScore(0);
    setLevel(1);
    setSpeed(200);
  };

  // Seviye rengi
  const getLevelColor = () => {
    const colors = ['#10b981', '#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444'];
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
        maxWidth: '448px',
        width: '100%'
      }}>
        
        {/* Geri Dön Butonu */}
        <div style={{ marginBottom: '16px' }}>
          <button
            onClick={() => navigate()}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              color: 'rgba(255, 255, 255, 0.8)',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              transition: 'color 0.3s ease',
              fontSize: '14px'
            }}
            onMouseOver={(e) => (e.target as HTMLButtonElement).style.color = 'white'}
            onMouseOut={(e) => (e.target as HTMLButtonElement).style.color = 'rgba(255, 255, 255, 0.8)'}
          >
            <ArrowLeft size={20} />
            Geri Dön
          </button>
        </div>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '16px' }}>
          <h1 style={{ 
            fontSize: '20px', 
            fontWeight: 'bold', 
            color: 'white', 
            marginBottom: '8px',
            textShadow: '2px 2px 4px rgba(0,0,0,0.3)'
          }}>
            🐍 Yılan Oyunu
          </h1>
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center', 
            fontSize: '14px' 
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
          </div>
          <div 
            style={{
              marginTop: '8px',
              padding: '7px 16px',
              borderRadius: '9999px',
              color: 'white',
              fontWeight: 'bold',
              fontSize: '18px',
              backgroundColor: getLevelColor(),
              textShadow: '1px 1px 2px rgba(0,0,0,0.3)',
              boxShadow: `0 0 20px ${getLevelColor()}40`
            }}
          >
            Seviye {level}
          </div>

          {/* Seviye İlerleme Çubuğu */}
          <div style={{
            marginTop: '12px',
            background: 'rgba(255, 255, 255, 0.1)',
            borderRadius: '12px',
            padding: '12px',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(255, 255, 255, 0.1)'
          }}>
            <div style={{ color: 'white', fontSize: '14px' }}>
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                marginBottom: '4px' 
              }}>
                <span>Sonraki Seviye:</span>
                <span style={{ color: '#FFD700' }}>{50 - (score % 50)} puan kaldı</span>
              </div>
              <div style={{
                background: 'rgba(255, 255, 255, 0.2)',
                borderRadius: '9999px',
                height: '8px',
                overflow: 'hidden'
              }}>
                <div 
                  style={{ 
                    height: '8px',
                    borderRadius: '9999px',
                    transition: 'all 0.3s ease',
                    width: `${(score % 50) * 2}%`,
                    background: `linear-gradient(90deg, ${getLevelColor()}, ${getLevelColor()}aa)`,
                    boxShadow: `0 0 10px ${getLevelColor()}60`
                  }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Oyun Alanı */}
        <div 
          ref={gameAreaRef}
          style={{
            position: 'relative',
            background: 'rgba(0, 0, 0, 0.3)',
            borderRadius: '12px',
            border: '4px solid rgba(255, 255, 255, 0.2)',
            margin: '0 auto',
            width: GRID_SIZE * 15,
            height: GRID_SIZE * 15,
            backdropFilter: 'blur(10px)',
            boxShadow: 'inset 0 0 20px rgba(0, 0, 0, 0.2)'
          }}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          {/* Yılan */}
          {snake.map((segment, index) => (
            <div
              key={index}
              style={{
                position: 'absolute',
                left: segment.x * 15 + 1,
                top: segment.y * 15 + 1,
                width: 13,
                height: 13,
                borderRadius: index === 0 ? '50%' : '4px',
                background: index === 0 
                  ? 'linear-gradient(45deg, #10b981, #34d399)' 
                  : 'linear-gradient(45deg, #059669, #10b981)',
                boxShadow: index === 0 
                  ? '0 0 15px rgba(16, 185, 129, 0.8), inset 0 0 10px rgba(255, 255, 255, 0.3)' 
                  : 'inset 0 0 5px rgba(255, 255, 255, 0.2)',
                animation: index === 0 ? 'pulse 2s infinite' : 'none'
              }}
            />
          ))}

          {/* Meyve Yiyecek */}
          <div
            style={{
              position: 'absolute',
              left: food.x * 15 + 1,
              top: food.y * 15 + 1,
              width: 13,
              height: 13,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '11px',
              animation: 'bounce 1.5s infinite',
              filter: 'drop-shadow(0 0 8px rgba(255, 255, 255, 0.6))'
            }}
          >
            {food.emoji}
          </div>

          {/* Game Over Overlay */}
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
                  fontSize: '24px', 
                  fontWeight: 'bold', 
                  marginBottom: '8px',
                  textShadow: '2px 2px 4px rgba(0,0,0,0.5)'
                }}>
                  💥 Oyun Bitti!
                </h2>
                <p style={{ fontSize: '18px', marginBottom: '8px' }}>Skor: {score}</p>
                <p style={{ fontSize: '16px', marginBottom: '16px' }}>Seviye: {level}</p>
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

        {/* Kontrol Düğmeleri */}
        <div style={{ marginTop: '24px' }}>
          {/* Yön Kontrol Butonları */}
          <div style={{ 
            display: 'flex', 
            flexDirection: 'column', 
            alignItems: 'center', 
            marginBottom: '20px',
            gap: '8px'
          }}>
            {/* Yukarı */}
            <button
              onClick={() => {
                if (direction.y === 0) {
                  changeDirection({ x: 0, y: -1 });
                }
              }}
              disabled={gameOver}
              style={{
                width: '50px',
                height: '50px',
                borderRadius: '12px',
                background: 'linear-gradient(45deg, #667eea, #764ba2)',
                border: '2px solid rgba(255, 255, 255, 0.3)',
                color: 'white',
                fontSize: '20px',
                cursor: !gameOver ? 'pointer' : 'not-allowed',
                transition: 'all 0.3s ease',
                backdropFilter: 'blur(10px)',
                opacity: gameOver ? 0.5 : 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
              onMouseOver={(e) => {
                if (!gameOver) {
                  const target = e.target as HTMLButtonElement;
                  target.style.transform = 'scale(1.1)';
                  target.style.boxShadow = '0 0 20px rgba(102, 126, 234, 0.5)';
                }
              }}
              onMouseOut={(e) => {
                const target = e.target as HTMLButtonElement;
                target.style.transform = 'scale(1)';
                target.style.boxShadow = 'none';
              }}
            >
              ⬆️
            </button>
            
            {/* Sol - Aşağı - Sağ */}
            <div style={{ display: 'flex', gap: '30px', alignItems: 'center' }}>
              <button
                onClick={() => {
                  if (direction.x === 0) {
                    changeDirection({ x: -1, y: 0 });
                  }
                }}
                disabled={gameOver}
                style={{
                  width: '50px',
                  height: '50px',
                  borderRadius: '12px',
                  background: 'linear-gradient(45deg, #667eea, #764ba2)',
                  border: '2px solid rgba(255, 255, 255, 0.3)',
                  color: 'white',
                  fontSize: '20px',
                  cursor: !gameOver ? 'pointer' : 'not-allowed',
                  transition: 'all 0.3s ease',
                  backdropFilter: 'blur(10px)',
                  opacity: gameOver ? 0.5 : 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
                onMouseOver={(e) => {
                  if (!gameOver) {
                    const target = e.target as HTMLButtonElement;
                    target.style.transform = 'scale(1.1)';
                    target.style.boxShadow = '0 0 20px rgba(102, 126, 234, 0.5)';
                  }
                }}
                onMouseOut={(e) => {
                  const target = e.target as HTMLButtonElement;
                  target.style.transform = 'scale(1)';
                  target.style.boxShadow = 'none';
                }}
              >
                ⬅️
              </button>
              
              <button
                onClick={() => {
                  if (direction.y === 0) {
                    changeDirection({ x: 0, y: 1 });
                  }
                }}
                disabled={gameOver}
                style={{
                  width: '50px',
                  height: '50px',
                  borderRadius: '12px',
                  background: 'linear-gradient(45deg, #667eea, #764ba2)',
                  border: '2px solid rgba(255, 255, 255, 0.3)',
                  color: 'white',
                  fontSize: '20px',
                  cursor: !gameOver ? 'pointer' : 'not-allowed',
                  transition: 'all 0.3s ease',
                  backdropFilter: 'blur(10px)',
                  opacity: gameOver ? 0.5 : 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
                onMouseOver={(e) => {
                  if (!gameOver) {
                    const target = e.target as HTMLButtonElement;
                    target.style.transform = 'scale(1.1)';
                    target.style.boxShadow = '0 0 20px rgba(102, 126, 234, 0.5)';
                  }
                }}
                onMouseOut={(e) => {
                  const target = e.target as HTMLButtonElement;
                  target.style.transform = 'scale(1)';
                  target.style.boxShadow = 'none';
                }}
              >
                ⬇️
              </button>
              
              <button
                onClick={() => {
                  if (direction.x === 0) {
                    changeDirection({ x: 1, y: 0 });
                  }
                }}
                disabled={gameOver}
                style={{
                  width: '50px',
                  height: '50px',
                  borderRadius: '12px',
                  background: 'linear-gradient(45deg, #667eea, #764ba2)',
                  border: '2px solid rgba(255, 255, 255, 0.3)',
                  color: 'white',
                  fontSize: '20px',
                  cursor: !gameOver ? 'pointer' : 'not-allowed',
                  transition: 'all 0.3s ease',
                  backdropFilter: 'blur(10px)',
                  opacity: gameOver ? 0.5 : 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
                onMouseOver={(e) => {
                  if (!gameOver) {
                    const target = e.target as HTMLButtonElement;
                    target.style.transform = 'scale(1.1)';
                    target.style.boxShadow = '0 0 20px rgba(102, 126, 234, 0.5)';
                  }
                }}
                onMouseOut={(e) => {
                  const target = e.target as HTMLButtonElement;
                  target.style.transform = 'scale(1)';
                  target.style.boxShadow = 'none';
                }}
              >
                ➡️
              </button>
            </div>
          </div>

          <div style={{ 
            display: 'flex', 
            justifyContent: 'center', 
            gap: '16px',
            marginBottom: '16px'
          }}>
            {!gameRunning && !gameOver && (
              <button
                onClick={startGame}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  background: 'linear-gradient(45deg, #10b981, #34d399)',
                  color: 'white',
                  padding: '12px 24px',
                  borderRadius: '12px',
                  fontWeight: 'bold',
                  border: 'none',
                  cursor: 'pointer',
                  transition: 'all 0.3s ease',
                  boxShadow: '0 4px 15px rgba(16, 185, 129, 0.3)',
                  fontSize: '16px'
                }}
                onMouseOver={(e) => {
                  const target = e.target as HTMLButtonElement;
                  target.style.transform = 'translateY(-2px)';
                  target.style.boxShadow = '0 6px 20px rgba(16, 185, 129, 0.4)';
                }}
                onMouseOut={(e) => {
                  const target = e.target as HTMLButtonElement;
                  target.style.transform = 'translateY(0)';
                  target.style.boxShadow = '0 4px 15px rgba(16, 185, 129, 0.3)';
                }}
              >
                <Play size={20} />
                Başla
              </button>
            )}
            
            {gameRunning && !gameOver && (
              <button
                onClick={pauseGame}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  background: 'linear-gradient(45deg, #f59e0b, #fbbf24)',
                  color: 'white',
                  padding: '12px 24px',
                  borderRadius: '12px',
                  fontWeight: 'bold',
                  border: 'none',
                  cursor: 'pointer',
                  transition: 'all 0.3s ease',
                  boxShadow: '0 4px 15px rgba(245, 158, 11, 0.3)',
                  fontSize: '16px'
                }}
                onMouseOver={(e) => {
                  const target = e.target as HTMLButtonElement;
                  target.style.transform = 'translateY(-2px)';
                  target.style.boxShadow = '0 6px 20px rgba(245, 158, 11, 0.4)';
                }}
                onMouseOut={(e) => {
                  const target = e.target as HTMLButtonElement;
                  target.style.transform = 'translateY(0)';
                  target.style.boxShadow = '0 4px 15px rgba(245, 158, 11, 0.3)';
                }}
              >
                <Pause size={20} />
                Duraklat
              </button>
            )}
            
            <button
              onClick={resetGame}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                background: 'linear-gradient(45deg, #ef4444, #f87171)',
                color: 'white',
                padding: '12px 24px',
                borderRadius: '12px',
                fontWeight: 'bold',
                border: 'none',
                cursor: 'pointer',
                transition: 'all 0.3s ease',
                boxShadow: '0 4px 15px rgba(239, 68, 68, 0.3)',
                fontSize: '16px'
              }}
              onMouseOver={(e) => {
                const target = e.target as HTMLButtonElement;
                target.style.transform = 'translateY(-2px)';
                target.style.boxShadow = '0 6px 20px rgba(239, 68, 68, 0.4)';
              }}
              onMouseOut={(e) => {
                const target = e.target as HTMLButtonElement;
                target.style.transform = 'translateY(0)';
                target.style.boxShadow = '0 4px 15px rgba(239, 68, 68, 0.3)';
              }}
            >
              <RotateCcw size={20} />
              Yeniden
            </button>
          </div>

          {/* Kontrol Talimatları */}
          <div style={{ 
            textAlign: 'center', 
            color: 'rgba(255, 255, 255, 0.8)', 
            fontSize: '14px',
            background: 'rgba(255, 255, 255, 0.1)',
            padding: '12px',
            borderRadius: '12px',
            backdropFilter: 'blur(10px)'
          }}>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% {
            opacity: 1;
            transform: scale(1);
          }
          50% {
            opacity: 0.8;
            transform: scale(1.05);
          }
        }

        @keyframes bounce {
          0%, 100% {
            transform: scale(1) rotate(0deg);
          }
          25% {
            transform: scale(1.1) rotate(-5deg);
          }
          50% {
            transform: scale(1.15) rotate(0deg);
          }
          75% {
            transform: scale(1.1) rotate(5deg);
          }
        }

        @media (max-width: 480px) {
          /* Mobil responsive ayarları */
        }
      `}</style>
    </div>
  );
};

export default SnakeGame;