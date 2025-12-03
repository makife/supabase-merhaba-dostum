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
  const [speed, setSpeed] = useState(2);

  // Fizik ve Karakter
  const [dinoY, setDinoY] = useState(0);
  const [jumpPhase, setJumpPhase] = useState("ground");
  const [doubleJumpsLeft, setDoubleJumpsLeft] = useState(3);
  const [canDoubleJump, setCanDoubleJump] = useState(false);

  // Objeler
  const [obstacles, setObstacles] = useState([]);
  const [clouds, setClouds] = useState([]);
  const [letters, setLetters] = useState([]); // EKRANDAKİ UÇAN HARFLER

  // Çevre ve Ayarlar
  const [groundOffset, setGroundOffset] = useState(0);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [vibrationEnabled, setVibrationEnabled] = useState(true);
  const [scoreHistory, setScoreHistory] = useState<number[]>([]);
  const [showScoreHistory, setShowScoreHistory] = useState(false);

  // --- YENİ KELİME SİSTEMİ STATE'LERİ ---
  const [wordList, setWordList] = useState<string[]>([]);
  const [targetWord, setTargetWord] = useState(""); // Hedef kelime (örn: "ELMA")
  const [collectedCount, setCollectedCount] = useState(0); // Kaç harf toplandı (0=hiç, 1=E, 2=EL...)
  const [wordNotification, setWordNotification] = useState(""); // "Sıradaki Kelime: ARMUT" animasyonu için

  // Zamanlayıcılar
  const [nextObstacleTime, setNextObstacleTime] = useState(0);
  const [nextLetterTime, setNextLetterTime] = useState(0);

  const gameLoopRef = useRef<number>();
  const lastTouchTime = useRef<number>(0);
  const audioContextRef = useRef<AudioContext | null>(null);

  // Oyun sabitleri
  const GAME_WIDTH = 600;
  const GAME_HEIGHT = 350;
  const GROUND_HEIGHT = 20;
  const DINO_WIDTH = 30;
  const DINO_HEIGHT = 40;
  const DINO_GROUND_Y = GAME_HEIGHT - GROUND_HEIGHT - DINO_HEIGHT;
  const JUMP_HEIGHT = 120;
  const OBSTACLE_WIDTH = 20;
  const LETTER_SIZE = 30; // Harf boyutu

  // Wordlist.txt çekme
  useEffect(() => {
    fetch("/wordlist.txt")
      .then((response) => response.text())
      .then((text) => {
        // Satır satır böl, boşlukları temizle, boş satırları filtrele
        const words = text
          .split("\n")
          .map((w) => w.trim().toUpperCase())
          .filter((w) => w.length > 0);
        setWordList(words);
      })
      .catch((err) => {
        console.error("Kelime listesi yüklenemedi, varsayılanlar kullanılıyor.", err);
        setWordList(["ELMA", "ARMUT", "KİRAZ", "KARPUZ", "ÇİLEK", "ATOM", "ENERJİ"]);
      });
  }, []);

  // AudioContext
  useEffect(() => {
    if (!audioContextRef.current) {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      audioContextRef.current = new AudioContextClass();
    }
    return () => {
      if (audioContextRef.current) {
        audioContextRef.current.close();
        audioContextRef.current = null;
      }
    };
  }, []);

  // Ses efektleri
  const playSound = useCallback(
    (frequency, duration = 100, type = "sine") => {
      if (!soundEnabled || !audioContextRef.current) return;
      try {
        const audioContext = audioContextRef.current;
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        oscillator.frequency.value = frequency;
        oscillator.type = type as OscillatorType;
        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration / 1000);
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + duration / 1000);
      } catch (error) {
        console.log("Ses hatası", error);
      }
    },
    [soundEnabled],
  );

  // Titreşim
  const vibrate = useCallback(
    (pattern = [50]) => {
      if (!vibrationEnabled) return;
      try {
        if (navigator.vibrate) navigator.vibrate(pattern);
      } catch (e) {
        console.log(e);
      }
    },
    [vibrationEnabled],
  );

  // --- YENİ KELİME SEÇME FONKSİYONU ---
  const pickNewWord = useCallback(() => {
    if (wordList.length === 0) return;
    const randomIndex = Math.floor(Math.random() * wordList.length);
    const newWord = wordList[randomIndex];
    setTargetWord(newWord);
    setCollectedCount(0);
    setWordNotification(`Sıradaki: ${newWord}`);
    setTimeout(() => setWordNotification(""), 2000); // 2 saniye sonra bildirimi gizle
  }, [wordList]);

  // Zıplama Mantığı (Aynı kaldı)
  const jump = useCallback(() => {
    if (gameState !== "playing") return;

    if (jumpPhase === "ground") {
      setJumpPhase("jumping");
      setCanDoubleJump(true);
      playSound(800, 150);
      vibrate([30]);

      let progress = 0;
      const totalDuration = 600;
      const startTime = Date.now();

      const singleJumpAnimation = () => {
        const elapsed = Date.now() - startTime;
        progress = elapsed / totalDuration;
        if (progress <= 1) {
          const jumpY = Math.sin(progress * Math.PI) * JUMP_HEIGHT;
          setDinoY(jumpY);
          requestAnimationFrame(singleJumpAnimation);
        } else {
          setDinoY(0);
          setJumpPhase("ground");
          setCanDoubleJump(false);
        }
      };
      singleJumpAnimation();
    } else if (jumpPhase === "jumping" && canDoubleJump && doubleJumpsLeft > 0) {
      setDoubleJumpsLeft((prev) => prev - 1);
      setCanDoubleJump(false);
      setJumpPhase("doubleJumping");
      playSound(1000, 200);
      vibrate([50, 30, 50]);

      const currentHeight = dinoY;
      const extraJumpHeight = 60;
      let doubleProgress = 0;
      const doubleDuration = 400;
      const doubleStartTime = Date.now();

      const doubleJumpAnimation = () => {
        const elapsed = Date.now() - doubleStartTime;
        doubleProgress = elapsed / doubleDuration;
        if (doubleProgress <= 1) {
          const extraY = Math.sin(doubleProgress * Math.PI) * extraJumpHeight;
          setDinoY(currentHeight + extraY);
          requestAnimationFrame(doubleJumpAnimation);
        } else {
          let fallProgress = 0;
          const fallDuration = 150;
          const fallStartTime = Date.now();
          const fallAnimation = () => {
            const fallElapsed = Date.now() - fallStartTime;
            fallProgress = fallElapsed / fallDuration;
            if (fallProgress <= 1) {
              const fallY = currentHeight * (1 - fallProgress * fallProgress * 2);
              setDinoY(Math.max(0, fallY));
              requestAnimationFrame(fallAnimation);
            } else {
              setDinoY(0);
              setJumpPhase("ground");
            }
          };
          fallAnimation();
        }
      };
      doubleJumpAnimation();
    }
  }, [gameState, jumpPhase, canDoubleJump, doubleJumpsLeft, dinoY, playSound, vibrate]);

  // Obje Yaratma
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

    return {
      x: GAME_WIDTH,
      y: DINO_GROUND_Y + 10,
      width: OBSTACLE_WIDTH,
      height: height,
      type: type,
    };
  }, []);

  // --- HARF YARATMA ---
  const createLetter = useCallback((char: string) => {
    // Harf yerde mi havada mı olsun? (%50 ihtimal)
    // Havada ise zıplayarak alınabilir bir noktada (yerden 60-90px yukarıda)
    const isAerial = Math.random() > 0.5;
    const yPos = isAerial ? DINO_GROUND_Y - (60 + Math.random() * 40) : DINO_GROUND_Y - 10;

    return {
      x: GAME_WIDTH,
      y: yPos,
      char: char,
      width: LETTER_SIZE,
      height: LETTER_SIZE,
      id: Date.now() + Math.random(), // Benzersiz ID
      collected: false,
    };
  }, []);

  const createCloud = useCallback(() => {
    return {
      x: GAME_WIDTH,
      y: Math.random() * 60 + 20,
      speed: 0.5 + Math.random() * 0.5,
    };
  }, []);

  // Çarpışma Kontrolü
  const checkCollision = useCallback(
    (dino, entity) => {
      const dinoRect = {
        x: 50,
        y: DINO_GROUND_Y - dinoY,
        width: DINO_WIDTH - 5,
        height: DINO_HEIGHT - 5,
      };
      // Harfler biraz daha affedici olabilir, engeller daha katı
      const margin = entity.char ? 0 : 3;

      const entityRect = {
        x: entity.x + margin,
        y: entity.y,
        width: entity.width - margin * 2,
        height: entity.height,
      };

      return (
        dinoRect.x < entityRect.x + entityRect.width &&
        dinoRect.x + dinoRect.width > entityRect.x &&
        dinoRect.y < entityRect.y + entityRect.height &&
        dinoRect.y + dinoRect.height > entityRect.y
      );
    },
    [dinoY],
  );

  // Oyunu Başlat
  const startGame = useCallback(() => {
    setGameState("playing");
    setScore(0);
    setSpeed(2);
    setDinoY(0);
    setJumpPhase("ground");
    setDoubleJumpsLeft(3);
    setCanDoubleJump(false);
    setObstacles([]);
    setLetters([]); // Harfleri sıfırla
    setClouds([createCloud()]);
    setGroundOffset(0);
    setNextObstacleTime(Date.now() + 1000);
    setNextLetterTime(Date.now() + 1500); // İlk harf biraz daha geç gelsin

    // İlk kelimeyi seç
    pickNewWord();

    playSound(440, 200);
    vibrate([100]);
  }, [createCloud, playSound, vibrate, pickNewWord]);

  // Oyun Sonu
  const endGame = useCallback(() => {
    setGameState("gameOver");
    setScoreHistory((prev) => [score, ...prev].slice(0, 10));
    if (score > highScore) {
      setHighScore(score);
      playSound(660, 300);
      vibrate([100, 50, 100, 50, 100]);
    } else {
      playSound(200, 500);
      vibrate([200]);
    }
    if (gameLoopRef.current) cancelAnimationFrame(gameLoopRef.current);
  }, [score, highScore, playSound, vibrate]);

  // --- OYUN DÖNGÜSÜ ---
  const gameLoop = useCallback(() => {
    if (gameState !== "playing") return;

    // Skor ve Hız
    setScore((prev) => prev + 1);
    setSpeed((prev) => Math.min(prev + 0.002, 12)); // Max hızı biraz artırdım
    setGroundOffset((prev) => (prev + speed) % 40);

    // --- ENGELLER (OBSTACLES) ---
    setObstacles((prev) => {
      let newObstacles = prev.map((obs) => ({ ...obs, x: obs.x - speed })).filter((obs) => obs.x > -OBSTACLE_WIDTH);

      const currentTime = Date.now();
      if (currentTime >= nextObstacleTime) {
        newObstacles.push(createObstacle());
        // Rastgele bekleme süresi
        const nextWait = 1200 + Math.random() * 1500 - speed * 50; // Hızlandıkça daha sık gelsin
        setNextObstacleTime(currentTime + Math.max(800, nextWait)); // Min 800ms
      }

      // Engel Çarpışma Kontrolü
      newObstacles.forEach((obs) => {
        if (checkCollision({ x: 50, y: DINO_GROUND_Y - dinoY }, obs)) {
          endGame();
        }
      });
      return newObstacles;
    });

    // --- HARFLER (LETTERS) ---
    setLetters((prev) => {
      // 1. Harfleri hareket ettir
      let newLetters = prev.map((l) => ({ ...l, x: l.x - speed })).filter((l) => l.x > -LETTER_SIZE);

      // 2. Harf Toplama Kontrolü
      let collectedIndices: number[] = [];
      newLetters.forEach((letter, index) => {
        if (!letter.collected && checkCollision({ x: 50, y: DINO_GROUND_Y - dinoY }, letter)) {
          // Harfi topladık!
          letter.collected = true; // Ekranda kaybolması için işaretle
          collectedIndices.push(index);

          // Efektler
          playSound(1200, 100, "square"); // "Coin" sesi gibi
          setScore((s) => s + 50); // Harf başına 50 puan

          // Kelime mantığı
          setCollectedCount((prevCount) => {
            const newCount = prevCount + 1;

            // Eğer kelime tamamlandıysa
            if (newCount >= targetWord.length) {
              // Bonus puan
              setScore((s) => s + 500);
              playSound(1500, 400, "triangle"); // Zafer sesi
              vibrate([50, 50, 50]);
              // Yeni kelimeye geç
              pickNewWord();
              return 0; // Count'u sıfırla (pickNewWord zaten yapıyor ama garanti olsun)
            }
            return newCount;
          });
        }
      });

      // Toplananları diziden çıkar
      newLetters = newLetters.filter((l) => !l.collected);

      // 3. Yeni Harf Spawn Mantığı
      // Eğer şu an ekranda, hedeflediğimiz harf YOKSA, yeni bir tane oluştur.
      // Ekranda birden fazla aynı harf olmasını istemeyiz.
      const currentTime = Date.now();

      // Sırada hangi harf var?
      const neededChar = targetWord[collectedCount];

      // Ekranda şu an o harf var mı?
      const isNeededCharOnScreen = newLetters.some((l) => l.char === neededChar);

      // Eğer ekranda yoksa ve bekleme süresi dolduysa spawn et
      if (!isNeededCharOnScreen && currentTime >= nextLetterTime && neededChar) {
        newLetters.push(createLetter(neededChar));
        // Bir sonraki harf girişimi için bekleme (harfi kaçırırsa hemen dibinde bitmesin)
        setNextLetterTime(currentTime + 1000 + Math.random() * 1000);
      }

      return newLetters;
    });

    // --- BULUTLAR ---
    setClouds((prev) => {
      let newClouds = prev.map((c) => ({ ...c, x: c.x - c.speed })).filter((c) => c.x > -60);
      if (Math.random() < 0.005 && newClouds.length < 3) newClouds.push(createCloud());
      return newClouds;
    });

    gameLoopRef.current = requestAnimationFrame(gameLoop);
  }, [
    gameState,
    speed,
    dinoY,
    targetWord,
    collectedCount,
    createObstacle,
    createLetter,
    checkCollision,
    endGame,
    pickNewWord,
    playSound,
    vibrate,
  ]);

  // Kontroller (Touch/Keyboard)
  useEffect(() => {
    const handleKeyPress = (e) => {
      if (e.code === "Space" || e.code === "ArrowUp") {
        e.preventDefault();
        gameState === "waiting" || gameState === "gameOver" ? startGame() : jump();
      }
    };
    window.addEventListener("keydown", handleKeyPress);
    return () => window.removeEventListener("keydown", handleKeyPress);
  }, [gameState, startGame, jump]);

  const handleTouch = useCallback(
    (e) => {
      e.preventDefault();
      e.stopPropagation();
      const currentTime = Date.now();
      if (currentTime - lastTouchTime.current < 200) return;
      lastTouchTime.current = currentTime;
      gameState === "waiting" || gameState === "gameOver" ? startGame() : jump();
    },
    [gameState, startGame, jump],
  );

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
          onClick={() => navigate()}
          className="flex items-center gap-2 text-white/80 hover:text-white bg-transparent border-none cursor-pointer"
        >
          <ArrowLeft className="w-5 h-5" /> Geri Dön
        </button>
      </div>

      <div className="game-header">
        {/* --- YENİ KELİME UI --- */}
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
          <span>Puan: {score.toString().padStart(5, "0")}</span>
          <span>En Yüksek: {highScore.toString().padStart(5, "0")}</span>
          <span className="double-jump-counter">⚡ {doubleJumpsLeft}</span>
        </div>

        <div className="settings">
          <button
            className={`setting-btn ${soundEnabled ? "active" : ""}`}
            onClick={() => setSoundEnabled(!soundEnabled)}
          >
            🔊
          </button>
          <button
            className={`setting-btn ${vibrationEnabled ? "active" : ""}`}
            onClick={() => setVibrationEnabled(!vibrationEnabled)}
          >
            📳
          </button>
        </div>
      </div>

      <div className="game-area" onTouchStart={handleTouch} onClick={handleTouch}>
        {clouds.map((cloud, i) => (
          <div key={i} className="cloud" style={{ left: `${cloud.x}px`, top: `${cloud.y}px` }}>
            ☁️
          </div>
        ))}

        {/* --- HARFLERİN RENDER EDİLMESİ --- */}
        {letters.map((letter) => (
          <div
            key={letter.id}
            className="game-letter"
            style={{
              left: `${letter.x}px`,
              top: `${letter.y}px`, // bottom yerine top kullanıyoruz çünkü havada olabilir
              width: `${letter.width}px`,
              height: `${letter.height}px`,
            }}
          >
            <div className="letter-circle">{letter.char}</div>
          </div>
        ))}

        <div
          className={`reactor ${jumpPhase !== "ground" ? "jumping" : ""} ${canDoubleJump ? "can-double-jump" : ""}`}
          style={{ bottom: `${GROUND_HEIGHT + dinoY}px` }}
        >
          ☢️
        </div>

        {obstacles.map((obs, i) => (
          <div
            key={i}
            className={`obstacle ${obs.type}`}
            style={{ left: `${obs.x}px`, bottom: `${GROUND_HEIGHT}px`, height: `${obs.height}px` }}
          >
            {obs.type === "short" ? "🍂" : obs.type === "normal" ? "🏝️" : obs.type === "tall" ? "🌵" : "🌲"}
          </div>
        ))}

        <div className="ground" style={{ backgroundPosition: `${-groundOffset}px 0` }} />

        {gameState === "waiting" && (
          <div className="game-overlay">
            <div className="message">
              <h3>☢️ Reaktör Kelime Avı</h3>
              <p>Zıpla, harfleri topla, kelimeyi tamamla!</p>
              <button className="play-btn" onClick={startGame}>
                🚀 Başla
              </button>
            </div>
          </div>
        )}

        {gameState === "gameOver" && (
          <div className="game-overlay">
            <div className="message">
              <h3>💥 Oyun Bitti!</h3>
              <p>Puan: {score}</p>
              <button className="play-btn" onClick={startGame}>
                🔄 Tekrar
              </button>
            </div>
          </div>
        )}
      </div>

      <style>{`
        body { margin: 0; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); }
        .dino-game { max-width: 650px; margin: 0 auto; padding: 20px; font-family: Arial, sans-serif; text-align: center; color: white; user-select: none; }
        
        /* Word Container Stilleri */
        .word-container {
          background: rgba(0, 0, 0, 0.4);
          padding: 10px 20px;
          border-radius: 15px;
          margin-bottom: 15px;
          min-height: 40px;
          display: flex;
          justify-content: center;
          align-items: center;
          border: 2px solid rgba(255, 255, 255, 0.1);
          box-shadow: 0 4px 6px rgba(0,0,0,0.2);
        }
        
        .current-word {
          display: flex;
          gap: 5px;
        }
        
        .word-char {
          font-family: 'Courier New', monospace;
          font-size: 24px;
          font-weight: bold;
          color: rgba(255, 255, 255, 0.3); /* Toplanmamış harf soluk */
          padding: 2px 6px;
          border-radius: 4px;
          transition: all 0.3s;
        }
        
        .word-char.collected {
          color: #4CAF50; /* Toplanmış harf yeşil */
          text-shadow: 0 0 10px #4CAF50;
          transform: scale(1.1);
        }
        
        .word-char.active-target {
          color: #FFD700; /* Sıradaki harf sarı */
          text-shadow: 0 0 10px #FFD700;
          animation: pulse 1s infinite;
          border-bottom: 2px solid #FFD700;
        }
        
        .word-notification {
          color: #FFF;
          font-weight: bold;
          font-size: 20px;
          animation: slideIn 0.5s ease-out;
        }

        /* Uçan Harf Stilleri */
        .game-letter {
          position: absolute;
          z-index: 5; /* Bulutların önünde, reaktörün arkasında olabilir */
          display: flex;
          align-items: center;
          justify-content: center;
        }
        
        .letter-circle {
          background: rgba(255, 255, 255, 0.9);
          color: #333;
          width: 30px;
          height: 30px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: bold;
          font-family: monospace;
          box-shadow: 0 0 15px rgba(255, 255, 255, 0.6);
          border: 2px solid #FFD700;
          animation: float 2s ease-in-out infinite;
        }

        @keyframes pulse { 0% { opacity: 0.7; } 50% { opacity: 1; } 100% { opacity: 0.7; } }
        @keyframes float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-5px); } }
        @keyframes slideIn { from { transform: translateY(-20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }

        /* Mevcut Stiller */
        .game-header { margin-bottom: 10px; }
        .game-info { display: flex; justify-content: center; gap: 15px; margin-bottom: 10px; flex-wrap: wrap; }
        .game-info span { background: rgba(0,0,0,0.3); padding: 5px 10px; border-radius: 15px; font-size: 14px; font-family: monospace; }
        .double-jump-counter { color: #FFD700; border: 1px solid #FFD700; }
        .settings { display: flex; justify-content: center; gap: 10px; margin-bottom: 10px; }
        .setting-btn { background: rgba(255,255,255,0.2); border: none; padding: 5px 10px; border-radius: 15px; cursor: pointer; color: white; }
        .setting-btn.active { background: #4CAF50; }
        
        .game-area {
          position: relative; width: 600px; height: 350px; margin: 0 auto;
          background: linear-gradient(to bottom, #87CEEB 0%, #87CEEB 75%, #DEB887 75%, #DEB887 100%);
          border-radius: 10px; overflow: hidden; border: 3px solid rgba(255,255,255,0.3);
        }
        .cloud { position: absolute; font-size: 24px; opacity: 0.8; }
        .reactor { position: absolute; left: 50px; font-size: 30px; z-index: 10; animation: reactorSpin 1s linear infinite; }
        .reactor.jumping { animation: reactorJumpSpin 0.6s ease-in-out; }
        .obstacle { position: absolute; display: flex; align-items: flex-end; justify-content: center; font-size: 24px; }
        .ground { position: absolute; bottom: 0; left: 0; width: 100%; height: 20px; background: repeating-linear-gradient(90deg, #8B4513 0, #8B4513 2px, #A0522D 2px, #A0522D 4px); }
        .game-overlay { position: absolute; inset: 0; background: rgba(0,0,0,0.7); display: flex; align-items: center; justify-content: center; z-index: 20; }
        .message { background: rgba(255,255,255,0.95); color: #333; padding: 30px; border-radius: 10px; text-align: center; }
        .play-btn { background: #4CAF50; color: white; border: none; padding: 10px 20px; border-radius: 20px; font-size: 16px; margin-top: 10px; cursor: pointer; }

        @keyframes reactorSpin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes reactorJumpSpin { 0% { transform: scale(1) rotate(0); } 50% { transform: scale(1.2) rotate(180deg); } 100% { transform: scale(1) rotate(360deg); } }
        
        @media (max-width: 650px) {
          .dino-game { padding: 10px; }
          .game-area { width: 100%; height: 250px; }
          .word-char { font-size: 18px; }
        }
      `}</style>
    </div>
  );
};

export default DinoRunner;
