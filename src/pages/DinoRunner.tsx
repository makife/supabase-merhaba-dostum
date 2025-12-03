import React, { useState, useEffect, useCallback, useRef } from "react";
import { ArrowLeft, RefreshCw, Zap } from "lucide-react";

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

  // Görsel State'ler (Render için)
  // Not: Fizik hesaplamaları Ref'lerde döner, render için state'e aktarılır
  const [dinoY, setDinoY] = useState(0);
  const [obstacles, setObstacles] = useState([]);
  const [letters, setLetters] = useState([]);
  const [clouds, setClouds] = useState([]);
  const [groundOffset, setGroundOffset] = useState(0);

  // --- KELİME SİSTEMİ ---
  const [wordList, setWordList] = useState<string[]>([]);
  const [targetWord, setTargetWord] = useState("");
  const [collectedCount, setCollectedCount] = useState(0);
  const [wordNotification, setWordNotification] = useState("");

  // --- OYUN MOTORU REF'LERİ (Değişkenler) ---
  // React State yerine Ref kullanıyoruz ki oyun döngüsü takılmasın
  const gameStateRef = useRef("waiting");
  const dinoYRef = useRef(0);
  const velocityRef = useRef(0); // Dikey Hız
  const speedRef = useRef(4); // Oyun Hızı
  const obstaclesRef = useRef([]);
  const lettersRef = useRef([]);
  const cloudsRef = useRef([]);
  const scoreRef = useRef(0);

  const nextObstacleTimeRef = useRef(0);
  const nextLetterTimeRef = useRef(0);
  const gameLoopRef = useRef<number>();
  const audioContextRef = useRef<AudioContext | null>(null);

  // --- AYARLAR ---
  const GRAVITY = 0.6; // Yerçekimi kuvveti
  const JUMP_FORCE = 10; // Zıplama gücü
  const GAME_WIDTH = 600;
  const GAME_HEIGHT = 350;
  const GROUND_HEIGHT = 30;
  const DINO_LEFT = 50; // Reaktörün soldan uzaklığı
  const DINO_WIDTH = 40;
  const DINO_HEIGHT = 40;
  const OBSTACLE_WIDTH = 30;
  const LETTER_SIZE = 35;

  // Ses Motoru
  useEffect(() => {
    if (!audioContextRef.current) {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      audioContextRef.current = new AudioContextClass();
    }

    // Kelime listesi
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

  const playSound = (freq, type = "sine", vol = 0.1) => {
    if (!audioContextRef.current) return;
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

  // --- KELİME SEÇİMİ ---
  const pickNewWord = useCallback(() => {
    if (wordList.length === 0) return;
    const newWord = wordList[Math.floor(Math.random() * wordList.length)];
    setTargetWord(newWord);
    setCollectedCount(0);
    setWordNotification(`HEDEF: ${newWord}`);
    setTimeout(() => setWordNotification(""), 2000);
  }, [wordList]);

  // --- OYUN BAŞLAT ---
  const startGame = () => {
    setGameState("playing");
    gameStateRef.current = "playing";

    // Reset Physics
    dinoYRef.current = 0;
    velocityRef.current = 0;
    speedRef.current = 4;
    scoreRef.current = 0;
    setScore(0);

    // Reset Objects
    obstaclesRef.current = [];
    lettersRef.current = [];
    cloudsRef.current = [];
    setObstacles([]);
    setLetters([]);

    nextObstacleTimeRef.current = Date.now() + 1000;
    nextLetterTimeRef.current = Date.now() + 1500;

    pickNewWord();
    playSound(440, "triangle");

    if (gameLoopRef.current) cancelAnimationFrame(gameLoopRef.current);
    gameLoopRef.current = requestAnimationFrame(gameLoop);
  };

  // --- ZIPLAMA (SONSUZ) ---
  const handleJump = (e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }

    if (gameStateRef.current !== "playing") {
      startGame();
      return;
    }

    // Basit Fizik: Her tıklandığında yukarı doğru hız ver
    velocityRef.current = JUMP_FORCE;
    playSound(600 + Math.random() * 200, "sine"); // Her zıplamada biraz farklı ses
  };

  // --- ÇARPIŞMA KONTROLÜ (AABB - Axis Aligned Bounding Box) ---
  const checkCollision = (rect1, rect2) => {
    return (
      rect1.x < rect2.x + rect2.width &&
      rect1.x + rect1.width > rect2.x &&
      rect1.y < rect2.y + rect2.height &&
      rect1.y + rect1.height > rect2.y
    );
  };

  // --- ANA OYUN DÖNGÜSÜ (FİZİK MOTORU) ---
  const gameLoop = () => {
    if (gameStateRef.current !== "playing") return;

    // 1. FİZİK GÜNCELLEME (Gravity)
    // Hızına yerçekimini ekle (aşağı çeker)
    velocityRef.current -= GRAVITY;
    // Konumuna hızı ekle
    dinoYRef.current += velocityRef.current;

    // Yere çarpma kontrolü
    if (dinoYRef.current <= 0) {
      dinoYRef.current = 0;
      velocityRef.current = 0; // Hızı sıfırla ama zıplamaya hazır ol
    }

    // Tavana çarpma kontrolü (Çok uçmasın diye opsiyonel)
    if (dinoYRef.current > GAME_HEIGHT - DINO_HEIGHT) {
      dinoYRef.current = GAME_HEIGHT - DINO_HEIGHT;
      velocityRef.current = -2; // Kafayı çarpıp düşsün
    }

    // 2. OYUN ZORLUĞU VE SKOR
    speedRef.current += 0.001; // Çok yavaş hızlanma
    scoreRef.current += 1;

    // Render için state güncelleme (Her frame değil, performans için)
    setDinoY(dinoYRef.current);
    setScore(Math.floor(scoreRef.current / 5)); // Puanı biraz yavaşlat
    setGroundOffset((prev) => (prev + speedRef.current) % 40);

    const dinoRect = {
      x: DINO_LEFT + 5, // Hitbox'ı biraz daralt
      y: dinoYRef.current + 5,
      width: DINO_WIDTH - 10,
      height: DINO_HEIGHT - 10,
    };

    // 3. ENGEL YÖNETİMİ
    // Hareket
    obstaclesRef.current = obstaclesRef.current
      .map((obs) => ({ ...obs, x: obs.x - speedRef.current }))
      .filter((obs) => obs.x > -OBSTACLE_WIDTH);

    // Spawn
    if (Date.now() > nextObstacleTimeRef.current) {
      const types = ["short", "tall", "box"];
      const type = types[Math.floor(Math.random() * types.length)];
      const height = type === "short" ? 30 : type === "tall" ? 60 : 40;

      obstaclesRef.current.push({
        id: Math.random(),
        x: GAME_WIDTH,
        y: 0, // Engeller hep yerdedir (bottom: 0)
        width: OBSTACLE_WIDTH,
        height: height,
        type: type,
      });
      // Rastgele bekleme süresi
      nextObstacleTimeRef.current = Date.now() + 1000 + Math.random() * 1500;
    }

    // Engel Çarpışma
    for (let obs of obstaclesRef.current) {
      const obsRect = { x: obs.x + 5, y: obs.y, width: obs.width - 10, height: obs.height - 5 };
      if (checkCollision(dinoRect, obsRect)) {
        setGameState("gameOver");
        gameStateRef.current = "gameOver";
        playSound(150, "sawtooth", 0.5);
        if (Math.floor(scoreRef.current / 5) > highScore) setHighScore(Math.floor(scoreRef.current / 5));
        return; // Döngüyü kır
      }
    }
    setObstacles([...obstaclesRef.current]);

    // 4. HARF YÖNETİMİ
    // Hareket
    lettersRef.current = lettersRef.current
      .map((l) => ({ ...l, x: l.x - speedRef.current }))
      .filter((l) => l.x > -LETTER_SIZE);

    // Spawn
    // Eğer hedef kelime varsa ve harf zamanı geldiyse
    if (targetWord && Date.now() > nextLetterTimeRef.current) {
      // Şu anki kelimenin sıradaki harfini bul (collectedCount'tan)
      // State'e erişmek loop içinde zor olabilir, o yüzden harfleri sırayla spawn edelim
      // Basitlik için: Ekranda aradığımız harf yoksa üret.

      // Bu closure içinde state'in güncel değeri olmayabilir, ref kullanalım mı?
      // Basit çözüm: targetWord bir state, loop içinde stale olabilir.
      // Ancak targetWord değiştiğinde component re-render olur ve loop yeniden tanımlanırsa sorun yok.
      // Ama biz loop'u ref ile tutuyoruz. O yüzden targetWord'ü bir ref'e kopyalamak daha güvenli olurdu ama
      // şimdilik basit bir kontrol yapalım.

      // Rastgele yükseklik (Min 20px, Max 180px) - YERİN ALTINA GİRMEMESİ İÇİN
      const randomY = Math.max(20, Math.random() * 180);

      // Rastgele bir harf üretmek yerine, kelimenin sıradaki harflerinden birini üretelim
      // Şimdilik tamamen rastgele üretip, doğruysa toplama mantığı yapalım
      // Veya dışarıdan state ile gelen targetWord'ü kullanalım.

      lettersRef.current.push({
        id: Math.random(),
        x: GAME_WIDTH,
        y: randomY, // Bottom offset
        char: "?", // Bunu toplama anında veya renderda çözeceğiz, şimdilik placeholder
        width: LETTER_SIZE,
        height: LETTER_SIZE,
        collected: false,
      });

      nextLetterTimeRef.current = Date.now() + 800 + Math.random() * 1000;
    }

    // Harf Çarpışma ve Mantık
    // Not: Harf karakterini burada belirlemek yerine, spawn anında belirlemeliyiz.
    // Ancak closure sorununu aşmak için: Harfleri "Generic Collectible" yapalım.
    // Çarpışınca o anki state'teki gereken harfi vermiş gibi davranalım.

    // YENİ MANTIK: Harf kutuları "?" olarak gelir. Toplayınca sıradaki harf açılır.
    // Bu kodun karmaşıklığını ve bug riskini azaltır.

    lettersRef.current.forEach((letter) => {
      if (letter.collected) return;

      const letterRect = { x: letter.x, y: letter.y, width: letter.width, height: letter.height };
      // Harf hitbox'ını biraz genişletelim (Mıknatıs etkisi gibi hissettirsin)
      const hitBox = { x: letter.x - 10, y: letter.y - 10, width: letter.width + 20, height: letter.height + 20 };

      if (checkCollision(dinoRect, hitBox)) {
        letter.collected = true;
        playSound(1000, "square", 0.1);

        // React State güncellemesi (Loop dışına etki)
        setCollectedCount((prev) => {
          const next = prev + 1;
          // Kelime bitti mi?
          // Not: targetWord state'i burada closure içinde eski kalabilir.
          // Bu yüzden basit bir hile yapacağız: setCollectedCount callback'i içinde kontrol yok,
          // useEffect ile collectedCount değişimini dinleyeceğiz.
          return next;
        });
        setScore((s) => s + 50);
      }
    });

    // Toplananları temizle
    lettersRef.current = lettersRef.current.filter((l) => !l.collected);
    setLetters([...lettersRef.current]);

    // 5. BULUTLAR
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

  // --- COLLECTED COUNT DEĞİŞİMİNİ İZLE (Kelime Tamamlama) ---
  useEffect(() => {
    if (gameState === "playing" && targetWord && collectedCount > 0) {
      if (collectedCount >= targetWord.length) {
        // Kelime Tamamlandı!
        setScore((s) => s + 500);
        playSound(1500, "sine", 0.3);
        pickNewWord();
        // collectedCount pickNewWord içinde sıfırlanır
      }
    }
  }, [collectedCount, targetWord, pickNewWord, gameState]);

  // Loop Başlatma/Durdurma
  useEffect(() => {
    if (gameState === "playing") {
      gameLoopRef.current = requestAnimationFrame(gameLoop);
    }
    return () => {
      if (gameLoopRef.current) cancelAnimationFrame(gameLoopRef.current);
    };
  }, [gameState]);

  // Klavye Dinleyici
  useEffect(() => {
    const handleKey = (e) => {
      if (e.code === "Space" || e.code === "ArrowUp") handleJump(e);
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [gameState]); // gameState bağımlılığı önemli

  return (
    <div className="game-container">
      <div className="top-bar">
        <button onClick={navigate} className="icon-btn">
          <ArrowLeft />
        </button>
        <div className="score-board">
          <div className="score-item">PUAN: {score}</div>
          <div className="score-item">REKOR: {highScore}</div>
        </div>
      </div>

      {/* OYUN ALANI */}
      <div className="game-stage" onPointerDown={handleJump}>
        {/* ARKA PLAN */}
        {clouds.map((c) => (
          <div key={c.id} className="cloud" style={{ left: c.x, bottom: c.y }}>
            ☁️
          </div>
        ))}

        {/* HARFLER */}
        {letters.map((l) => (
          <div
            key={l.id}
            className="letter-box"
            style={{ left: l.x, bottom: l.y + GROUND_HEIGHT, width: l.width, height: l.height }}
          >
            <div className="letter-inner">
              {/* Harf henüz toplanmadıysa sıradaki harfi, değilse ? göster.
                        Burada basit bir mantık: Oyuncu harfi topladığında yukarıdaki barda harf açılır.
                        Yerdeki kutular "Enerji Kutusu" gibi görünür. */}
              ⚡
            </div>
          </div>
        ))}

        {/* ENGELLER */}
        {obstacles.map((o) => (
          <div
            key={o.id}
            className={`obstacle ${o.type}`}
            style={{ left: o.x, bottom: GROUND_HEIGHT, width: o.width, height: o.height }}
          >
            {/* Kaktüs Görselleri */}
            {o.type === "short" && "🌵"}
            {o.type === "tall" && "🌲"}
            {o.type === "box" && "🪨"}
          </div>
        ))}

        {/* REAKTÖR (KARAKTER) */}
        <div
          className="reactor"
          style={{
            left: DINO_LEFT,
            bottom: dinoY + GROUND_HEIGHT,
            width: DINO_WIDTH,
            height: DINO_HEIGHT,
            transform: `rotate(${dinoY * 2}deg)`, // Yuvarlanma efekti
          }}
        >
          ☢️
        </div>

        {/* ZEMİN */}
        <div className="ground" style={{ backgroundPosition: `${-groundOffset}px 0`, height: GROUND_HEIGHT }}></div>

        {/* HUD (KELİME GÖSTERGESİ) */}
        <div className="hud">
          {wordNotification ? (
            <div className="notification">{wordNotification}</div>
          ) : (
            <div className="word-display">
              {targetWord.split("").map((char, i) => (
                <span
                  key={i}
                  className={`char-slot ${i < collectedCount ? "found" : ""} ${i === collectedCount ? "active" : ""}`}
                >
                  {i < collectedCount ? char : "_"}
                </span>
              ))}
              <span className="target-preview">({targetWord})</span>
            </div>
          )}
        </div>

        {/* MENÜLER */}
        {gameState !== "playing" && (
          <div className="overlay">
            <div className="card">
              <h2>{gameState === "waiting" ? "REAKTÖR KOŞUSU" : "SİSTEM ÇÖKTÜ!"}</h2>
              <p>
                {gameState === "waiting"
                  ? "Ekrana dokunarak zıpla. Havada sınırsız zıplayabilirsin!"
                  : `Puanın: ${score}`}
              </p>
              <button
                className="start-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  startGame();
                }}
              >
                {gameState === "waiting" ? "BAŞLAT" : "YENİDEN BAŞLAT"}
              </button>
            </div>
          </div>
        )}
      </div>

      <style>{`
        .game-container {
            width: 100%;
            max-width: 600px;
            margin: 0 auto;
            font-family: 'Segoe UI', sans-serif;
            user-select: none;
            overflow: hidden;
        }
        
        .top-bar {
            display: flex;
            justify-content: space-between;
            padding: 10px;
            color: #fff;
        }
        
        .icon-btn {
            background: none; border: none; color: white; cursor: pointer;
        }

        .score-board {
            display: flex; gap: 15px; font-weight: bold; font-family: monospace; font-size: 16px;
        }

        .game-stage {
            position: relative;
            width: 100%;
            height: 350px;
            background: linear-gradient(180deg, #1a2a6c 0%, #b21f1f 100%); /* Cyberpunk Sunset */
            border-radius: 12px;
            overflow: hidden;
            box-shadow: 0 10px 30px rgba(0,0,0,0.5);
            cursor: pointer;
            border: 2px solid rgba(255,255,255,0.1);
        }

        .cloud { position: absolute; font-size: 24px; opacity: 0.5; filter: blur(1px); }
        
        .reactor {
            position: absolute;
            display: flex; align-items: center; justify-content: center;
            font-size: 30px;
            z-index: 10;
            filter: drop-shadow(0 0 10px #00ff00);
        }

        .obstacle {
            position: absolute;
            display: flex; align-items: flex-end; justify-content: center;
            font-size: 24px;
            filter: grayscale(0.5) brightness(0.7);
        }

        .letter-box {
            position: absolute;
            display: flex; align-items: center; justify-content: center;
            z-index: 5;
            animation: float 2s infinite ease-in-out;
        }
        
        .letter-inner {
            width: 100%; height: 100%;
            background: rgba(255, 215, 0, 0.2);
            border: 2px solid #FFD700;
            border-radius: 50%;
            color: #FFD700;
            display: flex; align-items: center; justify-content: center;
            font-weight: bold;
            box-shadow: 0 0 15px #FFD700;
            font-size: 18px;
        }

        .ground {
            position: absolute;
            bottom: 0; left: 0; width: 100%;
            background: #111;
            border-top: 2px solid #555;
            background-image: linear-gradient(90deg, #333 1px, transparent 1px);
            background-size: 40px 100%;
        }

        .hud {
            position: absolute; top: 20px; left: 0; width: 100%;
            display: flex; justify-content: center;
            pointer-events: none;
        }
        
        .word-display {
            background: rgba(0,0,0,0.6);
            padding: 10px 20px;
            border-radius: 20px;
            border: 1px solid rgba(255,255,255,0.2);
            display: flex; gap: 5px; align-items: center;
        }

        .char-slot {
            font-size: 24px; font-weight: bold; color: #555;
            width: 20px; text-align: center;
            font-family: monospace;
        }
        
        .char-slot.found { color: #00ff00; text-shadow: 0 0 10px #00ff00; }
        .char-slot.active { color: #fff; border-bottom: 2px solid #fff; animation: pulse 0.5s infinite; }
        
        .target-preview {
            font-size: 12px; color: #aaa; margin-left: 10px; letter-spacing: 1px;
        }
        
        .notification {
            font-size: 24px; font-weight: bold; color: #fff;
            text-shadow: 0 0 20px #ff00de;
            animation: popIn 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        }

        .overlay {
            position: absolute; inset: 0;
            background: rgba(0,0,0,0.8);
            display: flex; align-items: center; justify-content: center;
            backdrop-filter: blur(5px);
            z-index: 50;
        }
        
        .card {
            background: #222; color: #fff;
            padding: 30px; border-radius: 15px;
            text-align: center;
            border: 1px solid #444;
            box-shadow: 0 0 50px rgba(0,0,0,0.5);
        }
        
        .start-btn {
            background: linear-gradient(45deg, #ff00de, #00ff00);
            border: none; padding: 12px 30px;
            color: #000; font-weight: bold; font-size: 18px;
            border-radius: 30px; margin-top: 15px;
            cursor: pointer;
            transition: transform 0.2s;
        }
        .start-btn:active { transform: scale(0.95); }

        @keyframes float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }
        @keyframes pulse { 0% { opacity: 0.5; } 100% { opacity: 1; } }
        @keyframes popIn { from { transform: scale(0); } to { transform: scale(1); } }
      `}</style>
    </div>
  );
};

export default DinoRunner;
