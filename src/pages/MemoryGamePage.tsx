import { homeBackPath } from "@/utils/challengeBackPath";
import React, { useState, useEffect, useRef, useLayoutEffect } from "react";
import { playChallengeWinSound } from "@/utils/challengeWinSound";
import Lottie from "lottie-react";
import { Trophy, ArrowLeft, Zap, Clock } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useDailyChallenge } from "@/hooks/useDailyChallenge";
import { ChallengeLeaderboard } from "@/components/ChallengeLeaderboard";
import { useGameMute } from "@/hooks/useGameMute";
import { GameMuteButton } from "@/components/GameMuteButton";
import { useExitGameConfirm } from "@/hooks/useExitGameConfirm";
import { toast } from "sonner";

interface Kart {
  id: number;
  kelime: string;
  tip: "duzgun" | "karisik";
  acik: boolean;
  eslesti: boolean;
  renk: string;
  eslestirmeId: number;
  // Görselin hangi parçasına karşılık geldiği (karıştırılmadan önceki grid pozisyonu)
  gorselParca: number;
}

const GRID_PAIRS = 12; // 12 çift = 24 kart
const SURE = 90;
const COLS = 5; // 5 sütun
const ROWS = 5; // 5 satır (24 kart + 1 boş)
const TOTAL_IMAGE_SLOTS = 24; // Görseli 24 parçaya böl

// Günlük seed (Europe/Istanbul timezone)
const getDailySeed = (): number => {
  const dateKey = new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Istanbul" });
  let hash = 0;
  for (let i = 0; i < dateKey.length; i++) {
    hash = (hash * 31 + dateKey.charCodeAt(i)) >>> 0;
  }
  return hash;
};

// Günlük görsel: 34 görsel, 34 günlük döngü. Her index'in extension'ı ayrı tanımlı.
const OZLU_SOZLER_EXT: string[] = [
  '.jpeg','.jpeg','.jpeg','.jpeg','.jpeg','.jpeg','.jpeg','.jpeg','.jpeg','.jpeg', // 1-10
  '.jpeg','.jpeg','.jpg', '.jpg', '.jpg',  // 11-15
  '.jpeg','.jpeg','.jpeg','.jpeg','.jpeg','.jpeg','.jpeg','.jpeg','.jpeg','.jpeg', // 16-25
  '.jpeg','.jpeg','.jpeg','.jpeg','.jpeg','.jpeg','.jpeg','.jpeg','.jpeg', // 26-34
];
const getDailyImage = (): string => {
  const idx = getDailySeed() % 34;
  return `/ozluSozler/ozluSozler${idx + 1}${OZLU_SOZLER_EXT[idx]}`;
};

// Görselin belirli parçasının background-position stilini hesapla
// gorselParca: 0-23 arası (görselin hangi karesine karşılık geldiği)
const getImageSliceStyle = (
  gorselParca: number,
  imageUrl: string,
  containerCols = 4, // 4x6 = 24 parça (4 sütun, 6 satır)
  containerRows = 6
): React.CSSProperties => {
  const col = gorselParca % containerCols;
  const row = Math.floor(gorselParca / containerCols);
  const xPercent = containerCols === 1 ? 0 : (col / (containerCols - 1)) * 100;
  const yPercent = containerRows === 1 ? 0 : (row / (containerRows - 1)) * 100;

  return {
    backgroundImage: `url(${imageUrl})`,
    backgroundSize: `${containerCols * 100}% ${containerRows * 100}%`,
    backgroundPosition: `${xPercent}% ${yPercent}%`,
  };
};

