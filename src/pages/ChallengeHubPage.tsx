import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { X } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useSounds } from "@/hooks/useSounds";
import { getDailyChallengeStatus, ChallengeType } from "@/hooks/useDailyChallenge";
import HomeCardCarousel from "@/components/home/HomeCardCarousel";
import type { SlidePanelItem } from "@/components/home/HomeSlidePanel";
import oynandiIcon from "@/assets/oynandi.svg";
import refleksKart from "@/assets/refleksKart.png";
import harfKosusuKart from "@/assets/harfKosusuKart.png";
import kelimePuzzleKart from "@/assets/kelimePuzzleKart.png";
import kelimeHafizaKart from "@/assets/kelimeHafizaKart.png";
import hadiKart from "@/assets/hadiKart.png";
import duelloYazi from "@/assets/duelloYazi.png";

const emptyStatus: Record<ChallengeType, boolean> = {
  word_hunt: false,
  anagram: false,
  word_chain: false,
  puzzle: false,
  reaktor: false,
  neon_blitz: false,
  memory: false,
  kelime_avi: false,
};

const todayKey = () => new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Istanbul" });

const ChallengeHubPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { playSound } = useSounds();

  const [challengeStatus, setChallengeStatus] = useState<Record<ChallengeType, boolean>>(() => {
    try {
      const cached = sessionStorage.getItem("challengeStatus");
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed._date === todayKey()) return parsed;
      }
    } catch {}
    return emptyStatus;
  });

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    const fetch = () => {
      getDailyChallengeStatus(user.id).then((status) => {
        if (cancelled) return;
        try {
          sessionStorage.setItem("challengeStatus", JSON.stringify({ ...status, _date: todayKey() }));
        } catch {}
        setChallengeStatus(status);
      });
    };
    fetch();
    const onVis = () => {
      if (document.visibilityState === "visible") fetch();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [user?.id]);

  const playedBadge = (
    <img src={oynandiIcon} alt="Oynandı" className="w-16 h-16 drop-shadow-[0_2px_3px_rgba(0,0,0,0.6)]" />
  );

  const go = (route: string) => {
    playSound("buttonClick");
    navigate(route);
  };

  const items: SlidePanelItem[] = [
    {
      id: "puzzle",
      title: "Kelime Puzzle",
      icon: null,
      gradient: "",
      imageSrc: kelimePuzzleKart,
      dimmed: challengeStatus.puzzle,
      badge: challengeStatus.puzzle ? playedBadge : undefined,
      onClick: () => go("/challenge/puzzle"),
    },
    {
      id: "reaktor",
      title: "Harf Koşusu",
      icon: null,
      gradient: "",
      imageSrc: harfKosusuKart,
      dimmed: challengeStatus.reaktor,
      badge: challengeStatus.reaktor ? playedBadge : undefined,
      onClick: () => go("/challenge/reaktor"),
    },
    {
      id: "neon-blitz",
      title: "Refleks",
      icon: null,
      gradient: "",
      imageSrc: refleksKart,
      dimmed: challengeStatus.neon_blitz,
      badge: challengeStatus.neon_blitz ? playedBadge : undefined,
      onClick: () => go("/challenge/neon-blitz"),
    },
    {
      id: "memory",
      title: "Kelime Hafıza",
      icon: null,
      gradient: "",
      imageSrc: kelimeHafizaKart,
      dimmed: challengeStatus.memory,
      badge: challengeStatus.memory ? playedBadge : undefined,
      onClick: () => go("/challenge/memory"),
    },
    {
      id: "kelime-avi",
      title: "Karma",
      icon: null,
      gradient: "",
      imageSrc: hadiKart,
      dimmed: challengeStatus.kelime_avi,
      badge: challengeStatus.kelime_avi ? playedBadge : undefined,
      onClick: () => go("/challenge/hadi"),
    },
  ];

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
            src={duelloYazi}
            alt="Düello & Challenge"
            className="h-25 w-auto object-contain select-none pointer-events-none drop-shadow-[0_2px_4px_rgba(0,0,0,0.6)]"
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

        <HomeCardCarousel items={items} />
      </div>
    </div>
  );
};

export default ChallengeHubPage;
