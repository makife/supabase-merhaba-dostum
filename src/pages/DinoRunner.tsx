import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

const DinoRunner = () => {
  const navigate = useNavigate();
  const [gameState, setGameState] = useState('waiting'); // waiting, playing, gameOver
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(parseInt(localStorage.getItem('dinoHighScore') || '0'));
  const [speed, setSpeed] = useState(2);
  const [dinoY, setDinoY] = useState(0);
  const [isJumping, setIsJumping] = useState(false);
  const [obstacles, setObstacles] = useState([]);
  const [clouds, setClouds] = useState([]);
  const [groundOffset, setGroundOffset] = useState(0);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [vibrationEnabled, setVibrationEnabled] = useState(true);

  const gameLoopRef = useRef<number | undefined>();
  const canvasRef = useRef<HTMLDivElement>();
  const gameAreaRef = useRef<HTMLDivElement>();

  // Oyun sabitleri
  const GAME_WIDTH = 600;
  const GAME_HEIGHT = 200;
  const GROUND_HEIGHT = 20;
  const DINO_WIDTH = 30;
  const DINO_HEIGHT = 40;
  const DINO_GROUND_Y = GAME_HEIGHT - GROUND_HEIGHT - DINO_HEIGHT;
  const JUMP_HEIGHT = 100;
  const OBSTACLE_WIDTH = 20;
  const OBSTACLE_HEIGHT = 40;

  // Ses efektleri
  const playSound = useCallback((frequency, duration = 100, type = 'sine') => {
    if (!soundEnabled) return;
    
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.frequency.value = frequency;
      oscillator.type = type;
      
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration / 1000);
      
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + duration / 1000);
    } catch (error) {
      console.log('Ses çalınamadı:', error);
    }
  }, [soundEnabled]);

  // Titreşim efekti
  const vibrate = useCallback((pattern = [50]) => {
    if (!vibrationEnabled) return;
    
    try {
      if (navigator.vibrate) {
        navigator.vibrate(pattern);
      } else if (window.Capacitor && window.Capacitor.Plugins.Haptics) {
        window.Capacitor.Plugins.Haptics.impact({ style: 'light' });
      }
    } catch (error) {
      console.log('Titreşim çalışmadı:', error);
    }
  }, [vibrationEnabled]);

  // Zıplama fonksiyonu
  const jump = useCallback(() => {
    if (gameState !== 'playing' || isJumping) return;
    
    setIsJumping(true);
    playSound(800, 150);
    vibrate([30]);
    
    let jumpProgress = 0;
    const jumpDuration = 600; // Biraz daha uzun zıplama
    const startTime = Date.now();
    
    const jumpAnimation = () => {
      const elapsed = Date.now() - startTime;
      jumpProgress = elapsed / jumpDuration;
      
      if (jumpProgress <= 1) {
        // Daha yüksek parabol hareketi + hafif ileri hareket
        const jumpY = Math.sin(jumpProgress * Math.PI) * JUMP_HEIGHT;
        setDinoY(jumpY);
        requestAnimationFrame(jumpAnimation);
      } else {
        setDinoY(0);
        setIsJumping(false);
      }
    };
    
    jumpAnimation();
  }, [gameState, isJumping, playSound, vibrate]);

  // Engel oluştur
  const createObstacle = useCallback(() => {
    const random = Math.random();
    let type, height;
    
    if (random < 0.3) {
      type = 'short';
      height = 25; // Çok kısa - kolay geçiş
    } else if (random < 0.5) {
      type = 'normal';
      height = 40; // Normal boy
    } else if (random < 0.8) {
      type = 'tall';
      height = 55; // Uzun - zıplamak gerekir
    } else {
      type = 'giant';
      height = 70; // Dev boy - tam zıplama gerekir
    }
    
    return {
      x: GAME_WIDTH,
      y: DINO_GROUND_Y + 10,
      width: OBSTACLE_WIDTH,
      height: height,
      type: type
    };
  }, []);

  // Bulut oluştur
  const createCloud = useCallback(() => {
    return {
      x: GAME_WIDTH,
      y: Math.random() * 60 + 20,
      speed: 0.5 + Math.random() * 0.5
    };
  }, []);

  // Çarpışma kontrolü
  const checkCollision = useCallback((dino, obstacle) => {
    const dinoRect = {
      x: 50,
      y: DINO_GROUND_Y - dinoY,
      width: DINO_WIDTH - 5, // Biraz daha toleranslı
      height: DINO_HEIGHT - 5 // Biraz daha toleranslı
    };
    
    const obstacleRect = {
      x: obstacle.x + 3, // Engelin kenarlarında biraz tolerans
      y: obstacle.y,
      width: obstacle.width - 6, // Daha dar çarpışma alanı
      height: obstacle.height // Artık dinamik height kullanıyoruz
    };
    
    return (
      dinoRect.x < obstacleRect.x + obstacleRect.width &&
      dinoRect.x + dinoRect.width > obstacleRect.x &&
      dinoRect.y < obstacleRect.y + obstacleRect.height &&
      dinoRect.y + dinoRect.height > obstacleRect.y
    );
  }, [dinoY]);

  // Oyunu başlat
  const startGame = useCallback(() => {
    setGameState('playing');
    setScore(0);
    setSpeed(2);
    setDinoY(0);
    setIsJumping(false);
    setObstacles([]);
    setClouds([createCloud()]);
    setGroundOffset(0);
    playSound(440, 200);
    vibrate([100]);
  }, [createCloud, playSound, vibrate]);

  // Oyunu bitir
  const endGame = useCallback(() => {
    setGameState('gameOver');
    
    if (score > highScore) {
      setHighScore(score);
      localStorage.setItem('dinoHighScore', score.toString());
      playSound(660, 300); // Yeni rekor sesi
      vibrate([100, 50, 100, 50, 100]);
    } else {
      playSound(200, 500); // Ölüm sesi
      vibrate([200]);
    }
    
    if (gameLoopRef.current) {
      cancelAnimationFrame(gameLoopRef.current);
    }
  }, [score, highScore, playSound, vibrate]);

  // Oyun döngüsü
  const gameLoop = useCallback(() => {
    if (gameState !== 'playing') return;

    // Puanı artır
    setScore(prev => prev + 1);
    
    // Hızı artır
    setSpeed(prev => Math.min(prev + 0.002, 6));
    
    // Yer offsetini güncelle
    setGroundOffset(prev => (prev + speed) % 40);
    
    // Engelleri güncelle
    setObstacles(prev => {
      let newObstacles = prev.map(obstacle => ({
        ...obstacle,
        x: obstacle.x - speed
      })).filter(obstacle => obstacle.x > -OBSTACLE_WIDTH);
      
      // Yeni engel ekle - random mesafe
      const lastObstacle = newObstacles[newObstacles.length - 1];
      const shouldAddObstacle = newObstacles.length === 0 || 
        (lastObstacle && lastObstacle.x < GAME_WIDTH - (150 + Math.random() * 300));
      
      if (shouldAddObstacle) {
        newObstacles.push(createObstacle());
      }
      
      // Çarpışma kontrolü
      newObstacles.forEach(obstacle => {
        if (checkCollision({ x: 50, y: DINO_GROUND_Y - dinoY }, obstacle)) {
          endGame();
        }
      });
      
      return newObstacles;
    });
    
    // Bulutları güncelle
    setClouds(prev => {
      let newClouds = prev.map(cloud => ({
        ...cloud,
        x: cloud.x - cloud.speed
      })).filter(cloud => cloud.x > -60);
      
      if (Math.random() < 0.005 && newClouds.length < 3) {
        newClouds.push(createCloud());
      }
      
      return newClouds;
    });
    
    gameLoopRef.current = requestAnimationFrame(gameLoop);
  }, [gameState, speed, dinoY, createObstacle, createCloud, checkCollision, endGame]);

  // Klavye kontrolü
  useEffect(() => {
    const handleKeyPress = (e) => {
      if (e.code === 'Space' || e.code === 'ArrowUp') {
        e.preventDefault();
        if (gameState === 'waiting' || gameState === 'gameOver') {
          startGame();
        } else {
          jump();
        }
      }
    };
    
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [gameState, startGame, jump]);

  // Dokunma kontrolü
  const handleTouch = useCallback((e) => {
    e.preventDefault();
    if (gameState === 'waiting' || gameState === 'gameOver') {
      startGame();
    } else {
      jump();
    }
  }, [gameState, startGame, jump]);

  // Oyun döngüsünü başlat
  useEffect(() => {
    if (gameState === 'playing') {
      gameLoopRef.current = requestAnimationFrame(gameLoop);
    }
    
    return () => {
      if (gameLoopRef.current) {
        cancelAnimationFrame(gameLoopRef.current);
      }
    };
  }, [gameState, gameLoop]);

  return (
    <div className="dino-game">
      {/* Geri Dön Butonu */}
      <div className="mb-4">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-white/80 hover:text-white transition-colors bg-transparent border-none cursor-pointer"
        >
          <ArrowLeft className="w-5 h-5" />
          Geri Dön
        </button>
      </div>
      
      <div className="game-header">
        <h2>☢️ Reaktör Oyunu</h2>
        <div className="game-info">
          <span>Puan: {score.toString().padStart(5, '0')}</span>
          <span>En Yüksek: {highScore.toString().padStart(5, '0')}</span>
          <span>Hız: {speed.toFixed(1)}x</span>
        </div>
        
        <div className="settings">
          <button 
            className={`setting-btn ${soundEnabled ? 'active' : ''}`}
            onClick={() => setSoundEnabled(!soundEnabled)}
          >
            🔊 Ses
          </button>
          <button 
            className={`setting-btn ${vibrationEnabled ? 'active' : ''}`}
            onClick={() => setVibrationEnabled(!vibrationEnabled)}
          >
            📳 Titreşim
          </button>
        </div>
      </div>

      <div 
        className="game-area"
        ref={gameAreaRef}
        onTouchStart={handleTouch}
        onClick={handleTouch}
      >
        {/* Bulutlar */}
        {clouds.map((cloud, index) => (
          <div
            key={index}
            className="cloud"
            style={{
              left: `${cloud.x}px`,
              top: `${cloud.y}px`
            }}
          >
            ☁️
          </div>
        ))}
        
        {/* Reaktör */}
        <div
          className={`reactor ${isJumping ? 'jumping' : ''}`}
          style={{
            bottom: `${GROUND_HEIGHT + dinoY}px`
          }}
        >
          ☢️
        </div>
        
        {/* Engeller */}
        {obstacles.map((obstacle, index) => (
          <div
            key={index}
            className={`obstacle ${obstacle.type}`}
            style={{
              left: `${obstacle.x}px`,
              bottom: `${GROUND_HEIGHT}px`,
              height: `${obstacle.height}px`
            }}
          >
            {obstacle.type === 'short' ? '🌱' : 
             obstacle.type === 'normal' ? '🌿' :
             obstacle.type === 'tall' ? '🌵' : '🌲'}
          </div>
        ))}
        
        {/* Zemin */}
        <div 
          className="ground"
          style={{
            backgroundPosition: `${-groundOffset}px 0`
          }}
        />
        
        {/* Oyun durumu overlay */}
        {gameState === 'waiting' && (
          <div className="game-overlay">
            <div className="message">
              <h3>☢️ Reactor Runner</h3>
              <p>Zıplamak için dokunun veya Space tuşuna basın</p>
              <button className="play-btn" onClick={startGame}>
                🚀 Başla
              </button>
            </div>
          </div>
        )}
        
        {gameState === 'gameOver' && (
          <div className="game-overlay">
            <div className="message">
              <h3>💥 Oyun Bitti!</h3>
              <p>Puan: {score}</p>
              {score === highScore && score > 0 && (
                <p className="new-record">🏆 Yeni Rekor!</p>
              )}
              <button className="play-btn" onClick={startGame}>
                🔄 Tekrar Oyna
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="game-instructions">
        <h4>🎮 Nasıl Oynanır:</h4>
        <p>• ☢️ Reaktörün kaktüslere çarpmasını engelleyin</p>
        <p>• 🖱️ Dokunarak veya Space ile zıplayın</p>
        <p>• ⚡ Oyun zamanla hızlanır</p>
        <p>• 🏆 En yüksek puanınızı geçmeye çalışın</p>
      </div>

      <style>{`
        .dino-game {
          max-width: 650px;
          margin: 0 auto;
          padding: 20px;
          font-family: Arial, sans-serif;
          text-align: center;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          border-radius: 15px;
          color: white;
          user-select: none;
        }

        .game-header h2 {
          margin-bottom: 20px;
          color: #fff;
          text-shadow: 2px 2px 4px rgba(0,0,0,0.3);
          font-size: 24px;
        }

        .game-info {
          display: flex;
          justify-content: space-between;
          margin-bottom: 15px;
          flex-wrap: wrap;
          gap: 8px;
        }

        .game-info span {
          background: rgba(255,255,255,0.2);
          padding: 8px 12px;
          border-radius: 20px;
          font-size: 13px;
          backdrop-filter: blur(10px);
          font-weight: bold;
          font-family: 'Courier New', monospace;
        }

        .settings {
          display: flex;
          justify-content: center;
          gap: 10px;
          margin-bottom: 20px;
        }

        .setting-btn {
          background: rgba(255,255,255,0.1);
          border: 2px solid rgba(255,255,255,0.3);
          color: white;
          padding: 8px 16px;
          border-radius: 20px;
          cursor: pointer;
          transition: all 0.3s ease;
          font-size: 12px;
          backdrop-filter: blur(10px);
        }

        .setting-btn.active {
          background: rgba(255,215,0,0.3);
          border-color: #FFD700;
          color: #FFD700;
          box-shadow: 0 0 15px rgba(255,215,0,0.3);
        }

        .game-area {
          position: relative;
          width: 600px;
          height: 200px;
          margin: 0 auto;
          background: linear-gradient(to bottom, #87CEEB 0%, #87CEEB 70%, #DEB887 70%, #DEB887 100%);
          border-radius: 10px;
          overflow: hidden;
          cursor: pointer;
          border: 3px solid rgba(255,255,255,0.3);
          box-shadow: 0 8px 32px rgba(0,0,0,0.3);
        }

        .cloud {
          position: absolute;
          font-size: 20px;
          opacity: 0.8;
          pointer-events: none;
        }

        .reactor {
          position: absolute;
          left: 50px;
          font-size: 30px;
          transition: none;
          z-index: 10;
          animation: reactorSpin 1s linear infinite; /* Sürekli dönen animasyon */
        }

        .reactor.jumping {
          animation: reactorJumpSpin 0.6s ease-in-out;
        }

        @keyframes reactorSpin {
          from { 
            transform: rotate(0deg); 
          }
          to { 
            transform: rotate(360deg); 
          }
        }

        @keyframes reactorJumpSpin {
          0% { 
            transform: rotate(0deg) scale(1); 
          }
          25% { 
            transform: rotate(90deg) scale(1.1); 
          }
          50% { 
            transform: rotate(180deg) scale(1.2); 
          }
          75% { 
            transform: rotate(270deg) scale(1.1); 
          }
          100% { 
            transform: rotate(360deg) scale(1); 
          }
        }

        .obstacle {
          position: absolute;
          width: 20px;
          display: flex;
          align-items: flex-end;
          justify-content: center;
          transition: none;
        }

        .obstacle.short {
          font-size: 18px; /* Küçük bitki */
        }

        .obstacle.normal {
          font-size: 22px; /* Normal bitki */
        }

        .obstacle.tall {
          font-size: 28px; /* Uzun kaktüs */
        }

        .obstacle.giant {
          font-size: 35px; /* Dev ağaç */
        }

        .ground {
          position: absolute;
          bottom: 0;
          left: 0;
          width: 100%;
          height: 20px;
          background: repeating-linear-gradient(
            90deg,
            #8B4513 0px,
            #8B4513 2px,
            #A0522D 2px,
            #A0522D 4px
          );
        }

        .game-overlay {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0,0,0,0.8);
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 10px;
          backdrop-filter: blur(5px);
        }

        .message {
          text-align: center;
          color: white;
          padding: 30px;
          background: rgba(255,255,255,0.1);
          border-radius: 15px;
          backdrop-filter: blur(10px);
        }

        .message h3 {
          margin-bottom: 15px;
          font-size: 24px;
          text-shadow: 2px 2px 4px rgba(0,0,0,0.5);
        }

        .message p {
          margin-bottom: 10px;
          font-size: 16px;
        }

        .new-record {
          color: #FFD700 !important;
          font-weight: bold;
          text-shadow: 0 0 10px rgba(255,215,0,0.5);
          animation: glow 1s ease-in-out infinite alternate;
        }

        @keyframes glow {
          from { text-shadow: 0 0 10px rgba(255,215,0,0.5); }
          to { text-shadow: 0 0 20px rgba(255,215,0,0.8); }
        }

        .play-btn {
          background: linear-gradient(45deg, #4CAF50, #45a049);
          color: white;
          border: none;
          padding: 12px 24px;
          border-radius: 25px;
          font-size: 16px;
          font-weight: bold;
          cursor: pointer;
          transition: all 0.3s ease;
          box-shadow: 0 4px 15px rgba(76, 175, 80, 0.3);
          margin-top: 10px;
        }

        .play-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 20px rgba(76, 175, 80, 0.4);
        }

        .game-instructions {
          background: rgba(255,255,255,0.1);
          padding: 15px;
          border-radius: 15px;
          margin-top: 20px;
          backdrop-filter: blur(10px);
        }

        .game-instructions h4 {
          margin-bottom: 10px;
          color: #FFD700;
          text-shadow: 1px 1px 2px rgba(0,0,0,0.3);
        }

        .game-instructions p {
          margin: 8px 0;
          font-size: 13px;
          text-align: left;
          line-height: 1.4;
        }

        @media (max-width: 650px) {
          .dino-game {
            margin: 0;
            padding: 15px;
            border-radius: 0;
          }
          
          .game-area {
            width: 100%;
            max-width: 500px;
          }
          
          .game-info {
            flex-direction: column;
            align-items: center;
            gap: 5px;
          }

          .settings {
            flex-wrap: wrap;
            gap: 8px;
          }
        }
      `}</style>
    </div>
  );
};

export default DinoRunner;