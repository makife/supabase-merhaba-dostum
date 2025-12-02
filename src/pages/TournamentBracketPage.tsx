import { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Trophy, Home, Clock, Crown } from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { useTournament } from "@/hooks/useTournament";
import { organizeMatchesByRound, getMatchStatus, generateBotName } from "@/utils/tournamentHelpers";
import { useAuth } from "@/contexts/AuthContext";
import { useSounds } from "@/hooks/useSounds";

const TournamentBracketPage = () => {
  const { tournamentId } = useParams();
  const navigate = useNavigate();
  // useTournament hook'unun next_round_starts_at verisini çektiğinden emin ol
  const { currentTournament, matches, fetchTournamentDetails, serverTimeOffset } = useTournament(tournamentId);
  const { user } = useAuth();
  const { playSpecialSound } = useSounds();

  const [countdown, setCountdown] = useState<number | null>(null);
  const [showChampion, setShowChampion] = useState(false);
  const [showEliminated, setShowEliminated] = useState(false);
  const [isNavigating, setIsNavigating] = useState(false);

  // 1. Verileri sürekli güncel tut (Realtime zaten hook içinde var ama manuel refresh de ekleyelim)
  useEffect(() => {
    if (tournamentId) {
      fetchTournamentDetails(tournamentId);
    }
  }, [tournamentId]);

  // 2. OTOMATİK GERİ SAYIM VE YÖNLENDİRME MOTORU (Kalp Atışı)
  useEffect(() => {
    if (!currentTournament || currentTournament.status !== "in_progress") {
      setCountdown(null);
      return;
    }

    // Veritabanındaki hedef zamanı al
    const targetTimeStr = currentTournament.next_round_starts_at;

    if (!targetTimeStr) {
      setCountdown(0);
      return;
    }

    const interval = setInterval(() => {
      const now = Date.now() + serverTimeOffset;
      const targetTime = new Date(targetTimeStr).getTime();
      const diff = Math.ceil((targetTime - now) / 1000);

      if (diff > 0) {
        setCountdown(diff);
      } else {
        setCountdown(0);
        handleAutoNavigation(); // Süre bitti, yönlendirmeyi dene
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [currentTournament, serverTimeOffset, matches, user]);

  // 3. Yönlendirme Mantığı
  const handleAutoNavigation = () => {
    if (!user || isNavigating || !matches || !currentTournament) return;

    const currentRound = currentTournament.current_round;

    // Benim bu turda, henüz tamamlanmamış bir maçım var mı?
    const myMatch = matches.find(
      (m) =>
        m.round === currentRound &&
        (m.status === "pending" || m.status === "in_progress") &&
        (m.player1_id === user.id || m.player2_id === user.id),
    );

    if (myMatch) {
      console.log(`🚀 Süre doldu! Maç ${myMatch.match_number} için yönlendiriliyor...`);
      setIsNavigating(true);

      // Ses efekti
      playSpecialSound("/button.mp3"); // Varsa bir başlangıç sesi

      // Yönlendirme
      navigate(`/game?match=${myMatch.id}&tournament=${tournamentId}`);
    }
  };

  // 4. Şampiyonluk ve Elenme Kontrolü
  useEffect(() => {
    if (!matches || !user) return;

    // Final maçını bul
    const finalMatch = matches.find((m) => m.round === 3 && m.status === "completed");

    if (finalMatch && finalMatch.winner_id) {
      const amIWinner = finalMatch.winner_id === user.id;
      const wasIInFinal = finalMatch.player1_id === user.id || finalMatch.player2_id === user.id;

      if (amIWinner && !showChampion) {
        setShowChampion(true);
        playSpecialSound("/sampiyon.mp3", 0.8);
      } else if (wasIInFinal && !amIWinner && !showEliminated) {
        setShowEliminated(true);
      }
    }
  }, [matches, user]);

  // Yükleniyor durumu
  if (!currentTournament) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 to-blue-900 p-4 flex items-center justify-center">
        <div className="text-white text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
          <p>Turnuva verileri yükleniyor...</p>
        </div>
      </div>
    );
  }

  // Bracket Görselleştirme Yardımcıları
  const uniqueMatches = useMemo(() => {
    const map = new Map<string, any>();
    for (const m of matches) {
      const key = `${m.round}-${m.match_number}`;
      map.set(key, m); // Basitçe en son geleni al, zaten sıralı geliyor
    }
    return Array.from(map.values());
  }, [matches]);

  const matchesByRound = organizeMatchesByRound(uniqueMatches);

  // Şampiyon Ekranı
  if (showChampion) {
    // ... (Senin mevcut şampiyon kodunla aynı) ...
    const finalMatch = matches.find((m) => m.round === 3);
    const championId = finalMatch?.winner_id;
    // const championName = championId === finalMatch?.player1_id ? finalMatch?.player1?.username : finalMatch?.player2?.username;
    // Basitleştirilmiş isim bulma (User ID'den profile bakmak gerekebilir, şimdilik basit tuttum)

    return (
      <div className="min-h-screen bg-gradient-to-br from-yellow-600 to-orange-600 p-4 flex items-center justify-center">
        <div className="text-center">
          <Crown className="w-24 h-24 text-yellow-200 mx-auto mb-6 animate-bounce" />
          <h1 className="text-6xl font-bold text-white mb-4">Şampiyon!</h1>
          <p className="text-white text-lg mb-6">Tebrikler, turnuvanın galibi sensin!</p>
          <Button onClick={() => navigate("/tournament")} className="bg-white text-orange-600 hover:bg-gray-100">
            Turnuva Listesi
          </Button>
        </div>
      </div>
    );
  }

  // Elenme Ekranı
  if (showEliminated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-600 to-purple-600 p-4 flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">😢</div>
          <h1 className="text-4xl font-bold text-white mb-4">Finalde Elendiniz</h1>
          <p className="text-white text-lg mb-6">Harika bir mücadeleydi!</p>
          <Button onClick={() => navigate("/tournament")} className="bg-white text-red-600 hover:bg-gray-100">
            Turnuva Listesi
          </Button>
        </div>
      </div>
    );
  }

  // MatchCard Bileşeni
  const MatchCard = ({ match, roundNumber }: { match: any; roundNumber: number }) => {
    // Helper: Oyuncu bilgilerini al
    const getPlayerDisplay = (playerId: string, playerInfo: any) => {
      // Eğer ID yoksa "Bekleniyor"
      if (!playerId) return { name: "...", isBot: false };

      // Bot kontrolü (Database'den gelen is_bot veya ID kontrolü)
      // Artık UUID kullandığımız için sadece playerInfo.is_bot'a güvenmeliyiz
      // Ancak eski veriler için fallback olarak 'bot_' kontrolü kalabilir
      const isBot = playerInfo?.is_bot || playerId.startsWith("bot_");

      if (isBot) {
        // İsmi playerInfo'dan al yoksa üret
        const name = playerInfo?.username || generateBotName(playerId.charCodeAt(0));
        return { name, isBot: true };
      }

      return { name: playerInfo?.username || "Oyuncu", isBot: false, avatar: playerInfo?.avatar_url };
    };

    const p1 = getPlayerDisplay(match.player1_id, match.player1);
    const p2 = getPlayerDisplay(match.player2_id, match.player2);
    const isCompleted = match.status === "completed";

    // Renkler
    const colors = {
      1: "from-purple-900/50 to-blue-900/50 border-purple-500/30",
      2: "from-orange-900/50 to-red-900/50 border-orange-500/30",
      3: "from-yellow-900/50 to-amber-900/50 border-yellow-500/30",
    }[roundNumber];

    return (
      <Card className={`mb-4 backdrop-blur-md bg-gradient-to-br ${colors} border text-white overflow-hidden relative`}>
        {/* Maç Durumu Badge'i */}
        <div className="absolute top-2 right-2 text-[10px] px-2 py-0.5 rounded-full bg-black/40">
          {match.status === "completed" ? "Bitti" : match.status === "in_progress" ? "Oynanıyor" : "Bekliyor"}
        </div>

        <CardContent className="p-3">
          {/* Player 1 */}
          <div
            className={`flex justify-between items-center p-2 rounded ${match.winner_id === match.player1_id ? "bg-green-500/20 border border-green-500/50" : ""}`}
          >
            <div className="flex items-center gap-2">
              <Avatar className="w-6 h-6">
                <AvatarImage src={p1.avatar} />
                <AvatarFallback className="text-black text-xs">{p1.isBot ? "🤖" : "👤"}</AvatarFallback>
              </Avatar>
              <span
                className={`text-sm ${match.winner_id === match.player1_id ? "font-bold text-green-300" : "text-gray-200"}`}
              >
                {p1.name}
              </span>
            </div>
            <span className="font-mono font-bold">{isCompleted ? match.player1_score : "-"}</span>
          </div>

          {/* VS */}
          <div className="text-[10px] text-center text-gray-500 -my-1 relative z-10">VS</div>

          {/* Player 2 */}
          <div
            className={`flex justify-between items-center p-2 rounded ${match.winner_id === match.player2_id ? "bg-green-500/20 border border-green-500/50" : ""}`}
          >
            <div className="flex items-center gap-2">
              <Avatar className="w-6 h-6">
                <AvatarImage src={p2.avatar} />
                <AvatarFallback className="text-black text-xs">{p2.isBot ? "🤖" : "👤"}</AvatarFallback>
              </Avatar>
              <span
                className={`text-sm ${match.winner_id === match.player2_id ? "font-bold text-green-300" : "text-gray-200"}`}
              >
                {p2.name}
              </span>
            </div>
            <span className="font-mono font-bold">{isCompleted ? match.player2_score : "-"}</span>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 p-4">
      <div className="max-w-6xl mx-auto">
        {/* Üst Bar */}
        <div className="flex items-center justify-between mb-8">
          <Button variant="ghost" className="text-white hover:bg-white/10" onClick={() => navigate("/tournament")}>
            <Home className="w-5 h-5 mr-2" /> Ana Menü
          </Button>
          <div className="text-center">
            <h1 className="text-2xl font-bold text-white">{currentTournament.name}</h1>
            <p className="text-gray-400 text-sm">Turnuva Tablosu</p>
          </div>
          <div className="w-24" /> {/* Spacer */}
        </div>

        {/* ⏰ SENKRONİZE GERİ SAYIM KARTI */}
        {countdown !== null && countdown > 0 && (
          <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-top-10 fade-in duration-500">
            <Card className="bg-yellow-500 text-black shadow-[0_0_50px_rgba(234,179,8,0.6)] border-4 border-yellow-300">
              <CardContent className="p-4 flex items-center gap-4">
                <Clock className="w-10 h-10 animate-pulse" />
                <div>
                  <p className="font-bold text-sm uppercase opacity-80">
                    {currentTournament.current_round === 1
                      ? "Çeyrek Final"
                      : currentTournament.current_round === 2
                        ? "Yarı Final"
                        : "Büyük Final"}{" "}
                    Başlıyor
                  </p>
                  <p className="text-4xl font-black font-mono tracking-widest">{countdown}</p>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Bracket Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[1, 2, 3].map((round) => (
            <div key={round} className="space-y-4">
              {/* Round Başlığı */}
              <div
                className={`text-center py-2 rounded-lg font-bold text-white uppercase tracking-wider bg-white/5 border border-white/10 ${currentTournament.current_round === round ? "ring-2 ring-yellow-500 text-yellow-500 bg-yellow-500/10" : "opacity-50"}`}
              >
                {round === 1 ? "Çeyrek Final" : round === 2 ? "Yarı Final" : "Final"}
              </div>

              {/* Maçlar */}
              <div className="space-y-4">
                {matchesByRound[round]?.map((match) => (
                  <MatchCard key={match.id} match={match} roundNumber={round} />
                ))}

                {(!matchesByRound[round] || matchesByRound[round].length === 0) && (
                  <div className="text-center py-8 text-gray-600 italic text-sm border-2 border-dashed border-gray-700 rounded-lg">
                    Henüz eşleşme yok
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default TournamentBracketPage;
