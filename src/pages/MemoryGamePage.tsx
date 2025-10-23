import React, { useState, useEffect } from "react";
import { RefreshCw, Trophy, Star, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useMemoryGame } from "@/hooks/useMemoryGame";

interface Kart {
  id: number;
  symbol: string;
  acik: boolean;
  eslesti: boolean;
  renk: string;
}

const MemoryGamePage: React.FC = () => {
  const navigate = useNavigate();
  const { canPlay, timeUntilNextPlay, loading, completeGame } = useMemoryGame();
  const [kartlar, setKartlar] = useState<Kart[]>([]);
  const [secilenKartlar, setSecilenKartlar] = useState<number[]>([]);
  const [hamle, setHamle] = useState(0);
  const [oyunBitti, setOyunBitti] = useState(false);
  const [gameLoading, setGameLoading] = useState(false);

  // Kart sembolleri ve renkleri
  const semboller = ["🎮", "🎯", "🎨", "🎪", "🎭", "🎸", "🎲", "🎊"];
  const renkler = [
    "from-purple-400 to-purple-600",
    "from-blue-400 to-blue-600",
    "from-green-400 to-green-600",
    "from-yellow-400 to-yellow-600",
    "from-red-400 to-red-600",
    "from-pink-400 to-pink-600",
    "from-indigo-400 to-indigo-600",
    "from-orange-400 to-orange-600",
  ];

  // Oyunu başlat
  const oyunuBaslat = () => {
    if (!canPlay) return;

    setGameLoading(true);

    // Kartları oluştur (her sembolden 2 tane)
    const yeniKartlar: Kart[] = [];
    semboller.forEach((symbol, index) => {
      for (let i = 0; i < 2; i++) {
        yeniKartlar.push({
          id: index * 2 + i,
          symbol,
          acik: false,
          eslesti: false,
          renk: renkler[index],
        });
      }
    });

    // Kartları karıştır
    const karisikKartlar = yeniKartlar.sort(() => Math.random() - 0.5);

    setTimeout(() => {
      setKartlar(karisikKartlar);
      setSecilenKartlar([]);
      setHamle(0);
      setOyunBitti(false);
      setGameLoading(false);
    }, 500);
  };

  // Kart tıklama işlemi
  const kartTikla = (kartIndex: number) => {
    if (secilenKartlar.length === 2) return;
    if (kartlar[kartIndex].acik || kartlar[kartIndex].eslesti) return;

    const yeniKartlar = [...kartlar];
    yeniKartlar[kartIndex].acik = true;
    setKartlar(yeniKartlar);

    const yeniSecilenler = [...secilenKartlar, kartIndex];
    setSecilenKartlar(yeniSecilenler);

    if (yeniSecilenler.length === 2) {
      setHamle(hamle + 1);

      const [birinci, ikinci] = yeniSecilenler;

      if (kartlar[birinci].symbol === kartlar[ikinci].symbol) {
        // Eşleşti!
        setTimeout(() => {
          const eslesmisKartlar = [...yeniKartlar];
          eslesmisKartlar[birinci].eslesti = true;
          eslesmisKartlar[ikinci].eslesti = true;
          setKartlar(eslesmisKartlar);
          setSecilenKartlar([]);

          // Tüm kartlar eşleşti mi kontrol et
          if (eslesmisKartlar.every((kart) => kart.eslesti)) {
            setOyunBitti(true);
            // Joker ver
            completeGame(hamle + 1);
          }
        }, 600);
      } else {
        // Eşleşmedi, kartları kapat
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

  // Oyun başladığında kartları oluştur
  useEffect(() => {
    if (canPlay && !loading) {
      oyunuBaslat();
    }
  }, [canPlay, loading]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900 p-4">
      <div className="max-w-md mx-auto">
        {/* Geri Dön Butonu */}
        <div className="mb-4">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-white/80 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            Geri Dön
          </button>
        </div>

        {/* Başlık */}
        <div className="text-center mb-6">
          <h1 className="text-3xl font-bold text-white mb-2 flex items-center justify-center gap-2">
            🤔 Hafıza Oyunu 🤔
          </h1>
          <p className="text-purple-200">
            {canPlay ? "Aynı kartları bulup eşleştir!" : "24 saatte bir oynayabilirsin!"}
          </p>
          {!canPlay && timeUntilNextPlay && (
            <p className="text-yellow-300 text-sm mt-1">Sonraki oyun: {timeUntilNextPlay}</p>
          )}
        </div>

        {/* Loading State */}
        {loading && (
          <div className="text-center mb-6">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
            <p className="text-white mt-2">Kontrol ediliyor...</p>
          </div>
        )}

        {/* Can't Play State */}
        {!loading && !canPlay && (
          <div className="text-center mb-6 bg-white/10 backdrop-blur-sm rounded-lg p-6">
            <Trophy className="w-16 h-16 text-yellow-400 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-white mb-2">Oyunu Tamamladın! 🎉</h2>
            <p className="text-purple-200 mb-2">24 saat sonra tekrar oynayabilirsin</p>
            {timeUntilNextPlay && <p className="text-yellow-300 font-semibold">Kalan süre: {timeUntilNextPlay}</p>}
          </div>
        )}

        {/* Skorlar */}
        {canPlay && !loading && (
          <div className="flex justify-between items-center mb-6 bg-white/10 backdrop-blur-sm rounded-lg p-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-white">{hamle}</div>
              <div className="text-sm text-purple-200">Hamle</div>
            </div>
            <button
              onClick={oyunuBaslat}
              disabled={gameLoading || !canPlay}
              className="bg-gradient-to-r from-green-500 to-blue-500 hover:from-green-600 hover:to-blue-600 
                     disabled:opacity-50 text-white px-4 py-2 rounded-lg flex items-center gap-2 
                     transform transition-all duration-200 hover:scale-105 active:scale-95"
            >
              <RefreshCw className={`w-4 h-4 ${gameLoading ? "animate-spin" : ""}`} />
              {gameLoading ? "Hazırlanıyor..." : "Yeni Oyun"}
            </button>
            <div className="text-center">
              <div className="text-2xl font-bold text-white">{kartlar.filter((kart) => kart.eslesti).length / 2}</div>
              <div className="text-sm text-purple-200">Çift</div>
            </div>
          </div>
        )}

        {/* Oyun Tamamlandı Mesajı */}
        {oyunBitti && canPlay && (
          <div className="text-center mb-6 bg-gradient-to-r from-yellow-400 to-orange-500 rounded-lg p-4 transform animate-bounce">
            <Trophy className="w-12 h-12 text-white mx-auto mb-2" />
            <h2 className="text-2xl font-bold text-white">Tebrikler! 🎉</h2>
            <p className="text-white">Oyunu {hamle} hamlede tamamladın ve joker kazandın!</p>
          </div>
        )}

        {/* Kart İzgarası */}
        {canPlay && !loading && (
          <div className="grid grid-cols-4 gap-3 mb-6">
            {kartlar.map((kart, index) => (
              <div
                key={`${kart.symbol}-${kart.id}`}
                onClick={() => kartTikla(index)}
                className="aspect-square relative cursor-pointer transform transition-all duration-300 hover:scale-105"
                style={{ perspective: "1000px" }}
              >
                <div
                  className={`w-full h-full relative transform-style-preserve-3d transition-transform duration-600 ${
                    kart.acik || kart.eslesti ? "rotate-y-180" : ""
                  }`}
                >
                  {/* Kart Arka Yüzü */}
                  <div className="absolute inset-0 w-full h-full backface-hidden bg-gradient-to-br from-purple-600 to-indigo-600 rounded-lg border-2 border-white/30 flex items-center justify-center">
                    <div className="text-2xl">🎪</div>
                  </div>

                  {/* Kart Ön Yüzü */}
                  <div
                    className={`absolute inset-0 w-full h-full backface-hidden rotate-y-180 rounded-lg border-2 border-white/30 flex items-center justify-center bg-gradient-to-br ${kart.renk} ${
                      kart.eslesti ? "opacity-20 scale-95" : ""
                    } transition-all duration-300`}
                  >
                    <div className={`text-3xl ${kart.eslesti ? "grayscale" : ""}`}>{kart.symbol}</div>

                    {/* Eşleşme Efekti */}
                    {kart.eslesti && (
                      <div className="absolute inset-0 bg-green-500/20 rounded-lg flex items-center justify-center">
                        <div className="text-4xl">✓</div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default MemoryGamePage;
