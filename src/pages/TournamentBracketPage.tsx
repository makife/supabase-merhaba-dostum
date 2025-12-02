import { useState, useEffect, useMemo, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Trophy, Home, Clock, Crown, Users, Loader2 } from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { useTournament } from "@/hooks/useTournament";
import { organizeMatchesByRound, generateBotName, getMatchStatus } from "@/utils/tournamentHelpers";
import { useAuth } from "@/contexts/AuthContext";
import { useSounds } from "@/hooks/useSounds";
import { supabase } from "@/integrations/supabase/client";

const TournamentBracketPage = () => {
  const { tournamentId } = useParams();
  const navigate = useNavigate();
  const { currentTournament, matches, fetchTournamentDetails, serverTimeOffset } = useTournament(tournamentId);
  const { user } = useAuth();
  const { playSpecialSound } = useSounds();

  const [countdown, setCountdown] = useState<number | null>(null);
  const [lobbyCountdown, setLobbyCountdown] = useState<number | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [showChampion, setShowChampion] = useState(false);
  const [showEliminated, setShowEliminated] = useState(false);
  const [isNavigating, setIsNavigating] = useState(false);
  const startTriggeredRef = useRef(false);

  // 1. Verileri sürekli güncel tut
  useEffect(() => {
    if (tournamentId) {
      fetchTournamentDetails(tournamentId);
    }
  }, [tournamentId]);

  // =========================================================================
  // ⚠️ DÜZELTME BURADA: useMemo TÜM RETURN'LERDEN ÖNCE OLMAK ZORUNDA
  // =========================================================================
  const uniqueMatches = useMemo(() => {
    if (!matches) return []; // Güvenlik kontrolü
    const map = new Map<string, any>();
    for (const m of matches) {
      const key = `${m.round}-${m.match_number}`;
      map.set(key, m);
    }
    return Array.from(map.values());
  }, [matches]);

  const matchesByRound = organizeMatchesByRound(uniqueMatches);
  // =========================================================================

  // A. LOBİ MANTIĞI
  useEffect(() => {
    if (!currentTournament || currentTournament.status !== "waiting" || startTriggeredRef.current) return;

    const interval = setInterval(() => {
      const now = Date.now() + serverTimeOffset;
      const expiresAt = new Date(currentTournament.expires_at).getTime();
      const diff = Math.ceil((expiresAt - now) / 1000);

      if (diff > 0) {
        setLobbyCountdown(diff);
      } else {
        clearInterval(interval);
        setLobbyCountdown(0);

        if (!startTriggeredRef.current) {
          startTriggeredRef.current = true;
          setIsStarting(true);
          console.log("🚀 Lobi süresi doldu, turnuva başlatılıyor...");

          supabase.rpc("start_tournament_structure" as any, { p_tournament_id: tournamentId }).then(({ error }) => {
            setIsStarting(false);
            if (error) {
              console.error("Turnuva başlatma hatası:", error);
              startTriggeredRef.current = false;
            } else {
              console.log("✅ Turnuva başarıyla başlatıldı!");
            }
          });
        }
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [currentTournament, serverTimeOffset, tournamentId]);

  // B. MAÇ GERİ SAYIM MANTIĞI
  useEffect(() => {
    if (!currentTournament || currentTournament.status !== "in_progress") {
      setCountdown(null);
      return;
    }

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
        handleAutoNavigation();
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [currentTournament, serverTimeOffset, matches, user]);

  const handleAutoNavigation = () => {
    if (!user || isNavigating || !matches || !currentTournament) return;

    const currentRound = currentTournament.current_round;

    const myMatch = matches.find(
      (m) =>
        m.round === currentRound &&
        (m.status === "pending" || m.status === "in_progress") &&
        (m.player1_id === user.id || m.player2_id === user.id),
    );

    if (myMatch) {
      console.log(`🚀 Süre doldu! Maç ${myMatch.match_number} için yönlendiriliyor...`);
      setIsNavigating(true);
      playSpecialSound("/button.mp3");
      navigate(`/game?match=${myMatch.id}&tournament=${tournamentId}`);
    }
  };

  // C. ŞAMPİYONLUK VE ELENME
  useEffect(() => {
    if (!matches || !user) return;

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

  // =========================================================================
  // D. RENDER (RETURN BLOKLARI BURADA BAŞLAR)
  // =========================================================================

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

  // --- LOBİ EKRANI ---
  if (currentTournament.status === "waiting") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 to-indigo-900 p-4 flex items-center justify-center">
        <Card className="w-full max-w-md bg-white/10 backdrop-blur-md border-white/20 text-white shadow-2xl">
          <CardContent className="p-8 text-center space-y-6">
            <Users className="w-16 h-16 mx-auto text-blue-400 animate-pulse" />

            <div className="space-y-2">
              <h1 className="text-3xl font-bold">{currentTournament.name}</h1>
              <p className="text-blue-200">Oyuncular bekleniyor...</p>
            </div>

            <div className="py-6">
              <div className="text-6xl font-mono font-black tracking-widest text-yellow-400 drop-shadow-lg">
                {lobbyCountdown !== null ? lobbyCountdown : "..."}
              </div>
              <p className="text-sm text-gray-400 mt-2">saniye sonra başlıyor</p>
            </div>

            {isStarting && (
              <div className="flex items-center justify-center gap-2 text-yellow-300">
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Turnuva oluşturuluyor...</span>
              </div>
            )}

            <div className="bg-black/30 rounded-lg p-4 text-left">
              <p className="text-sm text-gray-300 mb-2">ℹ️ Bilgi:</p>
              <ul className="text-xs text-gray-400 space-y-1 list-disc pl-4">
                <li>Süre bitince boş yerler botlarla dolar.</li>
                <li>Maçlar otomatik başlar.</li>
                <li>Turnuva süresince uygulamayı kapatmayın.</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Şampiyon Ekranı
  if (showChampion) {
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
    const getPlayerDisplay = (playerId: string, playerInfo: any) => {
      if (!playerId) return { name: "...", isBot: false };
      const isBot = playerInfo?.is_bot || false;

      if (isBot) {
        const seed = playerId.charCodeAt(0) + playerId.charCodeAt(playerId.length - 1);
        const name = playerInfo?.username || generateBotName(seed);
        return { name, isBot: true };
      }
      return { name: playerInfo?.username || "Oyuncu", isBot: false, avatar: playerInfo?.avatar_url };
    };

    const p1 = getPlayerDisplay(match.player1_id, match.player1);
    const p2 = getPlayerDisplay(match.player2_id, match.player2);
    const isCompleted = match.status === "completed";

    const colors = {
      1: "from-purple-900/50 to-blue-900/50 border-purple-500/30",
      2: "from-orange-900/50 to-red-900/50 border-orange-500/30",
      3: "from-yellow-900/50 to-amber-900/50 border-yellow-500/30",
    }[roundNumber];

    return (
      <Card
        className={`mb-4 backdrop-blur-md bg-gradient-to-br ${colors} border text-white overflow-hidden relative shadow-lg`}
      >
        <div className="absolute top-2 right-2 text-[10px] px-2 py-0.5 rounded-full bg-black/40 border border-white/10">
          {match.status === "completed" ? "Bitti" : match.status === "in_progress" ? "Oynanıyor" : "Bekliyor"}
        </div>

        <CardContent className="p-3 pt-6">
          {/* Player 1 */}
          <div
            className={`flex justify-between items-center p-2 rounded mb-1 transition-colors ${match.winner_id === match.player1_id ? "bg-green-500/20 border border-green-500/50" : "bg-black/20"}`}
          >
            <div className="flex items-center gap-2">
              <Avatar className="w-6 h-6 border border-white/20">
                <AvatarImage src={p1.avatar} />
                <AvatarFallback className="text-black text-[10px] bg-white/80">{p1.isBot ? "🤖" : "👤"}</AvatarFallback>
              </Avatar>
              <span
                className={`text-sm truncate max-w-[100px] ${match.winner_id === match.player1_id ? "font-bold text-green-300" : "text-gray-300"}`}
              >
                {p1.name}
              </span>
            </div>
            <span className="font-mono font-bold text-lg">{isCompleted ? match.player1_score : "-"}</span>
          </div>

          {/* Player 2 */}
          <div
            className={`flex justify-between items-center p-2 rounded transition-colors ${match.winner_id === match.player2_id ? "bg-green-500/20 border border-green-500/50" : "bg-black/20"}`}
          >
            <div className="flex items-center gap-2">
              <Avatar className="w-6 h-6 border border-white/20">
                <AvatarImage src={p2.avatar} />
                <AvatarFallback className="text-black text-[10px] bg-white/80">{p2.isBot ? "🤖" : "👤"}</AvatarFallback>
              </Avatar>
              <span
                className={`text-sm truncate max-w-[100px] ${match.winner_id === match.player2_id ? "font-bold text-green-300" : "text-gray-300"}`}
              >
                {p2.name}
              </span>
            </div>
            <span className="font-mono font-bold text-lg">{isCompleted ? match.player2_score : "-"}</span>
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
          <div className="w-24" />
        </div>

        {/* ⏰ MAÇ BAŞLANGIÇ GERİ SAYIMI */}
        {countdown !== null && countdown > 0 && currentTournament.status === "in_progress" && (
          <div className="fixed top-24 left-1/2 -translate-x-1/2 z-50 w-full max-w-sm px-4">
            <Card className="bg-yellow-500 text-black shadow-[0_0_50px_rgba(234,179,8,0.6)] border-4 border-yellow-300 transform scale-110 animate-pulse">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="font-bold text-xs uppercase opacity-80 mb-1">
                    {currentTournament.current_round === 1
                      ? "Çeyrek Final"
                      : currentTournament.current_round === 2
                        ? "Yarı Final"
                        : "Büyük Final"}
                  </p>
                  <p className="font-bold text-lg leading-none">MAÇLAR BAŞLIYOR</p>
                </div>
                <div className="text-5xl font-black font-mono tracking-tighter">{countdown}</div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Bracket Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[1, 2, 3].map((round) => (
            <div key={round} className="space-y-4">
              <div
                className={`text-center py-3 rounded-xl font-black text-white uppercase tracking-widest bg-white/5 border border-white/10 shadow-lg ${currentTournament.current_round === round ? "ring-2 ring-yellow-500 text-yellow-400 bg-yellow-500/10" : "opacity-40 grayscale"}`}
              >
                {round === 1 ? "Çeyrek Final" : round === 2 ? "Yarı Final" : "🏆 Final"}
              </div>

              <div className="space-y-4">
                {matchesByRound[round]?.map((match) => (
                  <MatchCard key={match.id} match={match} roundNumber={round} />
                ))}

                {(!matchesByRound[round] || matchesByRound[round].length === 0) && (
                  <div className="text-center py-12 text-gray-600 italic text-sm border-2 border-dashed border-gray-700 rounded-xl bg-black/20">
                    Eşleşmeler Bekleniyor...
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
