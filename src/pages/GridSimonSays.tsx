import React, { useState, useEffect, useCallback, useRef } from "react";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useSounds } from "@/hooks/useSounds";

// TypeScript hatası için global tanım
declare global {
  interface Window {
    webkitAudioContext: typeof AudioContext;
  }
}

const GridSimonSays = () => {
  const navigate = useNavigate();
  const { playSound } = useSounds();
  const [gameState, setGameState] = useState("waiting");
  const [sequence, setSequence] = useState<number[]>([]);
  const [playerSequence, setPlayerSequence] = useState<number[]>([]);
  const [score, setScore] = useState(0);
  const [activeCell, setActiveCell] = useState<number | null>(null);
  const [level, setLevel] = useState(1);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [vibrationEnabled, setVibrationEnabled] = useState(true);
  const [wordList, setWordList] = useState<string[]>([]);
  const [currentWord, setCurrentWord] = useState("");
  const [revealedCells, setRevealedCells] = useState(new Set());
  const [showGuessInput, setShowGuessInput] = useState(false);
  const [guessValue, setGuessValue] = useState("");
  const [cellLetters, setCellLetters] = useState<any>({});

  // Can ve Modal State'leri
  const [attempts, setAttempts] = useState(10);
  const [modal, setModal] = useState({ show: false, title: "", message: "", type: "info" });

  const audioContextRef = useRef<AudioContext | null>(null);
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
        setWordList(["KEDI", "KALEM", "BILGISAYAR", "TEKNOLOJI", "PROGRAMLAMA", "OYUN", "MASA", "KITAP"]);
      }
    };
    loadWordList();
  }, []);

  // AudioContext
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

  const showModal = (title: string, message: string, type = "info") => {
    setModal({ show: true, title, message, type });
  };

  const closeModal = () => {
    setModal({ ...modal, show: false });
    if (attempts <= 0) {
      setGameState("gameOver");
    }
  };

  // Ana sayfaya dönüş fonksiyonu
  const handleGoBack = () => {
    playSound("buttonClick");
    navigate("/");
  };

  const createSound = useCallback(
    (frequency: number, duration = 200) => {
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
        if (navigator.vibrate) navigator.vibrate(pattern);
      } catch (error) {
        console.log("Titreşim çalışmadı:", error);
      }
    },
    [vibrationEnabled],
  );

  const getCellSound = useCallback((cellIndex: number) => 200 + cellIndex * 50, []);
  const getRandomCell = useCallback(() => Math.floor(Math.random() * gridSize), []);
  const getWordLengthForLevel = useCallback((lvl: number) => Math.min(3 + lvl, 16), []);

  const selectRandomWord = useCallback(
    (targetLength: number) => {
      if (wordList.length === 0) return "OYUN";
      const wordsOfLength = wordList.filter((word) => word.length === targetLength);
      if (wordsOfLength.length > 0) {
        return wordsOfLength[Math.floor(Math.random() * wordsOfLength.length)];
      }
      const closeWords = wordList.filter((word) => word.length >= targetLength - 1 && word.length <= targetLength + 1);
      if (closeWords.length > 0) return closeWords[Math.floor(Math.random() * closeWords.length)];
      return wordList[Math.floor(Math.random() * wordList.length)];
    },
    [wordList],
  );

  const assignLettersToGrid = useCallback((word: string) => {
    const letters: any = {};
    const wordLength = word.length;
    const availablePositions = Array.from({ length: gridSize }, (_, i) => i);
    const shuffledPositions = availablePositions.sort(() => Math.random() - 0.5);

    for (let i = 0; i < wordLength; i++) {
      letters[shuffledPositions[i]] = word[i];
    }
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
    setAttempts(10);
    setRevealedCells(new Set());
    setGameState("showing");
    setShowGuessInput(false);
    setGuessValue("");
    createSound(440, 300);
    vibrate([200]);
    showSequence([firstCell]);
  }, [getRandomCell, getWordLengthForLevel, selectRandomWord, assignLettersToGrid, createSound, vibrate]);

  const showSequence = useCallback(
    (seq: number[]) => {
      let index = 0;
      setActiveCell(null);

      const showNext = () => {
        if (index < seq.length) {
          const cellIndex = seq[index];
          setActiveCell(cellIndex);
          setRevealedCells((prev) => {
            const newSet = new Set(prev);
            newSet.add(cellIndex);
            return newSet;
          });

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
    (cellIndex: number) => {
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
        setScore(newScore);

        createSound(660, 200);
        setTimeout(() => createSound(880, 200), 100);
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
      const wordLetterCount = Object.values(cellLetters).filter((l) => l !== null).length;
      const bonusPoints = 100 + (wordLetterCount - revealedCells.size) * 10;
      const newScore = score + bonusPoints;
      const newLevel = level + 1;

      setScore(newScore);
      setLevel(newLevel);
      setAttempts(10);

      createSound(1200, 300);
      setTimeout(() => createSound(1400, 300), 150);
      vibrate([100, 50, 100, 50, 100]);

      showModal("🎉 Mükemmel!", `Doğru bildin! +${bonusPoints} puan!`, "success");

      setTimeout(() => {
        closeModal();
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
      }, 2000);
    } else {
      const newAttempts = attempts - 1;
      setAttempts(newAttempts);
      setGuessValue("");

      if (newAttempts > 0) {
        createSound(150, 500);
        vibrate([200, 100, 200]);
        showModal("❌ Yanlış Cevap", `Dikkat et! Kalan Hakkın: ${newAttempts}`, "error");
      } else {
        createSound(100, 800);
        vibrate([500]);
        showModal("💀 Oyun Bitti", "Tahmin hakkın kalmadı!", "error");
      }
    }
  }, [
    guessValue,
    currentWord,
    score,
    revealedCells,
    level,
    cellLetters,
    attempts,
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
    setAttempts(10);
    setActiveCell(null);
    setRevealedCells(new Set());
    setCurrentWord("");
    setCellLetters({});
    setShowGuessInput(false);
    setGuessValue("");
    setModal({ show: false, title: "", message: "", type: "info" });
  }, []);

  const renderWordDisplay = () => {
    const wordLetters = currentWord.split("");
    const revealedLettersSet = new Set();
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
          className={`grid-cell ${isActive ? "active" : ""} ${isClickable ? "clickable" : ""}`}
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
      {/* GERİ BUTONU */}
      <button className="back-button" onClick={handleGoBack}>
        <ArrowLeft size={28} />
      </button>

      <div className="game-header">
        <h2>💣Sıkı Takip💣</h2>

        {gameState !== "waiting" && (
          <div className="word-section">
            <h3>Gizli Kelime ({currentWord.length} harf):</h3>
            {renderWordDisplay()}
          </div>
        )}

        <div className="game-info">
          <span>Seviye: {level}</span>
          <span>Puan: {score}</span>
          <span
            style={{
              color: attempts === 1 ? "#ff4d4d" : "white",
              border: attempts === 1 ? "1px solid #ff4d4d" : "1px solid rgba(255,255,255,0.2)",
            }}
          >
            ❤️ Hak: {attempts}
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

      {/* CUSTOM MODAL */}
      {modal.show && (
        <div className="modal-overlay">
          <div className={`modal-content ${modal.type}`}>
            <h3>{modal.title}</h3>
            <p>{modal.message}</p>
            {attempts > 0 ? (
              <button onClick={closeModal}>Tamam</button>
            ) : (
              <button onClick={closeModal}>Sonuçları Gör</button>
            )}
          </div>
        </div>
      )}

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
          position: relative; /* Geri butonu için */
        }

        /* YENİ EKLENEN GERİ BUTONU STİLİ */
        .back-button {
          position: absolute;
          top: 15px;
          left: 15px;
          background: rgba(255, 255, 255, 0.1);
          border: none;
          border-radius: 50%;
          width: 45px;
          height: 45px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          cursor: pointer;
          backdrop-filter: blur(5px);
          transition: all 0.3s ease;
          z-index: 10;
        }

        .back-button:hover {
          background: rgba(255, 255, 255, 0.25);
          transform: scale(1.1);
        }

        .game-header h2 {
          margin-bottom: 20px;
          margin-top: 35px; /* Başlığı butonla çakışmaması için biraz aşağı ittik */
          color: white;
          text-shadow: 2px 2px 4px rgba(0,0,0,0.3);
          font-size: 24px;
        }

        .word-section { margin: 20px 0; }
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
          transition: all 0.3s ease;
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
        .game-controls { margin: 20px 0; }
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
        .guess-btn { background: linear-gradient(45deg, #ffd60a, #e85d04); }
        .guess-btn:disabled { opacity: 0.5; cursor: not-allowed; }
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
        .guess-input::placeholder { color: rgba(255, 255, 255, 0.5); }
        .guess-buttons { display: flex; gap: 10px; justify-content: center; }
        .submit-guess-btn, .cancel-guess-btn {
          padding: 10px 20px;
          border: none;
          border-radius: 20px;
          font-size: 14px;
          font-weight: bold;
          cursor: pointer;
          transition: all 0.3s ease;
        }
        .submit-guess-btn { background: linear-gradient(45deg, #10b981, #059669); color: white; }
        .cancel-guess-btn { background: rgba(239, 68, 68, 0.8); color: white; }
        .game-over {
          background: rgba(255, 255, 255, 0.15);
          backdrop-filter: blur(10px);
          padding: 20px;
          border-radius: 15px;
          animation: fadeIn 0.5s ease;
        }
        .game-over p { margin-bottom: 15px; font-size: 18px; color: #feca57; }
        .game-over strong { color: #64ffda; font-size: 20px; }
        
        /* MODAL STYLES */
        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: rgba(0, 0, 0, 0.7);
          backdrop-filter: blur(5px);
          display: flex;
          justify-content: center;
          align-items: center;
          z-index: 1000;
          animation: fadeIn 0.3s ease;
        }
        .modal-content {
          background: rgba(30, 30, 40, 0.95);
          border: 2px solid rgba(255, 255, 255, 0.1);
          padding: 30px;
          border-radius: 20px;
          text-align: center;
          max-width: 80%;
          width: 300px;
          box-shadow: 0 10px 40px rgba(0,0,0,0.5);
          animation: scaleUp 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        }
        .modal-content.success { border-color: #00b894; box-shadow: 0 0 20px rgba(0, 184, 148, 0.3); }
        .modal-content.error { border-color: #ff7675; box-shadow: 0 0 20px rgba(255, 118, 117, 0.3); }
        .modal-content h3 { margin-top: 0; font-size: 24px; margin-bottom: 10px; }
        .modal-content.success h3 { color: #55efc4; }
        .modal-content.error h3 { color: #ff7675; }
        .modal-content p { color: #dfe6e9; font-size: 16px; margin-bottom: 25px; line-height: 1.5; }
        .modal-content button {
          background: linear-gradient(45deg, #6c5ce7, #a29bfe);
          border: none;
          padding: 10px 30px;
          color: white;
          border-radius: 25px;
          font-weight: bold;
          cursor: pointer;
          transition: transform 0.2s;
          font-size: 16px;
        }
        .modal-content button:hover { transform: scale(1.05); }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes scaleUp { from { transform: scale(0.8); opacity: 0; } to { transform: scale(1); opacity: 1; } }

        @media (max-width: 480px) {
          .simon-game { padding: 15px; }
          .word-letter { width: 24px; height: 30px; font-size: 16px; }
          .simon-grid { max-width: 280px; gap: 6px; }
          .cell-letter { font-size: 20px; }
        }
      `}</style>
    </div>
  );
};

export default GridSimonSays;
