import React, { useState, useEffect, useCallback, useRef } from "react";
import { ArrowLeft, Volume2, VolumeX } from "lucide-react";

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
  const [isMuted, setIsMuted] = useState(false);

  // Render State'leri
  const [dinoY, setDinoY] = useState(0);
  const [dinoRotation, setDinoRotation] = useState(0);
  const [obstacles, setObstacles] = useState([]);
  const [letters, setLetters] = useState([]);
  const [clouds, setClouds] = useState([]);
  const [groundOffset, setGroundOffset] = useState(0);

  // --- KELİME VE FEEDBACK SİSTEMİ ---
  const [wordList, setWordList] = useState<string[]>([]);
  const [targetWord, setTargetWord] = useState("");
  const [collectedCount, setCollectedCount] = useState(0);
  const [wordNotification, setWordNotification] = useState("");
  const [feedback, setFeedback] = useState<{ text: string; type: "success" | "fail" } | null>(null);

  // --- OYUN MOTORU REF'LERİ ---
  const gameStateRef = useRef("waiting");
  const dinoYRef = useRef(0);
  const dinoRotationRef = useRef(0);
  const velocityRef = useRef(0);
  const speedRef = useRef(4);
  const obstaclesRef = useRef([]);
  const lettersRef = useRef([]);
  const cloudsRef = useRef([]);
  const scoreRef = useRef(0);
  const isMutedRef = useRef(false);

  // Kelime Mantığı Ref'leri
  const targetWordRef = useRef("");
  const collectedCountRef = useRef(0);
  const spawnIndexRef = useRef(0);

  const nextObstacleTimeRef = useRef(0);
  const nextLetterTimeRef = useRef(0);
  const gameLoopRef = useRef<number>();
  const audioContextRef = useRef<AudioContext | null>(null);

  const PRAISE_WORDS = [
    "Mükemmel",
    "Süper",
    "Çok iyi!",
    "Aferin",
    "Helaaal",
    "Yürü bee!",
    "Fevkalade",
    "İşte Azim",
    "Maşallah",
    "Biliyorsun bu işi :)",
  ];

  // --- AYARLAR ---
  const GRAVITY = 0.6;
  const JUMP_FORCE = 10;
  const GAME_WIDTH = 600;
  const GAME_HEIGHT = 350;
  const GROUND_HEIGHT = 30;
  const DINO_LEFT = 50;
  const DINO_WIDTH = 40;
  const DINO_HEIGHT = 40;
  const OBSTACLE_WIDTH = 30;
  const LETTER_SIZE = 35;

  useEffect(() => {
    if (!audioContextRef.current) {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      audioContextRef.current = new AudioContextClass();
    }

    fetch("/wordlist.txt")
      .then((r) => r.text())
      .then((t) =>
        setWordList(
          t
            .split("\n")
            .map((w) => w.trim().toUpperCase())
            .filter((w) => w.length > 0),
        ),
      )
      .catch(() => setWordList(["REAKTÖR", "ATOM", "ENERJİ", "FİSYON", "URANYUM"]));
  }, []);

  useEffect(() => {
    targetWordRef.current = targetWord;
  }, [targetWord]);
  useEffect(() => {
    collectedCountRef.current = collectedCount;
  }, [collectedCount]);
  useEffect(() => {
    isMutedRef.current = isMuted;
  }, [isMuted]);

  const toggleMute = () => {
    setIsMuted((prev) => !prev);
  };

  const playSound = (freq, type = "sine", vol = 0.1) => {
    if (!audioContextRef.current || isMutedRef.current) return;
    try {
      const ctx = audioContextRef.current;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = freq;
      osc.type = type as OscillatorType;
      gain.gain.setValueAtTime(vol, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
      osc.start();
      osc.stop(ctx.currentTime + 0.1);
    } catch (e) {}
  };

  const pickNewWord = useCallback(() => {
    if (wordList.length === 0) return;
    const newWord = wordList[Math.floor(Math.random() * wordList.length)];

    setTargetWord(newWord);
    setCollectedCount(0);
    setWordNotification(`HEDEF: ${newWord}`);
    setTimeout(() => setWordNotification(""), 2000);

    targetWordRef.current = newWord;
    collectedCountRef.current = 0;
    spawnIndexRef.current = 0;
    nextLetterTimeRef.current = Date.now() + 1000;
  }, [wordList]);

  const showFeedback = (isSuccess: boolean) => {
    if (isSuccess) {
      const randomPraise = PRAISE_WORDS[Math.floor(Math.random() * PRAISE_WORDS.length)];
      setFeedback({ text: randomPraise, type: "success" });
      playSound(800, "square", 0.2);
    } else {
      setFeedback({ text: "Tüh! Olmadı", type: "fail" });
      playSound(150, "sawtooth", 0.3);
    }
    setTimeout(() => setFeedback(null), 1500);
  };

  const startGame = () => {
    setGameState("playing");
    gameStateRef.current = "playing";

    dinoYRef.current = 0;
    dinoRotationRef.current = 0;
    velocityRef.current = 0;
    speedRef.current = 4;
    scoreRef.current = 0;
    setScore(0);

    obstaclesRef.current = [];
    lettersRef.current = [];
    cloudsRef.current = [];
    setObstacles([]);
    setLetters([]);
    setFeedback(null);

    nextObstacleTimeRef.current = Date.now() + 1000;

    pickNewWord();
    playSound(440, "triangle");

    if (gameLoopRef.current) cancelAnimationFrame(gameLoopRef.current);
    gameLoopRef.current = requestAnimationFrame(gameLoop);
  };

  const handleJump = (e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (gameStateRef.current !== "playing") {
      startGame();
      return;
    }
    // Flappy Bird stili: Havada da zıplanabilir
    velocityRef.current = JUMP_FORCE;
    playSound(600 + Math.random() * 200, "sine");
  };

  const checkCollision = (rect1, rect2) => {
    return (
      rect1.x < rect2.x + rect2.width &&
      rect1.x + rect1.width > rect2.x &&
      rect1.y < rect2.y + rect2.height &&
      rect1.y + rect1.height > rect2.y
    );
  };

  // --- GAME LOOP ---
  const gameLoop = () => {
    if (gameStateRef.current !== "playing") return;

    // Fizik
    velocityRef.current -= GRAVITY;
    dinoYRef.current += velocityRef.current;

    if (dinoYRef.current <= 0) {
      dinoYRef.current = 0;
      velocityRef.current = 0;
    }
    if (dinoYRef.current > GAME_HEIGHT - DINO_HEIGHT) {
      dinoYRef.current = GAME_HEIGHT - DINO_HEIGHT;
      velocityRef.current = -2;
    }

    dinoRotationRef.current += speedRef.current * 4;
    speedRef.current += 0.001;
    scoreRef.current += 1;

    setDinoY(dinoYRef.current);
    setDinoRotation(dinoRotationRef.current);
    setScore(Math.floor(scoreRef.current / 5));
    setGroundOffset((prev) => (prev + speedRef.current) % 40);

    const dinoRect = {
      x: DINO_LEFT + 5,
      y: dinoYRef.current + 5,
      width: DINO_WIDTH - 10,
      height: DINO_HEIGHT - 10,
    };

    // Engeller
    obstaclesRef.current = obstaclesRef.current
      .map((obs) => ({ ...obs, x: obs.x - speedRef.current }))
      .filter((obs) => obs.x > -OBSTACLE_WIDTH);

    if (Date.now() > nextObstacleTimeRef.current) {
      const types = ["short", "tall", "box"];
      const type = types[Math.floor(Math.random() * types.length)];
      obstaclesRef.current.push({
        id: Math.random(),
        x: GAME_WIDTH,
        y: 0,
        width: OBSTACLE_WIDTH,
        height: type === "short" ? 30 : type === "tall" ? 60 : 40,
        type: type,
      });
      nextObstacleTimeRef.current = Date.now() + 1000 + Math.random() * 1500;
    }

    for (let obs of obstaclesRef.current) {
      const obsRect = { x: obs.x + 5, y: obs.y, width: obs.width - 10, height: obs.height - 5 };
      if (checkCollision(dinoRect, obsRect)) {
        setGameState("gameOver");
        gameStateRef.current = "gameOver";
        playSound(150, "sawtooth", 0.5);
        if (Math.floor(scoreRef.current / 5) > highScore) setHighScore(Math.floor(scoreRef.current / 5));
        return;
      }
    }
    setObstacles([...obstaclesRef.current]);

    // Harfler
    lettersRef.current = lettersRef.current
      .map((l) => ({ ...l, x: l.x - speedRef.current }))
      .filter((l) => l.x > -LETTER_SIZE);

    const currentWord = targetWordRef.current;

    if (currentWord && spawnIndexRef.current < currentWord.length && Date.now() > nextLetterTimeRef.current) {
      const charToSpawn = currentWord[spawnIndexRef.current];
      const randomY = Math.max(30, Math.random() * 180);

      lettersRef.current.push({
        id: Math.random(),
        x: GAME_WIDTH,
        y: randomY,
        char: charToSpawn,
        indexInWord: spawnIndexRef.current,
        width: LETTER_SIZE,
        height: LETTER_SIZE,
        collected: false,
      });

      spawnIndexRef.current++;
      nextLetterTimeRef.current = Date.now() + 800 + Math.random() * 600;
    }

    lettersRef.current.forEach((letter) => {
      if (letter.collected) return;
      const hitBox = { x: letter.x - 15, y: letter.y - 15, width: letter.width + 30, height: letter.height + 30 };
      if (checkCollision(dinoRect, hitBox)) {
        letter.collected = true;
        playSound(1000, "square", 0.1);
        setScore((s) => s + 50);
        setCollectedCount((prev) => prev + 1);
        collectedCountRef.current += 1;
      }
    });

    const activeLetters = lettersRef.current.filter((l) => !l.collected);
    setLetters(activeLetters);

    if (currentWord && spawnIndexRef.current >= currentWord.length && activeLetters.length === 0) {
      if (collectedCountRef.current === currentWord.length) {
        setScore((s) => s + 500);
        showFeedback(true);
      } else {
        showFeedback(false);
      }
      pickNewWord();
    }

    // Bulutlar
    cloudsRef.current = cloudsRef.current.map((c) => ({ ...c, x: c.x - c.speed })).filter((c) => c.x > -100);
    if (Math.random() < 0.02)
      cloudsRef.current.push({
        id: Math.random(),
        x: GAME_WIDTH,
        y: 150 + Math.random() * 100,
        speed: 0.5 + Math.random(),
      });
    setClouds([...cloudsRef.current]);

    gameLoopRef.current = requestAnimationFrame(gameLoop);
  };

  useEffect(() => {
    if (gameState === "playing") gameLoopRef.current = requestAnimationFrame(gameLoop);
    return () => {
      if (gameLoopRef.current) cancelAnimationFrame(gameLoopRef.current);
    };
  }, [gameState]);

  useEffect(() => {
    const handleKey = (e) => {
      if (e.code === "Space" || e.code === "ArrowUp") handleJump(e);
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [gameState]);

  return (
    <div className="page-wrapper">
      <div className="game-container">
        {/* ÜST BAR */}
        <div className="top-bar">
          <button onClick={navigate} className="icon-btn">
            <ArrowLeft size={24} />
            <span className="btn-text">GERİ</span>
          </button>

          <div className="score-board">
            <div className="score-item">
              <span className="label">PUAN</span>
              <span className="value">{score}</span>
            </div>
            <div className="score-item">
              <span className="label">REKOR</span>
              <span className="value">{highScore}</span>
            </div>
          </div>

          <button onClick={toggleMute} className="icon-btn" title="Sesi Aç/Kapat">
            {isMuted ? <VolumeX size={24} /> : <Volume2 size={24} />}
          </button>
        </div>

        {/* OYUN ALANI */}
        <div className="game-stage" onPointerDown={handleJump}>
          {clouds.map((c) => (
            <div key={c.id} className="cloud" style={{ left: c.x, bottom: c.y }}>
              ☁️
            </div>
          ))}

          {feedback && <div className={`feedback-popup ${feedback.type}`}>{feedback.text}</div>}

          {letters.map((l) => (
            <div
              key={l.id}
              className="letter-box"
              style={{ left: l.x, bottom: l.y + GROUND_HEIGHT, width: l.width, height: l.height }}
            >
              <div className="letter-inner">{l.char}</div>
            </div>
          ))}

          {obstacles.map((o) => (
            <div
              key={o.id}
              className={`obstacle ${o.type}`}
              style={{ left: o.x, bottom: GROUND_HEIGHT, width: o.width, height: o.height }}
            >
              {o.type === "short" && "🌵"}
              {o.type === "tall" && "🌲"}
              {o.type === "box" && "🪨"}
            </div>
          ))}

          <div
            className="reactor"
            style={{
              left: DINO_LEFT,
              bottom: dinoY + GROUND_HEIGHT,
              width: DINO_WIDTH,
              height: DINO_HEIGHT,
              transform: `rotate(${dinoRotation}deg)`,
            }}
          >
            ☢️
          </div>

          <div className="ground" style={{ backgroundPosition: `${-groundOffset}px 0`, height: GROUND_HEIGHT }}></div>

          <div className="hud">
            {wordNotification ? (
              <div className="notification">{wordNotification}</div>
            ) : (
              <div className="word-display">
                {targetWord.split("").map((char, i) => (
                  <span key={i} className={`char-slot ${i < collectedCount ? "found" : ""}`}>
                    {char}
                  </span>
                ))}
                {/* Uzun kelime önizlemesini kaldırdık, harfler yeterli */}
              </div>
            )}
          </div>

          {gameState !== "playing" && (
            <div className="overlay">
              <div className="card">
                <h2>{gameState === "waiting" ? "REAKTÖR KOŞUSU" : "SİSTEM ÇÖKTÜ!"}</h2>
                <p>{gameState === "waiting" ? "Harfleri topla, engellerden kaç!" : `Puanın: ${score}`}</p>
                <button
                  className="start-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    startGame();
                  }}
                >
                  {gameState === "waiting" ? "BAŞLAT" : "TEKRAR DENE"}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* MOBİL KONTROLLER */}
        <div className="mobile-controls">
          <button className="control-btn" onPointerDown={(e) => handleJump(e)}>
            ZIPLA ↰
          </button>
          <button className="control-btn" onPointerDown={(e) => handleJump(e)}>
            ZIPLA ↱
          </button>
        </div>
      </div>

      <style>{`
        /* Sayfa Geneli */
        .page-wrapper {
            min-height: 100vh;
            width: 100%;
            display: flex;
            align-items: center;
            justify-content: center;
            background: linear-gradient(135deg, #141E30 0%, #243B55 100%);
            padding: 20px;
            box-sizing: border-box;
        }

        .game-container {
            width: 100%; max-width: 600px;
            font-family: 'Segoe UI', sans-serif; user-select: none;
            position: relative;
            box-shadow: 0 10px 30px rgba(0,0,0,0.5);
            border-radius: 12px;
            overflow: hidden;
        }
        
        .top-bar {
            display: flex; justify-content: space-between; align-items: center;
            padding: 12px 20px;
            color: #fff;
            background: rgba(0, 0, 0, 0.6);
            backdrop-filter: blur(8px);
            border-bottom: 1px solid rgba(255,255,255,0.1);
            position: relative; z-index: 20;
        }
        
        .icon-btn {
            background: rgba(255,255,255,0.1); 
            border: 1px solid rgba(255,255,255,0.2); 
            color: white; cursor: pointer;
            display: flex; align-items: center; justify-content: center;
            padding: 8px; border-radius: 8px; gap: 6px;
            transition: all 0.2s; min-width: 44px;
        }
        .icon-btn:hover { background: rgba(255,255,255,0.2); }
        .icon-btn:active { transform: scale(0.95); }
        .btn-text { font-weight: bold; font-size: 14px; display: none; }
        @media(min-width: 400px) { .btn-text { display: inline; } }

        .score-board { display: flex; gap: 15px; }
        .score-item { display: flex; flex-direction: column; align-items: center; }
        .score-item .label { font-size: 9px; color: #aaa; font-weight: bold; letter-spacing: 1px; }
        .score-item .value { font-size: 16px; font-weight: bold; font-family: monospace; color: #FFD700; }

        .game-stage {
            position: relative; width: 100%; height: 350px;
            background: linear-gradient(180deg, #1a2a6c 0%, #b21f1f 100%);
            overflow: hidden; cursor: pointer;
            border: 2px solid rgba(255,255,255,0.1);
            border-top: none; border-bottom: none;
        }

        .mobile-controls {
            display: flex;
            background: #111;
            padding: 15px;
            gap: 15px;
            border-top: 1px solid rgba(255,255,255,0.1);
        }
        
        .control-btn {
            flex: 1;
            background: linear-gradient(180deg, #333 0%, #111 100%);
            color: #fff;
            border: 1px solid #444;
            padding: 20px;
            border-radius: 10px;
            font-size: 18px;
            font-weight: bold;
            text-transform: uppercase;
            letter-spacing: 1px;
            cursor: pointer;
            box-shadow: 0 4px 0 #000;
            transition: all 0.1s;
            touch-action: manipulation;
        }
        
        .control-btn:active {
            transform: translateY(4px);
            box-shadow: 0 0 0 #000;
            background: linear-gradient(180deg, #222 0%, #000 100%);
            border-color: #666;
        }

        .cloud { position: absolute; font-size: 24px; opacity: 0.5; }
        .reactor { position: absolute; display: flex; align-items: center; justify-content: center; font-size: 34px; z-index: 10; filter: drop-shadow(0 0 8px #00ff00); }
        .obstacle { position: absolute; display: flex; align-items: flex-end; justify-content: center; font-size: 28px; filter: grayscale(0.4) brightness(0.8); }

        .letter-box { position: absolute; display: flex; align-items: center; justify-content: center; z-index: 5; }
        .letter-inner {
            width: 32px; height: 32px;
            background: rgba(255, 255, 255, 0.95);
            border: 3px solid #FFD700;
            border-radius: 50%;
            color: #d32f2f;
            display: flex; align-items: center; justify-content: center;
            font-weight: 900;
            box-shadow: 0 0 15px rgba(255, 215, 0, 0.8);
            font-size: 20px; font-family: 'Arial Black', sans-serif;
        }

        .ground {
            position: absolute; bottom: 0; left: 0; width: 100%;
            background: #111; border-top: 3px solid #444;
            background-image: linear-gradient(90deg, #333 2px, transparent 2px);
            background-size: 50px 100%;
        }

        .hud {
            position: absolute; top: 15px; left: 0; width: 100%;
            display: flex; justify-content: center; pointer-events: none;
            padding: 0 10px; box-sizing: border-box;
        }
        
        .word-display {
            background: rgba(0,0,0,0.7); padding: 8px 12px;
            border-radius: 30px; border: 1px solid rgba(255,255,255,0.3);
            display: flex; flex-wrap: wrap; justify-content: center; gap: 4px;
            align-items: center;
            box-shadow: 0 4px 15px rgba(0,0,0,0.4);
            max-width: 100%;
        }

        .char-slot {
            font-size: 20px; font-weight: bold; color: #666;
            min-width: 15px; text-align: center; font-family: monospace;
            border-bottom: 2px solid #444;
        }
        
        @media (max-width: 400px) {
            .char-slot { font-size: 16px; border-bottom-width: 1px; }
            .word-display { gap: 2px; padding: 6px 10px; }
        }

        .char-slot.found { color: #00ff00; border-color: #00ff00; text-shadow: 0 0 10px #00ff00; transform: scale(1.1); transition: all 0.2s; }
        
        .notification {
            font-size: 28px; font-weight: bold; color: #fff;
            text-shadow: 0 0 20px #ff00de; animation: popIn 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
            text-align: center;
        }

        .feedback-popup {
            position: absolute; top: 40%; left: 50%; transform: translate(-50%, -50%);
            font-size: 40px; font-weight: 900; z-index: 40;
            text-align: center; white-space: nowrap;
            animation: bounceIn 0.5s ease-out forwards, fadeOut 0.5s ease-in 1s forwards;
        }
        .feedback-popup.success {
            color: #FFD700;
            text-shadow: 0 0 10px rgba(255, 215, 0, 0.8), 2px 2px 0 #000;
            background: rgba(0,0,0,0.3); padding: 10px 20px; border-radius: 15px;
        }
        .feedback-popup.fail {
            color: #FF4444;
            text-shadow: 0 0 10px rgba(255, 68, 68, 0.8), 2px 2px 0 #000;
            background: rgba(0,0,0,0.3); padding: 10px 20px; border-radius: 15px;
        }

        @keyframes bounceIn {
            0% { transform: translate(-50%, -50%) scale(0); opacity: 0; }
            60% { transform: translate(-50%, -50%) scale(1.2); opacity: 1; }
            100% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
        }
        @keyframes fadeOut { to { opacity: 0; transform: translate(-50%, -60%) scale(1.1); } }
        @keyframes popIn { from { transform: scale(0); } to { transform: scale(1); } }

        .overlay {
            position: absolute; inset: 0; background: rgba(0,0,0,0.8);
            display: flex; align-items: center; justify-content: center; z-index: 50; backdrop-filter: blur(5px);
        }
        .card {
            background: #222; color: #fff; padding: 30px; border-radius: 20px;
            text-align: center; border: 1px solid #444; box-shadow: 0 0 50px rgba(0,0,0,0.6);
        }
        .start-btn {
            background: linear-gradient(45deg, #FFD700, #FF8C00);
            border: none; padding: 12px 30px; color: #000; font-weight: 900;
            font-size: 18px; border-radius: 30px; margin-top: 15px; cursor: pointer;
            box-shadow: 0 0 20px rgba(255, 215, 0, 0.4); transition: transform 0.1s;
        }
        .start-btn:active { transform: scale(0.95); }
      `}</style>
    </div>
  );
};

export default DinoRunner;