const WordMemoryGame = () => {
  const navigate = useNavigate();
  const { requestExit, ExitConfirmDialog } = useExitGameConfirm();
  const { muted, playSound } = useGameMute("memory");
  const {
    hasPlayedToday,
    todayScore,
    leaderboard,
    loading: challengeLoading,
    saveScore,
    markAsPlayed,
  } = useDailyChallenge("memory");

  const [kartlar, setKartlar] = useState<Kart[]>([]);
  const [secilenKartlar, setSecilenKartlar] = useState<number[]>([]);
  const [hamle, setHamle] = useState(0);
  const [oyunBitti, setOyunBitti] = useState(false);
  const [gameLoading, setGameLoading] = useState(false);
  const [kalanSure, setKalanSure] = useState(SURE);
  const [oyunBasladi, setOyunBasladi] = useState(false);
  const [wordList, setWordList] = useState<string[]>([]);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [beyinAnim, setBeyinAnim] = useState<any>(null);
  const [gorselHazir, setGorselHazir] = useState(false);

  // Animasyon state: kazanınca kartlar yerlerine kayıyor mu?
  const [puzzleAciliyor, setPuzzleAciliyor] = useState(false);
  const [flipRevealedIds, setFlipRevealedIds] = useState<Set<number>>(new Set());

  // FLIP animasyonu için kart referansları ve ilk pozisyonlar
  const cardRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const firstRectsRef = useRef<Record<number, DOMRect>>({});


  const dailyImage = getDailyImage();

  useEffect(() => {
    fetch("/beyinKelimeHafiza.json").then(r => r.json()).then(setBeyinAnim).catch(() => {});
  }, []);

  // Görseli önceden yükle
  useEffect(() => {
    const img = new Image();
    img.src = dailyImage;
    img.onload = () => setGorselHazir(true);
    img.onerror = () => setGorselHazir(true); // Hata olsa da devam et
  }, [dailyImage]);

  const renkler = [
    "from-purple-400 to-purple-600",
    "from-blue-400 to-blue-600",
    "from-green-400 to-green-600",
    "from-yellow-400 to-yellow-600",
    "from-red-400 to-red-600",
    "from-pink-400 to-pink-600",
    "from-indigo-400 to-indigo-600",
    "from-orange-400 to-orange-600",
    "from-cyan-400 to-cyan-600",
    "from-teal-400 to-teal-600",
    "from-lime-400 to-lime-600",
    "from-amber-400 to-amber-600",
    "from-rose-400 to-rose-600",
  ];

  useEffect(() => {
    const loadWordList = async () => {
      try {
        const response = await fetch("/wordlist.txt");
        const text = await response.text();
        const words = text
          .split("\n")
          .map((w) => w.trim().toUpperCase())
          .filter((w) => w.length >= 4 && w.length <= 7);
        setWordList(words);
      } catch {
        setWordList([
          "BAHÇE", "KALEM", "DÜNYA", "GÜNEŞ", "DENIZ",
          "YILDIZ", "ÇIÇEK", "KITAP", "PENCERE", "KAHVE",
          "MÜZIK", "OYUN",
        ]);
      }
    };
    loadWordList();
  }, []);

  // Süre sayacı
  useEffect(() => {
    if (!oyunBasladi || oyunBitti || kalanSure <= 0) return;
    const timer = setInterval(() => {
      setKalanSure((prev) => {
        if (prev <= 1) {
          setOyunBitti(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [oyunBasladi, oyunBitti, kalanSure]);

  // Kazanınca puan kaydet + puzzle animasyonunu tetikle
  useEffect(() => {
    if (!oyunBitti) return;
    const kazandi = kartlar.length > 0 && kartlar.every((k) => k.eslesti);
    if (kazandi && hamle > 0) {
      const timeSpent = SURE - kalanSure;
      const rawScore = timeSpent > 0 ? parseFloat((10000 / (timeSpent * hamle)).toFixed(2)) : 0;
      saveScore(rawScore, hamle);
      if (!muted) playChallengeWinSound();
      markAsPlayed();
      toast.success("🎡 Tebrikler! Gün sonunda +1 çark çevirme hakkı kazanacaksın!", { duration: 5000 });

      // Puzzle açılma animasyonunu 600ms sonra başlat (FLIP için ilk rect'leri yakala)
      setTimeout(() => {
        const rects: Record<number, DOMRect> = {};
        Object.entries(cardRefs.current).forEach(([id, el]) => {
          if (el) rects[Number(id)] = el.getBoundingClientRect();
        });
        firstRectsRef.current = rects;
        setFlipRevealedIds(new Set());
        setPuzzleAciliyor(true);
      }, 600);

    }
  }, [oyunBitti]);

  const rastgeleKelimeAl = (adet: number): string[] => {
    if (wordList.length === 0) return [];
    const secilenler: string[] = [];
    const kopyaListe = [...wordList];
    for (let i = 0; i < adet && kopyaListe.length > 0; i++) {
      const randomIndex = Math.floor(Math.random() * kopyaListe.length);
      secilenler.push(kopyaListe[randomIndex]);
      kopyaListe.splice(randomIndex, 1);
    }
    return secilenler;
  };

  const harfleriKaristir = (kelime: string): string => {
    const harfler = kelime.split("");
    let karisik = [...harfler];
    for (let i = 0; i < 5; i++) {
      const idx1 = Math.floor(Math.random() * karisik.length);
      const idx2 = Math.floor(Math.random() * karisik.length);
      [karisik[idx1], karisik[idx2]] = [karisik[idx2], karisik[idx1]];
    }
    if (karisik.join("") === kelime && karisik.length > 1) {
      [karisik[0], karisik[1]] = [karisik[1], karisik[0]];
    }
    return karisik.join("");
  };

  const ilkKartAcildiRef = useRef(false);

  const oyunuBaslat = () => {
    if (wordList.length === 0 || hasPlayedToday) return;
    ilkKartAcildiRef.current = false;
    setPuzzleAciliyor(false);
    setFlipRevealedIds(new Set());
    firstRectsRef.current = {};
    setGameLoading(true);

    const secilenKelimeler = rastgeleKelimeAl(GRID_PAIRS);
    const kartToplamSayisi = GRID_PAIRS * 2; // 24

    // 0-23 arası görsel parça indekslerini karıştır
    const gorselParcalari = Array.from({ length: kartToplamSayisi }, (_, i) => i);
    const karisikParcalar = [...gorselParcalari].sort(() => Math.random() - 0.5);

    const karisikRenkler = Array.from({ length: kartToplamSayisi }, (_, i) =>
      renkler[i % renkler.length]
    ).sort(() => Math.random() - 0.5);

    const yeniKartlar: Kart[] = [];
    secilenKelimeler.forEach((kelime, index) => {
      const karisikKelime = harfleriKaristir(kelime);

      yeniKartlar.push({
        id: index * 2,
        kelime,
        tip: "duzgun",
        acik: false,
        eslesti: false,
        renk: karisikRenkler[index * 2],
        eslestirmeId: index,
        gorselParca: karisikParcalar[index * 2], // Karışık parça ataması
      });
      yeniKartlar.push({
        id: index * 2 + 1,
        kelime: karisikKelime,
        tip: "karisik",
        acik: false,
        eslesti: false,
        renk: karisikRenkler[index * 2 + 1],
        eslestirmeId: index,
        gorselParca: karisikParcalar[index * 2 + 1],
      });
    });

    // Kartları karıştır (grid'deki görsel sırası ≠ gorselParca, bu yüzden görsel dağınık görünür)
    const karisikKartlar = yeniKartlar.sort(() => Math.random() - 0.5);

    setTimeout(() => {
      setKartlar(karisikKartlar);
      setSecilenKartlar([]);
      setHamle(0);
      setOyunBitti(false);
      setKalanSure(SURE);
      setOyunBasladi(true);
      setGameLoading(false);
    }, 500);
  };

  const kartTikla = (kartIndex: number) => {
    if (secilenKartlar.length === 2) return;
    if (kartlar[kartIndex].acik || kartlar[kartIndex].eslesti) return;
    if (oyunBitti) return;

    if (!ilkKartAcildiRef.current) {
      ilkKartAcildiRef.current = true;
      markAsPlayed();
    }

    const yeniKartlar = [...kartlar];
    yeniKartlar[kartIndex].acik = true;
    setKartlar(yeniKartlar);

    const yeniSecilenler = [...secilenKartlar, kartIndex];
    setSecilenKartlar(yeniSecilenler);

    if (yeniSecilenler.length === 2) {
      setHamle(hamle + 1);
      const [birinci, ikinci] = yeniSecilenler;
      if (kartlar[birinci].eslestirmeId === kartlar[ikinci].eslestirmeId) {
        playSound("correctWord");
        setTimeout(() => {
          const eslesmisKartlar = [...yeniKartlar];
          eslesmisKartlar[birinci].eslesti = true;
          eslesmisKartlar[ikinci].eslesti = true;
          setKartlar(eslesmisKartlar);
          setSecilenKartlar([]);
          if (eslesmisKartlar.every((kart) => kart.eslesti)) {
            setOyunBitti(true);
            setOyunBasladi(false);
          }
        }, 600);
      } else {
        playSound("wrongWord");
        setTimeout(() => {
          const kapaliKartlar = [...yeniKartlar];
          kapaliKartlar[birinci].acik = false;
          kapaliKartlar[ikinci].acik = false;
          setKartlar(kapaliKartlar);
          setSecilenKartlar([]);
        }, 1000);
      }
    }
  };

  const kazandi = oyunBitti && kartlar.length > 0 && kartlar.every((k) => k.eslesti);

  // FLIP: puzzleAciliyor true olduğunda kartlar 4x6 grid'e geçer; ilk pozisyondan
  // yeni hedef pozisyona doğru yumuşakça uçar
  useLayoutEffect(() => {
    if (!puzzleAciliyor) return;
    const firstRects = firstRectsRef.current;
    if (!firstRects || Object.keys(firstRects).length === 0) return;

    // Yeni (last) pozisyonları ölç ve invert uygula
    Object.entries(cardRefs.current).forEach(([id, el]) => {
      if (!el) return;
      const first = firstRects[Number(id)];
      if (!first) return;
      const last = el.getBoundingClientRect();
      const dx = first.left - last.left;
      const dy = first.top - last.top;
      const sx = first.width / Math.max(last.width, 1);
      const sy = first.height / Math.max(last.height, 1);

      el.style.transition = "none";
      el.style.transformOrigin = "top left";
      el.style.transform = `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})`;
    });

    // Sonraki frame'de hedefe doğru kayma animasyonu (kelime yüzleri görünür)
    const slideDuration = 900;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        Object.values(cardRefs.current).forEach((el) => {
          if (!el) return;
          const delay = Math.random() * 180;
          el.style.transition = `transform ${slideDuration}ms cubic-bezier(0.34, 1.2, 0.4, 1) ${delay}ms`;
          el.style.transform = "translate(0px, 0px) scale(1, 1)";
        });
      });
    });

    // Kayma bittikten sonra sırayla (gorselParca 0 → 23) kartları çevir → resim açılsın
    const timeouts: ReturnType<typeof setTimeout>[] = [];
    const startFlipsAfter = slideDuration + 250;
    const sorted = [...kartlar].sort((a, b) => a.gorselParca - b.gorselParca);
    sorted.forEach((kart, i) => {
      timeouts.push(
        setTimeout(() => {
          setFlipRevealedIds((prev) => {
            const next = new Set(prev);
            next.add(kart.id);
            return next;
          });
          playSound("buttonClick");
        }, startFlipsAfter + i * 110)
      );
    });

    return () => timeouts.forEach(clearTimeout);
  }, [puzzleAciliyor]);



  if (challengeLoading) {
    return (
      <div
        className="fixed inset-0 flex items-center justify-center"
        style={{ background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)" }}
      >
        <div className="w-8 h-8 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 flex flex-col text-slate-100 font-sans overflow-hidden"
      style={{ background: "linear-gradient(135deg, #1a1028 0%, #2d1b4e 50%, #1a1040 100%)" }}
    >
      {/* Header */}
      <div className="px-5 pt-12 pb-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              playSound("buttonClick");
              requestExit(() => navigate(-1), !oyunBasladi || oyunBitti);
            }}
            className="w-10 h-10 rounded-xl bg-white/10 border border-white/10 flex items-center justify-center active:scale-90 transition-transform"
          >
            <ArrowLeft className="w-5 h-5 text-white" />
          </button>
          <div>
            <h1 className="text-lg font-black text-white">Kelime Hafıza</h1>
            <p className="text-[10px] text-purple-400/80">Kelimeleri karışık halleriyle eşleştir</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <GameMuteButton gameId="memory" size={40} />
          <button
            onClick={() => setShowLeaderboard(!showLeaderboard)}
            className="w-10 h-10 rounded-xl bg-white/10 border border-white/10 flex items-center justify-center active:scale-90 transition-transform"
          >
            <Trophy className="w-5 h-5 text-amber-400" />
          </button>
        </div>
      </div>

      <div className="flex-1 flex flex-col overflow-hidden px-5 pb-8">
        {showLeaderboard ? (
          <div className="flex-1 flex flex-col min-h-0 mt-4">
            <ChallengeLeaderboard
              leaderboard={leaderboard}
              title="Günlük Hafıza Sıralaması"
              scrollable
              showCompletionOnly
            />
            <button
              onClick={() => setShowLeaderboard(false)}
              className="mt-3 shrink-0 px-6 py-3 bg-white/10 border border-white/10 rounded-2xl font-bold text-white active:scale-95 transition-transform text-sm"
            >
              Oyuna Dön
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-4 mt-2 flex-1 overflow-y-auto">

            {/* Start screen */}
            {!oyunBasladi && kartlar.length === 0 && !oyunBitti && (
              <div className="flex flex-col items-center gap-4 mt-8">
                <div className="bg-white/10 p-4 rounded-xl backdrop-blur-sm border border-white/10 w-full">
                  <div className="text-center">
                    <div className="flex justify-center mb-3">
                      {beyinAnim ? (
                        <Lottie animationData={beyinAnim} loop autoplay style={{ width: 120, height: 120 }} />
                      ) : (
                        <div className="text-4xl">🧠</div>
                      )}
                    </div>
                    <h2 className="text-xl font-bold text-white mb-2">Kelime Hafıza Oyunu</h2>
                    <p className="text-sm text-white/60 mb-1">5x5 Izgara • {SURE} saniye</p>
                    <p className="text-xs text-yellow-300/80 flex items-center justify-center gap-1">
                      <Zap className="w-3 h-3" />
                      Düzgün kelimeyi karışık haliyle eşleştir
                    </p>
                    <p className="text-xs text-purple-300/80 mt-1 flex items-center justify-center gap-1">
                      🖼️ Tüm çiftleri bul, gizli görsel ortaya çıksın!
                    </p>
                    <p className="text-xs text-green-300/80 mt-2">🎡 Tamamlarsan +1 çark çevirme hakkı!</p>
                  </div>
                </div>

                {hasPlayedToday ? (
                  <div className="p-4 bg-white/5 border border-white/10 rounded-xl text-center w-full flex flex-col items-center gap-3">
                    <span className="text-sm text-slate-400">Bugün zaten oynadın! Yarın tekrar gel 🕐</span>
                    {todayScore != null && todayScore > 0 && (
                      <div className="text-amber-400 font-bold">Skorun: {todayScore}</div>
                    )}
                    <div className="text-xs text-purple-300/80">🖼️ Bugün açtığın görsel</div>
                    <div className="w-full rounded-xl overflow-hidden border border-white/10 shadow-lg shadow-purple-900/40 bg-black/30">
                      <img
                        src={dailyImage}
                        alt="Günün özlü sözü"
                        className="w-full h-auto block"
                        loading="lazy"
                      />
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => {
                      oyunuBaslat();
                      playSound("buttonClick");
                    }}
                    disabled={gameLoading || wordList.length === 0}
                    className="w-full py-4 bg-gradient-to-r from-purple-500 to-indigo-600 rounded-2xl font-bold text-white text-lg active:scale-95 transition-transform disabled:opacity-50 shadow-lg shadow-purple-500/30"
                  >
                    {gameLoading ? "Hazırlanıyor..." : "🚀 Başlat"}
                  </button>
                )}
              </div>
            )}

            {/* Stats */}
            {oyunBasladi && (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className={`flex items-center gap-1.5 text-white/80 ${kalanSure <= 10 ? "animate-pulse" : ""}`}>
                    <Clock size={14} />
                    <span
                      className={`text-sm font-mono tabular-nums tracking-tight ${kalanSure <= 10 ? "text-red-400" : ""}`}
                      style={{
                        fontVariantNumeric: "tabular-nums",
                        minWidth: "3ch",
                        display: "inline-block",
                        WebkitTransform: "translateZ(0)",
                        transform: "translateZ(0)",
                      }}
                    >
                      {Math.floor(kalanSure / 60)}:{(kalanSure % 60).toString().padStart(2, "0")}
                    </span>
                  </div>
                  <span className="text-sm text-white/80">
                    Hamle: <span className="font-bold text-white">{hamle}</span>
                  </span>
                </div>
                <span className="text-sm text-white/80">
                  Çift:{" "}
                  <span className="font-bold text-white">
                    {kartlar.filter((k) => k.eslesti).length / 2}/{GRID_PAIRS}
                  </span>
                </span>
              </div>
            )}

            {/* Game Over */}
            {oyunBitti && (
              <div
                className={`p-4 rounded-xl text-center ${kazandi ? "bg-green-500/20 border border-green-400/30" : "bg-red-500/20 border border-red-400/30"}`}
              >
                {kazandi ? (
                  <>
                    <Trophy className="w-10 h-10 text-green-400 mx-auto mb-2" />
                    <div className="text-green-400 font-bold text-lg">🎉 Tebrikler!</div>
                    <div className="text-white/80 text-sm mt-1">{hamle} hamlede tamamladın!</div>
                    <div className="text-amber-400 font-bold text-lg mt-2">
                      Skor: {SURE - kalanSure > 0 ? (10000 / ((SURE - kalanSure) * hamle)).toFixed(2) : 0}
                    </div>
                    <div className="text-purple-300 text-xs mt-2 animate-pulse">🖼️ Gizli görsel açılıyor...</div>
                    <div className="text-green-300 text-xs mt-1">🎡 +1 çark çevirme hakkı gün sonunda verilecek!</div>
                  </>
                ) : (
                  <>
                    <Clock className="w-10 h-10 text-red-400 mx-auto mb-2" />
                    <div className="text-red-400 font-bold text-lg">Süre Doldu! ⏱️</div>
                    <div className="text-white/80 text-sm">
                      {kartlar.filter((k) => k.eslesti).length / 2} çift eşleştirdin
                    </div>
                  </>
                )}
              </div>
            )}

            {/* ===================== KART GRİD ===================== */}
            {kartlar.length > 0 && (
              <div
                className={`grid gap-2 ${puzzleAciliyor ? "grid-cols-4" : "grid-cols-5"}`}
                style={{ overflow: "visible", position: "relative" }}
              >
                {kartlar.map((kart, index) => {
                  // Kart arka yüzü: görselin bu karta düşen karışık parçası
                  const imageSliceStyle = getImageSliceStyle(kart.gorselParca, dailyImage, 4, 6);

                  // Puzzle modunda kartı gorselParca pozisyonuna sabitle (4x6)
                  const puzzlePlacement: React.CSSProperties = puzzleAciliyor
                    ? {
                        gridColumnStart: (kart.gorselParca % 4) + 1,
                        gridRowStart: Math.floor(kart.gorselParca / 4) + 1,
                      }
                    : {};

                  return (
                    <div
                      key={`${kart.kelime}-${kart.id}`}
                      ref={(el) => {
                        cardRefs.current[kart.id] = el;
                      }}
                      onClick={() => !puzzleAciliyor && kartTikla(index)}
                      className="aspect-square relative cursor-pointer"
                      style={{
                        perspective: "1000px",
                        position: "relative",
                        ...puzzlePlacement,
                      }}
                    >
                      <div
                        className={`w-full h-full relative transition-transform duration-500 ${
                          (!puzzleAciliyor && (kart.acik || kart.eslesti)) ||
                          (puzzleAciliyor && !flipRevealedIds.has(kart.id))
                            ? "[transform:rotateY(180deg)]"
                            : ""
                        }`}
                        style={{
                          transformStyle: "preserve-3d",
                          WebkitTransformStyle: "preserve-3d" as any,
                          willChange: "transform",
                        }}
                      >
                        {/* ===== KART ARKASI: Görselin parçası ===== */}
                        <div
                          className="absolute inset-0 w-full h-full border-2 border-white/50 overflow-hidden"
                          style={{
                            backfaceVisibility: "hidden",
                            WebkitBackfaceVisibility: "hidden" as any,
                            borderRadius: puzzleAciliyor ? 0 : 10,
                            transition: "border-radius 600ms ease",
                            ...imageSliceStyle,
                          }}
                        >
                          {/* Resim açılmadan önce overlay (gameplay ve slide sırasında) */}
                          {!flipRevealedIds.has(kart.id) && (
                            <div className="absolute inset-0 bg-purple-950/70" />
                          )}
                          {/* Köşe dekorasyon (sadece oyun sırasında) */}
                          {!puzzleAciliyor && (
                            <div className="absolute inset-0 flex items-center justify-center">
                              <div className="w-7 h-7 rounded-full bg-white/20 border border-white/40 flex items-center justify-center">
                                <div className="w-3 h-3 rounded-full bg-purple-300" />
                              </div>
                            </div>
                          )}
                        </div>


                        {/* ===== KART ÖNÜ: Kelime ===== */}
                        <div
                          className={`absolute inset-0 w-full h-full rounded-lg border border-white/20 flex items-center justify-center bg-gradient-to-br ${kart.renk} ${
                            kart.eslesti && !puzzleAciliyor ? "opacity-20 scale-95" : ""
                          } transition-all duration-300 [transform:rotateY(180deg)]`}
                          style={{ backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden" as any }}
                        >
                          <div
                            className={`text-white font-extrabold px-0.5 text-center leading-tight tracking-tight uppercase break-words [text-shadow:0_1px_2px_rgba(0,0,0,0.6)] ${
                              kart.kelime.length > 8
                                ? "text-[11px]"
                                : kart.kelime.length > 6
                                ? "text-[13px]"
                                : kart.kelime.length > 4
                                ? "text-[15px]"
                                : "text-[17px]"
                            }`}
                          >
                            {kart.kelime}
                          </div>
                          {kart.eslesti && (
                            <div className="absolute inset-0 bg-green-500/20 rounded-lg flex items-center justify-center">
                              <div className="text-2xl">✓</div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}




            {/* Home button */}
            {(oyunBitti || hasPlayedToday) && (
              <button
                onClick={() => {
                  playSound("buttonClick");
                  navigate(homeBackPath());
                }}
                className="shrink-0 px-6 py-3 bg-white/10 border border-white/10 rounded-2xl font-bold text-white active:scale-95 transition-transform text-sm"
              >
                Ana Sayfa
              </button>
            )}
          </div>
        )}
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }
      `}</style>


      {ExitConfirmDialog}
    </div>
  );
};

export default WordMemoryGame;
