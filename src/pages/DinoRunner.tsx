import React, { useState, useEffect, useCallback, useRef } from "react";
import { ArrowLeft } from "lucide-react";

const DinoRunner = () => {
  const navigate = () => {
    if (window.history.length > 1) {
      window.history.back();
    } else {
      window.location.href = "/";
    }
  };

  // --- OYUN STATE'LERİ ---
  const [gameState, setGameState] = useState("waiting");
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [speed, setSpeed] = useState(3); // Başlangıç hızı biraz arttı

  // Fizik ve Karakter
  const [dinoY, setDinoY] = useState(0);
  const [jumpPhase, setJumpPhase] = useState("ground"); // ground, jumping, doubleJumping
  const [doubleJumpsLeft, setDoubleJumpsLeft] = useState(3);

  // Objeler
  const [obstacles, setObstacles] = useState([]);
  const [clouds, setClouds] = useState([]);
  const [letters, setLetters] = useState([]);

  // Çevre ve Ayarlar
  const [groundOffset, setGroundOffset] = useState(0);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [vibrationEnabled, setVibrationEnabled] = useState(true);

  // --- KELİME SİSTEMİ ---
  const [wordList, setWordList] = useState<string[]>([]);
  const [targetWord, setTargetWord] = useState("");
  const [collectedCount, setCollectedCount] = useState(0);
  const [wordNotification, setWordNotification] = useState("");

  // Zamanlayıcılar
  const [nextObstacleTime, setNextObstacleTime] = useState(0);
  const [nextLetterTime, setNextLetterTime] = useState(0);

  const gameLoopRef = useRef<number>();
  const audioContextRef = useRef<AudioContext | null>(null);

  // Animasyon Referansları (React state yerine ref kullanarak performansı artırdık)
  const dinoYRef = useRef(0);
  const jumpStartTimeRef = useRef(0);
  const startYRef = useRef(0);

  // Oyun sabitleri
  const GAME_WIDTH = 600;
  const GAME_HEIGHT = 350;
  const GROUND_HEIGHT = 20;
  const DINO_WIDTH = 30;
  const DINO_HEIGHT = 40;
  const DINO_GROUND_Y = GAME_HEIGHT - GROUND_HEIGHT - DINO_HEIGHT;
  const JUMP_HEIGHT = 130; // Zıplama biraz daha yüksek
  const OBSTACLE_WIDTH = 20;
  const LETTER_SIZE = 30;

  // Wordlist.txt çekme
  useEffect(() => {
    fetch("/wordlist.txt")
      .then((response) => response.text())
      .then((text) => {
        const words = text
          .split("\n")
          .map((w) => w.trim().toUpperCase())
          .filter((w) => w.length > 0);
        setWordList(words);
      })
      .catch((err) => {
        setWordList(["ELMA", "ARMUT", "KİRAZ", "KARPUZ", "ÇİLEK", "ATOM", "ENERJİ"]);
      });
  }, []);

  // AudioContext
  useEffect(() => {
    if (!audioContextRef.current) {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      audioContextRef.current = new AudioContextClass();
    }
  }, []);

  const playSound = useCallback(
    (frequency, duration = 100, type = "sine") => {
      if (!soundEnabled || !audioContextRef.current) return;
      try {
        const audioContext = audioContextRef.current;
        if (audioContext.state === "suspended") audioContext.resume();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        oscillator.frequency.value = frequency;
        oscillator.type = type as OscillatorType;
        gainNode.gain.setValueAtTime(0.2, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration / 1000);
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + duration / 1000);
      } catch (e) {}
    },
    [soundEnabled],
  );

  const vibrate = useCallback(
    (pattern = [50]) => {
      if (vibrationEnabled && navigator.vibrate) navigator.vibrate(pattern);
    },
    [vibrationEnabled],
  );

  const pickNewWord = useCallback(() => {
    if (wordList.length === 0) return;
    const randomIndex = Math.floor(Math.random() * wordList.length);
    const newWord = wordList[randomIndex];
    setTargetWord(newWord);
    setCollectedCount(0);
    setWordNotification(`Sıradaki: ${newWord}`);
    setTimeout(() => setWordNotification(""), 2000);
  }, [wordList]);

  // --- GÜNCELLENMİŞ ZIPLAMA MANTIĞI ---
  // Animasyon döngüsü içinde değil, React state'inden bağımsız fizik hesaplaması için
  // bu sefer daha "anlık" tepki veren bir yapı kurduk.

  const performJump = useCallback(() => {
    if (gameState !== "playing") return;

    // 1. Durum: Yerdeyiz -> Zıpla
    if (jumpPhase === "ground") {
      setJumpPhase("jumping");
      jumpStartTimeRef.current = Date.now();
      startYRef.current = 0;
      playSound(600, 100);
      vibrate([20]);
    }
    // 2. Durum: Havadayız -> Çift Zıpla
    else if ((jumpPhase === "jumping" || jumpPhase === "falling") && doubleJumpsLeft > 0) {
      setJumpPhase("doubleJumping");
      setDoubleJumpsLeft((prev) => prev - 1);
      jumpStartTimeRef.current = Date.now();
      startYRef.current = dinoYRef.current; // O anki yükseklikten başla
      playSound(900, 150); // Daha ince ses
      vibrate([40]);
    }
  }, [gameState, jumpPhase, doubleJumpsLeft, playSound, vibrate]);

  // Obje Yaratma Helperları
  const createObstacle = useCallback(() => {
    const random = Math.random();
    let type, height;
    if (random < 0.3) {
      type = "short";
      height = 25;
    } else if (random < 0.5) {
      type = "normal";
      height = 40;
    } else if (random < 0.8) {
      type = "tall";
      height = 55;
    } else {
      type = "giant";
      height = 70;
    }
    return { x: GAME_WIDTH, y: DINO_GROUND_Y + 10, width: OBSTACLE_WIDTH, height, type, id: Math.random() };
  }, []);

  const createLetter = useCallback((char: string) => {
    const isAerial = Math.random() > 0.4; // %60 havada olsun
    const yPos = isAerial ? DINO_GROUND_Y - (70 + Math.random() * 40) : DINO_GROUND_Y - 10;
    return {
      x: GAME_WIDTH,
      y: yPos,
      char,
      width: LETTER_SIZE,
      height: LETTER_SIZE,
      id: Math.random(),
      collected: false,
    };
  }, []);

  const createCloud = useCallback(
    () => ({
      x: GAME_WIDTH,
      y: Math.random() * 60 + 20,
      speed: 0.5 + Math.random() * 0.5,
      id: Math.random(),
    }),
    [],
  );

  // Oyun Başlatma
  const startGame = useCallback(() => {
    setGameState("playing");
    setScore(0);
    setSpeed(3); // Hız reset
    setDinoY(0);
    dinoYRef.current = 0;
    setJumpPhase("ground");
    setDoubleJumpsLeft(3);
    setObstacles([]);
    setLetters([]);
    setClouds([createCloud()]);
    setGroundOffset(0);
    setNextObstacleTime(Date.now() + 1000);
    setNextLetterTime(Date.now() + 1500);
    pickNewWord();
    playSound(440, 200);
  }, [createCloud, pickNewWord, playSound]);

  const endGame = useCallback(() => {
    setGameState("gameOver");
    if (score > highScore) {
      setHighScore(score);
      playSound(660, 300);
    } else {
      playSound(200, 500);
    }
    vibrate([200]);
    if (gameLoopRef.current) cancelAnimationFrame(gameLoopRef.current);
  }, [score, highScore, playSound, vibrate]);

  // Çarpışma
  const checkCollision = (dinoYPos, entity) => {
    const dinoRect = { x: 50 + 5, y: DINO_GROUND_Y - dinoYPos + 5, width: DINO_WIDTH - 10, height: DINO_HEIGHT - 10 };
    const entityRect = { x: entity.x + 2, y: entity.y + 2, width: entity.width - 4, height: entity.height - 4 };
    return (
      dinoRect.x < entityRect.x + entityRect.width &&
      dinoRect.x + dinoRect.width > entityRect.x &&
      dinoRect.y < entityRect.y + entityRect.height &&
      dinoRect.y + dinoRect.height > entityRect.y
    );
  };

  // --- ANA OYUN DÖNGÜSÜ ---
  const gameLoop = useCallback(() => {
    if (gameState !== "playing") return;

    // 1. FİZİK HESAPLAMALARI (Zıplama)
    const currentTime = Date.now();
    let newY = 0;

    if (jumpPhase === "jumping") {
      const elapsed = currentTime - jumpStartTimeRef.current;
      const duration = 550; // Zıplama süresi
      if (elapsed < duration) {
        // Sinüs dalgası ile yumuşak zıplama
        newY = Math.sin((elapsed / duration) * Math.PI) * JUMP_HEIGHT;
      } else {
        setJumpPhase("ground"); // Zıplama bitti
      }
    } else if (jumpPhase === "doubleJumping") {
      const elapsed = currentTime - jumpStartTimeRef.current;
      const duration = 450;
      if (elapsed < duration) {
        // Mevcut yüksekliğin üzerine ekle
        newY = startYRef.current + Math.sin((elapsed / duration) * Math.PI) * (JUMP_HEIGHT * 0.8);
      } else {
        // Çift zıplama bitti, yere düşüş fazı (basitçe ground'a çekiyoruz ama düşme efekti eklenebilir)
        // Düşüşü yumuşatmak için falling fazı eklenebilir ama basitlik için ground'a çekiyoruz
        if (elapsed > duration) setJumpPhase("ground");
      }
    }

    // Yere çakılma kontrolü (Basit fizik)
    if (newY < 0) newY = 0;
    dinoYRef.current = newY;
    setDinoY(newY);

    // 2. OYUN İLERLEMESİ
    setScore((s) => s + 1);

    // Hızlanma: Her karede çok az artır ama limit koy (Max 14)
    setSpeed((prev) => Math.min(prev + 0.004, 14));
    setGroundOffset((prev) => (prev + speed) % 40);

    // 3. OBJE YÖNETİMİ
    setObstacles((prev) => {
      let newObs = prev.map((o) => ({ ...o, x: o.x - speed })).filter((o) => o.x > -50);

      // Engel Spawn
      if (Date.now() > nextObstacleTime) {
        newObs.push(createObstacle());
        // Hızlandıkça aralıkları daralt
        const minWait = Math.max(700, 1500 - speed * 80);
        setNextObstacleTime(Date.now() + minWait + Math.random() * 1000);
      }

      // Çarpışma
      newObs.forEach((o) => {
        if (checkCollision(newY, o)) endGame();
      });
      return newObs;
    });

    setLetters((prev) => {
      let newLet = prev.map((l) => ({ ...l, x: l.x - speed })).filter((l) => l.x > -50);

      // Harf Toplama
      newLet.forEach((l) => {
        if (!l.collected && checkCollision(newY, l)) {
          l.collected = true;
          playSound(1200, 80, "square");
          setScore((s) => s + 50);

          setCollectedCount((count) => {
            const next = count + 1;
            if (next >= targetWord.length) {
              setScore((s) => s + 500);
              playSound(1500, 300, "triangle");
              pickNewWord();
              return 0;
            }
            return next;
          });
        }
      });

      // Harf Spawn (Mantık: Ekranda aradığımız harf yoksa ve zamanı geldiyse)
      const needed = targetWord[collectedCount];
      const hasNeeded = newLet.some((l) => l.char === needed && !l.collected);
      if (!hasNeeded && Date.now() > nextLetterTime && needed) {
        newLet.push(createLetter(needed));
        setNextLetterTime(Date.now() + 800 + Math.random() * 800);
      }

      return newLet.filter((l) => !l.collected);
    });

    setClouds((prev) => {
      let newC = prev.map((c) => ({ ...c, x: c.x - c.speed })).filter((c) => c.x > -60);
      if (Math.random() < 0.01 && newC.length < 4) newC.push(createCloud());
      return newC;
    });

    gameLoopRef.current = requestAnimationFrame(gameLoop);
  }, [gameState, speed, jumpPhase, nextObstacleTime, nextLetterTime, targetWord, collectedCount, doubleJumpsLeft]);

  // --- KONTROLLER (Lag'siz Versiyon) ---

  // Ortak input handler (Tüm tıklama/basma olayları buraya gelir)
  const handleInput = useCallback(
    (e) => {
      // Event propagation ve default davranışları durdur
      if (e.cancelable) e.preventDefault();
      e.stopPropagation();

      if (gameState === "waiting" || gameState === "gameOver") {
        startGame();
      } else {
        performJump();
      }
    },
    [gameState, performJump, startGame],
  );

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.code === "Space" || e.code === "ArrowUp") handleInput(e);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handleInput]);

  useEffect(() => {
    if (gameState === "playing") gameLoopRef.current = requestAnimationFrame(gameLoop);
    return () => {
      if (gameLoopRef.current) cancelAnimationFrame(gameLoopRef.current);
    };
  }, [gameState, gameLoop]);

  return (
    <div className="dino-game">
      <div className="mb-4">
        <button
          onClick={navigate}
          className="flex items-center gap-2 text-white/80 hover:text-white bg-transparent border-none cursor-pointer"
        >
          <ArrowLeft className="w-5 h-5" /> Geri Dön
        </button>
      </div>

      <div className="game-header">
        {/* KELİME BARI */}
        <div className="word-container">
          {wordNotification ? (
            <div className="word-notification">{wordNotification}</div>
          ) : (
            <div className="current-word">
              {targetWord.split("").map((char, idx) => (
                <span
                  key={idx}
                  className={`word-char ${idx < collectedCount ? "collected" : ""} ${idx === collectedCount ? "active-target" : ""}`}
                >
                  {char}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="game-info">
          <div className="stat-box">Puan: {score}</div>
          <div className="stat-box">Hız: {speed.toFixed(1)}</div>
          <div className={`stat-box double-jump ${doubleJumpsLeft > 0 ? "active" : ""}`}>⚡ x {doubleJumpsLeft}</div>
        </div>
      </div>

      {/* OYUN ALANI - Dokunma olayları doğrudan div üzerinde */}
      <div
        className="game-area"
        onPointerDown={handleInput} // PointerDown en hızlı tepkiyi verir (mobil + masaüstü)
      >
        {clouds.map((c) => (
          <div key={c.id} className="cloud" style={{ left: `${c.x}px`, top: `${c.y}px` }}>
            ☁️
          </div>
        ))}

        {letters.map((l) => (
          <div
            key={l.id}
            className="game-letter"
            style={{ left: `${l.x}px`, top: `${l.y}px`, width: `${l.width}px`, height: `${l.height}px` }}
          >
            <div className="letter-circle">{l.char}</div>
          </div>
        ))}

        {/* REAKTÖR KARAKTERİ */}
        <div
          className={`reactor ${jumpPhase !== "ground" ? "jumping" : ""}`}
          style={{ bottom: `${GROUND_HEIGHT + dinoY}px` }}
        >
          ☢️
        </div>

        {obstacles.map((o) => (
          <div
            key={o.id}
            className={`obstacle ${o.type}`}
            style={{ left: `${o.x}px`, bottom: `${GROUND_HEIGHT}px`, height: `${o.height}px` }}
          >
            {o.type === "short" ? "🍂" : o.type === "normal" ? "🏝️" : o.type === "tall" ? "🌵" : "🌲"}
          </div>
        ))}

        <div className="ground" style={{ backgroundPosition: `${-groundOffset}px 0` }} />

        {/* MENÜLER */}
        {(gameState === "waiting" || gameState === "gameOver") && (
          <div className="game-overlay">
            <div className="message">
              <h3>{gameState === "waiting" ? "☢️ Reaktör Kelime Avı" : "💥 Oyun Bitti!"}</h3>
              {gameState === "gameOver" && <p className="final-score">Skor: {score}</p>}
              <p className="hint">Çift tıklayarak havada tekrar zıpla! (⚡)</p>
              <button className="play-btn">{gameState === "waiting" ? "🚀 BAŞLA" : "🔄 TEKRAR"}</button>
            </div>
          </div>
        )}
      </div>

      <style>{`
        .dino-game { max-width: 650px; margin: 0 auto; padding: 20px; font-family: 'Segoe UI', sans-serif; text-align: center; color: white; touch-action: none; }
        
        .word-container {
          background: rgba(0,0,0,0.5); padding: 10px; border-radius: 12px; margin-bottom: 10px; min-height: 45px;
          display: flex; justify-content: center; align-items: center; border: 1px solid rgba(255,255,255,0.1);
        }
        .word-char { font-size: 26px; font-weight: 800; color: rgba(255,255,255,0.2); margin: 0 4px; font-family: monospace; }
        .word-char.collected { color: #4CAF50; text-shadow: 0 0 10px #4CAF50; }
        .word-char.active-target { color: #FFD700; border-bottom: 3px solid #FFD700; animation: pulse 0.8s infinite; }
        .word-notification { font-size: 22px; font-weight: bold; color: #FFF; animation: slideUp 0.3s; }

        .game-info { display: flex; justify-content: space-between; gap: 10px; margin-bottom: 10px; }
        .stat-box { background: rgba(255,255,255,0.15); padding: 6px 12px; border-radius: 8px; font-size: 14px; font-weight: bold; flex: 1; }
        .double-jump { color: #555; transition: all 0.2s; }
        .double-jump.active { color: #FFD700; background: rgba(255, 215, 0, 0.2); box-shadow: 0 0 10px rgba(255, 215, 0, 0.2); }

        .game-area {
          position: relative; width: 100%; height: 300px;
          background: linear-gradient(to bottom, #87CEEB 40%, #E0F6FF 80%, #DEB887 80%, #8B4513 100%);
          border-radius: 12px; overflow: hidden; border: 4px solid rgba(255,255,255,0.4);
          cursor: pointer; user-select: none; -webkit-tap-highlight-color: transparent;
        }

        .reactor { position: absolute; left: 40px; font-size: 34px; z-index: 10; animation: spin 0.8s linear infinite; filter: drop-shadow(0 4px 4px rgba(0,0,0,0.3)); }
        .reactor.jumping { animation: spin 0.4s linear infinite; }
        
        .game-letter { position: absolute; z-index: 5; display: flex; justify-content: center; align-items: center; }
        .letter-circle {
          width: 32px; height: 32px; background: white; color: #333; border-radius: 50%;
          display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 18px;
          border: 3px solid #FFD700; box-shadow: 0 0 15px rgba(255,215,0,0.6);
        }

        .obstacle { position: absolute; display: flex; align-items: flex-end; justify-content: center; font-size: 24px; filter: grayscale(0.2); }
        .cloud { position: absolute; font-size: 30px; opacity: 0.7; color: white; }
        
        .game-overlay { position: absolute; inset: 0; background: rgba(0,0,0,0.7); display: flex; align-items: center; justify-content: center; z-index: 20; backdrop-filter: blur(4px); }
        .message { background: white; color: #333; padding: 25px; border-radius: 16px; text-align: center; width: 80%; max-width: 300px; box-shadow: 0 10px 25px rgba(0,0,0,0.2); }
        .message h3 { margin: 0 0 10px; font-size: 20px; color: #333; }
        .play-btn { background: #4CAF50; color: white; border: none; padding: 12px 30px; border-radius: 50px; font-size: 18px; font-weight: bold; margin-top: 15px; cursor: pointer; transition: transform 0.1s; box-shadow: 0 4px 0 #388E3C; }
        .play-btn:active { transform: translateY(4px); box-shadow: none; }
        .final-score { font-size: 28px; font-weight: 800; color: #4CAF50; margin: 5px 0; }
        .hint { font-size: 12px; color: #666; margin-top: 5px; }

        @keyframes spin { 100% { transform: rotate(360deg); } }
        @keyframes pulse { 0% { transform: scale(1); } 50% { transform: scale(1.15); } 100% { transform: scale(1); } }
        @keyframes slideUp { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
      `}</style>
    </div>
  );
};

export default DinoRunner;
