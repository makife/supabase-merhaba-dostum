import React, { useState, useEffect } from "react";
import { Trophy, ArrowLeft, Zap, Clock } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useDailyChallenge } from "@/hooks/useDailyChallenge";
import { ChallengeLeaderboard } from "@/components/ChallengeLeaderboard";
import { useSounds } from "@/hooks/useSounds";
import { toast } from "sonner";

interface Kart {
  id: number;
  kelime: string;
  tip: "duzgun" | "karisik";
  acik: boolean;
  eslesti: boolean;
  renk: string;
  eslestirmeId: number;
}

const GRID_PAIRS = 12; // 12 çift = 24 kart = ~5x5 (1 boş)
const SURE = 90;

const WordMemoryGame = () => {
  const navigate = useNavigate();
  const { playSound } = useSounds();
  const { hasPlayedToday, todayScore, leaderboard, loading: challengeLoading, saveScore, markAsPlayed } = useDailyChallenge("memory");

  const [kartlar, setKartlar] = useState<Kart[]>([]);
  const [secilenKartlar, setSecilenKartlar] = useState<number[]>([]);
  const [hamle, setHamle] = useState(0);
  const [oyunBitti, setOyunBitti] = useState(false);
  const [gameLoading, setGameLoading] = useState(false);
  const [kalanSure, setKalanSure] = useState(SURE);
  const [oyunBasladi, setOyunBasladi] = useState(false);
  const [wordList, setWordList] = useState<string[]>([]);
  const [showLeaderboard, setShowLeaderboard] = useState(false);

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
        setWordList(["BAHÇE", "KALEM", "DÜNYA", "GÜNEŞ", "DENIZ", "YILDIZ", "ÇIÇEK", "KITAP", "PENCERE", "KAHVE", "MÜZIK", "OYUN"]);
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

  // Save score when completed
  useEffect(() => {
    if (!oyunBitti) return;
    const kazandi = kartlar.length > 0 && kartlar.every((k) => k.eslesti);
    if (kazandi && hamle > 0) {
      const timeSpent = SURE - kalanSure;
      const rawScore = timeSpent > 0 ? parseFloat((10000 / (timeSpent * hamle)).toFixed(2)) : 0;
      saveScore(rawScore, hamle);
      markAsPlayed();
      toast.success("🎡 Tebrikler! Gün sonunda +1 çark çevirme hakkı kazanacaksın!", { duration: 5000 });
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

  const ilkKartAcildiRef = React.useRef(false);

  const oyunuBaslat = () => {
    if (wordList.length === 0 || hasPlayedToday) return;
    ilkKartAcildiRef.current = false;
    setGameLoading(true);

    const secilenKelimeler = rastgeleKelimeAl(GRID_PAIRS);
    const kartToplamSayisi = GRID_PAIRS * 2;
    const kullanilacakRenkler = [];
    for (let i = 0; i < kartToplamSayisi; i++) {
      kullanilacakRenkler.push(renkler[i % renkler.length]);
    }
    const karisikRenkler = kullanilacakRenkler.sort(() => Math.random() - 0.5);

    const yeniKartlar: Kart[] = [];
    secilenKelimeler.forEach((kelime, index) => {
      const karisikKelime = harfleriKaristir(kelime);
      yeniKartlar.push({
        id: index * 2, kelime, tip: "duzgun", acik: false, eslesti: false,
        renk: karisikRenkler[index * 2], eslestirmeId: index,
      });
      yeniKartlar.push({
        id: index * 2 + 1, kelime: karisikKelime, tip: "karisik", acik: false, eslesti: false,
        renk: karisikRenkler[index * 2 + 1], eslestirmeId: index,
      });
    });

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

  if (challengeLoading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center" style={{ background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)" }}>
        <div className="w-8 h-8 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="fixed inset-0 flex flex-col text-slate-100 font-sans overflow-hidden" style={{ background: "linear-gradient(135deg, #1a1028 0%, #2d1b4e 50%, #1a1040 100%)" }}>
      {/* Header */}
      <div className="px-5 pt-12 pb-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => { navigate(-1); playSound("buttonClick"); }} className="w-10 h-10 rounded-xl bg-white/10 border border-white/10 flex items-center justify-center active:scale-90 transition-transform">
            <ArrowLeft className="w-5 h-5 text-white" />
          </button>
          <div>
            <h1 className="text-lg font-black text-white">🧠 Kelime Hafıza</h1>
            <p className="text-[10px] text-purple-400/80">Kelimeleri karışık halleriyle eşleştir</p>
          </div>
        </div>
        <button onClick={() => setShowLeaderboard(!showLeaderboard)} className="w-10 h-10 rounded-xl bg-white/10 border border-white/10 flex items-center justify-center active:scale-90 transition-transform">
          <Trophy className="w-5 h-5 text-amber-400" />
        </button>
      </div>

      <div className="flex-1 flex flex-col overflow-hidden px-5 pb-8">
        {showLeaderboard ? (
          <div className="flex-1 flex flex-col min-h-0 mt-4">
            <ChallengeLeaderboard leaderboard={leaderboard} title="Günlük Hafıza Sıralaması" scrollable />
            <button onClick={() => setShowLeaderboard(false)} className="mt-3 shrink-0 px-6 py-3 bg-white/10 border border-white/10 rounded-2xl font-bold text-white active:scale-95 transition-transform text-sm">
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
                    <div className="text-4xl mb-3">🧠</div>
                    <h2 className="text-xl font-bold text-white mb-2">Kelime Hafıza Oyunu</h2>
                    <p className="text-sm text-white/60 mb-1">5x5 Izgara • {SURE} saniye</p>
                    <p className="text-xs text-yellow-300/80 flex items-center justify-center gap-1">
                      <Zap className="w-3 h-3" />
                      Düzgün kelimeyi karışık haliyle eşleştir
                    </p>
                    <p className="text-xs text-green-300/80 mt-2">🎡 Tamamlarsan +1 çark çevirme hakkı!</p>
                  </div>
                </div>

                {hasPlayedToday ? (
                  <div className="p-4 bg-white/5 border border-white/10 rounded-xl text-center w-full">
                    <span className="text-sm text-slate-400">Bugün zaten oynadın! Yarın tekrar gel 🕐</span>
                    {todayScore != null && todayScore > 0 && (
                      <div className="text-amber-400 font-bold mt-2">Skorun: {todayScore}</div>
                    )}
                  </div>
                ) : (
                  <button
                    onClick={() => { oyunuBaslat(); playSound("buttonClick"); }}
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
                  <div className="flex items-center gap-1.5 text-white/80">
                    <Clock size={14} />
                    <span className={`text-sm font-mono ${kalanSure <= 10 ? "text-red-400 animate-pulse" : ""}`}>
                      {Math.floor(kalanSure / 60)}:{(kalanSure % 60).toString().padStart(2, "0")}
                    </span>
                  </div>
                  <span className="text-sm text-white/80">Hamle: <span className="font-bold text-white">{hamle}</span></span>
                </div>
                <span className="text-sm text-white/80">Çift: <span className="font-bold text-white">{kartlar.filter((k) => k.eslesti).length / 2}/{GRID_PAIRS}</span></span>
              </div>
            )}

            {/* Game Over */}
            {oyunBitti && (
              <div className={`p-4 rounded-xl text-center ${kazandi ? "bg-green-500/20 border border-green-400/30" : "bg-red-500/20 border border-red-400/30"}`}>
                {kazandi ? (
                  <>
                    <Trophy className="w-10 h-10 text-green-400 mx-auto mb-2" />
                    <div className="text-green-400 font-bold text-lg">🎉 Tebrikler!</div>
                    <div className="text-white/80 text-sm mt-1">{hamle} hamlede tamamladın!</div>
                    <div className="text-amber-400 font-bold text-lg mt-2">
                      Skor: {((SURE - kalanSure) > 0 ? (10000 / ((SURE - kalanSure) * hamle)).toFixed(2) : 0)}
                    </div>
                    <div className="text-green-300 text-xs mt-2">🎡 +1 çark çevirme hakkı gün sonunda verilecek!</div>
                  </>
                ) : (
                  <>
                    <Clock className="w-10 h-10 text-red-400 mx-auto mb-2" />
                    <div className="text-red-400 font-bold text-lg">Süre Doldu! ⏱️</div>
                    <div className="text-white/80 text-sm">{kartlar.filter((k) => k.eslesti).length / 2} çift eşleştirdin</div>
                  </>
                )}
              </div>
            )}

            {/* Card Grid - 5 columns */}
            {kartlar.length > 0 && (
              <div className="grid grid-cols-5 gap-2">
                {kartlar.map((kart, index) => (
                  <div
                    key={`${kart.kelime}-${kart.id}`}
                    onClick={() => kartTikla(index)}
                    className="aspect-square relative cursor-pointer transform transition-all duration-300"
                    style={{ perspective: "1000px" }}
                  >
                    <div
                      className={`w-full h-full relative transition-transform duration-500 ${kart.acik || kart.eslesti ? "[transform:rotateY(180deg)]" : ""}`}
                      style={{ transformStyle: "preserve-3d" }}
                    >
                      <div
                        className="absolute inset-0 w-full h-full bg-gradient-to-br from-purple-600 to-indigo-600 rounded-lg border border-white/20 flex items-center justify-center"
                        style={{ backfaceVisibility: "hidden" }}
                      >
                        <div className="text-2xl">📝</div>
                      </div>
                      <div
                        className={`absolute inset-0 w-full h-full rounded-lg border border-white/20 flex items-center justify-center bg-gradient-to-br ${kart.renk} ${kart.eslesti ? "opacity-20 scale-95" : ""} transition-all duration-300 [transform:rotateY(180deg)]`}
                        style={{ backfaceVisibility: "hidden" }}
                      >
                        <div className={`text-white font-bold px-1 text-center break-all ${kart.kelime.length > 6 ? "text-[8px]" : kart.kelime.length > 5 ? "text-[9px]" : "text-[10px]"}`}>
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
                ))}
              </div>
            )}

            {/* Home button */}
            {(oyunBitti || hasPlayedToday) && (
              <button onClick={() => navigate("/")} className="shrink-0 px-6 py-3 bg-white/10 border border-white/10 rounded-2xl font-bold text-white active:scale-95 transition-transform text-sm">
                Ana Sayfa
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default WordMemoryGame;
