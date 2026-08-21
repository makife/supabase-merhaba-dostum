import { homeBackPath } from "@/utils/challengeBackPath";
import React, { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";

import { playChallengeWinSound } from "@/utils/challengeWinSound";
import { ArrowLeft, Trophy } from "lucide-react";
import Lottie from "lottie-react";
import { useDailyChallenge } from "@/hooks/useDailyChallenge";
import { useGameMute } from "@/hooks/useGameMute";
import { GameMuteButton } from "@/components/GameMuteButton";
import { useExitGameConfirm } from "@/hooks/useExitGameConfirm";
import { toast } from "sonner";
import { playDinoJump, playJumpBeep, playGenericTone } from "@/utils/genericBeep";
import { Capacitor } from "@capacitor/core";
const IS_IOS_NATIVE = Capacitor.isNativePlatform() && Capacitor.getPlatform() === "ios";


const DINO_RUNNER_ASSET_VERSION = "20260625-portal-center-entry-fix";

// --- Karakter sprite tanımları ---
type CharacterId = "adventure" | "dinosour" | "jack" | "robot";
const CHARACTERS: Record<CharacterId, { folder: string; runFrames: number; jumpFrames: number; label: string; previewSrc: string }> = {
  adventure: { folder: "adventureSprite", runFrames: 8, jumpFrames: 10, label: "Kaşif", previewSrc: "/DinoRunners/previews/adventure.webp" },
  dinosour:  { folder: "dinosourSprite",  runFrames: 8, jumpFrames: 12, label: "Dinozor", previewSrc: "/DinoRunners/previews/dinosour.webp" },
  jack:      { folder: "jackSprite",      runFrames: 8, jumpFrames: 10, label: "Jack", previewSrc: "/DinoRunners/previews/jack.webp" },
  robot:     { folder: "robotSprite",     runFrames: 8, jumpFrames: 10, label: "Robot", previewSrc: "/DinoRunners/previews/robot.webp" },
};

const DinoCharacterSprite: React.FC<{ character: CharacterId; isJumping: boolean; size: number }> = ({ character, isJumping, size }) => {
  const cfg = CHARACTERS[character];
  const [frame, setFrame] = useState(1);
  const frameRef = useRef(1);
  const modeRef = useRef<boolean>(isJumping);

  // Mod değişimini takip et — frame sıfırlansın
  useEffect(() => {
    if (modeRef.current !== isJumping) {
      modeRef.current = isJumping;
      frameRef.current = 1;
      setFrame(1);
    }
  }, [isJumping]);

  // Frame döngüsü
  useEffect(() => {
    const id = setInterval(() => {
      const total = modeRef.current ? cfg.jumpFrames : cfg.runFrames;
      frameRef.current = frameRef.current >= total ? 1 : frameRef.current + 1;
      setFrame(frameRef.current);
    }, 70);
    return () => clearInterval(id);
  }, [character, cfg.jumpFrames, cfg.runFrames]);

  // Tüm frameleri baştan mount et; sadece görünürlüğü değiştir → flicker/yeniden yükleme yok
  const runFrames = Array.from({ length: cfg.runFrames }, (_, i) => i + 1);
  const jumpFrames = Array.from({ length: cfg.jumpFrames }, (_, i) => i + 1);

  return (
    <div style={{ position: "relative", width: size, height: size, pointerEvents: "none" }}>
      {runFrames.map((n) => (
        <img
          key={`r${n}`}
          src={`/DinoRunners/${cfg.folder}/Run (${n}).webp`}
          alt=""
          draggable={false}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "contain",
            userSelect: "none",
            visibility: !isJumping && frame === n ? "visible" : "hidden",
          }}
        />
      ))}
      {jumpFrames.map((n) => (
        <img
          key={`j${n}`}
          src={`/DinoRunners/${cfg.folder}/Jump (${n}).webp`}
          alt=""
          draggable={false}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "contain",
            userSelect: "none",
            visibility: isJumping && frame === n ? "visible" : "hidden",
          }}
        />
      ))}
    </div>
  );
};

// --- Parallax arka plan katmanları (her level için, uzak → yakın sırada) ---
type LevelBg = "level1" | "level2" | "level3" | "level4" | "level5" | "level6" | "level7" | "level8";

// 5 katmanlı (1..5.webp) yeni pack'ler için ortak parallax hızları.
// 1 = en uzak (gökyüzü), 5 = en yakın (zemin) varsayımı.
const FIVE_LAYER_SPEEDS = [0.03, 0.15, 0.35, 0.6, 1.0];
const buildFiveLayerConfig = (folder: string) =>
  FIVE_LAYER_SPEEDS.map((speed, i) => ({
    src: `/DinoRunners/${folder}/${i + 1}.webp`,
    speed,
  }));

