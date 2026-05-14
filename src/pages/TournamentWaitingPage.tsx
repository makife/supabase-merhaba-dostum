import { useEffect, useCallback, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import Lottie from "lottie-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Users, Bot, User, ArrowLeft, Trophy, Crown } from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { TournamentCountdown } from "@/components/TournamentCountdown";
import { useTournament } from "@/hooks/useTournament";
import { usePageResync } from "@/hooks/useGlobalResync";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

const TournamentWaitingPage = () => {
  const { tournamentId } = useParams();
  const navigate = useNavigate();
  const [yukleniyorAnim, setYukleniyorAnim] = useState<any>(null);

  useEffect(() => {
    fetch("/turnuvaYukleniyor.json")
      .then((r) => r.json())
      .then(setYukleniyorAnim)
      .catch(console.error);
  }, []);

  const {
    currentTournament,
    participants,
    loading,
    timeLeft,
    isCreator,
    hasJoined,
    realPlayerCount,
    fetchTournamentDetails,
    leaveTournament,
    joinTournament,
  } = useTournament(tournamentId);

  // 🔄 Global Resync Hook
  const handleResync = useCallback(() => {
    if (tournamentId) {
      console.log("🔄 [TournamentWaitingPage] Resync triggered");
      fetchTournamentDetails(tournamentId);
    }
  }, [tournamentId, fetchTournamentDetails]);

  usePageResync(handleResync, "TournamentWaitingPage", true);

  useEffect(() => {
    if (tournamentId) {
      fetchTournamentDetails(tournamentId);
    }
  }, [tournamentId]);

  // Turnuva başladıysa bracket sayfasına yönlendir
  useEffect(() => {
    if (currentTournament?.status === "in_progress" && tournamentId) {
      navigate(`/tournament/bracket/${tournamentId}`);
    }
  }, [currentTournament?.status, tournamentId, navigate]);

  const handleLeave = async () => {
    await leaveTournament();
  };

  // Loading ekranı
  if (loading || !currentTournament) {
    return (
      <div
        className="fixed inset-0 flex flex-col items-center justify-center"
        style={{ background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)" }}
      >
        {yukleniyorAnim ? (
          <Lottie animationData={yukleniyorAnim} loop autoplay style={{ width: 80, height: 80 }} />
        ) : (
          <div className="w-12 h-12 rounded-full border-2 border-white/20 border-t-amber-400 animate-spin mb-4" />
        )}
        <p className="text-white/60 text-sm font-medium uppercase tracking-widest">Turnuva yükleniyor</p>
      </div>
    );
  }

  const realPlayers = participants.filter((p) => !p.is_bot);
  const bots = participants.filter((p) => p.is_bot);
  const emptySlots = 8 - participants.length;

  return (
    <div
      className="fixed inset-0 flex flex-col text-slate-100 overflow-hidden"
      style={{ background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)" }}
    >
      {/* Arka plan ışık efekti */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_var(--tw-gradient-stops))] from-amber-500/10 via-transparent to-transparent pointer-events-none opacity-40" />

      {/* ── HEADER ── */}
      <div
        className="flex-none z-10 px-5 pt-6 pb-4 border-b border-white/5 shadow-xl"
        style={{ backgroundColor: "#1a1a2e" }}
      >
        <div className="flex items-center justify-between">
          {/* Geri butonu */}
          <button
            onClick={handleLeave}
            className="w-10 h-10 rounded-xl bg-white/8 ring-1 ring-white/10 flex items-center justify-center active:scale-90 transition-transform"
          >
            <ArrowLeft className="w-5 h-5 text-white/70" />
          </button>

          {/* Başlık */}
          <div className="flex items-center gap-2">
            <div className="w-1 h-5 bg-amber-400 rounded-full" />
            <h1 className="text-sm font-black text-white uppercase tracking-widest truncate max-w-[180px]">
              {currentTournament.name}
            </h1>
          </div>

          {/* Ayrıl butonu */}
          <button
            onClick={handleLeave}
            className="px-3 py-2 rounded-xl text-xs font-bold text-red-300 bg-red-500/10 ring-1 ring-red-500/20 active:scale-90 transition-transform hover:bg-red-500/15"
          >
            Ayrıl
          </button>
        </div>
      </div>

      {/* ── SCROLLABLE İÇERİK ── */}
      <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4 pb-8 relative z-10">
        {/* Countdown */}
        <div className="bg-[#16213e]/80 ring-1 ring-white/10 rounded-3xl p-5 shadow-xl">
          <TournamentCountdown
            timeLeft={timeLeft}
            realPlayerCount={realPlayerCount}
            totalParticipants={participants.length}
            isCreator={isCreator}
          />
        </div>

        {/* Katılımcılar */}
        <div className="bg-[#16213e]/80 ring-1 ring-white/10 rounded-3xl overflow-hidden shadow-xl">
          {/* Başlık */}
          <div className="px-5 pt-5 pb-4 border-b border-white/5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-1 h-5 bg-indigo-400 rounded-full" />
              <h3 className="text-sm font-black text-white uppercase tracking-widest">Katılımcılar</h3>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 ring-1 ring-emerald-500/20 px-2 py-1 rounded-lg">
                {realPlayerCount} Oyuncu
              </span>
              {bots.length > 0 && (
                <span className="text-xs text-slate-400 bg-white/5 ring-1 ring-white/10 px-2 py-1 rounded-lg">
                  {bots.length} Bot
                </span>
              )}
            </div>
          </div>

          {/* Liste */}
          <div className="px-4 py-3 space-y-2 max-h-64 overflow-y-auto">
            {/* Gerçek oyuncular */}
            {realPlayers.map((participant) => (
              <div
                key={participant.id}
                className="flex items-center gap-3 px-3 py-2.5 rounded-2xl bg-emerald-500/8 ring-1 ring-emerald-500/15"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0" />
                <Avatar className="w-9 h-9 flex-shrink-0" showFrame={true}>
                  <AvatarImage src={participant.profiles?.avatar_url || undefined} />
                  <AvatarFallback className="bg-emerald-500/20 text-emerald-300 text-xs font-bold">
                    {participant.profiles?.username?.charAt(0)?.toUpperCase() || "?"}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-white/95 truncate">
                      {participant.profiles?.username || "Oyuncu"}
                    </span>
                    {participant.user_id === currentTournament.creator_id && (
                      <span className="flex items-center gap-1 text-[9px] font-bold text-amber-900 bg-amber-400 px-1.5 py-0.5 rounded-full flex-shrink-0">
                        <Crown className="w-2.5 h-2.5" />
                        KURUCU
                      </span>
                    )}
                  </div>
                </div>
                <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wide flex-shrink-0">
                  Oyuncu
                </span>
              </div>
            ))}

            {/* Botlar */}
            {bots.map((participant) => (
              <div
                key={participant.id}
                className="flex items-center gap-3 px-3 py-2.5 rounded-2xl bg-white/4 ring-1 ring-white/8"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-slate-500 flex-shrink-0" />
                <div className="w-9 h-9 rounded-full bg-slate-500/20 ring-1 ring-white/10 flex items-center justify-center flex-shrink-0">
                  <Bot className="w-4 h-4 text-slate-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium text-slate-400 truncate">
                    {participant.profiles?.username || "Bot"}
                  </span>
                </div>
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide flex-shrink-0">Bot</span>
              </div>
            ))}

            {/* Boş slotlar */}
            {Array.from({ length: emptySlots }, (_, i) => (
              <div
                key={`empty-${i}`}
                className="flex items-center gap-3 px-3 py-2.5 rounded-2xl bg-white/3 ring-1 ring-white/5 opacity-40"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-slate-600 flex-shrink-0" />
                <div className="w-9 h-9 rounded-full bg-slate-700/30 border border-dashed border-slate-600 flex-shrink-0" />
                <span className="text-sm text-slate-500">Boş Slot</span>
              </div>
            ))}
          </div>

          <div className="h-3" />
        </div>
      </div>

      {/* ── İPTAL DİALOG ──
          Sadece bu sayfanın turnuvası iptal olursa açılsın (currentTournament.id === tournamentId)
          Önceki cancelled turnuva cache'de kalsa bile tetiklenmez
      */}
      <Dialog
        open={currentTournament?.status === "cancelled" && currentTournament?.id === tournamentId}
        onOpenChange={() => navigate("/tournament")}
      >
        <DialogContent
          className="w-[calc(100%-2rem)] max-w-sm rounded-3xl border-0 p-0 shadow-2xl bg-[#16213e] ring-1 ring-white/10"
          style={{ left: "50%", transform: "translateX(-50%)" }}
        >
          <div className="px-5 pt-6 pb-4 border-b border-white/5">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-1 h-5 bg-red-400 rounded-full" />
              <h2 className="text-sm font-black text-white uppercase tracking-widest">Turnuva İptal Edildi</h2>
            </div>
            <p className="text-[11px] text-slate-400 ml-3">Turnuva yeterli oyuncu olmadığı için iptal edildi.</p>
          </div>
          <div className="px-4 py-4">
            <div
              onClick={() => navigate("/tournament")}
              className="flex items-center gap-3 cursor-pointer rounded-2xl px-3 py-3 bg-white/8 ring-1 ring-white/10 hover:bg-white/12 active:scale-95 transition-all"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 flex-shrink-0" />
              <span className="flex-1 text-sm font-semibold text-white/95">Turnuvalara Dön</span>
              <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-indigo-500/20 text-indigo-300">
                <Trophy className="w-4 h-4" />
              </div>
            </div>
          </div>
          <div className="h-2" />
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TournamentWaitingPage;
