import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Play, Pause, RotateCcw, Trophy, Target, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const GRID_SIZE = 20;
const INITIAL_SNAKE = [{ x: 10, y: 10 }];
const INITIAL_DIRECTION = { x: 0, y: -1 };

const SnakeGame = () => {
  const navigate = useNavigate();
  const [snake, setSnake] = useState(INITIAL_SNAKE);
  const [food, setFood] = useState({ x: 5, y: 5 });
  const [direction, setDirection] = useState(INITIAL_DIRECTION);
  const [gameRunning, setGameRunning] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [score, setScore] = useState(0);
  const [level, setLevel] = useState(1);
  const [speed, setSpeed] = useState(200);
  const [highScore, setHighScore] = useState(() => {
    const saved = localStorage.getItem('snakeHighScore');
    return saved ? parseInt(saved) : 0;
  });
  
  const gameAreaRef = useRef(null);
  const gameLoopRef = useRef(null);
  const touchStartRef = useRef({ x: 0, y: 0 });

  // Yeni yiyecek pozisyonu oluştur
  const generateFood = useCallback((currentSnake) => {
    let newFood;
    do {
      newFood = {
        x: Math.floor(Math.random() * GRID_SIZE),
        y: Math.floor(Math.random() * GRID_SIZE)
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
          localStorage.setItem('snakeHighScore', newScore.toString());
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
      if (!gameRunning || gameOver) return;

      switch (e.key) {
        case 'ArrowUp':
          if (direction.y === 0) setDirection({ x: 0, y: -1 });
          break;
        case 'ArrowDown':
          if (direction.y === 0) setDirection({ x: 0, y: 1 });
          break;
        case 'ArrowLeft':
          if (direction.x === 0) setDirection({ x: -1, y: 0 });
          break;
        case 'ArrowRight':
          if (direction.x === 0) setDirection({ x: 1, y: 0 });
          break;
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [direction, gameRunning, gameOver]);

  // Dokunmatik kontroller
  const handleTouchStart = (e) => {
    e.preventDefault();
    const touch = e.touches[0];
    touchStartRef.current = { x: touch.clientX, y: touch.clientY };
  };

  const handleTouchEnd = (e) => {
    e.preventDefault();
    if (!gameRunning || gameOver) return;

    const touch = e.changedTouches[0];
    const deltaX = touch.clientX - touchStartRef.current.x;
    const deltaY = touch.clientY - touchStartRef.current.y;

    const absX = Math.abs(deltaX);
    const absY = Math.abs(deltaY);

    if (Math.max(absX, absY) < 30) return; // Minimum kaydırma mesafesi

    if (absX > absY) {
      // Yatay hareket
      if (deltaX > 0 && direction.x === 0) {
        setDirection({ x: 1, y: 0 }); // Sağ
      } else if (deltaX < 0 && direction.x === 0) {
        setDirection({ x: -1, y: 0 }); // Sol
      }
    } else {
      // Dikey hareket
      if (deltaY > 0 && direction.y === 0) {
        setDirection({ x: 0, y: 1 }); // Aşağı
      } else if (deltaY < 0 && direction.y === 0) {
        setDirection({ x: 0, y: -1 }); // Yukarı
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
    setFood({ x: 5, y: 5 });
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
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 p-4">
      <div className="bg-gray-800 rounded-2xl shadow-2xl p-6 max-w-md w-full">
        
        {/* Geri Dön Butonu */}
        <div className="mb-4">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2 text-white/80 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            Geri Dön
          </button>
        </div>
        {/* Header */}
        <div className="text-center mb-4">
          <h1 className="text-3xl font-bold text-white mb-2">🐍 Snake Game</h1>
          <div className="flex justify-between items-center text-sm">
            <div className="flex items-center gap-2 text-yellow-400">
              <Trophy size={16} />
              <span>En Yüksek: {highScore}</span>
            </div>
            <div className="flex items-center gap-2 text-blue-400">
              <Target size={16} />
              <span>Skor: {score}</span>
            </div>
          </div>
          <div 
            className="mt-2 px-4 py-2 rounded-full text-white font-bold text-lg"
            style={{ backgroundColor: getLevelColor() }}
          >
            Seviye {level}
          </div>
        </div>

        {/* Oyun Alanı */}
        <div 
          ref={gameAreaRef}
          className="relative bg-gray-700 rounded-xl border-4 border-gray-600 mx-auto"
          style={{
            width: GRID_SIZE * 15,
            height: GRID_SIZE * 15,
          }}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          {/* Yılan */}
          {snake.map((segment, index) => (
            <div
              key={index}
              className={`absolute rounded ${index === 0 ? 'bg-green-400' : 'bg-green-500'}`}
              style={{
                left: segment.x * 15,
                top: segment.y * 15,
                width: 14,
                height: 14,
                boxShadow: index === 0 ? '0 0 10px rgba(74, 222, 128, 0.8)' : 'none'
              }}
            />
          ))}

          {/* Yiyecek */}
          <div
            className="absolute bg-red-500 rounded-full animate-pulse"
            style={{
              left: food.x * 15 + 1,
              top: food.y * 15 + 1,
              width: 12,
              height: 12,
              boxShadow: '0 0 15px rgba(239, 68, 68, 0.8)'
            }}
          />

          {/* Game Over Overlay */}
          {gameOver && (
            <div className="absolute inset-0 bg-black bg-opacity-80 flex items-center justify-center rounded-xl">
              <div className="text-center text-white">
                <h2 className="text-2xl font-bold mb-2">Oyun Bitti!</h2>
                <p className="text-lg mb-2">Skor: {score}</p>
                <p className="text-md mb-4">Seviye: {level}</p>
                {score === highScore && score > 0 && (
                  <p className="text-yellow-400 font-bold mb-4">🎉 Yeni Rekor!</p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Kontrol Düğmeleri */}
        <div className="mt-6 space-y-4">
          <div className="flex justify-center gap-4">
            {!gameRunning && !gameOver && (
              <button
                onClick={startGame}
                className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-xl font-bold transition-colors"
              >
                <Play size={20} />
                Başla
              </button>
            )}
            
            {gameRunning && !gameOver && (
              <button
                onClick={pauseGame}
                className="flex items-center gap-2 bg-yellow-600 hover:bg-yellow-700 text-white px-6 py-3 rounded-xl font-bold transition-colors"
              >
                <Pause size={20} />
                Duraklat
              </button>
            )}
            
            <button
              onClick={resetGame}
              className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-xl font-bold transition-colors"
            >
              <RotateCcw size={20} />
              Yeniden
            </button>
          </div>

          {/* Kontrol Talimatları */}
          <div className="text-center text-gray-400 text-sm">
            <p>🖱️ Ok tuşları ile kontrol edin</p>
            <p>📱 Mobilde parmağınızı kaydırın</p>
            <p>🎯 Her 50 puan = Yeni seviye!</p>
          </div>
        </div>

        {/* Seviye Bilgisi */}
        <div className="mt-4 bg-gray-700 rounded-lg p-3">
          <div className="text-white text-sm">
            <div className="flex justify-between mb-1">
              <span>Sonraki Seviye:</span>
              <span>{50 - (score % 50)} puan kaldı</span>
            </div>
            <div className="bg-gray-600 rounded-full h-2">
              <div 
                className="h-2 rounded-full transition-all duration-300"
                style={{ 
                  width: `${(score % 50) * 2}%`,
                  backgroundColor: getLevelColor()
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SnakeGame;