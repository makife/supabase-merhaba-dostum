import { useCallback, useEffect, useState } from "react";
import Lottie from "lottie-react";
import { homeBackPath } from "@/utils/challengeBackPath";
import { useNavigate } from "react-router-dom";
import { Home, Users, Plus, RefreshCw } from "lucide-react";
import { TournamentCard } from "@/components/TournamentCard";
import CreateTournamentDialog from "@/components/CreateTournamentDialog";
import { useTournamentContext } from "@/contexts/TournamentContext";
import { useUser } from "@/contexts/UserContext";
import { usePageResync } from "@/hooks/useGlobalResync";
import { useSounds } from "@/hooks/useSounds";
import { toast } from "sonner";

const TournamentPage = () => {
  const navigate = useNavigate();
  const { playSound } = useSounds();
  const { tournaments, loading, createTournament, joinTournament, fetchTournaments, hasLeftTournament } =
    useTournamentContext();
  const { profile, isPremium } = useUser();

  const [kupaAnim, setKupaAnim] = useState<any>(null);
  const [isListRefreshing, setIsListRefreshing] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  useEffect(() => {
    fetch("/kupajson.json").then(r => r.json()).then(setKupaAnim).catch(console.error);
  }, []);
  useEffect(() => {
    fetchTournaments();
  }, []);

  // 🔄 Global Resync Hook
  usePageResync(fetchTournaments, "TournamentPage", true);

  const handleOpenCreate = () => {
    playSound("buttonClick");
    const totalCredits = (profile?.game_credits || 0) + (profile?.bonus_credits || 0);
    if (!isPremium && totalCredits < 3) {
      toast.error("Yetersiz oyun sayfası!", {
        description: `Turnuva için en az 3 sayfa gerekli. Mevcut: ${totalCredits}`,
        duration: 4000,
      });
      return;
    }
    setCreateOpen(true);
  };

  const handleConfirmCreate = async (opts: { name: string; avatarUrl: string | null; isPrivate: boolean }) => {
    const tournamentId = await createTournament(opts);
    if (tournamentId) {
      setCreateOpen(false);
      navigate(`/tournament/waiting/${tournamentId}`);
    }
  };

  const handleJoinTournament = async (tournamentId: string) => {
    const totalCredits = (profile?.game_credits || 0) + (profile?.bonus_credits || 0);
    if (!isPremium && totalCredits < 3) {
      toast.error("Yetersiz oyun sayfası!", {
        description: `Turnuva için en az 3 sayfa gerekli. Mevcut: ${totalCredits}`,
        duration: 4000,
      });
      return;
    }
    const success = await joinTournament(tournamentId);
    if (success) {
      navigate(`/tournament/waiting/${tournamentId}`);
    }
  };

  const handleTournamentExpired = useCallback(() => {
    void fetchTournaments();
  }, [fetchTournaments]);

  const handleRefreshTournaments = useCallback(async () => {
    if (isListRefreshing) return;
    playSound("buttonClick");
    setIsListRefreshing(true);
    try {
      await fetchTournaments();
    } finally {
      setIsListRefreshing(false);
    }
  }, [fetchTournaments, isListRefreshing, playSound]);

  return (
    <div
      className="fixed inset-0 flex flex-col text-slate-100 overflow-hidden"
      style={{ background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)" }}
    >
      {/* Arka plan ışık efekti */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_var(--tw-gradient-stops))] from-amber-500/10 via-transparent to-transparent pointer-events-none opacity-40" />

      {/* Arka plan turnuva görseli */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <img
          src="/turnuvaBracket.webp"
          alt=""
          className="absolute top-0 left-1/2 -translate-x-1/2 w-[120%] max-w-2xl opacity-5"
        />
      </div>

      {/* ── HEADER ── */}
      <div
        className="flex-none z-10 px-5 pt-6 pb-4 border-b border-white/5 shadow-xl"
        style={{ backgroundColor: "#1a1a2e" }}
      >
        <div className="flex items-center justify-between">
          {/* Ana Sayfa butonu */}
          <button
            onClick={() => { playSound("buttonClick"); navigate(homeBackPath()); }}
            className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/8 ring-1 ring-white/10 active:scale-90 transition-transform hover:bg-white/12"
          >
            <Home className="w-4 h-4 text-white/70" />
            <span className="text-xs font-semibold text-white/70">Ana Sayfa</span>
          </button>

          {/* Başlık */}
          <div className="flex items-center gap-2">
            <div className="w-1 h-5 bg-amber-400 rounded-full" />
            <h1 className="text-sm font-black text-white uppercase tracking-widest">Turnuvalar</h1>
          </div>

          {/* Yenile butonu */}
          <button
            onClick={handleRefreshTournaments}
            disabled={isListRefreshing}
            className="w-10 h-10 rounded-xl bg-white/8 ring-1 ring-white/10 flex items-center justify-center active:scale-90 transition-transform hover:bg-white/12 disabled:opacity-40"
          >
            <RefreshCw className={`w-4 h-4 text-white/70 ${isListRefreshing ? "animate-spin" : ""}`} />
          </button>
        </div>

        {/* Alt yazı */}
        <p className="text-[11px] text-slate-400 text-center mt-3">8 oyunculu heyecan dolu turnuvalara katıl!</p>
      </div>

      {/* ── SCROLLABLE İÇERİK ── */}
      <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4 pb-8 relative z-10">
        {/* Turnuva Oluştur Kartı */}
        <div className="bg-[#16213e]/80 ring-1 ring-white/10 rounded-3xl overflow-hidden shadow-xl">
          <div className="px-5 pt-5 pb-4 border-b border-white/5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-1 h-5 bg-amber-400 rounded-full" />
                <h2 className="text-sm font-black text-white uppercase tracking-widest">Yeni Turnuva</h2>
              </div>
              {kupaAnim && (
                <Lottie animationData={kupaAnim} loop autoplay style={{ width: 40, height: 40 }} />
              )}
            </div>
          </div>
          <div className="px-4 py-4">
            <div
              onClick={!loading ? handleOpenCreate : undefined}
              className={`flex items-center gap-3 cursor-pointer rounded-2xl px-3 py-3 ring-1 transition-colors duration-150 active:scale-95 shadow-[0_2px_12px_rgba(0,0,0,0.3)]
                ${
                  loading
                    ? "bg-white/4 ring-white/5 opacity-50 cursor-not-allowed"
                    : "bg-amber-500/10 ring-amber-500/20 hover:bg-amber-500/15"
                }`}
            >
              <span className="w-1.5 h-1.5 rounded-full flex-shrink-0 bg-amber-400" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white/95">
                  {loading ? "Oluşturuluyor..." : "Yeni Turnuva Oluştur"}
                </p>
                <p className="text-[11px] text-slate-400">Kendi turnuvanı oluştur ve davet et</p>
              </div>
              <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 bg-amber-500/20 text-amber-300">
                <Plus className="w-4 h-4" />
              </div>
            </div>
          </div>
        </div>

        {/* Aktif Turnuvalar */}
        <div className="bg-[#16213e]/80 ring-1 ring-white/10 rounded-3xl overflow-hidden shadow-xl">
          <div className="px-5 pt-5 pb-4 border-b border-white/5">
            <div className="flex items-center gap-2">
              <div className="w-1 h-5 bg-indigo-400 rounded-full" />
              <h2 className="text-sm font-black text-white uppercase tracking-widest">Aktif Turnuvalar</h2>
            </div>
          </div>

          <div className="px-4 py-4">
            {loading && tournaments.length === 0 ? (
              <div className="flex flex-col items-center py-8 gap-3">
                <div className="w-8 h-8 rounded-full border-2 border-white/10 border-t-amber-400 animate-spin" />
                <p className="text-xs text-slate-400 uppercase tracking-widest">Yükleniyor</p>
              </div>
            ) : tournaments.length === 0 ? (
              <div className="flex flex-col items-center py-10 gap-3">
                <div className="w-16 h-16 rounded-2xl bg-white/5 ring-1 ring-white/10 flex items-center justify-center">
                  <Users className="w-8 h-8 text-slate-500" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-semibold text-white/70 mb-1">Aktif Turnuva Yok</p>
                  <p className="text-[11px] text-slate-500">İlk turnuvayı sen oluştur!</p>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                {tournaments.map((tournament) => (
                  <TournamentCard
                    key={tournament.id}
                    tournament={tournament}
                    onJoin={handleJoinTournament}
                    disabled={loading}
                    hasLeft={hasLeftTournament(tournament.id)}
                    onExpired={handleTournamentExpired}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Turnuva Kuralları */}
        <div className="bg-[#16213e]/80 ring-1 ring-white/10 rounded-3xl overflow-hidden shadow-xl">
          <div className="px-5 pt-5 pb-4 border-b border-white/5">
            <div className="flex items-center gap-2">
              <div className="w-1 h-5 bg-rose-400 rounded-full" />
              <h2 className="text-sm font-black text-white uppercase tracking-widest">Turnuva Kuralları</h2>
            </div>
          </div>
          <div className="px-5 py-4 space-y-2.5">
            {[
              { dot: "bg-blue-400", text: "Her turnuvada maksimum 8 oyuncu katılabilir" },
              { dot: "bg-purple-400", text: "Yetersiz oyuncu durumunda botlar otomatik eklenir" },
              { dot: "bg-amber-400", text: "Turnuva 3 aşamada tamamlanır: Çeyrek Final → Yarı Final → Final" },
              { dot: "bg-cyan-400", text: "Her maç zamana karşı oynanır (2 dakika)" },
              { dot: "bg-red-400", text: "Turnuva başladıktan sonra katılım mümkün değildir" },
            ].map((rule, i) => (
              <div key={i} className="flex items-start gap-2.5">
                <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 mt-1.5 ${rule.dot}`} />
                <p className="text-xs text-slate-300 leading-relaxed">{rule.text}</p>
              </div>
            ))}
          </div>
          <div className="h-2" />
        </div>
      </div>

      <CreateTournamentDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        loading={loading}
        onCreate={handleConfirmCreate}
      />
    </div>
  );
};

export default TournamentPage;
