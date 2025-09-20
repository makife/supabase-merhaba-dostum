import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

const GridSimonSays = () => {
  const navigate = useNavigate();
  const [gameState, setGameState] = useState('waiting'); // waiting, showing, playing, gameOver
  const [sequence, setSequence] = useState([]);
  const [playerSequence, setPlayerSequence] = useState([]);
  const [currentStep, setCurrentStep] = useState(0);
  const [score, setScore] = useState(0);
  const [activeCell, setActiveCell] = useState(null);
  const [level, setLevel] = useState(1);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [vibrationEnabled, setVibrationEnabled] = useState(true);

  // 4x4 grid oluştur (0-15 arası sayılar)
  const gridSize = 16;

  // Ses efektleri
  const createSound = useCallback((frequency, duration = 200) => {
    if (!soundEnabled) return;
    
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.frequency.value = frequency;
      oscillator.type = 'sine';
      
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration / 1000);
      
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + duration / 1000);
    } catch (error) {
      console.log('Ses çalınamadı:', error);
    }
  }, [soundEnabled]);

  // Titreşim efekti
  const vibrate = useCallback((pattern = [100]) => {
    if (!vibrationEnabled) return;
    
    try {
      if (navigator.vibrate) {
        navigator.vibrate(pattern);
      } else if (window.Capacitor && window.Capacitor.Plugins.Haptics) {
        window.Capacitor.Plugins.Haptics.impact({ style: 'medium' });
      }
    } catch (error) {
      console.log('Titreşim çalışmadı:', error);
    }
  }, [vibrationEnabled]);

  // Hücre sesler - her hücre için farklı frekans
  const getCellSound = useCallback((cellIndex) => {
    const baseFreq = 200;
    return baseFreq + (cellIndex * 50);
  }, []);

  // Rastgele hücre seç
  const getRandomCell = useCallback(() => {
    return Math.floor(Math.random() * gridSize);
  }, []);

  // Oyunu başlat
  const startGame = useCallback(() => {
    const firstCell = getRandomCell();
    setSequence([firstCell]);
    setPlayerSequence([]);
    setCurrentStep(0);
    setScore(0);
    setLevel(1);
    setGameState('showing');
    createSound(440, 300); // Başlama sesi
    vibrate([200]);
    showSequence([firstCell]);
  }, [getRandomCell, createSound, vibrate]);

  // Diziyi göster (daha hızlı)
  const showSequence = useCallback((seq) => {
    let index = 0;
    setActiveCell(null);
    
    const showNext = () => {
      if (index < seq.length) {
        const cellIndex = seq[index];
        setActiveCell(cellIndex);
        
        // Hücre sesi çal
        createSound(getCellSound(cellIndex), 300);
        vibrate([50]);
        
        setTimeout(() => {
          setActiveCell(null);
          setTimeout(() => {
            index++;
            showNext();
          }, 100); // Daha hızlı geçiş (200'den 100'e)
        }, 400); // Daha hızlı gösterim (600'den 400'e)
      } else {
        setTimeout(() => {
          setGameState('playing');
          createSound(880, 200); // Oyuncu sırası sesi
        }, 300); // Daha hızlı başlama (500'den 300'e)
      }
    };
    
    setTimeout(showNext, 500); // Daha hızlı başlama (1000'den 500'e)
  }, [createSound, getCellSound, vibrate]);

  // Hücreye tıklanma
  const handleCellClick = useCallback((cellIndex) => {
    if (gameState !== 'playing') return;

    const newPlayerSequence = [...playerSequence, cellIndex];
    setPlayerSequence(newPlayerSequence);

    // Tıklama efekti
    setActiveCell(cellIndex);
    createSound(getCellSound(cellIndex), 150);
    vibrate([30]);
    
    setTimeout(() => setActiveCell(null), 150); // Daha hızlı efekt (200'den 150'ye)

    // Kontrol et
    const currentSequenceIndex = newPlayerSequence.length - 1;
    
    if (newPlayerSequence[currentSequenceIndex] !== sequence[currentSequenceIndex]) {
      // Yanlış tıklama - oyun bitti
      setGameState('gameOver');
      createSound(150, 500); // Hata sesi
      vibrate([200, 100, 200]);
      return;
    }

    // Doğru tıklama
    if (newPlayerSequence.length === sequence.length) {
      // Seviye tamamlandı
      const newScore = score + (level * 10);
      const newLevel = level + 1;
      
      setScore(newScore);
      setLevel(newLevel);
      
      // Başarı sesi
      createSound(660, 200);
      setTimeout(() => createSound(880, 200), 100);
      setTimeout(() => createSound(1100, 300), 200);
      vibrate([100, 50, 100]);
      
      setTimeout(() => {
        // Yeni hücre ekle ve göster
        const newSequence = [...sequence, getRandomCell()];
        setSequence(newSequence);
        setPlayerSequence([]);
        setGameState('showing');
        showSequence(newSequence);
      }, 600); // Daha hızlı geçiş (1000'den 600'e)
    }
  }, [gameState, playerSequence, sequence, score, level, getRandomCell, showSequence, createSound, getCellSound, vibrate]);

  // Oyunu sıfırla
  const resetGame = useCallback(() => {
    setGameState('waiting');
    setSequence([]);
    setPlayerSequence([]);
    setCurrentStep(0);
    setScore(0);
    setLevel(1);
    setActiveCell(null);
  }, []);

  // Grid oluştur
  const renderGrid = () => {
    const cells = [];
    
    for (let i = 0; i < gridSize; i++) {
      const isActive = activeCell === i;
      const isClickable = gameState === 'playing';
      
      cells.push(
        <button
          key={i}
          className={`grid-cell ${isActive ? 'active' : ''} ${isClickable ? 'clickable' : ''}`}
          onClick={() => handleCellClick(i)}
          disabled={!isClickable}
        >
          {i + 1}
        </button>
      );
    }
    
    return cells;
  };

  return (
    <div className="simon-game">
      {/* Geri Butonu */}
      <button 
        className="back-button"
        onClick={() => navigate('/')}
      >
        ← Ana Sayfa
      </button>
      
      <div className="game-header">
        <h2>4x4 Grid Simon Says</h2>
        <div className="game-info">
          <span>Seviye: {level}</span>
          <span>Puan: {score}</span>
          <span>Durum: {
            gameState === 'waiting' ? 'Başlamayı bekliyor' :
            gameState === 'showing' ? 'Diziyi gösteriyor...' :
            gameState === 'playing' ? 'Sırayı tekrarla!' :
            'Oyun Bitti!'
          }</span>
        </div>
        
        {/* Ayarlar */}
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

      <div className="game-grid">
        {renderGrid()}
      </div>

      <div className="game-controls">
        {gameState === 'waiting' && (
          <button className="start-btn" onClick={startGame}>
            🚀 Oyunu Başlat
          </button>
        )}
        
        {gameState === 'gameOver' && (
          <div className="game-over">
            <p>🎯 Oyun Bitti! Final Puanınız: {score}</p>
            <button className="restart-btn" onClick={resetGame}>
              🔄 Tekrar Oyna
            </button>
          </div>
        )}
      </div>

      <div className="game-instructions">
        <h4>⚡ Hızlı Mod Nasıl Oynanır:</h4>
        <p>• 🎵 Her hücrenin kendine özel sesi var</p>
        <p>• 📳 Dokunmatik geri bildirim aktif</p>
        <p>• ⚡ Daha hızlı tempo için hazır ol!</p>
        <p>• 🎯 Yanıp sönen hücrelerin sırasını hatırla</p>
      </div>

      <style>{`
        .simon-game {
          max-width: 500px;
          margin: 0 auto;
          padding: 20px;
          font-family: Arial, sans-serif;
          text-align: center;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          border-radius: 15px;
          color: white;
          min-height: 100vh;
          box-sizing: border-box;
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

        .setting-btn:hover {
          transform: scale(1.05);
        }

        .game-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 8px;
          margin: 25px 0;
          max-width: 320px;
          margin-left: auto;
          margin-right: auto;
        }

        .grid-cell {
          aspect-ratio: 1;
          border: none;
          border-radius: 12px;
          background: rgba(255,255,255,0.1);
          color: white;
          font-size: 16px;
          font-weight: bold;
          cursor: pointer;
          transition: all 0.15s ease;
          backdrop-filter: blur(10px);
          border: 2px solid rgba(255,255,255,0.2);
          user-select: none;
          -webkit-tap-highlight-color: transparent;
        }

        .grid-cell:hover {
          background: rgba(255,255,255,0.2);
          transform: scale(1.03);
        }

        .grid-cell:active {
          transform: scale(0.95);
        }

        .grid-cell.active {
          background: #FFD700 !important;
          color: #333;
          transform: scale(1.08);
          box-shadow: 0 0 25px rgba(255, 215, 0, 0.8);
          border-color: #FFD700;
          animation: pulse 0.15s ease-in-out;
        }

        @keyframes pulse {
          0% { transform: scale(1.08); }
          50% { transform: scale(1.15); }
          100% { transform: scale(1.08); }
        }

        .grid-cell.clickable {
          cursor: pointer;
        }

        .grid-cell:disabled {
          cursor: not-allowed;
          opacity: 0.6;
        }

        .game-controls {
          margin: 20px 0;
        }

        .start-btn, .restart-btn {
          background: linear-gradient(45deg, #4CAF50, #45a049);
          color: white;
          border: none;
          padding: 15px 30px;
          border-radius: 30px;
          font-size: 16px;
          font-weight: bold;
          cursor: pointer;
          transition: all 0.3s ease;
          box-shadow: 0 4px 15px rgba(76, 175, 80, 0.3);
          user-select: none;
          -webkit-tap-highlight-color: transparent;
        }

        .start-btn:hover, .restart-btn:hover {
          transform: translateY(-3px);
          box-shadow: 0 6px 20px rgba(76, 175, 80, 0.4);
        }

        .start-btn:active, .restart-btn:active {
          transform: translateY(-1px);
        }

        .game-over {
          background: rgba(255,255,255,0.1);
          padding: 20px;
          border-radius: 15px;
          backdrop-filter: blur(10px);
          animation: fadeIn 0.5s ease-in;
        }

        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .game-over p {
          margin-bottom: 15px;
          font-size: 18px;
          color: #FFD700;
          text-shadow: 1px 1px 2px rgba(0,0,0,0.3);
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

        @media (max-width: 480px) {
          .simon-game {
            margin: 0;
            padding: 15px;
            border-radius: 0;
            min-height: 100vh;
          }
          
          .game-info {
            flex-direction: column;
            align-items: center;
            gap: 5px;
          }
          
          .game-grid {
            max-width: 280px;
            gap: 6px;
          }
          
          .grid-cell {
            font-size: 14px;
            border-radius: 10px;
          }

          .settings {
            flex-wrap: wrap;
            gap: 8px;
          }

          .setting-btn {
            font-size: 11px;
            padding: 6px 12px;
          }
        }

        @media (max-height: 700px) {
          .simon-game {
            padding: 10px;
          }
          
          .game-header h2 {
            font-size: 20px;
            margin-bottom: 15px;
          }
          
          .game-instructions {
            font-size: 12px;
          }
        }
      `}</style>
    </div>
  );
};

export default GridSimonSays;