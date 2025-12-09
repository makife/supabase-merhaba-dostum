import React, { useState, useEffect, useCallback, useRef } from "react";
import { ArrowLeft } from "lucide-react";

const GridSimonSays = () => {
  const [gameState, setGameState] = useState("waiting");
  const [sequence, setSequence] = useState([]);
  const [playerSequence, setPlayerSequence] = useState([]);
  const [score, setScore] = useState(0);
  const [activeCell, setActiveCell] = useState(null);
  const [level, setLevel] = useState(1);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [vibrationEnabled, setVibrationEnabled] = useState(true);
  const [wordList, setWordList] = useState([]);
  const [currentWord, setCurrentWord] = useState("");
  const [revealedCells, setRevealedCells] = useState(new Set());
  const [showGuessInput, setShowGuessInput] = useState(false);
  const [guessValue, setGuessValue] = useState("");
  const [cellLetters, setCellLetters] = useState({});
  const audioContextRef = useRef(null);

  const gridSize = 16;

  // Kelime listesini yükle
  useEffect(() => {
    const loadWordList = async () => {
      try {
        const response = await fetch("/wordlist.txt");
        const text = await response.text();
        const words = text
          .split("\n")
          .map((word) => word.trim().toUpperCase())
          .filter((word) => word.length >= 4 && word.length <= 16);
        setWordList(words);
      } catch (error) {
        console.log("Kelime listesi yüklenemedi:", error);
        // Fallback kelimeler
        setWordList(["KEDI", "KALEM", "BILGISAYAR", "TEKNOLOJI", "PROGRAMLAMA", "OYUN", "MASA", "KITAP"]);
      }
    };
    loadWordList();
  }, []);

  // AudioContext'i oluştur
  useEffect(() => {
    if (!audioContextRef.current) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      audioContextRef.current = new AudioContextClass();
    }

    return () => {
      if (audioContextRef.current) {
        audioContextRef.current.close();
        audioContextRef.current = null;
      }
    };
  }, []);

  const createSound = useCallback(
    (frequency, duration = 200) => {
      if (!soundEnabled || !audioContextRef.current) return;

      try {
        const audioContext = audioContextRef.current;
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);

        oscillator.frequency.value = frequency;
        oscillator.type = "sine";

        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration / 1000);

        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + duration / 1000);
      } catch (error) {
        console.log("Ses çalınamadı:", error);
      }
    },
    [soundEnabled],
  );

  const vibrate = useCallback(
    (pattern = [100]) => {
      if (!vibrationEnabled) return;

      try {
        if (navigator.vibrate) {
          navigator.vibrate(pattern);
        }
      } catch (error) {
        console.log("Titreşim çalışmadı:", error);
      }
    },
    [vibrationEnabled],
  );

  const getCellSound = useCallback((cellIndex) => {
    const baseFreq = 200;
    return baseFreq + cellIndex * 50;
  }, []);

  const getRandomCell = useCallback(() => {
    return Math.floor(Math.random() * gridSize);
  }, []);

  // Level'e göre kelime uzunluğu belirle (Level 1 = 4 harf, Level 2 = 5 harf...)
  const getWordLengthForLevel = useCallback((lvl) => {
    const length = 3 + lvl; // Level 1 = 4, Level 2 = 5, ...
    return Math.min(length, 16); // Max 16 harf
  }, []);

  // Belirli uzunluktaki rastgele kelime seç
  const selectRandomWord = useCallback(
    (targetLength) => {
      if (wordList.length === 0) {
        const fallback = ["KEDI", "KALEM", "BILGISAYAR", "TEKNOLOJI"];
        return fallback[Math.floor(Math.random() * fallback.length)];
      }

      const wordsOfLength = wordList.filter((word) => word.length === targetLength);

      if (wordsOfLength.length > 0) {
        const randomIndex = Math.floor(Math.random() * wordsOfLength.length);
        return wordsOfLength[randomIndex];
      } else {
        // Eğer tam uzunlukta kelime yoksa, yakın uzunluktaki kelimeyi seç
        const closeWords = wordList.filter(
          (word) => word.length >= targetLength - 1 && word.length <= targetLength + 1,
        );
        if (closeWords.length > 0) {
          return closeWords[Math.floor(Math.random() * closeWords.length)];
        }
        return wordList[Math.floor(Math.random() * wordList.length)];
      }
    },
    [wordList],
  );

  // Harfleri gride rastgele dağıt
  const assignLettersToGrid = useCallback((word) => {
    const letters = {};
    const wordLength = word.length;

    // Rastgele pozisyonlar seç (0-15 arası)
    const availablePositions = Array.from({ length: gridSize }, (_, i) => i);
    const shuffledPositions = availablePositions.sort(() => Math.random() - 0.5);

    // Kelimenin harflerini rastgele pozisyonlara yerleştir
    for (let i = 0; i < wordLength; i++) {
      letters[shuffledPositions[i]] = word[i];
    }

    // Kalan pozisyonlar boş (null)
    for (let i = wordLength; i < gridSize; i++) {
      letters[shuffledPositions[i]] = null;
    }

    return letters;
  }, []);

  const startGame = useCallback(() => {
    const firstCell = getRandomCell();
    const wordLength = getWordLengthForLevel(1);
    const word = selectRandomWord(wordLength);
    const letters = assignLettersToGrid(word);

    setCurrentWord(word);
    setCellLetters(letters);
    setSequence([firstCell]);
    setPlayerSequence([]);
    setScore(0);
    setLevel(1);
    setRevealedCells(new Set());
    setGameState("showing");
    setShowGuessInput(false);
    setGuessValue("");
    createSound(440, 300);
    vibrate([200]);
    showSequence([firstCell]);
  }, [getRandomCell, getWordLengthForLevel, selectRandomWord, assignLettersToGrid, createSound, vibrate]);

  const showSequence = useCallback(
    (seq) => {
      let index = 0;
      setActiveCell(null);

      const showNext = () => {
        if (index < seq.length) {
          const cellIndex = seq[index];
          setActiveCell(cellIndex);
          setRevealedCells((prev) => new Set([...prev, cellIndex]));

          createSound(getCellSound(cellIndex), 300);
          vibrate([50]);

          setTimeout(() => {
            setActiveCell(null);
            setTimeout(() => {
              index++;
              showNext();
            }, 100);
          }, 400);
        } else {
          setTimeout(() => {
            setGameState("playing");
            createSound(880, 200);
          }, 300);
        }
      };

      setTimeout(showNext, 500);
    },
    [createSound, getCellSound, vibrate],
  );

  const handleCellClick = useCallback(
    (cellIndex) => {
      if (gameState !== "playing") return;

      const newPlayerSequence = [...playerSequence, cellIndex];
      setPlayerSequence(newPlayerSequence);

      setActiveCell(cellIndex);
      createSound(getCellSound(cellIndex), 150);
      vibrate([30]);

      setTimeout(() => setActiveCell(null), 150);

      const currentSequenceIndex = newPlayerSequence.length - 1;

      if (newPlayerSequence[currentSequenceIndex] !== sequence[currentSequenceIndex]) {
        setGameState("gameOver");
        createSound(150, 500);
        vibrate([200, 100, 200]);
        return;
      }

      if (newPlayerSequence.length === sequence.length) {
        const newScore = score + level * 10;
        const newLevel = level + 1;

        setScore(newScore);
        setLevel(newLevel);

        createSound(660, 200);
        setTimeout(() => createSound(880, 200), 100);
        setTimeout(() => createSound(1100, 300), 200);
        vibrate([100, 50, 100]);

        setTimeout(() => {
          const newSequence = [...sequence, getRandomCell()];
          setSequence(newSequence);
          setPlayerSequence([]);
          setGameState("showing");
          showSequence(newSequence);
        }, 600);
      }
    },
    [
      gameState,
      playerSequence,
      sequence,
      score,
      level,
      getRandomCell,
      showSequence,
      createSound,
      getCellSound,
      vibrate,
    ],
  );

  const handleGuess = useCallback(() => {
    const normalizedGuess = guessValue.trim().toUpperCase();
    const normalizedWord = currentWord.toUpperCase();

    if (normalizedGuess === normalizedWord) {
      // Doğru tahmin!
      const wordLetterCount = Object.values(cellLetters).filter((l) => l !== null).length;
      const bonusPoints = 100 + (wordLetterCount - revealedCells.size) * 10;
      const newScore = score + bonusPoints;
      const newLevel = level + 1;

      setScore(newScore);
      setLevel(newLevel);
      createSound(1200, 300);
      setTimeout(() => createSound(1400, 300), 150);
      setTimeout(() => createSound(1600, 400), 300);
      vibrate([100, 50, 100, 50, 100]);

      alert(`🎉 Tebrikler! Doğru tahmin! +${bonusPoints} puan kazandınız!`);

      // Yeni seviye başlat
      setTimeout(() => {
        const wordLength = getWordLengthForLevel(newLevel);
        const word = selectRandomWord(wordLength);
        const letters = assignLettersToGrid(word);
        const firstCell = getRandomCell();

        setCurrentWord(word);
        setCellLetters(letters);
        setSequence([firstCell]);
        setPlayerSequence([]);
        setRevealedCells(new Set());
        setShowGuessInput(false);
        setGuessValue("");
        setGameState("showing");
        showSequence([firstCell]);
      }, 1500);
    } else {
      // Yanlış tahmin
      createSound(150, 500);
      vibrate([200, 100, 200]);
      alert("❌ Yanlış tahmin! Tekrar deneyin.");
      setGuessValue("");
    }
  }, [
    guessValue,
    currentWord,
    score,
    revealedCells,
    level,
    cellLetters,
    createSound,
    vibrate,
    getWordLengthForLevel,
    selectRandomWord,
    assignLettersToGrid,
    getRandomCell,
    showSequence,
  ]);

  const resetGame = useCallback(() => {
    setGameState("waiting");
    setSequence([]);
    setPlayerSequence([]);
    setScore(0);
    setLevel(1);
    setActiveCell(null);
    setRevealedCells(new Set());
    setCurrentWord("");
    setCellLetters({});
    setShowGuessInput(false);
    setGuessValue("");
  }, []);

  const renderWordDisplay = () => {
    // Kelimeyi sıralı göster (açılan harfleri göster)
    const wordLetters = currentWord.split("");
    const revealedLettersSet = new Set();

    // Hangi harflerin açıldığını bul
    Object.entries(cellLetters).forEach(([cellIndex, letter]) => {
      if (letter && revealedCells.has(parseInt(cellIndex))) {
        revealedLettersSet.add(letter);
      }
    });

    return (
      <div className="word-display">
        {wordLetters.map((letter, index) => {
          const isRevealed = revealedLettersSet.has(letter);
          return (
            <span key={index} className={`word-letter ${isRevealed ? "revealed" : ""}`}>
              {isRevealed ? letter : "?"}
            </span>
          );
        })}
      </div>
    );
  };

  const renderGrid = () => {
    const cells = [];

    for (let i = 0; i < gridSize; i++) {
      const isActive = activeCell === i;
      const isClickable = gameState === "playing";
      const isRevealed = revealedCells.has(i);
      const hasLetter = cellLetters[i] !== null && cellLetters[i] !== undefined;

      cells.push(
        <button
          key={i}
          className={`grid-cell ${isActive ? "active" : ""} ${isClickable ? "clickable" : ""} ${!hasLetter ? "empty" : ""}`}
          onClick={() => handleCellClick(i)}
          disabled={!isClickable}
        >
          {isRevealed && hasLetter && <span className="cell-letter">{cellLetters[i]}</span>}
        </button>,
      );
    }

    return cells;
  };

  return (
    <div className="simon-game">
      <div className="game-header">
        <h2>💣 Kelime Tahmin Oyunu 💣</h2>

        {gameState !== "waiting" && (
          <div className="word-section">
            <h3>Gizli Kelime ({currentWord.length} harf):</h3>
            {renderWordDisplay()}
          </div>
        )}

        <div className="game-info">
          <span>Seviye: {level}</span>
          <span>Puan: {score}</span>
          <span>
            {gameState === "waiting"
              ? "Başlamayı bekliyor"
              : gameState === "showing"
                ? "Diziyi gösteriyor..."
                : gameState === "playing"
                  ? "Sırayı tekrarla!"
                  : "Oyun Bitti!"}
          </span>
        </div>

        <div className="settings">
          <button
            className={`setting-btn ${soundEnabled ? "active" : ""}`}
            onClick={() => setSoundEnabled(!soundEnabled)}
          >
            🔊 Ses
          </button>
          <button
            className={`setting-btn ${vibrationEnabled ? "active" : ""}`}
            onClick={() => setVibrationEnabled(!vibrationEnabled)}
          >
            📳 Titreşim
          </button>
        </div>
      </div>

      <div className="simon-grid">{renderGrid()}</div>

      <div className="game-controls">
        {gameState === "waiting" && (
          <button className="start-btn" onClick={startGame}>
            🚀 Oyunu Başlat
          </button>
        )}

        {(gameState === "playing" || gameState === "showing") && !showGuessInput && (
          <button className="guess-btn" onClick={() => setShowGuessInput(true)} disabled={gameState === "showing"}>
            🤔 Kelimeyi Tahmin Et
          </button>
        )}

        {showGuessInput && gameState === "playing" && (
          <div className="guess-section">
            <input
              type="text"
              value={guessValue}
              onChange={(e) => setGuessValue(e.target.value.toUpperCase())}
              placeholder="Kelimeyi yazın..."
              className="guess-input"
              maxLength={16}
              autoFocus
            />
            <div className="guess-buttons">
              <button className="submit-guess-btn" onClick={handleGuess}>
                ✅ Gönder
              </button>
              <button
                className="cancel-guess-btn"
                onClick={() => {
                  setShowGuessInput(false);
                  setGuessValue("");
                }}
              >
                ❌ İptal
              </button>
            </div>
          </div>
        )}

        {gameState === "gameOver" && (
          <div className="game-over">
            <p>🎯 Oyun Bitti! Final Puanınız: {score}</p>
            <p>
              Kelime: <strong>{currentWord}</strong>
            </p>
            <button className="restart-btn" onClick={resetGame}>
              🔄 Tekrar Oyna
            </button>
          </div>
        )}
      </div>

      <style>{`
        .simon-game {
          min-height: 100vh;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          max-width: 500px;
          margin: 0 auto;
          padding: 20px;
          font-family: Arial, sans-serif;
          text-align: center;
          color: white;
          box-sizing: border-box;
        }

        .game-header h2 {
          margin-bottom: 20px;
          color: white;
          text-shadow: 2px 2px 4px rgba(0,0,0,0.3);
          font-size: 24px;
        }

        .word-section {
          margin: 20px 0;
        }

        .word-section h3 {
          color: #64ffda;
          font-size: 16px;
          margin-bottom: 10px;
          text-shadow: 1px 1px 2px rgba(0,0,0,0.3);
        }

        .word-display {
          display: flex;
          justify-content: center;
          gap: 4px;
          flex-wrap: wrap;
          margin: 10px 0;
        }

        .word-letter {
          width: 28px;
          height: 34px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(255, 255, 255, 0.1);
          border: 2px solid rgba(255, 255, 255, 0.3);
          border-radius: 8px;
          font-size: 18px;
          font-weight: bold;
          color: rgba(255, 255, 255, 0.3);
          transition: all 0.3s ease;
        }

        .word-letter.revealed {
          background: rgba(100, 255, 218, 0.3);
          border-color: #64ffda;
          color: #64ffda;
          animation: letterReveal 0.5s ease;
        }

        @keyframes letterReveal {
          0% { transform: scale(0.5) rotateY(90deg); }
          50% { transform: scale(1.2) rotateY(0deg); }
          100% { transform: scale(1) rotateY(0deg); }
        }

        .game-info {
          display: flex;
          justify-content: space-between;
          margin-bottom: 15px;
          flex-wrap: wrap;
          gap: 8px;
        }

        .game-info span {
          background: rgba(255, 255, 255, 0.15);
          backdrop-filter: blur(10px);
          border: 1px solid rgba(255, 255, 255, 0.2);
          padding: 8px 12px;
          border-radius: 20px;
          font-size: 13px;
          font-weight: bold;
        }

        .settings {
          display: flex;
          justify-content: center;
          gap: 10px;
          margin-bottom: 20px;
        }

        .setting-btn {
          background: rgba(255, 255, 255, 0.1);
          border: 2px solid rgba(255, 255, 255, 0.2);
          color: white;
          padding: 8px 16px;
          border-radius: 20px;
          cursor: pointer;
          transition: all 0.3s ease;
          font-size: 12px;
          backdrop-filter: blur(10px);
        }

        .setting-btn.active {
          background: rgba(100, 255, 100, 0.3);
          border-color: #64ff64;
          color: #64ff64;
          box-shadow: 0 0 15px rgba(100, 255, 100, 0.3);
        }

        .simon-grid {
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
          background: rgba(255, 255, 255, 0.15);
          backdrop-filter: blur(10px);
          color: white;
          font-size: 14px;
          font-weight: bold;
          cursor: pointer;
          transition: all 0.15s ease;
          border: 2px solid rgba(255, 255, 255, 0.2);
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
        }

        .grid-cell.empty {
          background: rgba(255, 255, 255, 0.05);
          border-color: rgba(255, 255, 255, 0.1);
        }

        .cell-letter {
          font-size: 24px;
          color: #64ffda;
          text-shadow: 0 0 10px rgba(100, 255, 218, 0.5);
          animation: letterPop 0.3s ease;
        }

        @keyframes letterPop {
          0% { transform: scale(0); }
          50% { transform: scale(1.3); }
          100% { transform: scale(1); }
        }

        .grid-cell.active {
          background: linear-gradient(45deg, #ff6b6b, #feca57) !important;
          transform: scale(1.08);
          box-shadow: 0 0 25px rgba(255, 202, 87, 0.8);
        }

        .game-controls {
          margin: 20px 0;
        }

        .start-btn, .restart-btn, .guess-btn {
          background: linear-gradient(45deg, #48cae4, #023e8a);
          color: white;
          border: none;
          padding: 15px 30px;
          border-radius: 30px;
          font-size: 16px;
          font-weight: bold;
          cursor: pointer;
          transition: all 0.3s ease;
          box-shadow: 0 4px 15px rgba(72, 202, 228, 0.3);
          margin: 5px;
        }

        .guess-btn {
          background: linear-gradient(45deg, #ffd60a, #e85d04);
        }

        .guess-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .guess-section {
          background: rgba(255, 255, 255, 0.15);
          backdrop-filter: blur(10px);
          padding: 20px;
          border-radius: 15px;
          margin-top: 15px;
        }

        .guess-input {
          width: 100%;
          max-width: 300px;
          padding: 12px;
          border: 2px solid rgba(255, 255, 255, 0.3);
          border-radius: 10px;
          background: rgba(255, 255, 255, 0.2);
          color: white;
          font-size: 18px;
          text-align: center;
          font-weight: bold;
          text-transform: uppercase;
          margin-bottom: 10px;
        }

        .guess-input::placeholder {
          color: rgba(255, 255, 255, 0.5);
        }

        .guess-buttons {
          display: flex;
          gap: 10px;
          justify-content: center;
        }

        .submit-guess-btn, .cancel-guess-btn {
          padding: 10px 20px;
          border: none;
          border-radius: 20px;
          font-size: 14px;
          font-weight: bold;
          cursor: pointer;
          transition: all 0.3s ease;
        }

        .submit-guess-btn {
          background: linear-gradient(45deg, #10b981, #059669);
          color: white;
        }

        .cancel-guess-btn {
          background: rgba(239, 68, 68, 0.8);
          color: white;
        }

        .game-over {
          background: rgba(255, 255, 255, 0.15);
          backdrop-filter: blur(10px);
          padding: 20px;
          border-radius: 15px;
          animation: fadeIn 0.5s ease;
        }

        .game-over p {
          margin-bottom: 15px;
          font-size: 18px;
          color: #feca57;
        }

        .game-over strong {
          color: #64ffda;
          font-size: 20px;
        }

        @media (max-width: 480px) {
          .simon-game {
            padding: 15px;
          }
          
          .word-letter {
            width: 24px;
            height: 30px;
            font-size: 16px;
          }
          
          .simon-grid {
            max-width: 280px;
            gap: 6px;
          }

          .cell-letter {
            font-size: 20px;
          }
        }
      `}</style>
    </div>
  );
};

export default GridSimonSays;
