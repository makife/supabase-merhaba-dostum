import React, { useState, useEffect, useCallback, useRef } from "react";
import { ArrowLeft, Trophy } from "lucide-react";
import { useDailyChallenge } from "@/hooks/useDailyChallenge";
import { useSounds } from "@/hooks/useSounds";
import { useExitGameConfirm } from "@/hooks/useExitGameConfirm";
import { toast } from "sonner";

const DinoRunner = () => {
  const navigate = () => {
    if (window.history.length > 1) {
      window.history.back();
    } else {
      window.location.href = "/";
    }
  };

  const { hasPlayedToday, todayScore, leaderboard, loading: challengeLoading, saveScore: saveChallengeScore, markAsPlayed } = useDailyChallenge("reaktor");
  const { playSound: playButtonSound } = useSounds();
  const [showLeaderboard, setShowLeaderboard] = useState(false);

  // --- RENK PALETLERİ ---
  const getRandomGradient = () => {
    const gradients = [
      "linear-gradient(180deg, #1a2a6c 0%, #b21f1f 100%)", // Klasik
      "linear-gradient(180deg, #000428 0%, #004e92 100%)", // Gece
      "linear-gradient(180deg, #16222A 0%, #3A6073 100%)", // Metalik
      "linear-gradient(180deg, #134E5E 0%, #71B280 100%)", // Orman
      "linear-gradient(180deg, #2C3E50 0%, #FD746C 100%)", // Gün Batımı
      "linear-gradient(180deg, #403B4A 0%, #E7E9BB 100%)", // Sisli
      "linear-gradient(180deg, #FF512F 0%, #DD2476 100%)", // Ateş
    ];
    return gradients[Math.floor(Math.random() * gradients.length)];
  };

  // --- OYUN STATE'LERİ ---
  const [gameState, setGameState] = useState("waiting");
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [completedWords, setCompletedWords] = useState<string[]>([]);
  // Level ve Görünüm State'leri
  const [level, setLevel] = useState(1);
  const [bgGradient, setBgGradient] = useState("linear-gradient(180deg, #1a2a6c 0%, #b21f1f 100%)");

  // Fiziksel Render State'leri - TEK BATCH STATE
  const [renderState, setRenderState] = useState({
    dinoY: 0,
    dinoRotation: 0,
    obstacles: [] as any[],
    letters: [] as any[],
    clouds: [] as any[],
    groundOffset: 0,
  });

  // --- KELİME VE FEEDBACK SİSTEMİ ---
  const [wordList, setWordList] = useState<string[]>([]);
  const [targetWord, setTargetWord] = useState("");
  
  // YENİ: Hangi indekslerin toplandığını tutan Set (Sıralı değil, slot bazlı)
  const [collectedIndices, setCollectedIndices] = useState<Set<number>>(new Set());
  
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
  const groundOffsetRef = useRef(0);

  // Kelime Mantığı Ref'leri
  const targetWordRef = useRef("");
  const collectedIndicesRef = useRef<Set<number>>(new Set());
  const wordsClearedRef = useRef(0);
  const completedWordsRef = useRef<string[]>([]);
  const wordBonusRef = useRef(0);
  const spawnIndexRef = useRef(0);

  const nextObstacleTimeRef = useRef(0);
  const lastObstacleKindRef = useRef<"ceiling" | "ground" | null>(null);
  const sameKindStreakRef = useRef(0);
  const nextLetterTimeRef = useRef(0);
  const gameLoopRef = useRef<number>();
  const audioContextRef = useRef<AudioContext | null>(null);
  const lastFrameTimeRef = useRef<number>(0);

  const PRAISE_WORDS = [
    "Mükemmel", "Süper", "Çok iyi!", "Aferin", 
    "Helaaal", "Yürü bee!", "Fevkalade", "İşte Azim", 
    "Maşallah", "Biliyorsun bu işi :)"
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
          t.split("\n")
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
    
    // Set'i sıfırla
    setCollectedIndices(new Set());
    collectedIndicesRef.current = new Set();
    
    setWordNotification(`HEDEF: ${newWord}`);
    setTimeout(() => setWordNotification(""), 2000);

    targetWordRef.current = newWord;
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

  // Refs to read latest values inside callbacks/event listeners
  const hasPlayedTodayRef = useRef(false);
  const challengeLoadingRef = useRef(true);
  useEffect(() => { hasPlayedTodayRef.current = hasPlayedToday; }, [hasPlayedToday]);
  useEffect(() => { challengeLoadingRef.current = challengeLoading; }, [challengeLoading]);

  const startGame = () => {
    // Block if challenge data is still loading or already played today
    if (challengeLoadingRef.current) return;
    if (hasPlayedTodayRef.current) return;
    // Mark immediately (also flips local state synchronously)
    hasPlayedTodayRef.current = true;
    markAsPlayed();

    setGameState("playing");
    gameStateRef.current = "playing";

    dinoYRef.current = 0;
    dinoRotationRef.current = 0;
    velocityRef.current = 0;
    speedRef.current = 2;
    scoreRef.current = 0;
    lastFrameTimeRef.current = 0;
    setScore(0);
    
    // Level Sıfırlama
    setLevel(1);
    wordsClearedRef.current = 0;
    setBgGradient("linear-gradient(180deg, #1a2a6c 0%, #b21f1f 100%)");

    completedWordsRef.current = [];
    setCompletedWords([]);
    wordBonusRef.current = 0;
    obstaclesRef.current = [];
    lastObstacleKindRef.current = null;
    sameKindStreakRef.current = 0;
    lettersRef.current = [];
    cloudsRef.current = [];
    setRenderState({ dinoY: 0, dinoRotation: 0, obstacles: [], letters: [], clouds: [], groundOffset: 0 });
    setFeedback(null);

    nextObstacleTimeRef.current = Date.now() + 1000;

    pickNewWord();
    playSound(440, "triangle");
  };

  const handleJump = (e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (gameStateRef.current !== "playing") {
      // Do NOT auto-start if user already played today or data is still loading.
      // Otherwise pressing JUMP after game-over would re-launch the game.
      if (challengeLoadingRef.current || hasPlayedTodayRef.current) return;
      startGame();
      return;
    }
    velocityRef.current = JUMP_FORCE;
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
  const gameLoop = (timestamp?: number) => {
    if (gameStateRef.current !== "playing") return;

    // Delta-time hesaplama (iOS WebView ilk frame'lerde düşük FPS verir, bu normalize eder)
    const now = timestamp || performance.now();
    if (lastFrameTimeRef.current === 0) lastFrameTimeRef.current = now;
    const rawDelta = now - lastFrameTimeRef.current;
    lastFrameTimeRef.current = now;
    // 60fps = 16.67ms referans, max 3 frame atlama (50ms) ile sınırla
    const dt = Math.min(rawDelta, 50) / 16.667;

    // Fizik (delta-time normalized)
    velocityRef.current -= GRAVITY * dt;
    dinoYRef.current += velocityRef.current * dt;
    if (dinoYRef.current <= 0) {
      dinoYRef.current = 0;
      velocityRef.current = 0;
    }
    if (dinoYRef.current > GAME_HEIGHT - DINO_HEIGHT) {
      dinoYRef.current = GAME_HEIGHT - DINO_HEIGHT;
      velocityRef.current = -2;
    }

    dinoRotationRef.current += speedRef.current * 4 * dt;
    speedRef.current += 0.001 * dt;

    groundOffsetRef.current = (groundOffsetRef.current + speedRef.current * dt) % 40;

    const dinoRect = {
      x: DINO_LEFT + 5,
      y: dinoYRef.current + 5,
      width: DINO_WIDTH - 10,
      height: DINO_HEIGHT - 10,
    };

    // Engeller (in-place update, düşük GC, delta-time normalized)
    for (let i = obstaclesRef.current.length - 1; i >= 0; i--) {
      obstaclesRef.current[i].x -= speedRef.current * dt;
      if (obstaclesRef.current[i].x <= -OBSTACLE_WIDTH) obstaclesRef.current.splice(i, 1);
    }

    if (Date.now() > nextObstacleTimeRef.current) {
      // Karışık dağılım: temel oran %45 tavan / %55 zemin,
      // aynı tip 2 kez üst üste geldiyse 3.'sünde tipi zorla değiştir,
      // 1 kez üst üste geldiyse karşı tipe doğru ağırlık ver.
      const last = lastObstacleKindRef.current;
      const streak = sameKindStreakRef.current;
      let isCeiling: boolean;
      if (last && streak >= 2) {
        // 2 aynı tip arka arkaya geldi → kesin değiştir
        isCeiling = last !== "ceiling";
      } else if (last && streak === 1) {
        // 1 aynı tip → karşıya %75 ağırlık
        isCeiling = last === "ceiling" ? Math.random() < 0.25 : Math.random() < 0.75;
      } else {
        isCeiling = Math.random() < 0.45;
      }
      const kind: "ceiling" | "ground" = isCeiling ? "ceiling" : "ground";
      sameKindStreakRef.current = last === kind ? streak + 1 : 1;
      lastObstacleKindRef.current = kind;
      if (isCeiling) {
        const height = 30 + Math.floor(Math.random() * 91); // 30-120
        obstaclesRef.current.push({
          id: Math.random(),
          x: GAME_WIDTH,
          y: GAME_HEIGHT - GROUND_HEIGHT - height, // tavandan sarkar
          width: OBSTACLE_WIDTH,
          height,
          type: "ceiling",
        });
      } else {
        const height = 30 + Math.floor(Math.random() * 91); // 30-120
        const type = height <= 50 ? "short" : height >= 90 ? "tall" : "box";
        obstaclesRef.current.push({
          id: Math.random(),
          x: GAME_WIDTH,
          y: 0,
          width: OBSTACLE_WIDTH,
          height,
          type: type,
        });
      }
      nextObstacleTimeRef.current = Date.now() + 1000 + Math.random() * 1500;
    }

    for (let obs of obstaclesRef.current) {
      const obsRect = { x: obs.x + 5, y: obs.y, width: obs.width - 10, height: obs.height - 5 };
      if (checkCollision(dinoRect, obsRect)) {
        setGameState("gameOver");
        gameStateRef.current = "gameOver";
        playSound(150, "sawtooth", 0.5);
        const letterScore = Math.floor(scoreRef.current);
        const wordBonus = wordBonusRef.current;
        const finalScore = letterScore + wordBonus;
        setScore(finalScore);
        if (finalScore > highScore) setHighScore(finalScore);
        // Save to daily challenge
        saveChallengeScore(finalScore, completedWordsRef.current.length).then((saved) => {
          if (saved) {
            toast.success(`🎯 Challenge puanın kaydedildi: ${finalScore}`);
          }
        });
        return;
      }
    }
    // obstacles updated via ref, will batch render below

    // Harfler (in-place update, düşük GC)
    for (let i = lettersRef.current.length - 1; i >= 0; i--) {
      lettersRef.current[i].x -= speedRef.current * dt;
      if (lettersRef.current[i].x <= -LETTER_SIZE) lettersRef.current.splice(i, 1);
    }

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

    // Harf Toplama (Set Mantığı)
    lettersRef.current.forEach((letter) => {
      if (letter.collected) return;
      const hitBox = { x: letter.x - 15, y: letter.y - 15, width: letter.width + 30, height: letter.height + 30 };
      
      if (checkCollision(dinoRect, hitBox)) {
        letter.collected = true;
        playSound(1000, "square", 0.1);
        
        // Her toplanan harf = 10 puan
        scoreRef.current += 10;

        // Yeni: Set güncelleme
        const newSet = new Set(collectedIndicesRef.current);
        newSet.add(letter.indexInWord);
        collectedIndicesRef.current = newSet;
        setCollectedIndices(new Set(newSet));
      }
    });

    const activeLetters = lettersRef.current.filter((l) => !l.collected);
    // letters updated via ref, will batch render below

    // Kelime Bitiş Kontrolü
    if (currentWord && spawnIndexRef.current >= currentWord.length && activeLetters.length === 0) {
      
      const isWordComplete = collectedIndicesRef.current.size === currentWord.length;

      if (isWordComplete) {
        // Track completed word for bonus scoring
        completedWordsRef.current.push(currentWord);
        wordBonusRef.current += currentWord.length * 10;
        setCompletedWords([...completedWordsRef.current]);
        showFeedback(true);
        
        // Level Mantığı
        wordsClearedRef.current += 1;
        
        if (wordsClearedRef.current >= 3) {
           setLevel(prev => prev + 1);
           wordsClearedRef.current = 0; // Sıfırla
           
           // Yeni Gradient ve Ses
           setBgGradient(getRandomGradient());
           playSound(600, "sine", 0.5); 
           setWordNotification(`SEVİYE ${level + 1}!`);
        }

      } else {
        showFeedback(false);
      }
      pickNewWord();
    }

    // Bulutlar kaldırıldı - gereksiz DOM + paint yükü

    // --- HER FRAME RENDER (60FPS) ---
    setRenderState({
      dinoY: dinoYRef.current,
      dinoRotation: dinoRotationRef.current,
      obstacles: obstaclesRef.current,
      letters: activeLetters,
      clouds: [],
      groundOffset: groundOffsetRef.current,
    });

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

  const liveScore = Math.floor(scoreRef.current) + wordBonusRef.current;
  const shownScore = gameState === "gameOver" ? score : liveScore;

  return (
    <div className="page-wrapper">
      <div className="game-container">
        {/* ÜST BAR */}
        <div className="top-bar">
          <button onClick={() => { playButtonSound("buttonClick"); navigate(); }} className="icon-btn">
            <ArrowLeft size={24} />
            <span className="btn-text">GERİ</span>
          </button>

          <div className="score-board">
            <div className="score-item">
              <span className="label">SEVİYE</span>
              <span className="value">{level}</span>
            </div>
            <div className="score-item">
              <span className="label">PUAN</span>
              <span className="value">{shownScore}</span>
            </div>
            <div className="score-item">
              <span className="label">REKOR</span>
              <span className="value">{highScore}</span>
            </div>
          </div>

          <button onClick={() => { playButtonSound("buttonClick"); setShowLeaderboard(true); }} className="icon-btn" title="Sıralamalar">
            <Trophy size={24} />
          </button>
        </div>

        {/* OYUN ALANI */}
        <div 
          className="game-stage" 
          onPointerDown={handleJump}
          style={{ background: bgGradient }} // Inline style ile dinamik renk
        >
          {feedback && <div className={`feedback-popup ${feedback.type}`}>{feedback.text}</div>}

          {renderState.letters.map((l) => (
            <div
              key={l.id}
              className="letter-box"
              style={{
                width: l.width,
                height: l.height,
                transform: `translate3d(${l.x}px, ${-(l.y + GROUND_HEIGHT)}px, 0)`,
              }}
            >
              <div className="letter-inner">{l.char}</div>
            </div>
          ))}

          {renderState.obstacles.map((o) => (
            <div
              key={o.id}
              className={`obstacle obs-${o.type}`}
              style={{
                width: o.width,
                height: o.height,
                transform: `translate3d(${o.x}px, ${-(o.y + GROUND_HEIGHT)}px, 0)`,
              }}
            />
          ))}

          <div
            className="reactor"
            style={{
              width: DINO_WIDTH,
              height: DINO_HEIGHT,
              transform: `translate3d(${DINO_LEFT}px, ${-(renderState.dinoY + GROUND_HEIGHT)}px, 0) rotate(${renderState.dinoRotation}deg)`,
            }}
          >
            ☢️
          </div>

          <div className="ground" />

          <div className="hud">
            {wordNotification ? (
              <div className="notification">{wordNotification}</div>
            ) : (
              <div className="word-display">
                {targetWord.split("").map((char, i) => {
                  // YENİ: Set.has ile kontrol
                  const isFound = collectedIndices.has(i);
                  return (
                    <span key={i} className={`char-slot ${isFound ? "found" : ""}`}>
                      {char}
                    </span>
                  );
                })}
              </div>
            )}
          </div>

          {gameState !== "playing" && (
            <div className="overlay">
              <div className="card">
                <h2>{gameState === "waiting" ? "REAKTÖR KOŞUSU" : "SİSTEM ÇÖKTÜ!"}</h2>
                {gameState === "gameOver" ? (
                  <div>
                    <p>Mesafe Puanı: {Math.floor(scoreRef.current / 5)}</p>
                    {completedWords.length > 0 && (
                      <p>Kelime Bonusu: +{wordBonusRef.current}</p>
                    )}
                    <p style={{fontSize: '20px', fontWeight: 'bold', color: '#FFD700', marginTop: '8px'}}>Toplam: {score}</p>
                    {todayScore !== null && (
                      <p style={{fontSize: '12px', color: '#aaa', marginTop: '4px'}}>Bugünkü en iyi: {todayScore}</p>
                    )}
                  </div>
                ) : hasPlayedToday ? (
                  <div>
                    <p style={{color: '#aaa', marginBottom: '8px'}}>Bugünkü challenge tamamlandı! ✅</p>
                    <p style={{fontSize: '20px', fontWeight: 'bold', color: '#FFD700'}}>Puanın: {todayScore}</p>
                    <p style={{fontSize: '12px', color: '#888', marginTop: '8px'}}>Yarın tekrar dene 🎯</p>
                    <div style={{marginTop: '10px', background: 'rgba(255,165,0,0.15)', border: '1px solid rgba(255,165,0,0.3)', borderRadius: '8px', padding: '8px 12px'}}>
                      <p style={{fontSize: '12px', color: '#FFD700', fontWeight: 'bold'}}>🏆 1. Lik Ödülü</p>
                      <p style={{fontSize: '14px', color: '#fff', marginTop: '4px'}}>📄 3 Oyun Sayfası</p>
                    </div>
                  </div>
                ) : (
                  <div>
                    <p>Harfleri topla, engellerden kaç!</p>
                    <div style={{marginTop: '10px', background: 'rgba(255,165,0,0.15)', border: '1px solid rgba(255,165,0,0.3)', borderRadius: '8px', padding: '8px 12px'}}>
                      <p style={{fontSize: '12px', color: '#FFD700', fontWeight: 'bold'}}>🏆 1. Lik Ödülü</p>
                      <p style={{fontSize: '14px', color: '#fff', marginTop: '4px'}}>📄 3 Oyun Sayfası</p>
                    </div>
                  </div>
                )}
                {!hasPlayedToday && (
                  <button
                    className="start-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      playButtonSound("buttonClick");
                      startGame();
                    }}
                  >
                    {gameState === "waiting" ? "BAŞLAT" : "TEKRAR DENE"}
                  </button>
                )}
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

      {/* LEADERBOARD MODAL */}
      {showLeaderboard && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.85)',zIndex:100,display:'flex',alignItems:'center',justifyContent:'center',padding:'20px'}} onClick={() => setShowLeaderboard(false)}>
          <div style={{background:'#1a1a2e',borderRadius:'20px',padding:'24px',maxWidth:'400px',width:'100%',maxHeight:'80vh',overflow:'auto',border:'1px solid rgba(255,255,255,0.1)'}} onClick={e => e.stopPropagation()}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'16px'}}>
              <h3 style={{color:'white',fontSize:'18px',fontWeight:'bold'}}>🏆 Günlük Sıralama</h3>
              <button onClick={() => { playButtonSound("buttonClick"); setShowLeaderboard(false); }} style={{background:'rgba(255,255,255,0.1)',border:'none',color:'white',borderRadius:'8px',padding:'6px 12px',cursor:'pointer'}}>✕</button>
            </div>
            {leaderboard.length === 0 ? (
              <p style={{color:'#888',textAlign:'center',padding:'20px'}}>Henüz kimse oynamamış</p>
            ) : (
              leaderboard.map((entry, i) => (
                <div key={entry.id} style={{display:'flex',alignItems:'center',gap:'12px',padding:'10px',borderRadius:'12px',background: i === 0 ? 'rgba(255,215,0,0.1)' : 'rgba(255,255,255,0.05)',marginBottom:'8px',border: i === 0 ? '1px solid rgba(255,215,0,0.3)' : '1px solid transparent'}}>
                  <span style={{width:'24px',textAlign:'center',fontWeight:'bold',color: i === 0 ? '#FFD700' : i === 1 ? '#C0C0C0' : i === 2 ? '#CD7F32' : '#888',fontSize:'14px'}}>{i + 1}</span>
                  <div style={{width:'32px',height:'32px',borderRadius:'50%',background:'rgba(255,255,255,0.1)',display:'flex',alignItems:'center',justifyContent:'center',overflow:'hidden'}}>
                    {entry.avatar_url ? <img src={entry.avatar_url} style={{width:'100%',height:'100%',objectFit:'cover'}} /> : <span style={{fontSize:'14px'}}>👤</span>}
                  </div>
                  <div style={{flex:1}}>
                    <span style={{color:'white',fontSize:'13px',fontWeight:'600'}}>{entry.username}</span>
                  </div>
                  <span style={{color:'#FFD700',fontWeight:'bold',fontSize:'14px'}}>{entry.score}</span>
                </div>
              ))
            )}
          </div>
        </div>
      )}

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
            width: 100%;
            max-width: 600px;
            font-family: 'Segoe UI', sans-serif; user-select: none;
            position: relative;
            box-shadow: 0 10px 30px rgba(0,0,0,0.5);
            border-radius: 12px;
            overflow: hidden;
        }
        
        .top-bar {
            display: flex;
            justify-content: space-between; align-items: center;
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
            position: relative;
            width: 100%; height: 350px;
            /* background burada inline olarak veriliyor, css default kalabilir */
            transition: background 1s ease; /* Renk geçişi yumuşak olsun */
            overflow: hidden; cursor: pointer;
            border: 2px solid rgba(255,255,255,0.1);
            border-top: none;
            border-bottom: none;
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

        .reactor {
            position: absolute;
            left: 0;
            bottom: 0;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 30px;
            z-index: 10;
            color: #00ff00;
        }
        .obstacle {
            position: absolute;
            left: 0;
            bottom: 0;
            border-radius: 4px;
        }
        .obs-short {
            background: #4a7c3f;
        }
        .obs-tall {
            background: #2d5a27;
        }
        .obs-box {
            background: #666;
            border-radius: 6px;
        }
        .obs-ceiling {
            background: linear-gradient(180deg, #ff4444 0%, #8b0000 100%);
            border-radius: 0 0 6px 6px;
            box-shadow: 0 2px 8px rgba(255, 68, 68, 0.5);
        }

        .letter-box {
            position: absolute;
            left: 0;
            bottom: 0;
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 5;
        }
        .letter-inner {
            width: 32px;
            height: 32px;
            background: #FFD700;
            border-radius: 50%;
            color: #222;
            display: flex; align-items: center;
            justify-content: center;
            font-weight: 900;
            font-size: 18px; font-family: 'Arial Black', sans-serif;
        }

        .ground {
            position: absolute;
            bottom: 0; left: 0; width: 100%;
            height: 30px;
            background: #222;
            border-top: 2px solid #555;
        }

        .hud {
            position: absolute;
            top: 15px; left: 0; width: 100%;
            display: flex; justify-content: center; pointer-events: none;
            padding: 0 10px; box-sizing: border-box;
        }
        
        .word-display {
            background: rgba(0,0,0,0.7);
            padding: 8px 12px;
            border-radius: 30px; border: 1px solid rgba(255,255,255,0.3);
            display: flex; flex-wrap: wrap; justify-content: center; gap: 4px;
            align-items: center;
            box-shadow: 0 4px 15px rgba(0,0,0,0.4);
            max-width: 100%;
        }

        .char-slot {
            font-size: 20px;
            font-weight: bold; color: #666;
            min-width: 15px; text-align: center; font-family: monospace;
            border-bottom: 2px solid #444;
        }
        
        @media (max-width: 400px) {
            .char-slot { font-size: 16px; border-bottom-width: 1px; }
            .word-display { gap: 2px; padding: 6px 10px; }
        }

        .char-slot.found { color: #00ff00; border-color: #00ff00; text-shadow: 0 0 10px #00ff00; transform: scale(1.1); transition: all 0.2s; }
        
        .notification {
            font-size: 28px;
            font-weight: bold; color: #fff;
            text-shadow: 0 0 20px #ff00de; animation: popIn 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
            text-align: center;
        }

        .feedback-popup {
            position: absolute;
            top: 40%; left: 50%; transform: translate(-50%, -50%);
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
            position: absolute;
            inset: 0; background: rgba(0,0,0,0.8);
            display: flex; align-items: center; justify-content: center; z-index: 50; backdrop-filter: blur(5px);
        }
        .card {
            background: #222;
            color: #fff; padding: 30px; border-radius: 20px;
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
