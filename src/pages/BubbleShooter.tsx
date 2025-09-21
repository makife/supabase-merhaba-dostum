import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ArrowLeft } from 'lucide-react';

const BubbleShooter = () => {
  const [gameState, setGameState] = useState('waiting');
  const [score, setScore] = useState(0);
  const [level, setLevel] = useState(1);
  const [bubbles, setBubbles] = useState([]);
  const [currentBubble, setCurrentBubble] = useState(null);
  const [nextBubble, setNextBubble] = useState(null);
  const [shooterAngle, setShooterAngle] = useState(0);
  const [isAiming, setIsAiming] = useState(false);
  const [shootingBubble, setShootingBubble] = useState(null);
  const [explodingBubbles, setExplodingBubbles] = useState([]);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [vibrationEnabled, setVibrationEnabled] = useState(true);
  const [shotCount, setShotCount] = useState(0);
  const [nextRowWarning, setNextRowWarning] = useState(false);
  
  const gameAreaRef = useRef(null);
  const shooterRef = useRef(null);
  const animationRef = useRef(null);
  
  const BUBBLE_SIZE = 30;
  const GRID_WIDTH = 12;
  const GRID_HEIGHT = 10;
  const SHOOTER_X = 185;
  const SHOOTER_Y = 450;
  const BUBBLE_SPEED = 8;
  const SHOTS_PER_NEW_ROW = 8; // Her 8 atışta bir yeni sıra
  
  const COLORS = ['🔴', '🟡', '🔵', '🟢', '🟠', '🟣'];
  
  const playSound = useCallback((frequency, duration = 150, type = 'sine') => {
    if (!soundEnabled) return;
    
    try {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.frequency.value = frequency;
      oscillator.type = type;
      
      gainNode.gain.setValueAtTime(0.2, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration / 1000);
      
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + duration / 1000);
    } catch (error) {
      console.log('Ses çalınamadı:', error);
    }
  }, [soundEnabled]);

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

  const getRandomColor = useCallback(() => {
    return COLORS[Math.floor(Math.random() * Math.min(COLORS.length, 3 + level))];
  }, [level]);

  const createBubble = useCallback((color, id) => {
    return {
      color: color,
      id: id,
      timestamp: Date.now()
    };
  }, []);

  const getBubblePosition = useCallback((row, col) => {
    const offsetX = (row % 2) * (BUBBLE_SIZE / 2);
    return {
      x: col * BUBBLE_SIZE + offsetX + 10,
      y: row * (BUBBLE_SIZE * 0.85) + 10
    };
  }, []);

  // Yeni sıra ekle
  const addNewRow = useCallback(() => {
    setBubbles(prevBubbles => {
      const newBubbles = [...prevBubbles];
      
      // Tüm balonları aşağı kaydır
      newBubbles.forEach(bubble => {
        bubble.row += 1;
        bubble.y += BUBBLE_SIZE * 0.85;
      });
      
      // Yeni sırayı en üste ekle
      const newRow = 0;
      const maxCols = newRow % 2 === 0 ? GRID_WIDTH : GRID_WIDTH - 1;
      
      for (let col = 0; col < maxCols; col++) {
        if (Math.random() < 0.7) { // %70 doluluk
          const pos = getBubblePosition(newRow, col);
          newBubbles.push({
            id: `newrow-${Date.now()}-${col}`,
            row: newRow,
            col,
            x: pos.x,
            y: pos.y,
            color: getRandomColor(),
            isNew: true
          });
        }
      }
      
      return newBubbles;
    });
    
    playSound(150, 300, 'triangle');
    vibrate([100, 50, 100]);
    setNextRowWarning(false);
  }, [getBubblePosition, getRandomColor, playSound, vibrate]);

  const getGridPosition = useCallback((x, y) => {
    const row = Math.round(y / (BUBBLE_SIZE * 0.85));
    const offsetX = (row % 2) * (BUBBLE_SIZE / 2);
    const col = Math.round((x - offsetX - 10) / BUBBLE_SIZE);
    
    const clampedRow = Math.max(0, Math.min(row, GRID_HEIGHT - 1));
    const maxCol = clampedRow % 2 === 0 ? GRID_WIDTH - 1 : GRID_WIDTH - 2;
    const clampedCol = Math.max(0, Math.min(col, maxCol));
    
    return { row: clampedRow, col: clampedCol };
  }, []);

  const findConnectedBubbles = useCallback((bubbles, startRow, startCol, color) => {
    const connected = new Set();
    const stack = [[startRow, startCol]];
    
    while (stack.length > 0) {
      const [row, col] = stack.pop();
      const key = `${row}-${col}`;
      
      if (connected.has(key)) continue;
      
      const bubble = bubbles.find(b => b.row === row && b.col === col);
      if (!bubble || bubble.color !== color) continue;
      
      connected.add(key);
      
      let neighbors;
      if (row % 2 === 0) {
        neighbors = [
          [row - 1, col - 1], [row - 1, col],
          [row, col - 1], [row, col + 1],
          [row + 1, col - 1], [row + 1, col]
        ];
      } else {
        neighbors = [
          [row - 1, col], [row - 1, col + 1],
          [row, col - 1], [row, col + 1],
          [row + 1, col], [row + 1, col + 1]
        ];
      }
      
      neighbors.forEach(([r, c]) => {
        if (r >= 0 && r < GRID_HEIGHT && c >= 0) {
          const maxCol = r % 2 === 0 ? GRID_WIDTH : GRID_WIDTH - 1;
          if (c < maxCol) {
            stack.push([r, c]);
          }
        }
      });
    }
    
    return Array.from(connected).map(key => {
      const [row, col] = key.split('-').map(Number);
      return bubbles.find(b => b.row === row && b.col === col);
    }).filter(Boolean);
  }, []);

  const initializeGame = useCallback(() => {
    const initialBubbles = [];
    const rows = Math.min(5 + Math.floor(level / 2), 8);
    
    for (let row = 0; row < rows; row++) {
      const maxCols = row % 2 === 0 ? GRID_WIDTH : GRID_WIDTH - 1;
      for (let col = 0; col < maxCols; col++) {
        if (Math.random() < 0.85) {
          const pos = getBubblePosition(row, col);
          initialBubbles.push({
            id: `${row}-${col}`,
            row,
            col,
            x: pos.x,
            y: pos.y,
            color: getRandomColor()
          });
        }
      }
    }
    
    setBubbles(initialBubbles);
    setCurrentBubble(createBubble(getRandomColor(), 'current'));
    setNextBubble(createBubble(getRandomColor(), 'next'));
    setShootingBubble(null);
    setExplodingBubbles([]);
    setShotCount(0);
    setNextRowWarning(false);
  }, [level, getBubblePosition, getRandomColor, createBubble]);

  const startGame = useCallback(() => {
    setGameState('playing');
    setScore(0);
    setLevel(1);
    playSound(440, 200);
    vibrate([100]);
    initializeGame();
  }, [playSound, vibrate, initializeGame]);

  const stopAnimation = useCallback(() => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
  }, []);

  const shoot = useCallback((targetX, targetY) => {
    if (gameState !== 'playing' || !currentBubble || shootingBubble) return;
    
    stopAnimation();
    
    const dx = targetX - SHOOTER_X;
    const dy = targetY - SHOOTER_Y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    const dirX = dx / distance;
    const dirY = dy / distance;
    
    const shootBubble = {
      color: currentBubble.color,
      id: `shooting-${Date.now()}`,
      x: SHOOTER_X,
      y: SHOOTER_Y,
      dirX,
      dirY,
      speed: BUBBLE_SPEED
    };
    
    setShootingBubble(shootBubble);
    playSound(300, 100);
    vibrate([30]);
    
    const animateShoot = () => {
      setShootingBubble(prev => {
        if (!prev) return null;
        
        let newX = prev.x + prev.dirX * prev.speed;
        let newY = prev.y + prev.dirY * prev.speed;
        let newDirX = prev.dirX;
        let newDirY = prev.dirY;
        
        if (newX <= BUBBLE_SIZE/2 || newX >= 370 - BUBBLE_SIZE/2) {
          newDirX *= -1;
          playSound(250, 50);
        }
        
        if (newY <= BUBBLE_SIZE/2) {
          newDirY *= -1;
          playSound(250, 50);
        }
        
        const hitBubble = bubbles.find(bubble => {
          const dist = Math.sqrt(
            Math.pow(newX - bubble.x - BUBBLE_SIZE/2, 2) + 
            Math.pow(newY - bubble.y - BUBBLE_SIZE/2, 2)
          );
          return dist < BUBBLE_SIZE * 0.9;
        });
        
        if (hitBubble || newY > 480) {
          let bestRow = Math.round(newY / (BUBBLE_SIZE * 0.85));
          let bestCol = 0;
          let minDistance = Infinity;
          
          for (let r = Math.max(0, bestRow - 1); r <= Math.min(GRID_HEIGHT - 1, bestRow + 1); r++) {
            const maxCols = r % 2 === 0 ? GRID_WIDTH : GRID_WIDTH - 1;
            for (let c = 0; c < maxCols; c++) {
              const isOccupied = bubbles.some(b => b.row === r && b.col === c);
              if (!isOccupied) {
                const pos = getBubblePosition(r, c);
                const distance = Math.sqrt(
                  Math.pow(newX - pos.x - BUBBLE_SIZE/2, 2) + 
                  Math.pow(newY - pos.y - BUBBLE_SIZE/2, 2)
                );
                if (distance < minDistance) {
                  minDistance = distance;
                  bestRow = r;
                  bestCol = c;
                }
              }
            }
          }
          
          const finalPos = getBubblePosition(bestRow, bestCol);
          
          const newBubble = {
            id: `new-${Date.now()}`,
            row: bestRow,
            col: bestCol,
            x: finalPos.x,
            y: finalPos.y,
            color: prev.color,
            isNew: true
          };
          
          setBubbles(prevBubbles => {
            const updated = [...prevBubbles, newBubble];
            
            const connected = findConnectedBubbles(updated, bestRow, bestCol, prev.color);
            
            if (connected.length >= 3) {
              setExplodingBubbles(connected);
              playSound(800, 200);
              vibrate([50, 25, 50]);
              setScore(s => s + connected.length * 10 * level);
              
              setTimeout(() => {
                setBubbles(current => {
                  const remaining = current.filter(b => !connected.some(c => c.id === b.id));
                  
                  if (remaining.length === 0) {
                    setGameState('won');
                    playSound(660, 300);
                    setTimeout(() => playSound(880, 300), 150);
                    vibrate([100, 50, 100, 50, 100]);
                  }
                  
                  return remaining;
                });
                setExplodingBubbles([]);
              }, 300);
              
              return updated;
            } else {
              playSound(400, 100);
              vibrate([30]);
              return updated;
            }
          });
          
          // Atış sayısını artır ve yeni sıra kontrolü
          setShotCount(prev => {
            const newCount = prev + 1;
            if (newCount % SHOTS_PER_NEW_ROW === SHOTS_PER_NEW_ROW - 2) {
              // 2 atış kala uyarı ver
              setNextRowWarning(true);
              playSound(200, 100);
            } else if (newCount % SHOTS_PER_NEW_ROW === 0) {
              // Yeni sıra ekle
              setTimeout(() => addNewRow(), 500);
            }
            return newCount;
          });
          
          setCurrentBubble(createBubble(nextBubble.color, `current-${Date.now()}`));
          setNextBubble(createBubble(getRandomColor(), `next-${Date.now()}`));
          setShootingBubble(null);
          return null;
        }
        
        return {
          ...prev,
          x: newX,
          y: newY,
          dirX: newDirX,
          dirY: newDirY
        };
      });
      
      animationRef.current = requestAnimationFrame(animateShoot);
    };
    
    animationRef.current = requestAnimationFrame(animateShoot);
    
  }, [gameState, currentBubble, nextBubble, bubbles, shootingBubble, getBubblePosition, findConnectedBubbles, getRandomColor, createBubble, playSound, vibrate, level, stopAnimation]);

  const handleAiming = useCallback((e) => {
    if (gameState !== 'playing') return;
    
    const rect = gameAreaRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    const clientX = e.clientX || (e.touches && e.touches[0]?.clientX);
    const clientY = e.clientY || (e.touches && e.touches[0]?.clientY);
    
    if (!clientX || !clientY) return;
    
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    
    const angle = Math.atan2(y - SHOOTER_Y, x - SHOOTER_X);
    setShooterAngle(angle);
    setIsAiming(true);
  }, [gameState]);

  const handleShoot = useCallback((e) => {
    if (gameState !== 'playing' || !isAiming) return;
    
    const rect = gameAreaRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    const clientX = e.clientX || (e.changedTouches && e.changedTouches[0]?.clientX);
    const clientY = e.clientY || (e.changedTouches && e.changedTouches[0]?.clientY);
    
    if (!clientX || !clientY) return;
    
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    
    shoot(x, y);
    setIsAiming(false);
  }, [gameState, isAiming, shoot]);

  const nextLevel = useCallback(() => {
    setLevel(prev => prev + 1);
    setGameState('playing');
    initializeGame();
    playSound(550, 250);
    vibrate([75, 25, 75]);
  }, [initializeGame, playSound, vibrate]);

  useEffect(() => {
    if (bubbles.length > 0) {
      const lowestBubble = Math.max(...bubbles.map(b => b.row));
      if (lowestBubble >= GRID_HEIGHT - 2) {
        setGameState('gameOver');
        playSound(200, 500);
        vibrate([200]);
      }
    }
  }, [bubbles, playSound, vibrate]);

  useEffect(() => {
    return () => {
      stopAnimation();
    };
  }, [stopAnimation]);

  return (
    <div className="bubble-game">
      <div className="mb-4 relative z-20">
        <button
          onClick={() => window.history.back()}
          className="flex items-center gap-2 text-white/80 hover:text-white transition-colors bg-transparent border-none cursor-pointer p-2"
          style={{ fontSize: '14px' }}
        >
          <ArrowLeft className="w-5 h-5" />
          Geri Dön
        </button>
      </div>
      
      <div className="game-header">
        <h2>🫧 Bubble Shooter</h2>
        <div className="game-info">
          <span>Seviye: {level}</span>
          <span>Puan: {score}</span>
          <span>Kalan: {bubbles.length}</span>
          <span className={nextRowWarning ? 'warning' : ''}>
            Atış: {shotCount % SHOTS_PER_NEW_ROW + 1}/{SHOTS_PER_NEW_ROW}
          </span>
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
        onMouseMove={handleAiming}
        onMouseDown={handleShoot}
        onTouchMove={handleAiming}
        onTouchEnd={handleShoot}
      >
        {bubbles.map((bubble) => (
          <div
            key={bubble.id}
            className={`bubble ${bubble.isNew ? 'new' : ''} ${
              explodingBubbles.some(eb => eb.id === bubble.id) ? 'exploding' : ''
            }`}
            style={{
              left: `${bubble.x}px`,
              top: `${bubble.y}px`
            }}
          >
            {bubble.color}
          </div>
        ))}
        
        {shootingBubble && (
          <div
            className="shooting-bubble"
            style={{
              left: `${shootingBubble.x - 15}px`,
              top: `${shootingBubble.y - 15}px`
            }}
          >
            {shootingBubble.color}
          </div>
        )}
        
        {isAiming && gameState === 'playing' && (
          <div
            className="aim-line"
            style={{
              left: `${SHOOTER_X}px`,
              top: `${SHOOTER_Y}px`,
              transform: `rotate(${shooterAngle}rad)`,
              transformOrigin: '0 0'
            }}
          />
        )}
        
        <div 
          className="shooter"
          ref={shooterRef}
          style={{
            left: `${SHOOTER_X - 20}px`,
            top: `${SHOOTER_Y - 20}px`
          }}
        >
          🎯
        </div>
        
        {currentBubble && (
          <div
            className="current-bubble"
            style={{
              left: `${SHOOTER_X - 15}px`,
              top: `${SHOOTER_Y - 15}px`
            }}
          >
            {currentBubble.color}
          </div>
        )}
        
        {nextBubble && (
          <div className="next-bubble">
            <span>Sonraki:</span>
            <div className="next-bubble-icon">{nextBubble.color}</div>
          </div>
        )}
        
        {nextRowWarning && (
          <div className="row-warning">
            ⚠️ Yeni sıra geliyor!
          </div>
        )}
        
        {gameState === 'waiting' && (
          <div className="game-overlay">
            <div className="message">
              <h3>🫧 Bubble Shooter</h3>
              <p>3 veya daha fazla aynı renk balonu eşleştirin!</p>
              <button className="play-btn" onClick={startGame}>
                🚀 Başla
              </button>
            </div>
          </div>
        )}
        
        {gameState === 'won' && (
          <div className="game-overlay">
            <div className="message">
              <h3>🎉 Seviye Tamamlandı!</h3>
              <p>Puan: {score}</p>
              <button className="play-btn" onClick={nextLevel}>
                ⏭️ Sonraki Seviye
              </button>
            </div>
          </div>
        )}
        
        {gameState === 'gameOver' && (
          <div className="game-overlay">
            <div className="message">
              <h3>💥 Oyun Bitti!</h3>
              <p>Seviye: {level} | Puan: {score}</p>
              <button className="play-btn" onClick={startGame}>
                🔄 Tekrar Oyna
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="game-instructions">
        <h4>🎮 Nasıl Oynanır:</h4>
        <p>• 🎯 Nişan alın ve balonları fırlatın</p>
        <p>• 🔴 3+ aynı renk balon eşleştirin</p>
        <p>• 🏆 Tüm balonları temizleyin</p>
        <p>• ⚡ Her seviye daha zor olur</p>
      </div>

      <style>{`
        .bubble-game {
          max-width: 400px;
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

        .game-info span.warning {
          background: rgba(255, 69, 0, 0.3);
          border: 2px solid #FF4500;
          color: #FFD700;
          animation: warningPulse 1s infinite;
        }

        @keyframes warningPulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.7; transform: scale(1.05); }
        }

        .row-warning {
          position: absolute;
          top: 50px;
          left: 50%;
          transform: translateX(-50%);
          background: rgba(255, 69, 0, 0.9);
          color: white;
          padding: 10px 20px;
          border-radius: 25px;
          font-weight: bold;
          font-size: 14px;
          z-index: 15;
          animation: warningBounce 0.5s ease-in-out infinite alternate;
          box-shadow: 0 4px 15px rgba(255, 69, 0, 0.4);
        }

        @keyframes warningBounce {
          0% { transform: translateX(-50%) translateY(0px); }
          100% { transform: translateX(-50%) translateY(-5px); }
        }

        .game-area {
          position: relative;
          width: 370px;
          height: 500px;
          margin: 0 auto;
          background: linear-gradient(to bottom, #87CEEB 0%, #87CEEB 80%, #DEB887 80%);
          border-radius: 10px;
          overflow: hidden;
          cursor: crosshair;
          border: 3px solid rgba(255,255,255,0.3);
          box-shadow: 0 8px 32px rgba(0,0,0,0.3);
        }

        .bubble {
          position: absolute;
          width: 30px;
          height: 30px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 20px;
          background: rgba(255,255,255,0.1);
          border: 2px solid rgba(255,255,255,0.3);
          box-shadow: 0 2px 8px rgba(0,0,0,0.2);
          transition: transform 0.2s ease;
        }

        .bubble.new {
          animation: bubbleAppear 0.3s ease-out;
        }

        .bubble.exploding {
          animation: bubbleExplode 0.3s ease-out forwards;
        }

        .shooting-bubble {
          position: absolute;
          width: 30px;
          height: 30px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 20px;
          background: rgba(255,255,255,0.2);
          border: 2px solid rgba(255,255,255,0.5);
          box-shadow: 0 0 15px rgba(255,255,255,0.3);
          z-index: 12;
        }

        @keyframes bubbleAppear {
          0% {
            transform: scale(0);
            opacity: 0;
          }
          50% {
            transform: scale(1.2);
            opacity: 0.8;
          }
          100% {
            transform: scale(1);
            opacity: 1;
          }
        }

        @keyframes bubbleExplode {
          0% {
            transform: scale(1);
            opacity: 1;
          }
          50% {
            transform: scale(1.5);
            opacity: 0.6;
          }
          100% {
            transform: scale(2);
            opacity: 0;
          }
        }

        .bubble:hover {
          transform: scale(1.1);
        }

        .shooter {
          position: absolute;
          width: 40px;
          height: 40px;
          font-size: 30px;
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 10;
        }

        .current-bubble {
          position: absolute;
          width: 30px;
          height: 30px;
          font-size: 20px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(255,255,255,0.2);
          border: 2px solid rgba(255,255,255,0.5);
          border-radius: 50%;
          z-index: 11;
          box-shadow: 0 0 15px rgba(255,255,255,0.3);
        }

        .next-bubble {
          position: absolute;
          bottom: 20px;
          left: 20px;
          background: rgba(255,255,255,0.15);
          padding: 12px 16px;
          border-radius: 15px;
          backdrop-filter: blur(10px);
          font-size: 12px;
          border: 2px solid rgba(255,255,255,0.3);
          box-shadow: 0 4px 15px rgba(0,0,0,0.2);
          z-index: 13;
        }

        .next-bubble-icon {
          font-size: 16px;
          margin-top: 5px;
        }

        .aim-line {
          position: absolute;
          width: 200px;
          height: 2px;
          background: linear-gradient(to right, 
            rgba(255,255,255,0.8) 0%, 
            rgba(255,255,255,0.4) 50%, 
            transparent 100%);
          pointer-events: none;
          z-index: 5;
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
          margin-bottom: 15px;
          font-size: 16px;
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

        @media (max-width: 450px) {
          .bubble-game {
            margin: 0;
            padding: 15px;
            border-radius: 0;
          }
          
          .game-area {
            width: 100%;
            max-width: 350px;
          }
          
          .game-info {
            flex-direction: column;
            align-items: center;
            gap: 5px;
          }
        }
      `}</style>
    </div>
  );
};

export default BubbleShooter;