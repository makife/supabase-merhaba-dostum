import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { X } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useUser } from "@/contexts/UserContext";
import { useSounds } from "@/hooks/useSounds";
import { supabase } from "@/integrations/supabase/client";
import { useMatchmaking } from "@/contexts/NewMatchmakingContext";
import { PressableZone } from "@/components/ui/pressable-zone";
import GameModeSelector from "@/components/GameModeSelector";
import PrivateRoomCards from "@/components/PrivateRoomCards";
import { SlotMatchmaking } from "@/components/SlotMatchmaking";
import { setGameHubPath } from "@/utils/challengeBackPath";
import oyunModlariYazi from "@/assets/oyunModlariYazi.png";

const isUnlimitedLivesActive = (profile: any) => {
  if (!profile?.unlimited_lives_until) return false;
  return new Date(profile.unlimited_lives_until) > new Date();
};

const MODES = [
  { id: "random-match", title: "Rastgele Rakip" },
  { id: "tournament", title: "Turnuva" },
  { id: "vs-computer", title: "Yapay Zeka" },
  { id: "private-room", title: "Özel Oda" },
];

const GameModesPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { profile, isPremium } = useUser();
  const { playSound } = useSounds();
  const { startSearch, searchProgress, cancelSearch } = useMatchmaking();

  const [mounted, setMounted] = useState(false);
  const [selectedMode, setSelectedMode] = useState<string | null>(null);
  const [showMatchmaking, setShowMatchmaking] = useState(false);
  const [matchmakingGameType, setMatchmakingGameType] = useState<"timed" | "score">("timed");
  const [matchmakingKey, setMatchmakingKey] = useState(0);

  useEffect(() => {
    setGameHubPath("/game-modes");
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const hasUsableCredit = async () => {
    if (isPremium || isUnlimitedLivesActive(profile)) return true;
    if ((profile?.game_credits || 0) + (profile?.bonus_credits || 0) > 0) return true;
    if (!user?.id) return false;
    const { data } = await supabase
      .from("profiles")
      .select("game_credits, bonus_credits, premium_until, unlimited_lives_until")
      .eq("id", user.id)
      .maybeSingle();
    const now = new Date();
    return Boolean(
      ((data?.game_credits || 0) + (data?.bonus_credits || 0) > 0) ||
        (data?.premium_until && new Date(data.premium_until) > now) ||
        (data?.unlimited_lives_until && new Date(data.unlimited_lives_until) > now),
    );
  };

  const handleModeClick = async (modeId: string) => {
    if (!(await hasUsableCredit())) {
      toast.error("Oyun için yeterli sayfan yok!", { description: "Oyun oynamak için sayfa satın alın." });
      navigate("/market");
      return;
    }
    if (modeId === "tournament") navigate("/tournament");
    else if (modeId === "random-match") {
      setMatchmakingGameType("timed");
      setMatchmakingKey(Date.now());
      setShowMatchmaking(true);
      setTimeout(() => startSearch("timed"), 100);
    } else if (modeId === "vs-computer") navigate("/game/vs-computer?type=timed");
    else setSelectedMode(modeId);
  };

  return (
    <div className="fixed inset-0 z-0 flex flex-col">
      <div
        className="absolute inset-0"
        style={{ background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)" }}
      />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_var(--tw-gradient-stops))] from-amber-500/20 via-transparent to-transparent pointer-events-none opacity-30" />

      <div className="relative z-10 flex-1 min-h-0 flex flex-col pt-8 pb-6 pl-4 pr-6">
        <div className="flex items-center justify-between mb-4">
          <img
  src={oyunModlariYazi}
  alt="Oyun Modlari"
  className="h-24 sm:h-28 md:h-32 w-auto object-contain select-none pointer-events-none drop-shadow-[0_2px_4px_rgba(0,0,0,0.6)]"
  draggable={false}
/>
          <button
            type="button"
            onClick={() => {
              playSound("buttonClick");
              navigate("/");
            }}
            className="w-10 h-10 rounded-full bg-white/15 border border-white/30 flex items-center justify-center active:scale-90 transition-transform"
            aria-label="Kapat"
          >
            <X className="w-5 h-5 text-white" />
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto scrollbar-hide flex flex-col gap-1 items-center justify-center">
          {MODES.map((mode, i) => (
            <PressableZone
              key={mode.id}
              inline
              label={mode.title}
              glow={false}
              onPress={() => handleModeClick(mode.id)}
              className="w-[92%] flex-shrink-0 block mx-auto"
              style={{
                transform: mounted ? "translate3d(0,0,0)" : "translate3d(-120%,0,0)",
                opacity: mounted ? 1 : 0,
                transition: `transform 380ms cubic-bezier(0.16, 1, 0.3, 1) ${i * 80}ms, opacity 300ms ease-out ${i * 80}ms`,
                willChange: "transform, opacity",
              }}
            >
              <img
                src={`/oyunModu/${mode.id}.png`}
                alt={mode.title}
                className="w-full h-auto select-none pointer-events-none"
                draggable={false}
              />
            </PressableZone>
          ))}
        </div>
      </div>

      {selectedMode === "private-room" ? (
        <PrivateRoomCards onClose={() => setSelectedMode(null)} />
      ) : selectedMode ? (
        <GameModeSelector
          mode={selectedMode}
          onStart={(type) => {
            if (selectedMode === "tournament") navigate("/tournament", { state: { gameType: type } });
            else if (selectedMode === "random-match") {
              setMatchmakingGameType(type);
              setMatchmakingKey(Date.now());
              setShowMatchmaking(true);
              setTimeout(() => startSearch(type), 100);
            } else navigate(`/game/${selectedMode}?type=${type}`);
            setSelectedMode(null);
          }}
          onClose={() => setSelectedMode(null)}
        />
      ) : null}

      {showMatchmaking && (
        <div className="fixed inset-0 z-[9999] bg-[#1a1a2e]">
          <SlotMatchmaking
            key={`matchmaking-${matchmakingKey}`}
            onCancel={() => {
              cancelSearch();
              setShowMatchmaking(false);
            }}
            searchProgress={searchProgress}
          />
        </div>
      )}
    </div>
  );
};

export default GameModesPage;
