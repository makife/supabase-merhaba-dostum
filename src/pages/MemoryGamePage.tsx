import React, { useState, useEffect } from "react";
import { RefreshCw, Trophy, ArrowLeft, Zap, Clock } from "lucide-react";

interface Kart {
  id: number;
  kelime: string;
  tip: "duzgun" | "karisik";
  acik: boolean;
  eslesti: boolean;
  renk: string;
  eslestirmeId: number;
}

type Zorluk = "kolay" | "zor";

const WordMemoryGame = () => {
  const [kartlar, setKartlar] = useState<Kart[]>([]);
  const [secilenKartlar, setSecilenKartlar] = useState<number[]>([]);
  const [hamle, setHamle] = useState(0);
  const [oyunBitti, setOyunBitti] = useState(false);
  const [gameLoading, setGameLoading] = useState(false);
  const [canPlay, setCanPlay] = useState(true);
  const [zorluk, setZorluk] = useState<Zorluk>("kolay");
  const [kalanSure, setKalanSure] = useState(60);
  const [oyunBasladi, setOyunBasladi] = useState(false);
  const [wordList, setWordList] = useState<string[]>([]);

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

  // Wordlist'i yükle
  useEffect(() => {
    const loadWordList = async () => {
      try {
        const response = await fetch("/wordlist.txt");
        const text = await response.text();
        const words = text
          .split("\n")
          .map((w) => w.trim().toUpperCase())
          .filter((w) => w.length >= 4 && w.length <= 7); // 4-7 harfli kelimeler
        setWordList(words);
      } catch (error) {
        console.error("Wordlist yüklenemedi:", error);
        // Fallback kelimeler
        setWordList([
          "BAHÇE",
          "KALEM",
          "DÜNYA",
          "GÜNEŞ",
          "DENIZ",
          "YILDIZ",
          "ÇIÇEK",
          "KITAP",
          "PENCERE",
          "KAHVE",
          "MÜZIK",
          "OYUN",
          "RENK",
          "HAVA",
          "BILGISAYAR",
          "TELEFON",
          "ARABA",
          "OKUL",
          "EVREN",
          "HAYAT",
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

  // Rastgele kelime seç
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

  // Kelimenin harflerini karıştır
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

  // Oyunu başlat
  const oyunuBaslat = (secilenZorluk: Zorluk) => {
    if (wordList.length === 0) return;

    setGameLoading(true);
    setZorluk(secilenZorluk);

    const kartSayisi = secilenZorluk === "kolay" ? 8 : 12; // 16 kart (8 çift) veya 24 kart (12 çift)
    const sure = secilenZorluk === "kolay" ? 60 : 90;

    // Rastgele kelimeler seç
    const secilenKelimeler = rastgeleKelimeAl(kartSayisi);

    // Tüm renkleri karıştır
    const kartToplamSayisi = kartSayisi * 2;
    const kullanilacakRenkler = [];
    for (let i = 0; i < kartToplamSayisi; i++) {
      kullanilacakRenkler.push(renkler[i % renkler.length]);
    }
    const karisikRenkler = kullanilacakRenkler.sort(() => Math.random() - 0.5);

    // Kartları oluştur
    const yeniKartlar: Kart[] = [];
    secilenKelimeler.forEach((kelime, index) => {
      const karisikKelime = harfleriKaristir(kelime);

      yeniKartlar.push({
        id: index * 2,
        kelime: kelime,
        tip: "duzgun",
        acik: false,
        eslesti: false,
        renk: karisikRenkler[index * 2],
        eslestirmeId: index,
      });

      yeniKartlar.push({
        id: index * 2 + 1,
        kelime: karisikKelime,
        tip: "karisik",
        acik: false,
        eslesti: false,
        renk: karisikRenkler[index * 2 + 1],
        eslestirmeId: index,
      });
    });

    const karisikKartlar = yeniKartlar.sort(() => Math.random() - 0.5);

    setTimeout(() => {
      setKartlar(karisikKartlar);
      setSecilenKartlar([]);
      setHamle(0);
      setOyunBitti(false);
      setKalanSure(sure);
      setOyunBasladi(true);
      setGameLoading(false);
    }, 500);
  };

  // Kart tıklama işlemi
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

  const gridCols = zorluk === "kolay" ? "grid-cols-4" : "grid-cols-5";
  const kazandi = oyunBitti && kartlar.length > 0 && kartlar.every((k) => k.eslesti);

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900 p-4">
      <div className="max-w-2xl mx-auto">
        {/* Geri Dön Butonu */}
        <div className="mb-4">
          <button
            onClick={() => window.history.back()}
            className="flex items-center gap-2 text-white/80 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            Geri Dön
          </button>
        </div>

        {/* Başlık */}
        <div className="text-center mb-6">
          <h1 className="text-3xl font-bold text-white mb-2 flex items-center justify-center gap-2">
            🧠 Kelime Hafıza Oyunu 🎯
          </h1>
          <p className="text-purple-200">Kelimeleri karışık halleriyle eşleştir!</p>
          <div className="mt-3 bg-white/10 backdrop-blur-sm rounded-lg p-3 inline-block">
            <p className="text-yellow-300 text-sm flex items-center gap-2">
              <Zap className="w-4 h-4" />
              İpucu: Düzgün yazılmış kelimeyi karışık haliyle eşleştir
            </p>
          </div>
        </div>

        {/* Zorluk Seçimi veya Oyun İstatistikleri */}
        {!oyunBasladi && kartlar.length === 0 ? (
          <div className="mb-6 space-y-4">
            <h2 className="text-xl font-bold text-white text-center mb-4">Zorluk Seviyesi Seç</h2>
            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={() => oyunuBaslat("kolay")}
                disabled={gameLoading || wordList.length === 0}
                className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 
                       disabled:opacity-50 text-white p-6 rounded-lg transform transition-all duration-200 
                       hover:scale-105 active:scale-95"
              >
                <div className="text-3xl mb-2">😊</div>
                <div className="font-bold text-lg">KOLAY</div>
                <div className="text-sm mt-2">4x4 Izgara</div>
                <div className="text-sm flex items-center justify-center gap-1 mt-1">
                  <Clock className="w-4 h-4" />
                  60 saniye
                </div>
              </button>

              <button
                onClick={() => oyunuBaslat("zor")}
                disabled={gameLoading || wordList.length === 0}
                className="bg-gradient-to-r from-red-500 to-orange-600 hover:from-red-600 hover:to-orange-700 
                       disabled:opacity-50 text-white p-6 rounded-lg transform transition-all duration-200 
                       hover:scale-105 active:scale-95"
              >
                <div className="text-3xl mb-2">🔥</div>
                <div className="font-bold text-lg">ZOR</div>
                <div className="text-sm mt-2">5x5 Izgara</div>
                <div className="text-sm flex items-center justify-center gap-1 mt-1">
                  <Clock className="w-4 h-4" />
                  90 saniye
                </div>
              </button>
            </div>
            {gameLoading && (
              <div className="text-center">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
                <p className="text-white mt-2">Kelimeler hazırlanıyor...</p>
              </div>
            )}
          </div>
        ) : (
          <>
            {/* Skorlar ve Süre */}
            {oyunBasladi && (
              <div className="flex justify-between items-center mb-6 bg-white/10 backdrop-blur-sm rounded-lg p-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-white">{hamle}</div>
                  <div className="text-sm text-purple-200">Hamle</div>
                </div>

                <div className="text-center">
                  <div
                    className={`text-2xl font-bold flex items-center gap-2 ${
                      kalanSure <= 10 ? "text-red-400 animate-pulse" : "text-white"
                    }`}
                  >
                    <Clock className="w-6 h-6" />
                    {Math.floor(kalanSure / 60)}:{(kalanSure % 60).toString().padStart(2, "0")}
                  </div>
                  <div className="text-sm text-purple-200">Süre</div>
                </div>

                <div className="text-center">
                  <div className="text-2xl font-bold text-white">
                    {kartlar.filter((kart) => kart.eslesti).length / 2}
                  </div>
                  <div className="text-sm text-purple-200">Çift</div>
                </div>
              </div>
            )}

            {/* Oyun Tamamlandı veya Süre Doldu */}
            {oyunBitti && (
              <div
                className={`text-center mb-6 rounded-lg p-4 ${
                  kazandi
                    ? "bg-gradient-to-r from-yellow-400 to-orange-500 transform animate-bounce"
                    : "bg-gradient-to-r from-gray-600 to-gray-700"
                }`}
              >
                {kazandi ? (
                  <>
                    <Trophy className="w-12 h-12 text-white mx-auto mb-2" />
                    <h2 className="text-2xl font-bold text-white">Tebrikler! 🎉</h2>
                    <p className="text-white">Oyunu {hamle} hamlede tamamladın!</p>
                    <p className="text-white/90 text-sm mt-1">
                      {zorluk === "kolay" ? "Kolay mod" : "Zor mod"} - {kalanSure} saniye kaldı
                    </p>
                  </>
                ) : (
                  <>
                    <Clock className="w-12 h-12 text-white mx-auto mb-2" />
                    <h2 className="text-2xl font-bold text-white">Süre Doldu! ⏱️</h2>
                    <p className="text-white">{kartlar.filter((k) => k.eslesti).length / 2} çift eşleştirdin</p>
                  </>
                )}
                <button
                  onClick={() => {
                    setKartlar([]);
                    setOyunBasladi(false);
                  }}
                  className="mt-4 bg-white text-purple-900 px-6 py-2 rounded-lg font-bold 
                         hover:bg-purple-100 transition-all"
                >
                  Yeni Oyun
                </button>
              </div>
            )}

            {/* Kart Izgarası */}
            {kartlar.length > 0 && (
              <div className={`grid ${gridCols} gap-3 mb-6`}>
                {kartlar.map((kart, index) => (
                  <div
                    key={`${kart.kelime}-${kart.id}`}
                    onClick={() => kartTikla(index)}
                    className="aspect-square relative cursor-pointer transform transition-all duration-300 hover:scale-105"
                    style={{ perspective: "1000px" }}
                  >
                    <div
                      className={`w-full h-full relative transition-transform duration-600 ${
                        kart.acik || kart.eslesti ? "[transform:rotateY(180deg)]" : ""
                      }`}
                      style={{ transformStyle: "preserve-3d" }}
                    >
                      {/* Kart Arka Yüzü */}
                      <div
                        className="absolute inset-0 w-full h-full bg-gradient-to-br from-purple-600 to-indigo-600 rounded-lg border-2 border-white/30 flex items-center justify-center"
                        style={{ backfaceVisibility: "hidden" }}
                      >
                        <div className="text-3xl">📝</div>
                      </div>

                      {/* Kart Ön Yüzü */}
                      <div
                        className={`absolute inset-0 w-full h-full rounded-lg border-2 border-white/30 flex items-center justify-center bg-gradient-to-br ${kart.renk} ${
                          kart.eslesti ? "opacity-20 scale-95" : ""
                        } transition-all duration-300 [transform:rotateY(180deg)]`}
                        style={{ backfaceVisibility: "hidden" }}
                      >
                        {/* Kelime */}
                        <div
                          className={`text-white font-bold px-2 text-center break-all ${
                            kart.kelime.length > 6 ? "text-xs" : kart.kelime.length > 5 ? "text-sm" : "text-base"
                          } ${kart.eslesti ? "grayscale" : ""}`}
                        >
                          {kart.kelime}
                        </div>

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
          </>
        )}

        {/* Oyun Kuralları */}
        <div className="bg-white/5 backdrop-blur-sm rounded-lg p-4 text-sm text-purple-200">
          <h3 className="font-bold text-white mb-2">🎮 Nasıl Oynanır?</h3>
          <ul className="space-y-1 list-disc list-inside">
            <li>Her kelime 2 kartta bulunur: biri düzgün, biri karışık</li>
            <li>BAHÇE ve AHBEÇ gibi eşleşmeleri bul</li>
            <li>Süre dolmadan tüm çiftleri eşleştir!</li>
            <li>Kolay: 4x4 ızgara, 60 saniye</li>
            <li>Zor: 5x5 ızgara, 90 saniye</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default WordMemoryGame;