const PARALLAX_CONFIGS: Record<LevelBg, { src: string; speed: number }[]> = {
  level1: [
    { src: "/DinoRunners/DinoRunnerArkaPlan11/layer07_Sky.webp", speed: 0.03 },
    { src: "/DinoRunners/DinoRunnerArkaPlan11/layer06_Rocks.webp", speed: 0.08 },
    { src: "/DinoRunners/DinoRunnerArkaPlan11/layer05_Hills.webp", speed: 0.18 },
    { src: "/DinoRunners/DinoRunnerArkaPlan11/layer04_Clouds.webp", speed: 0.12 },
    { src: "/DinoRunners/DinoRunnerArkaPlan11/layer03_Hills_Castle.webp", speed: 0.3 },
    { src: "/DinoRunners/DinoRunnerArkaPlan11/layer02_Trees_rocks.webp", speed: 0.55 },
    { src: "/DinoRunners/DinoRunnerArkaPlan11/layer01_Ground.webp", speed: 1.0 },
  ],
  level2: [
    { src: "/DinoRunners/DinoRunnerArkaPlan22/layer07_Sky.webp", speed: 0.03 },
    { src: "/DinoRunners/DinoRunnerArkaPlan22/layer06_Rocks.webp", speed: 0.08 },
    { src: "/DinoRunners/DinoRunnerArkaPlan22/layer05_Clouds.webp", speed: 0.12 },
    { src: "/DinoRunners/DinoRunnerArkaPlan22/layer04_Hills_2.webp", speed: 0.22 },
    { src: "/DinoRunners/DinoRunnerArkaPlan22/layer03_Hills_1.webp", speed: 0.38 },
    { src: "/DinoRunners/DinoRunnerArkaPlan22/layer02_Trees.webp", speed: 0.6 },
    { src: "/DinoRunners/DinoRunnerArkaPlan22/layer01_Ground.webp", speed: 1.0 },
  ],
  level3: [
    { src: "/DinoRunners/DinoRunnerArkaPlan33/layer09_Sky.webp", speed: 0.0 },
    { src: "/DinoRunners/DinoRunnerArkaPlan33/layer08_Stars_1.webp", speed: 0.04 },
    { src: "/DinoRunners/DinoRunnerArkaPlan33/layer07_Stars_2.webp", speed: 0.07 },
    { src: "/DinoRunners/DinoRunnerArkaPlan33/layer06_Stars_3.webp", speed: 0.11 },
    { src: "/DinoRunners/DinoRunnerArkaPlan33/layer05_Castle.webp", speed: 0.25 },
    { src: "/DinoRunners/DinoRunnerArkaPlan33/layer03_Clouds_3.webp", speed: 0.35 },
    { src: "/DinoRunners/DinoRunnerArkaPlan33/layer02_Clouds_2.webp", speed: 0.5 },
    { src: "/DinoRunners/DinoRunnerArkaPlan33/layer01_Clouds_1.webp", speed: 0.7 },
    { src: "/DinoRunners/DinoRunnerArkaPlan33/layer04_Path.webp", speed: 1.0 },
  ],
  level4: [
    { src: "/DinoRunners/DinoRunnerArkaPlan44/layer06_sky.webp", speed: 0.03 },
    { src: "/DinoRunners/DinoRunnerArkaPlan44/layer05_rocks.webp", speed: 0.12 },
    { src: "/DinoRunners/DinoRunnerArkaPlan44/layer04_clouds.webp", speed: 0.18 },
    { src: "/DinoRunners/DinoRunnerArkaPlan44/layer03_trees.webp", speed: 0.42 },
    { src: "/DinoRunners/DinoRunnerArkaPlan44/layer02_cake.webp", speed: 0.65 },
    { src: "/DinoRunners/DinoRunnerArkaPlan44/layer01_ground.webp", speed: 1.0 },
  ],
  level5: buildFiveLayerConfig("DinoRunnerArkaPlan55"),
  level6: buildFiveLayerConfig("DinoRunnerArkaPlan66"),
  level7: buildFiveLayerConfig("DinoRunnerArkaPlan77"),
  level8: buildFiveLayerConfig("DinoRunnerArkaPlan88"),
};


const ParallaxBackground: React.FC<{
  bg: LevelBg;
  speedRef: React.MutableRefObject<number>;
  multRef: React.MutableRefObject<number>;
}> = ({ bg, speedRef, multRef }) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const layersRef = useRef<(HTMLDivElement | null)[]>([]);
  const offsetsRef = useRef<number[]>([]);
  const tileWidthsRef = useRef<number[]>([]); // her katmanın gerçek render genişliği
  const naturalSizeRef = useRef<{ w: number; h: number }[]>([]);
  const config = PARALLAX_CONFIGS[bg];

  // Görüntülerin doğal boyutlarını yükle
  useEffect(() => {
    naturalSizeRef.current = config.map(() => ({ w: 0, h: 0 }));
    tileWidthsRef.current = config.map(() => 0);
    offsetsRef.current = config.map(() => 0);

    config.forEach((layer, i) => {
      const img = new Image();
      img.onload = () => {
        naturalSizeRef.current[i] = { w: img.naturalWidth, h: img.naturalHeight };
        recomputeTileWidths();
      };
      img.src = layer.src;
    });

    const recomputeTileWidths = () => {
      const h = containerRef.current?.clientHeight || window.innerHeight;
      for (let i = 0; i < config.length; i++) {
        const nat = naturalSizeRef.current[i];
        if (nat.h > 0) {
          // backgroundSize: auto 100% => render width = naturalW * (containerH / naturalH)
          tileWidthsRef.current[i] = (nat.w * h) / nat.h;
        }
      }
    };

    const onResize = () => recomputeTileWidths();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [bg, config]);

  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min((now - last) / 16.6667, 3);
      last = now;
      const baseSpeed = speedRef.current * multRef.current;
      for (let i = 0; i < config.length; i++) {
        const tileW = tileWidthsRef.current[i];
        let next = offsetsRef.current[i] + baseSpeed * config[i].speed * dt;
        // Tile genişliğine göre sarmala — kopukluk olmaz
        if (tileW > 0) {
          // negatif kalmasına gerek yok; sadece % al
          next = next % tileW;
          if (next < 0) next += tileW;
        }
        offsetsRef.current[i] = next;
        const el = layersRef.current[i];
        if (el) {
          // tam piksele yuvarla (sub-pixel titremesini engeller)
          el.style.backgroundPositionX = `${-Math.round(next)}px`;
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [bg, config, speedRef, multRef]);

  return (
    <div ref={containerRef} style={{ position: "absolute", inset: 0, zIndex: 0, pointerEvents: "none", overflow: "hidden", background: "#000" }}>
      {config.map((layer, i) => (
        <div
          key={layer.src}
          ref={(el) => { layersRef.current[i] = el; }}
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage: `url(${layer.src})`,
            backgroundRepeat: "repeat-x",
            backgroundPosition: "0 bottom",
            backgroundSize: "auto 100%",
            willChange: "background-position",
          }}
        />
      ))}
    </div>
  );
};


const DinoRunner = () => {
  const routerNavigate = useNavigate();
  const { requestExit, ExitConfirmDialog } = useExitGameConfirm();
  const doNavigate = () => {
    routerNavigate(homeBackPath(), { replace: true });
  };

  // navigate, gameState tanımından sonra aşağıda tanımlanıyor.

  const { hasPlayedToday, todayScore, leaderboard, loading: challengeLoading, saveScore: saveChallengeScore, markAsPlayed } = useDailyChallenge("reaktor");
  const { muted: gameMuted, playSound: playButtonSound } = useGameMute("reaktor");
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [reaktorAnim, setReaktorAnim] = useState<any>(null);
  const [arkaPlanAnim, setArkaPlanAnim] = useState<any>(null);
  const [arkaPlanAnim2, setArkaPlanAnim2] = useState<any>(null);
  const [arkaPlanAnim3, setArkaPlanAnim3] = useState<any>(null);
  const [arkaPlanAnim4, setArkaPlanAnim4] = useState<any>(null);
  const [arkaPlanAnim5, setArkaPlanAnim5] = useState<any>(null);
  const [portalAnim, setPortalAnim] = useState<any>(null);
  const [activeBg, setActiveBg] = useState<LevelBg>("level1");
  const [showLevelUpText, setShowLevelUpText] = useState(false);
  const [levelUpMessage, setLevelUpMessage] = useState("");
  const arkaPlanLottieRef = useRef<any>(null);
  const bgSpeedMultRef = useRef(1); // Parallax bg için ekstra çarpan (portal eşiğinde 0'a iner)
  const portalGecisAudioRef = useRef<HTMLAudioElement | null>(null);
  const playPortalGecisSound = () => {
    try {
      if (!portalGecisAudioRef.current) {
        portalGecisAudioRef.current = new Audio(`/DinoRunnerPortalGecis.mp3?v=${DINO_RUNNER_ASSET_VERSION}`);
        portalGecisAudioRef.current.volume = 0.7;
      }
      const a = portalGecisAudioRef.current;
      a.currentTime = 0;
      a.play().catch(() => {});
    } catch {}
  };

  // Her bg lottie'sinin temel hız çarpanı. ArkaPlan2 JSON içinde yavaşlatıldı,
  // bu yüzden diğer arka planlarla aynı çarpanı kullanıyor.
  const BG_BASE_SPEED: Record<LevelBg, number> = {
    level1: 1,
    level2: 1,
    level3: 1,
    level4: 1,
    level5: 1,
    level6: 1,
    level7: 1,
    level8: 1,
  };

  const computeBgSpeed = (bg: LevelBg, lvl: number) =>
    Math.min((BG_BASE_SPEED[bg] ?? 1) * (1 + (lvl - 1) * 0.2), 4);

  useEffect(() => {
    fetch(`/reaktorKosma.json?v=${DINO_RUNNER_ASSET_VERSION}`).then(r => r.json()).then(setReaktorAnim).catch(() => {});
    fetch(`/DinoRunnerArkaPlanPortal.json?v=${DINO_RUNNER_ASSET_VERSION}`).then(r => r.json()).then(setPortalAnim).catch(() => {});
    (Object.keys(CHARACTERS) as CharacterId[]).forEach((id) => {
      const img = new Image();
      img.src = CHARACTERS[id].previewSrc;
    });
  }, []);

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
  const navigate = () => requestExit(doNavigate, gameState !== "playing");
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [selectedCharacter, setSelectedCharacter] = useState<CharacterId | null>(null);
  const [showCharacterPicker, setShowCharacterPicker] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [completedWords, setCompletedWords] = useState<string[]>([]);
  // Level ve Görünüm State'leri
  const [level, setLevel] = useState(1);
  const [bgGradient, setBgGradient] = useState("linear-gradient(180deg, #1a2a6c 0%, #b21f1f 100%)");

  // Fiziksel Render State'leri - TEK BATCH STATE
  const [renderState, setRenderState] = useState({
    dinoX: 50,
    dinoY: 0,
    dinoRotation: 0,
    dinoOpacity: 1,
    obstacles: [] as any[],
    letters: [] as any[],
    clouds: [] as any[],
    groundOffset: 0,
    portal: null as null | { x: number },
    entryPortal: null as null | { x: number },
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
  const dinoXRef = useRef(50);
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
  const lastFrameTimeRef = useRef<number>(0);

  // Portal Ref'leri: her 500 puanda sağ portal, sonraki level başlangıcında sol portal
  const levelRef = useRef(1);
  const portalTriggeredRef = useRef(false); // Portal spawn gecikmesi sırasında tekrar kurulum olmasın
  const nextPortalScoreRef = useRef(750);
  const portalRef = useRef<{ x: number; targetLevel: number } | null>(null);
  const entryPortalRef = useRef<{ x: number } | null>(null);
  const entryAnimationRef = useRef<{ startTime: number; fromX: number; toX: number; fromY: number; toY: number; duration: number } | null>(null);
  const exitFadeRef = useRef(0); // 0 → 1, reaktör çıkış portalından geçerken artar
  const pendingLevelRef = useRef(2);
  const levelUpTimeoutRef = useRef<any>(null);
  const PORTAL_WIDTH = 300;
  const PORTAL_VERTICAL_OVERSCAN = 24;
  const PORTAL_DOOR_CENTER_RATIO = 0.63;
  const ENTRY_PORTAL_X = -PORTAL_WIDTH * PORTAL_DOOR_CENTER_RATIO;
  const ENTRY_DINO_START_X = 4;
  // Üst leveldeki giriş portalı dikeyde yukarı kaydırılır;
  // reaktör portalın merkezinden görünmez başlayıp yere doğru fade-in ile düşer.
  const ENTRY_PORTAL_Y_OFFSET = 180;

  const PRAISE_WORDS = [
    "🫵", "Süper", "Çok iyi!", "👏", 
    "👌", "Güzel", "👍", "💯", 
    "İyi", "🤙"
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

  const getBgForLevel = (lvl: number): LevelBg => {
    if (lvl <= 1) return "level1";
    if (lvl === 2) return "level2";
    if (lvl === 3) return "level3";
    if (lvl === 4) return "level4";
    if (lvl === 5) return "level5";
    if (lvl === 6) return "level6";
    if (lvl === 7) return "level7";
    return "level8";
  };


  const restoreBackgroundSpeed = (targetLevel = levelRef.current) => {
    const bg = getBgForLevel(targetLevel);
    if (arkaPlanLottieRef.current) arkaPlanLottieRef.current.setSpeed(computeBgSpeed(bg, targetLevel));
    // Parallax arka plan çarpanını anında geri aç
    bgSpeedMultRef.current = 1;
  };

  // Arka planı, portalın oyuncuya yaklaşma oranıyla orantılı olarak yavaşlatır.
  // Portal sağdan girip reaktör merkezine ulaştığında çarpan 0 olur.
  const updateBgMultFromPortal = (portalX: number, reactorCenterX: number) => {
    const startX = GAME_WIDTH; // portal spawn x
    const endX = reactorCenterX; // hedef (level geçişi)
    const range = Math.max(1, startX - endX);
    const progress = Math.min(Math.max((startX - portalX) / range, 0), 1); // 0 → 1
    const mult = 1 - progress; // 1 → 0 doğrusal
    bgSpeedMultRef.current = mult;
    if (arkaPlanLottieRef.current) {
      const startSpeed = computeBgSpeed(getBgForLevel(levelRef.current), levelRef.current);
      arkaPlanLottieRef.current.setSpeed(startSpeed * mult);
    }
  };

  useEffect(() => {
    // NOT: Burada ayrı bir AudioContext AÇMIYORUZ. iOS'ta ikinci bir context
    // AVAudioSession'ı resetliyor ve sayfadan çıkınca arka plan müziği kesilip
    // bir süre sonra sıradaki parçadan başlıyor. Tüm tonlar paylaşımlı
    // genericBeep context'i üzerinden çalınır.



    fetch("/wordlist.txt")
      .then((r) => r.text())
      .then((t) =>
        setWordList(
          t.split("\n")
           .map((w) => w.trim().toUpperCase())
           .filter((w) => w.length >= 6 && w.length <= 8),
        ),
      )
      .catch(() => setWordList(["REAKTÖR", "FİSYON", "URANYUM", "KARBON", "PLUTONYUM"]));
  }, []);

  useEffect(() => {
    targetWordRef.current = targetWord;
  }, [targetWord]);

  useEffect(() => {
    isMutedRef.current = isMuted;
  }, [isMuted]);

  // GameMuteButton toggle → local mute ile senkron (oyun içi jenerik sesler dahil)
  useEffect(() => {
    setIsMuted(gameMuted);
  }, [gameMuted]);

  useEffect(() => {
    levelRef.current = level;
  }, [level]);

  const toggleMute = () => {
    setIsMuted((prev) => !prev);
  };

  const playSound = (freq, type = "sine", vol = 0.1) => {
    if (isMutedRef.current) return;
    playGenericTone(freq, type as OscillatorType, vol);
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
      setFeedback({ text: "Olmadı!", type: "fail" });
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

    gameStateRef.current = "playing";

    dinoXRef.current = ENTRY_DINO_START_X;
    dinoRotationRef.current = 0;
    velocityRef.current = 0;
    speedRef.current = 2;
    scoreRef.current = 0;
    lastFrameTimeRef.current = 0;
    setScore(0);
    
    // Level Sıfırlama
    setLevel(1);
    levelRef.current = 1;
    wordsClearedRef.current = 0;
    setBgGradient("linear-gradient(180deg, #1a2a6c 0%, #b21f1f 100%)");
    if (arkaPlanLottieRef.current) arkaPlanLottieRef.current.setSpeed(1);

    // Level 2 Portal Sıfırlama
    setActiveBg("level1");
    portalTriggeredRef.current = false;
    nextPortalScoreRef.current = 750;
    portalRef.current = null;
    exitFadeRef.current = 0;

    // Giriş portalı (level 1 için de portaldan giriş yap)
    entryPortalRef.current = { x: ENTRY_PORTAL_X };
    const portalCenterDinoY = GAME_HEIGHT / 2 - DINO_HEIGHT / 2 - GROUND_HEIGHT + ENTRY_PORTAL_Y_OFFSET;
    dinoYRef.current = portalCenterDinoY;
    entryAnimationRef.current = {
      startTime: performance.now(),
      fromX: ENTRY_DINO_START_X,
      toX: DINO_LEFT,
      fromY: portalCenterDinoY,
      toY: 0,
      duration: 1400,
    };

    if (levelUpTimeoutRef.current) clearTimeout(levelUpTimeoutRef.current);
    setShowLevelUpText(false);
    setLevelUpMessage("");

    completedWordsRef.current = [];
    setCompletedWords([]);
    wordBonusRef.current = 0;
    obstaclesRef.current = [];
    lastObstacleKindRef.current = null;
    sameKindStreakRef.current = 0;
    lettersRef.current = [];
    cloudsRef.current = [];
    setRenderState({
      dinoX: ENTRY_DINO_START_X,
      dinoY: portalCenterDinoY,
      dinoRotation: 0,
      dinoOpacity: 0,
      obstacles: [],
      letters: [],
      clouds: [],
      groundOffset: 0,
      portal: null,
      entryPortal: entryPortalRef.current,
    });
    setFeedback(null);

    nextObstacleTimeRef.current = Date.now() + 1800;

    pickNewWord();
    playPortalGecisSound();
    playSound(440, "triangle");
    setGameState("playing");
  };

  const startLevel = (targetLevel: number) => {
    playButtonSound("buttonClick");
    playPortalGecisSound();
    const targetBg = getBgForLevel(targetLevel);
    setActiveBg(targetBg);
    setLevel(targetLevel);
    levelRef.current = targetLevel;
    wordsClearedRef.current = 0;
    restoreBackgroundSpeed(targetLevel);
    setBgGradient(getRandomGradient());

    obstaclesRef.current = [];
    lettersRef.current = [];
    lastObstacleKindRef.current = null;
    sameKindStreakRef.current = 0;
    portalRef.current = null;
    portalTriggeredRef.current = false;
    exitFadeRef.current = 0;
    entryPortalRef.current = { x: ENTRY_PORTAL_X };
    dinoXRef.current = ENTRY_DINO_START_X;
    // Portalın dikey ortasından çıksın: portal yukarı kaydırıldığı için dinoY de yukarı kayar
    const portalCenterDinoY = GAME_HEIGHT / 2 - DINO_HEIGHT / 2 - GROUND_HEIGHT + ENTRY_PORTAL_Y_OFFSET;
    dinoYRef.current = portalCenterDinoY;
    velocityRef.current = 0;
    entryAnimationRef.current = {
      startTime: performance.now(),
      fromX: ENTRY_DINO_START_X,
      toX: DINO_LEFT,
      fromY: portalCenterDinoY,
      toY: 0,
      duration: 1400,
    };
    nextObstacleTimeRef.current = Date.now() + 1800;
    nextLetterTimeRef.current = Date.now() + 1400;
    lastFrameTimeRef.current = 0;

    setRenderState((prev) => ({
      ...prev,
      dinoX: ENTRY_DINO_START_X,
      dinoY: portalCenterDinoY,
      dinoOpacity: 0,
      obstacles: [],
      letters: [],
      portal: null,
      entryPortal: entryPortalRef.current,
    }));

    pickNewWord();

    gameStateRef.current = "playing";
    setGameState("playing");
  };

  useEffect(() => {
    if (!arkaPlanLottieRef.current) return;
    const id = requestAnimationFrame(() => {
      arkaPlanLottieRef.current?.setSpeed(computeBgSpeed(activeBg, level));
    });
    return () => cancelAnimationFrame(id);
  }, [activeBg, level]);

  const handleJump = (e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    // Zıplama sadece aktif oyunda çalışsın; oyunu başlatma görevi BAŞLA butonlarına kalsın.
    if (gameStateRef.current !== "playing") return;
    velocityRef.current = JUMP_FORCE;
    // Jenerik zıplama bip sesi (buton sesinden farklı)
    // iOS nativde mp3 pool HTMLAudio play() ana thread'de hitch yaratıyor;
    // WebAudio oscillator (playJumpBeep) donma yaşatmadan zıplama sesi verir.
    if (!gameMuted) {
      if (IS_IOS_NATIVE) playJumpBeep();
      else playDinoJump();
    }
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

    // Fizik (delta-time normalized) — entry animasyonu sırasında yerçekimi devre dışı
    if (!entryAnimationRef.current) {
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
    }

    dinoRotationRef.current += speedRef.current * 4 * dt;
    speedRef.current += 0.001 * dt;

    if (entryAnimationRef.current) {
      const entry = entryAnimationRef.current;
      const progress = Math.min((now - entry.startTime) / entry.duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      dinoXRef.current = entry.fromX + (entry.toX - entry.fromX) * eased;
      dinoYRef.current = entry.fromY + (entry.toY - entry.fromY) * eased;
      if (progress >= 1) {
        dinoXRef.current = entry.toX;
        dinoYRef.current = entry.toY;
        velocityRef.current = 0;
        entryAnimationRef.current = null;
        entryPortalRef.current = null;
      }
    }

    groundOffsetRef.current = (groundOffsetRef.current + speedRef.current * dt) % 40;

    const dinoRect = {
      x: dinoXRef.current + 5,
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
        const height = 20 + Math.floor(Math.random() * 111); // 20-130
        obstaclesRef.current.push({
          id: Math.random(),
          x: GAME_WIDTH,
          y: GAME_HEIGHT - GROUND_HEIGHT - height, // tavandan sarkar
          width: OBSTACLE_WIDTH,
          height,
          type: "ceiling",
        });
      } else {
        const height = 20 + Math.floor(Math.random() * 111); // 20-130
        const type = height <= 45 ? "short" : height >= 100 ? "tall" : "box";
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
        if (!gameMuted) playChallengeWinSound();
        saveChallengeScore(finalScore, completedWordsRef.current.length).then((saved) => {

          if (saved) {
            toast.success(`🎯 Challenge puanın kaydedildi: ${finalScore}`);
          }
        });
        return;
      }
    }
    // obstacles updated via ref, will batch render below

    // --- PORTAL: Her 500 puanda sağdan portal belirir, merkeze girince level atlanır ---
    const currentTotalScore = Math.floor(scoreRef.current) + wordBonusRef.current;
    if (!portalTriggeredRef.current && !portalRef.current && currentTotalScore >= nextPortalScoreRef.current) {
      portalTriggeredRef.current = true;
      const targetLevel = levelRef.current + 1;
      obstaclesRef.current = [];
      lettersRef.current = [];
      nextObstacleTimeRef.current = Date.now() + 5000;
      nextLetterTimeRef.current = Date.now() + 5000;
      // Arka plan, portal sağdan gelmeye başladığında oransal olarak yavaşlayacak.
      setTimeout(() => {
        if (gameStateRef.current === "playing") {
          portalRef.current = { x: GAME_WIDTH, targetLevel };
        }
      }, 900);
    }

    if (portalRef.current) {
      portalRef.current.x -= speedRef.current * dt;

      const portalDoorCenterX = portalRef.current.x + PORTAL_WIDTH * PORTAL_DOOR_CENTER_RATIO;
      const reactorCenterX = dinoXRef.current + DINO_WIDTH / 2;
      updateBgMultFromPortal(portalDoorCenterX, reactorCenterX);

      // Reaktör portal kapısına yaklaştıkça yavaşça solar (fade-out)
      const fadeStart = portalDoorCenterX - DINO_WIDTH / 2;
      const fadeEnd = portalDoorCenterX + DINO_WIDTH;
      const fadeRange = Math.max(1, fadeEnd - fadeStart);
      exitFadeRef.current = Math.min(Math.max((reactorCenterX - fadeStart) / fadeRange, 0), 1);

      // Reaktör tamamen solduktan sonra level atlasın
      if (reactorCenterX >= portalDoorCenterX + DINO_WIDTH) {
        const reachedLevel = portalRef.current.targetLevel;
        portalRef.current = null;
        playPortalGecisSound();
        pendingLevelRef.current = reachedLevel;
        nextPortalScoreRef.current += 750;
        gameStateRef.current = "transition";
        setGameState("transition");
        setLevelUpMessage(`🎉 Tebrikler ${reachedLevel}. Levele geçtiniz!`);
        setShowLevelUpText(true);
        playSound(900, "sine", 0.3);
        levelUpTimeoutRef.current = setTimeout(() => {
          setShowLevelUpText(false);
          setGameState("levelStart");
        }, 2200);
        return;
      } else if (portalRef.current.x < -PORTAL_WIDTH) {
        // Güvenlik: bir şekilde çarpışma tetiklenmeden ekranı terk ederse temizle
        portalRef.current = null;
        portalTriggeredRef.current = false;
        restoreBackgroundSpeed();
      }
    }

    // Harfler (in-place update, düşük GC)
    for (let i = lettersRef.current.length - 1; i >= 0; i--) {
      lettersRef.current[i].x -= speedRef.current * dt;
      if (lettersRef.current[i].x <= -LETTER_SIZE) lettersRef.current.splice(i, 1);
    }

    const currentWord = targetWordRef.current;

    if (currentWord && spawnIndexRef.current < currentWord.length && Date.now() > nextLetterTimeRef.current) {
      const charToSpawn = currentWord[spawnIndexRef.current];

      // Engellerle çakışmayan bir Y konumu bul.
      // Engeller ve harfler aynı hızda hareket ettiği için spawn anındaki
      // dikey çakışma kalıcı olur; o yüzden mevcut engellerin yakınında
      // (yatay olarak spawn noktasına yakın) olanların Y bandını dışla.
      const spawnX = GAME_WIDTH;
      // Geniş yatay pencere: yakın zamanda spawn edilen engelleri de yakala
      // (aynı hızda olduklarından yatay mesafe sabit kalır, kalıcı çakışma riski var)
      const HORIZONTAL_SAFETY = 80;
      const dangerObstacles = obstaclesRef.current.filter((o: any) => {
        return o.x + o.width + HORIZONTAL_SAFETY > spawnX - LETTER_SIZE &&
               o.x < spawnX + LETTER_SIZE + HORIZONTAL_SAFETY;
      });

      // Yakında bir engel spawn olacaksa (aynı hız → sabit yakın mesafe oluşur)
      // harf spawnını biraz ertele ki engelle çakışmasın.
      const msUntilNextObstacle = nextObstacleTimeRef.current - Date.now();
      let skipSpawn = false;
      if (msUntilNextObstacle >= 0 && msUntilNextObstacle < 350) {
        nextLetterTimeRef.current = Date.now() + 400;
        skipSpawn = true;
      }

      let randomY = 0;
      let foundClearY = false;
      if (!skipSpawn) {
        const yMin = 30;
        const yMax = 180;
        randomY = yMin + Math.random() * (yMax - yMin);
        // En fazla 20 deneme yap; engelle çakışmayan Y bul
        for (let attempt = 0; attempt < 20; attempt++) {
          const collides = dangerObstacles.some((o: any) => {
            return randomY < o.y + o.height + 6 && randomY + LETTER_SIZE + 6 > o.y;
          });
          if (!collides) { foundClearY = true; break; }
          randomY = yMin + Math.random() * (yMax - yMin);
        }

        // Hiç temiz Y bulunamadıysa şu an spawn etme, kısa süre sonra tekrar dene
        if (!foundClearY) {
          nextLetterTimeRef.current = Date.now() + 300;
          skipSpawn = true;
        }
      }

      if (!skipSpawn) {
        lettersRef.current.push({
          id: Math.random(),
          x: spawnX,
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
        
        wordsClearedRef.current += 1;

      } else {
        showFeedback(false);
      }
      pickNewWord();
    }

    // Bulutlar kaldırıldı - gereksiz DOM + paint yükü

    // --- HER FRAME RENDER (60FPS) ---
    // Entry animasyonu sırasında reaktör görünmezden görünür hale gelir
    let dinoOpacity = 1;
    if (entryAnimationRef.current) {
      const ea = entryAnimationRef.current;
      const p = Math.min((performance.now() - ea.startTime) / ea.duration, 1);
      dinoOpacity = Math.min(1, p * 1.2);
    }
    // Çıkış portalından geçerken solma
    if (exitFadeRef.current > 0) {
      dinoOpacity = Math.min(dinoOpacity, 1 - exitFadeRef.current);
    }
    setRenderState({
      dinoX: dinoXRef.current,
      dinoY: dinoYRef.current,
      dinoRotation: dinoRotationRef.current,
      dinoOpacity,
      obstacles: obstaclesRef.current,
      letters: activeLetters,
      clouds: [],
      groundOffset: groundOffsetRef.current,
      portal: portalRef.current ? { x: portalRef.current.x } : null,
      entryPortal: entryPortalRef.current ? { x: entryPortalRef.current.x } : null,
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

          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <GameMuteButton gameId="reaktor" size={40} />
            <button onClick={() => { playButtonSound("buttonClick"); setShowLeaderboard(true); }} className="icon-btn" title="Sıralamalar">
              <Trophy size={24} />
            </button>
          </div>
        </div>

        {/* OYUN ALANI */}
        <div 
          className="game-stage" 
          data-no-sfx
          onPointerDown={handleJump}
          style={{ background: "transparent" }}
        >
          {/* Parallax Arka Plan */}
          <ParallaxBackground bg={activeBg} speedRef={speedRef} multRef={bgSpeedMultRef} />


          {/* Level başlangıç portalı (yukarıda, dikeyde kaydırılmış) */}
          {renderState.entryPortal && portalAnim && (
            <div
              style={{
                position: "absolute",
                left: 0,
                top: -PORTAL_VERTICAL_OVERSCAN - ENTRY_PORTAL_Y_OFFSET,
                width: PORTAL_WIDTH,
                height: `calc(100% + ${PORTAL_VERTICAL_OVERSCAN * 2}px)`,
                transform: `translate3d(${renderState.entryPortal.x}px, 0, 0)`,
                zIndex: 6,
                pointerEvents: "none",
              }}
            >
              <Lottie animationData={portalAnim} loop autoplay style={{ width: "100%", height: "100%" }} rendererSettings={{ preserveAspectRatio: "none" }} />
            </div>
          )}

          {/* Sağ level geçiş portalı */}
          {renderState.portal && portalAnim && (
            <div
              style={{
                position: "absolute",
                left: 0,
                top: -PORTAL_VERTICAL_OVERSCAN,
                width: PORTAL_WIDTH,
                height: `calc(100% + ${PORTAL_VERTICAL_OVERSCAN * 2}px)`,
                transform: `translate3d(${renderState.portal.x}px, 0, 0)`,
                zIndex: 6,
                pointerEvents: "none",
              }}
            >
              <Lottie animationData={portalAnim} loop={false} autoplay style={{ width: "100%", height: "100%" }} rendererSettings={{ preserveAspectRatio: "none" }} />
            </div>
          )}

          {showLevelUpText && (
            <div className="level-up-banner">{levelUpMessage}</div>
          )}

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
              <div className={`letter-inner ${level === 2 ? "neon-pink" : level === 3 ? "neon-green" : level === 4 ? "neon-blue" : level === 5 ? "letter-black" : level === 6 ? "letter-purple" : level === 7 ? "letter-red" : level === 8 ? "letter-blue" : ""}`}>{l.char}</div>
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
              opacity: renderState.dinoOpacity,
              transform: `translate3d(${renderState.dinoX}px, ${-(renderState.dinoY + GROUND_HEIGHT)}px, 0)${selectedCharacter ? "" : ` rotate(${renderState.dinoRotation}deg)`}`,
            }}
          >
            {selectedCharacter ? (
              <div
                style={{
                  position: "absolute",
                  left: "50%",
                  bottom: 0,
                  transform: "translateX(-50%)",
                  width: DINO_WIDTH * 2.5,
                  height: DINO_WIDTH * 2.5,
                  pointerEvents: "none",
                }}
              >
                <DinoCharacterSprite
                  character={selectedCharacter}
                  isJumping={renderState.dinoY > 2}
                  size={DINO_WIDTH * 2.5}
                />
              </div>
            ) : (
              "☢️"
            )}
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

          {(gameState === "waiting" || gameState === "gameOver") && (
            <div className="overlay">
              <div className="card">
                {gameState === "waiting" && reaktorAnim && (
                  <div style={{ width: 100, height: 100, margin: "0 auto 8px" }}>
                    <Lottie animationData={reaktorAnim} loop autoplay style={{ width: "100%", height: "100%" }} />
                  </div>
                )}
                <h2>{gameState === "waiting" ? "HARF KOŞUSU" : "SİSTEM ÇÖKTÜ!"}</h2>
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
                      if (gameState === "waiting" && !selectedCharacter) {
                        setShowCharacterPicker(true);
                      } else {
                        startGame();
                      }
                    }}
                  >
                    {gameState === "waiting"
                      ? (selectedCharacter ? "BAŞLA" : "GİRİŞ")
                      : "TEKRAR DENE"}
                  </button>
                )}
              </div>
            </div>
          )}

          {showCharacterPicker && (
            <div className="overlay" onClick={(e) => e.stopPropagation()}>
              <div className="card character-picker-card">
                <h2 style={{ marginBottom: 6 }}>KARAKTER SEÇ</h2>
                <p style={{ fontSize: 12, color: "#aaa", marginBottom: 8 }}>Bir karakter seç ve BAŞLA'ya bas</p>
                <div className="character-grid">
                  {(Object.keys(CHARACTERS) as CharacterId[]).map((id) => {
                    const isSel = selectedCharacter === id;
                    return (
                      <button
                        key={id}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedCharacter(id);
                        }}
                        style={{
                          background: isSel ? "rgba(0,234,255,0.15)" : "rgba(255,255,255,0.05)",
                          border: isSel ? "2px solid #00eaff" : "2px solid rgba(255,255,255,0.1)",
                          borderRadius: 12,
                          padding: 8,
                          cursor: "pointer",
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          gap: 6,
                          color: "#fff",
                        }}
                      >
                        <img
                          src={CHARACTERS[id].previewSrc}
                          alt={CHARACTERS[id].label}
                          draggable={false}
                          loading="eager"
                          decoding="async"
                          style={{ width: 58, height: 58, objectFit: "contain" }}
                        />
                        <span style={{ fontSize: 13, fontWeight: "bold" }}>{CHARACTERS[id].label}</span>
                      </button>
                    );
                  })}
                </div>
                <button
                  className="start-btn"
                  style={{ marginTop: 8, opacity: selectedCharacter ? 1 : 0.5 }}
                  disabled={!selectedCharacter}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (!selectedCharacter) return;
                    playButtonSound("buttonClick");
                    setShowCharacterPicker(false);
                    if (!hasPlayedTodayRef.current && !challengeLoadingRef.current && gameStateRef.current !== "playing") {
                      startGame();
                    }
                  }}
                >
                  BAŞLA
                </button>
              </div>
            </div>
          )}

          {gameState === "levelStart" && (
            <div className="overlay">
              <div className="card">
                <h2>{pendingLevelRef.current}. LEVEL AÇILDI!</h2>
                <p>Portaldan geçtin, yeni bölge seni bekliyor.</p>
                <div style={{marginTop: '10px', background: 'rgba(0,234,255,0.12)', border: '1px solid rgba(0,234,255,0.35)', borderRadius: '8px', padding: '8px 12px'}}>
                  <p style={{fontSize: '12px', color: '#00eaff', fontWeight: 'bold'}}>Mevcut Puanın: {Math.floor(scoreRef.current) + wordBonusRef.current}</p>
                </div>
                <button
                  className="start-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    startLevel(pendingLevelRef.current);
                  }}
                >
                  BAŞLA
                </button>
              </div>
            </div>
          )}
        </div>

        {/* MOBİL KONTROLLER */}
        <div className="mobile-controls">
          <button className="control-btn" data-no-sfx onPointerDown={(e) => handleJump(e)}>
            ZIPLA ↰
          </button>
          <button className="control-btn" data-no-sfx onPointerDown={(e) => handleJump(e)}>
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
            background: transparent;
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
            border: 2px solid rgba(255, 255, 255, 0.9);
        }
        .obs-short {
            background: #5cb85c;
        }
        .obs-tall {
            background: #2e7d32;
        }
        .obs-box {
            background: #00d2d3;
            border-radius: 6px;
        }
        .obs-ceiling {
            background: linear-gradient(180deg, #ff4444 0%, #8b0000 100%);
            border-radius: 0 0 6px 6px;
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
        .letter-inner.neon-green {
            background: #39FF14;
            box-shadow: 0 0 8px rgba(57, 255, 20, 0.7);
        }
        .letter-inner.neon-pink {
            background: #FF10F0;
            box-shadow: 0 0 8px rgba(255, 16, 240, 0.7);
        }
        .letter-inner.neon-blue {
            background: #00F0FF;
            box-shadow: 0 0 8px rgba(0, 240, 255, 0.7);
        }
        .letter-inner.letter-black {
            background: #111;
            color: #fff;
            box-shadow: 0 0 8px rgba(0, 0, 0, 0.7);
        }
        .letter-inner.letter-purple {
            background: #9D00FF;
            color: #fff;
            box-shadow: 0 0 8px rgba(157, 0, 255, 0.7);
        }
        .letter-inner.letter-red {
            background: #FF2222;
            color: #fff;
            box-shadow: 0 0 8px rgba(255, 34, 34, 0.7);
        }
        .letter-inner.letter-blue {
            background: #0066FF;
            color: #fff;
            box-shadow: 0 0 8px rgba(0, 102, 255, 0.7);
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

        .level-up-banner {
            position: absolute;
            top: 50%; left: 50%;
            transform: translate(-50%, -50%) scale(0);
            z-index: 61;
            /* 🔥 Küçük ekranlarda (iOS native) taşmayı önle: viewport'a göre ölçekle */
            font-size: clamp(14px, 4.6vw, 24px);
            line-height: 1.25;
            font-weight: 900;
            text-align: center;
            color: #fff;
            text-shadow: 0 0 10px #00eaff, 0 0 25px #00eaff, 2px 2px 0 #000;
            background: rgba(0,0,0,0.55);
            padding: 12px 16px;
            border-radius: 18px;
            border: 2px solid rgba(0,234,255,0.6);
            /* nowrap taşmaya sebep oluyordu → satır kırılmasına izin ver */
            white-space: normal;
            word-break: break-word;
            width: max-content;
            max-width: min(78%, 300px);
            box-sizing: border-box;
            animation:
              levelUpGrow 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards,
              levelUpPulse 0.9s ease-in-out 0.6s infinite;
        }
        @keyframes levelUpGrow {
            0% { transform: translate(-50%, -50%) scale(0); opacity: 0; }
            60% { transform: translate(-50%, -50%) scale(1.1); opacity: 1; }
            100% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
        }

        @keyframes levelUpPulse {
            0%, 100% { transform: translate(-50%, -50%) scale(1); }
            50% { transform: translate(-50%, -50%) scale(1.04); }
        }

        @media (max-width: 400px) {
            .level-up-banner { font-size: 17px; padding: 12px 16px; }
        }

        .overlay {
            position: absolute;
            inset: 0; background: rgba(0,0,0,0.8);
            display: flex; align-items: center; justify-content: center; z-index: 50; backdrop-filter: blur(5px);
        }
        .card {
            background: #222;
            color: #fff; padding: 30px; border-radius: 20px;
            text-align: center; border: 1px solid #444; box-shadow: 0 0 50px rgba(0,0,0,0.6);
            max-width: calc(100% - 32px);
            max-height: calc(100% - 32px);
            overflow: auto;
            box-sizing: border-box;
        }
        .character-picker-card {
            width: min(420px, calc(100% - 18px));
            max-height: calc(100% - 18px);
            padding: 14px;
            overflow: hidden;
            box-sizing: border-box;
        }
        .character-picker-card h2 {
            font-size: 20px;
            line-height: 1.1;
        }
        .character-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 6px;
        }
        .start-btn {
            background: linear-gradient(45deg, #FFD700, #FF8C00);
            border: none; padding: 12px 30px; color: #000; font-weight: 900;
            font-size: 18px; border-radius: 30px; margin-top: 15px; cursor: pointer;
            box-shadow: 0 0 20px rgba(255, 215, 0, 0.4); transition: transform 0.1s;
        }
        .character-picker-card .start-btn {
            width: 100%;
            min-height: 40px;
            padding: 9px 20px;
            font-size: 16px;
        }
        .start-btn:active { transform: scale(0.95); }
      `}</style>
      {ExitConfirmDialog}
    </div>
  );
};

export default DinoRunner;
