import { useState, useEffect, useRef, memo, useCallback, useMemo } from "react";
import { useMusic } from "@/contexts/MusicContext";
import { useAuth } from "@/contexts/AuthContext";
import { useUser } from "@/contexts/UserContext";
import { useSounds } from "@/hooks/useSounds";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import PrivateRoomModal from "@/components/PrivateRoomModal";
import { SlotMatchmaking } from "@/components/SlotMatchmaking";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { toast } from "sonner";
import { useJokerInventory } from "@/hooks/useJokerInventory";
import { usePremiumDailyRewards } from "@/hooks/usePremiumDailyRewards";
import { useMatchmaking } from "@/contexts/NewMatchmakingContext";
import { AvatarViewDialog } from "@/components/AvatarViewDialog";
import GameModeSelector from "@/components/GameModeSelector";
import { RadioPicker } from "@/components/RadioPicker";
import HomeClouds from "@/components/home/HomeClouds";
import HomeMapPoint from "@/components/home/HomeMapPoint";
import levelBarImg from "@/assets/levelBar.png";
import murekkepAnim from "@/assets/murekkep.json";
import HomeIslands from "@/components/home/HomeIslands";
import HomeBottomNav from "@/components/home/HomeBottomNav";
import HomeSlidePanel, { SlidePanelItem } from "@/components/home/HomeSlidePanel";
import LeaderboardPrizeDialog from "@/components/LeaderboardPrizeDialog";
import ChallengePrizeDialog from "@/components/ChallengePrizeDialog";
import { useSearchingPlayersCount } from "@/hooks/useSearchingPlayersCount";
import { useActiveTournamentDisplayCount } from "@/hooks/useActiveTournamentDisplayCount";
import Lottie from "lottie-react";
import { useSystemMessages } from "@/hooks/useSystemMessages";
import { SystemMessagesDialog } from "@/components/SystemMessagesDialog";

import {
  Bot,
  Users,
  Trophy,
  Clock,
  Target,
  Crown,
  Zap,
  Gift,
  Star,
  Flame,
  Gamepad2,
  Sparkles,
  Check,
} from "lucide-react";
import { getDailyChallengeStatus, ChallengeType } from "@/hooks/useDailyChallenge";

// --- YARDIMCI SABİTLER ---

const greetingMessages = [
  "Sahne senin! 🌟",
  "Bugün şanslı günün! 🍀",
  "Enerjin harika! ⚡",
  "Rekor kırmaya hazır mısın? 🚀",
  "Şampiyon geldi! 👑",
  "Mükemmel gözüküyorsun 🧿",
  "Zihinler hazırsa başlıyoruz! 🧠",
  "Bugün skor tabelası yanacak! 🔥",
  "Hızına kimse yetişemez! 💨",
  "Efsane bir oyun seni bekliyor! 🎯",
  "Odak moduna geç! 🎧",
  "Rakipler titreyecek! 😎",
  "Bugün fark atma günü! 💥",
  "Kontrol sende! 🎮",
  "Stratejini konuştur! ♟️",
  "Bu tur senin turun! 🔄",
  "Şimdi göster kendini! 💪",
  "Skorları alt üst et! 📊",
  "Hazırsan zaman başlıyor! ⏳",
  "Bugün zirveye oynuyoruz! 🏆",
  "Seri başlasın! 🔁",
  "Reflekslerine güven! ⚔️",
  "Büyük hamle zamanı! 🎲",
  "Mod: Kazanma 🔓",
  "Bugün MVP sensin! ⭐",
  "Hedef: Rekor! 🎯",
  "Oyun seni bekliyor! 👀",
  "Başarı senin ikinci adın! 🏅",
  "Bir efsane doğuyor... 🌌",
  "Tam isabet zamanı! 🎯",
  "Bugün kimse seni durduramaz! 🛑",
  "Zirve modu aktif! 🚨",
  "Hadi tarih yazalım! 📖",
  "Bugün başarı kaçınılmaz! 💯",
];

const getRandomGreeting = () =>
  greetingMessages[Math.floor(Math.random() * greetingMessages.length)].toLocaleUpperCase("tr-TR");

const isGiftPremium = (profile: any) => {
  if (!profile?.premium_until) return false;
  const premiumUntil = new Date(profile.premium_until);
  const createdAt = new Date(profile.created_at);
  // 🔧 FIX: Math.floor kullanarak tutarlı hesaplama
  const daysDiff = Math.floor((premiumUntil.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24));
  return daysDiff >= 6 && daysDiff <= 8 && premiumUntil > new Date();
};

const isUnlimitedLivesActive = (profile: any) => {
  if (!profile?.unlimited_lives_until) return false;
  const expiry = new Date(profile.unlimited_lives_until);
  return expiry > new Date();
};

// 2 saatten fazla kaldıysa "maraton" (24h), değilse "kısa" (1h)
const getUnlimitedType = (profile: any): "maraton" | "short" | null => {
  if (!profile?.unlimited_lives_until) return null;
  const expiry = new Date(profile.unlimited_lives_until);
  const now = new Date();
  if (expiry <= now) return null;
  const hoursLeft = (expiry.getTime() - now.getTime()) / (1000 * 60 * 60);
  return hoursLeft > 2 ? "maraton" : "short";
};

const getVipType = (profile: any): "yearly" | "monthly" | null => {
  if (!profile?.premium_until) return null;
  const now = new Date();
  const premiumUntil = new Date(profile.premium_until);
  if (premiumUntil <= now) return null;

  // Kalan süreye göre tespit — manuel SQL güncellemeleri ve farklı store productId'leri
  // (premium_type ile uyumsuz olabilir) için en güvenilir yol budur.
  const daysRemaining = (premiumUntil.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
  if (daysRemaining > 45) return "yearly";

  // 45 günden az kalanlar için premium_type'a bak
  if (profile.premium_type && String(profile.premium_type).toLowerCase().includes("year")) return "yearly";
  return "monthly";
};

// --- BİLEŞENLER ---

const StatWidget = memo(({ svgIcon, value, label }: any) => (
  <div className="flex-1 bg-[#1e2d45] border border-indigo-500/20 rounded-2xl p-3 flex flex-col items-center justify-center relative overflow-hidden group">
    <img
      src={svgIcon}
      alt=""
      className="absolute inset-0 w-full h-full object-cover opacity-10 select-none pointer-events-none"
    />
    <span className="relative z-10 text-lg font-bold text-white tracking-tight">{value}</span>
    <span className="relative z-10 text-[10px] text-slate-400 font-medium uppercase tracking-wide opacity-80">
      {label}
    </span>
  </div>
));
StatWidget.displayName = "StatWidget";

const HakIcon = memo(({ animData, filled, size = 24 }: { animData: any; filled: boolean; size?: number }) => (
  <div
    className={`transition-all duration-300 ${filled ? "opacity-100" : "opacity-10"}`}
    style={{ width: size, height: size }}
  >
    {animData ? (
      <Lottie animationData={animData} loop={true} autoplay={true} style={{ width: "100%", height: "100%" }} />
    ) : (
      <div className="w-full h-full bg-slate-700 rounded-sm" />
    )}
  </div>
));
HakIcon.displayName = "HakIcon";

let _premiumLottieCache: any = null;
let _premiumLottiePromise: Promise<any> | null = null;
const loadPremiumLottie = () => {
  if (_premiumLottieCache) return Promise.resolve(_premiumLottieCache);
  if (!_premiumLottiePromise) {
    _premiumLottiePromise = fetch("/premiumLottie.json")
      .then((r) => r.json())
      .then((d) => {
        _premiumLottieCache = d;
        return d;
      })
      .catch(() => null);
  }
  return _premiumLottiePromise;
};

const VipCrownIcon = ({ className = "" }: { className?: string }) => {
  const [data, setData] = useState<any>(_premiumLottieCache);
  useEffect(() => {
    if (!data) loadPremiumLottie().then((d) => d && setData(d));
  }, [data]);
  return (
    <div className={className} style={{ display: "inline-block" }}>
      {data ? (
        <Lottie animationData={data} loop autoplay style={{ width: "100%", height: "100%" }} />
      ) : null}
    </div>
  );
};

const getLevelFruitIcon = (level: number): string => {
  if (level < 5) return "/icons/yaprak.svg";
  if (level < 10) return "/icons/muz.svg";
  if (level < 15) return "/icons/turkumeyve.svg";
  if (level < 20) return "/icons/limon.svg";
  if (level < 25) return "/icons/uzum.svg";
  if (level < 30) return "/icons/cilek.svg";
  if (level < 35) return "/icons/karpuz.svg";
  if (level < 40) return "/icons/elma.svg";
  if (level < 45) return "/icons/dut.svg";
  if (level < 50) return "/icons/ananas.svg";
  if (level < 55) return "/icons/kiraz.svg";
  if (level < 60) return "/icons/kivi.svg";
  if (level < 65) return "/icons/ejder.svg";
  if (level < 70) return "/icons/portakal.svg";
  return "/icons/meyvetabagi.svg";
};

const KelimePuzzleIcon = ({ className = "" }: { className?: string }) => (
  <img src="/icons/kelimepuzzle.svg" className={className} alt="" />
);

const ReaktorIcon = ({ className = "" }: { className?: string }) => (
  <img src="/icons/reaktor.svg" className={className} alt="" />
);

const RefleksIcon = ({ className = "" }: { className?: string }) => (
  <img src="/icons/refleks.svg" className={className} alt="" />
);

const KelimeHafizaIcon = ({ className = "" }: { className?: string }) => (
  <img src="/icons/kelimehafiza.svg" className={className} alt="" />
);

const WheelIcon = ({ className = "" }: { className?: string }) => (
  <img src="/icons/cark.svg" className={className} alt="" />
);

const UnlimitedIcon = ({ className = "" }: { className?: string }) => (
  <img src="/icons/unlimited.svg" className={className} alt="" />
);

const RastgeleIcon = ({ className = "" }: { className?: string }) => (
  <img src="/icons/rastgele.svg" className={className} alt="" />
);

const TurnuvaIcon = ({ className = "" }: { className?: string }) => (
  <img src="/icons/turnuva.svg" className={className} alt="" />
);

const AiModIcon = ({ className = "" }: { className?: string }) => (
  <img src="/icons/aimod.svg" className={className} alt="" />
);

const OzelOdaIcon = ({ className = "" }: { className?: string }) => (
  <img src="/icons/ozeloda.svg" className={className} alt="" />
);

const GameModeCard = memo(({ mode, onClick, searchingCount, activeTournamentCount }: any) => (
  <div
    onClick={onClick}
    className={`relative group cursor-pointer rounded-3xl p-4 h-32 flex flex-col justify-between transition-transform duration-200 active:scale-[0.97] border-2 border-white shadow-[0_0_12px_rgba(255,255,255,0.2)]`}
    style={{ transform: "translateZ(0)" }}
  >
    <div
      className={`absolute inset-0 bg-gradient-to-br ${mode.gradient} opacity-90 rounded-3xl`}
    />
    <div className="absolute -right-4 -top-4 w-24 h-24 bg-white/10 rounded-full blur-2xl pointer-events-none" />

    <div className="relative z-10 flex justify-between items-start">
      <div className="p-2 bg-white/20 backdrop-blur-md rounded-2xl border border-white/20 shadow-inner">
        <mode.icon className="w-6 h-6 text-white" />
      </div>
      {mode.isLive && (
        <Badge className="bg-red-500 hover:bg-red-500 text-white border-0 text-[10px] px-2 py-0.5">CANLI</Badge>
      )}
    </div>

    <div className="relative z-10">
      <h3 className="text-lg font-bold text-white leading-none mb-1" style={{ WebkitTextStroke: '2px #000', paintOrder: 'stroke fill' } as any}>{mode.title}</h3>
      {mode.id === "tournament" ? (
        <div className="mt-1 inline-flex items-center gap-1 bg-white/20 backdrop-blur-sm rounded-full px-2 py-0.5">
          <span
            className={`w-1.5 h-1.5 rounded-full ${(activeTournamentCount ?? 0) > 0 ? "bg-amber-400 animate-pulse" : "bg-slate-400"}`}
          />
          <span className="text-[10px] text-white font-medium">{activeTournamentCount ?? 0} aktif turnuva</span>
        </div>
      ) : (
        <p className="text-[11px] text-white font-medium line-clamp-1">{mode.description}</p>
      )}
      {mode.id === "random-match" && typeof searchingCount === "number" && (
        <div className="mt-1 inline-flex items-center gap-1 bg-white/20 backdrop-blur-sm rounded-full px-2 py-0.5">
          <span
            className={`w-1.5 h-1.5 rounded-full ${searchingCount > 0 ? "bg-green-400 animate-pulse" : "bg-slate-400"}`}
          />
          <span className="text-[10px] text-white font-medium">{searchingCount} kişi arıyor</span>
        </div>
      )}
    </div>
  </div>
));
GameModeCard.displayName = "GameModeCard";

// --- ANA SAYFA ---

const HomePage = () => {
  const { user } = useAuth();
  const { profile, isPremium, refreshProfile, getTotalCredits } = useUser();
  const navigate = useNavigate();
  const { playSound } = useSounds();
  // 🔥 DÜZELTME: startBackgroundMusic ARTIK YOK. Native otomatik hallediyor.
  // const { startBackgroundMusic } = useMusic(); <-- SİLİNDİ
  const { jokers, loadJokers } = useJokerInventory();
  const searchingPlayersCount = useSearchingPlayersCount();
  const activeTournamentCount = useActiveTournamentDisplayCount();

  usePremiumDailyRewards();

  const headerRef = useRef<HTMLDivElement | null>(null);
  const profileRef = useRef<HTMLDivElement | null>(null);
  const navRef = useRef<HTMLDivElement | null>(null);
  const [islandBounds, setIslandBounds] = useState({ top: 0, bottom: 0 });

  useEffect(() => {
    const measure = () => {
      const headerTop = headerRef.current?.getBoundingClientRect().top ?? 0;
      const profileBottom = profileRef.current?.getBoundingClientRect().bottom;
      setIslandBounds({
        top:
          profileBottom != null
            ? Math.max(0, profileBottom - headerTop + 4)
            : (headerRef.current?.getBoundingClientRect().height ?? 0),
        bottom: navRef.current?.getBoundingClientRect().height ?? 0,
      });
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (headerRef.current) ro.observe(headerRef.current);
    if (profileRef.current) ro.observe(profileRef.current);
    if (navRef.current) ro.observe(navRef.current);
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, []);


  const [selectedMode, setSelectedMode] = useState<string | null>(null);

  const [showMatchmaking, setShowMatchmaking] = useState(false);
  const [matchmakingGameType, setMatchmakingGameType] = useState<"timed" | "score">("timed");
  const [matchmakingKey, setMatchmakingKey] = useState<number>(0);

  const [timeUntilNextCredit, setTimeUntilNextCredit] = useState<string>("");
  const [unlimitedTimeLeft, setUnlimitedTimeLeft] = useState<string>("");
  const [premiumTimeLeft, setPremiumTimeLeft] = useState<string>("");
  const [sayfaHakAnim, setSayfaHakAnim] = useState<any>(null);
  const [kalanSayfaAnim, setKalanSayfaAnim] = useState<any>(null);
  const [boostProfilAnim, setBoostProfilAnim] = useState<any>(null);
  const [premiumBadgeAnim, setPremiumBadgeAnim] = useState<any>(null);

  const boostUntilHome = (profile as any)?.score_boost_until ? new Date((profile as any).score_boost_until) : null;
  const boostSourceHome = (profile as any)?.score_boost_source;
  const boostRemainingMsHome = boostUntilHome ? boostUntilHome.getTime() - Date.now() : 0;
  const boostActiveHome = boostRemainingMsHome > 0 && (boostSourceHome === "kelime_avi" || boostSourceHome === "leaderboard" || boostRemainingMsHome > 2 * 60 * 60 * 1000);

  useEffect(() => {
    if (boostActiveHome && !boostProfilAnim) {
      fetch("/boostProfil.json").then(r => r.json()).then(setBoostProfilAnim).catch(() => {});
    }
  }, [boostActiveHome, boostProfilAnim]);

  useEffect(() => {
    if (isPremium && !premiumBadgeAnim) {
      fetch("/premiumLottie.json").then(r => r.json()).then(setPremiumBadgeAnim).catch(() => {});
    }
  }, [isPremium, premiumBadgeAnim]);

  // useMemoryGame taşındı
  const { startSearch, searchProgress, cancelSearch } = useMatchmaking();
  const [showAvatarView, setShowAvatarView] = useState(false);
  const [showSystemMessages, setShowSystemMessages] = useState(false);
  const [showRadio, setShowRadio] = useState(false);
  const [showChallengePanel, setShowChallengePanel] = useState(false);
  const [showModePanel, setShowModePanel] = useState(false);
  const [pendingFriendRequests, setPendingFriendRequests] = useState(0);
  const [unreadChatCount, setUnreadChatCount] = useState(0);
  const { messages: systemMessages, unreadCount: systemUnread, loading: systemLoading, markAllRead: markSystemRead, readIds: systemReadIds } = useSystemMessages();

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    const fetchPending = async () => {
      try {
        const { count } = await supabase
          .from("friendships")
          .select("id", { count: "exact", head: true })
          .eq("friend_id", user.id)
          .eq("status", "pending");
        if (!cancelled) setPendingFriendRequests(count || 0);
      } catch {}
      try {
        const { count: msgCount } = await supabase
          .from("private_messages")
          .select("id", { count: "exact", head: true })
          .eq("recipient_id", user.id)
          .eq("is_read", false);
        if (!cancelled) setUnreadChatCount(msgCount || 0);
      } catch {}
    };
    fetchPending();
    const interval = setInterval(fetchPending, 30000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [user?.id]);


  // Eski bot rematch URL'lerini temizle; bot rematch artık özel oda bekleme akışıyla başlar.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("autoRematch") !== "1") return;
    const url = new URL(window.location.href);
    url.searchParams.delete("autoRematch");
    url.searchParams.delete("botNow");
    window.history.replaceState({}, "", url.toString());
  }, []);


  const [challengeStatus, setChallengeStatus] = useState<Record<ChallengeType, boolean>>(() => {
    try {
      const cached = sessionStorage.getItem("challengeStatus");
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed._date === new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Istanbul" })) {
          return parsed;
        }
      }
    } catch {}
    return {
      word_hunt: false,
      anagram: false,
      word_chain: false,
      puzzle: false,
      reaktor: false,
      neon_blitz: false,
      memory: false,
      kelime_avi: false,
    };
  });
  const [wheelSpinsLeft, setWheelSpinsLeft] = useState<number | null>(() => {
    try {
      const cached = sessionStorage.getItem("wheelSpinsLeft");
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed._date === new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Istanbul" })) {
          return parsed.spins;
        }
      }
    } catch {}
    return null;
  });

  // Fetch daily challenge completion status & wheel spin availability
  useEffect(() => {
    if (!user?.id) return;

    // Bot turnuvaları artık useActiveTournamentDisplayCount hook'u tarafından
    // her 30s'de bir tetikleniyor — burada ekstra çağrıya gerek yok.


    const fetchChallengeStatus = () => {
      sessionStorage.removeItem("challengeStatus");
      getDailyChallengeStatus(user.id).then((status) => {
        const withDate = { ...status, _date: new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Istanbul" }) };
        sessionStorage.setItem("challengeStatus", JSON.stringify(withDate));
        setChallengeStatus(status);
      });
    };
    fetchChallengeStatus();

    const handleVisibility = () => {
      if (document.visibilityState === "visible") fetchChallengeStatus();
    };
    document.addEventListener("visibilitychange", handleVisibility);

    // Check wheel spins
    const today = new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Istanbul" });
    supabase
      .from("wheel_spins")
      .select("id")
      .eq("user_id", user.id)
      .eq("date", today)
      .maybeSingle()
      .then(({ data: spinData }) => {
        const dailyAvailable = !spinData ? 1 : 0;
        const bonus = profile?.bonus_spins || 0;
        const total = dailyAvailable + bonus;
        setWheelSpinsLeft(total);
        sessionStorage.setItem("wheelSpinsLeft", JSON.stringify({ spins: total, _date: today }));
      });

    // Load sayfa hak animation
    fetch("/sayfaHak.json")
      .then((r) => r.json())
      .then(setSayfaHakAnim)
      .catch(() => {});

    fetch("/anaSayfa/kalanSayfalarim.json")
      .then((r) => r.json())
      .then(setKalanSayfaAnim)
      .catch(() => {});


    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [user?.id, profile?.bonus_spins]);

  const [greeting] = useState(() => {
    const sessionGreeting = sessionStorage.getItem("sessionGreeting");
    if (sessionGreeting) return sessionGreeting;
    const newGreeting = getRandomGreeting();
    sessionStorage.setItem("sessionGreeting", newGreeting);
    return newGreeting;
  });

  const vipType = getVipType(profile);

  // --- HESAPLAMALAR ---
  const calculateLevel = (totalScore: number) => {
    let level = 1;
    let totalExpNeeded = 0;
    let currentLevelExp = 1000;

    while (totalScore >= totalExpNeeded + currentLevelExp) {
      totalExpNeeded += currentLevelExp;
      level++;
      currentLevelExp = level * 1000;
    }
    return { level, experience: totalScore - totalExpNeeded, nextLevelExp: currentLevelExp };
  };

  const levelData = calculateLevel(profile?.total_score || 0);
  const progressPercent = (levelData.experience / levelData.nextLevelExp) * 100;

  const calculateUnlimitedTimeLeft = () => {
    if (!profile || !isUnlimitedLivesActive(profile)) {
      setUnlimitedTimeLeft("");
      return;
    }
    const now = new Date();
    const expiryDateString = (profile as any).unlimited_lives_until;
    if (!expiryDateString) return;

    const expiry = new Date(expiryDateString);
    if (now >= expiry) {
      setUnlimitedTimeLeft("");
      refreshProfile();
      return;
    }

    const timeDiff = expiry.getTime() - now.getTime();
    const totalSeconds = Math.floor(timeDiff / 1000);
    const days = Math.floor(totalSeconds / (3600 * 24));
    const hours = Math.floor((totalSeconds % (3600 * 24)) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (days > 0) setUnlimitedTimeLeft(`${days} Gün ${hours} Sa`);
    else {
      const h = hours.toString().padStart(2, "0");
      const m = minutes.toString().padStart(2, "0");
      const s = seconds.toString().padStart(2, "0");
      setUnlimitedTimeLeft(`${h}:${m}:${s}`);
    }
  };

  const calculatePremiumTimeLeft = () => {
    if (!profile?.premium_until) return setPremiumTimeLeft("");
    const now = new Date();
    const expiry = new Date(profile.premium_until);
    if (now >= expiry) return setPremiumTimeLeft("");

    const timeDiff = expiry.getTime() - now.getTime();
    // 🔧 FIX: Tutarlı hesaplama - kalan tam günleri göster
    const days = Math.floor(timeDiff / (1000 * 60 * 60 * 24));
    const remainingHours = Math.floor((timeDiff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

    // Eğer 1+ gün kaldıysa, gün ve saat olarak göster
    if (days > 0) {
      if (remainingHours > 0) {
        setPremiumTimeLeft(`${days} Gün ${remainingHours}s`);
      } else {
        setPremiumTimeLeft(`${days} Gün`);
      }
    } else {
      // Son gün - saat ve dakika göster
      const minutes = Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60));
      setPremiumTimeLeft(`${remainingHours}s ${minutes}d`);
    }
  };

  const calculateTimeUntilNextCredit = () => {
    if (!profile?.last_credit_refresh || isPremium || profile?.game_credits >= 5) {
      setTimeUntilNextCredit("");
      return;
    }
    const now = new Date();
    const lastRefresh = new Date(profile.last_credit_refresh);
    const nextRefresh = new Date(lastRefresh.getTime() + 72 * 60 * 1000);
    if (now >= nextRefresh) return setTimeUntilNextCredit("");
    const timeDiff = nextRefresh.getTime() - now.getTime();
    const minutes = Math.floor(timeDiff / (1000 * 60));
    const seconds = Math.floor((timeDiff % (1000 * 60)) / 1000);
    setTimeUntilNextCredit(`${minutes}:${seconds.toString().padStart(2, "0")}`);
  };

  const refreshCredits = async () => {
    if (!user || isPremium) return;
    const currentCredits = profile?.game_credits || 0;
    if (currentCredits >= 5) return;
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          game_credits: Math.min(currentCredits + 1, 5),
          last_credit_refresh: new Date().toISOString(),
        })
        .eq("id", user.id);
      if (!error) {
        await refreshProfile();
        playSound("buttonClick");
      }
    } catch (error) {
      console.error(error);
    }
  };

  useEffect(() => {
    if (profile && isUnlimitedLivesActive(profile)) {
      calculateUnlimitedTimeLeft();
      const interval = setInterval(calculateUnlimitedTimeLeft, 1000);
      return () => clearInterval(interval);
    } else setUnlimitedTimeLeft("");
  }, [profile]);

  useEffect(() => {
    if (profile?.premium_until) {
      calculatePremiumTimeLeft();
      const interval = setInterval(calculatePremiumTimeLeft, 60000);
      return () => clearInterval(interval);
    }
  }, [profile]);

  useEffect(() => {
    if (!isPremium && profile) {
      calculateTimeUntilNextCredit();
      const interval = setInterval(() => {
        calculateTimeUntilNextCredit();
        if (profile?.last_credit_refresh && !isPremium && profile.game_credits < 5) {
          const now = new Date();
          const nextRefresh = new Date(new Date(profile.last_credit_refresh).getTime() + 72 * 60 * 1000);
          if (now >= nextRefresh) {
            refreshCredits();
            setTimeout(() => refreshProfile(), 500);
          }
        }
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [profile, isPremium]);

  // 🔥 DÜZELTME: Bu useEffect ARTIK GEREKSİZ. SİLİNDİ.
  /*
  useEffect(() => {
    startBackgroundMusic();
  }, [startBackgroundMusic]);
  */

  useEffect(() => {
    const checkDailyReset = async () => {
      if (!user || !profile) return;
      const today = new Date().toISOString().split("T")[0];
      const lastReset = profile.last_daily_reset
        ? new Date(profile.last_daily_reset).toISOString().split("T")[0]
        : null;
      if (lastReset !== today) await refreshProfile();
    };
    checkDailyReset();
  }, [user, profile?.last_daily_reset]);

  useEffect(() => {
    console.log("🏠 [HomePage] Mount - ilk veri yüklemesi...");
    refreshProfile(true);
    // loadJokers() kaldırıldı - useJokerInventory hook'u zaten mount'ta çağırıyor
  }, []);

  const handleGameModeClick = useCallback(
    async (modeId: string) => {
      playSound("buttonClick");
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
          (data?.unlimited_lives_until && new Date(data.unlimited_lives_until) > now)
        );
      };

      if (
        !(await hasUsableCredit())
      ) {
        toast.error("Oyun için yeterli sayfan yok!", { description: "Oyun oynamak için sayfa satın alın." });
        navigate("/market");
        return;
      }
      if (modeId === "tournament") navigate("/tournament");
      else setSelectedMode(modeId);
    },
    [playSound, isPremium, profile, user?.id, navigate],
  );

  const handleMatchFound = (roomId: string) => {
    setShowMatchmaking(false);
    if (roomId === "ai-game") navigate(`/game/vs-computer?type=${matchmakingGameType}`);
    else navigate(`/game/random-match?room=${roomId}&type=${matchmakingGameType}`);
  };

  // --- CONFIG ---
  const gameModesConfig = useMemo(
    () => [
      {
        id: "random-match",
        title: "Rastgele Rakip",
        icon: RastgeleIcon,
        gradient: "from-violet-500 via-purple-500 to-indigo-500",
        glowColor: "violet",
        isLive: true,
      },
      {
        id: "tournament",
        title: "Turnuva",
        description: "Büyük ödüller",
        icon: TurnuvaIcon,
        gradient: "from-amber-400 via-orange-500 to-red-500",
        glowColor: "amber",
        isLive: false,
      },
      {
        id: "vs-computer",
        title: "Yapay Zeka",
        description: "Pratik yap",
        icon: AiModIcon,
        gradient: "from-cyan-400 via-sky-500 to-blue-500",
        glowColor: "cyan",
        isLive: false,
      },
      {
        id: "private-room",
        title: "Özel Oda",
        description: "Arkadaşınla oyna",
        icon: OzelOdaIcon,
        gradient: "from-emerald-400 via-green-500 to-teal-500",
        glowColor: "emerald",
        isLive: false,
      },
    ],
    [],
  );

  // miniGamesConfig artık MiniGamesPage'e taşındı

  const totalCredits = getTotalCredits();

  // Seviyeye göre arka plan rengi (çift tonlu gradient)
  const getLevelBackgroundColor = () => {
    return {
      bg: "linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)", // index.html renkleri
      gradient: "from-[#ff6b6b]/40", // Şeffaflığı %20'den %40'a çıkardık
      headerBg: "#1a1a2e",
    };

    /*
    const level = levelData.level;

    if (level >= 70) 
      return { bg: "linear-gradient(135deg, #CFD8DC 0%, #B0BEC5 100%)", gradient: "from-slate-300/60", headerBg: "#C0CCD3" }; 
    if (level >= 40) 
      return { bg: "linear-gradient(135deg, #BFDBFE 0%, #93C5FD 100%)", gradient: "from-blue-300/60", headerBg: "#A9D0FE" }; 
    if (level >= 25) 
      return { bg: "linear-gradient(135deg, #BBF7D0 0%, #86EFAC 100%)", gradient: "from-emerald-300/60", headerBg: "#A0F3BE" }; 
    if (level >= 10) 
      return { bg: "linear-gradient(135deg, #E9D5FF 0%, #D8B4FE 100%)", gradient: "from-purple-300/60", headerBg: "#E0C5FE" }; 
    return { bg: "linear-gradient(135deg, #FEF3C7 0%, #FDE68A 100%)", gradient: "from-orange-200/50", headerBg: "#FEEDA6" };
    */
  };

  const levelBgColors = getLevelBackgroundColor();

  const level = levelData.level;
  const levelStarGradient =
    level >= 70
      ? "from-slate-400 to-slate-600"
      : level >= 40
        ? "from-blue-400 to-blue-600"
        : level >= 25
          ? "from-emerald-400 to-green-600"
          : level >= 10
            ? "from-purple-500 to-indigo-600"
            : "from-amber-400 to-orange-500";

  const jokerList = [
    {
      img: "/icons/degistir.svg",
      count: jokers.degistir,
      name: "Değiştir",
      layer: "bg-gradient-to-br from-cyan-400 via-cyan-500 to-blue-600",
    },
    {
      img: "/icons/fisilda.svg",
      count: jokers.fisilida,
      name: "Fısılda",
      layer: "bg-gradient-to-br from-amber-400 via-yellow-500 to-orange-500",
    },
    {
      img: "/icons/senyaz.svg",
      count: jokers.senYaz,
      name: "Sen Yaz",
      layer: "bg-gradient-to-br from-emerald-400 via-green-500 to-teal-600",
    },
  ];

  const challengePanelItems: SlidePanelItem[] = [
    {
      id: "puzzle",
      title: "Kelime Puzzle",
      subtitle: challengeStatus.puzzle ? "Yarın tekrar gel!" : "Harfleri sıraya diz",
      icon: <KelimePuzzleIcon className="w-9 h-9" />,
      gradient: "from-yellow-600 via-amber-500 to-yellow-700",
      dimmed: challengeStatus.puzzle,
      badge: challengeStatus.puzzle ? <Check className="w-6 h-6 text-amber-200" /> : undefined,
      onClick: () => {
        playSound("buttonClick");
        setShowChallengePanel(false);
        navigate("/challenge/puzzle");
      },
    },
    {
      id: "reaktor",
      title: "Harf Koşusu",
      subtitle: challengeStatus.reaktor ? "Yarın tekrar gel!" : "Harfleri topla",
      icon: <ReaktorIcon className="w-9 h-9" />,
      gradient: "from-yellow-600 via-amber-500 to-yellow-700",
      dimmed: challengeStatus.reaktor,
      badge: challengeStatus.reaktor ? <Check className="w-6 h-6 text-amber-200" /> : undefined,
      onClick: () => {
        playSound("buttonClick");
        setShowChallengePanel(false);
        navigate("/challenge/reaktor");
      },
    },
    {
      id: "neon-blitz",
      title: "Refleks",
      subtitle: challengeStatus.neon_blitz ? "Yarın tekrar gel!" : "Hızını test et",
      icon: <RefleksIcon className="w-9 h-9" />,
      gradient: "from-yellow-600 via-amber-500 to-yellow-700",
      dimmed: challengeStatus.neon_blitz,
      badge: challengeStatus.neon_blitz ? <Check className="w-6 h-6 text-amber-200" /> : undefined,
      onClick: () => {
        playSound("buttonClick");
        setShowChallengePanel(false);
        navigate("/challenge/neon-blitz");
      },
    },
    {
      id: "memory",
      title: "Hafıza",
      subtitle: challengeStatus.memory ? "Yarın tekrar gel!" : "Kelimeleri eşleştir",
      icon: <KelimeHafizaIcon className="w-9 h-9" />,
      gradient: "from-yellow-600 via-amber-500 to-yellow-700",
      dimmed: challengeStatus.memory,
      badge: challengeStatus.memory ? <Check className="w-6 h-6 text-amber-200" /> : undefined,
      onClick: () => {
        playSound("buttonClick");
        setShowChallengePanel(false);
        navigate("/challenge/memory");
      },
    },
    {
      id: "kelime-avi",
      title: "Kelime Avı",
      subtitle: challengeStatus.kelime_avi ? "Yarın tekrar gel!" : "Harfleri birleştir",
      icon: <img src="/surukle.svg" alt="" className="w-9 h-9" />,
      gradient: "from-yellow-600 via-amber-500 to-yellow-700",
      dimmed: challengeStatus.kelime_avi,
      badge: challengeStatus.kelime_avi ? <Check className="w-6 h-6 text-amber-200" /> : undefined,
      onClick: () => {
        playSound("buttonClick");
        setShowChallengePanel(false);
        navigate("/challenge/kelime-avi");
      },
    },
  ];

  const gameModePanelItems: SlidePanelItem[] = gameModesConfig.map((mode) => {
    const Icon = mode.icon;
    return {
      id: mode.id,
      title: mode.title,
      subtitle:
        mode.id === "tournament"
          ? `${activeTournamentCount ?? 0} aktif turnuva`
          : mode.id === "random-match"
            ? `${searchingPlayersCount ?? 0} kişi arıyor`
            : mode.description,
      icon: <Icon className="w-9 h-9" />,
      gradient: mode.gradient,
      badge: mode.isLive ? (
        <Badge className="bg-red-500 hover:bg-red-500 text-white border-0 text-[10px] px-2 py-0.5">CANLI</Badge>
      ) : undefined,
      onClick: () => {
        setShowModePanel(false);
        handleGameModeClick(mode.id);
      },
    };
  });

  return (
    <>
      <LeaderboardPrizeDialog />
      <ChallengePrizeDialog />
      <div
        className="fixed inset-0 flex flex-col text-slate-100 font-sans selection:bg-indigo-500/30 overflow-hidden"
        style={{
          backgroundColor: "hsl(var(--app-shell))",
          backgroundImage: "url('/alttaban/kompleyesilarkaplan.svg')",
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
        }}
      >
        <style>{`
          @keyframes homeIslandFloat {
            0%, 100% { transform: translate3d(0, -8px, 0); }
            50%      { transform: translate3d(0, 10px, 0); }
          }
        `}</style>

        {/* Light Effects */}
        <div
          className={`absolute inset-0 bg-[radial-gradient(circle_at_top,_var(--tw-gradient-stops))] ${levelBgColors.gradient} via-transparent to-transparent pointer-events-none opacity-30`}
        />

        {/* Bulutlar - arka katman */}
        <div className="absolute inset-0 z-0 pointer-events-none">
          <HomeClouds layer="back" />
        </div>

        {/* --------------------------------------------------------
        ÜST ALAN — harita katmanının üzerinde yüzer (sabit header yok)
      -------------------------------------------------------- */}
        <div ref={headerRef} className="absolute top-0 left-0 right-0 z-30 px-4 pt-5 pointer-events-none">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0 flex flex-col pointer-events-auto">
            {/* Profil + Seviye */}

            <div
              ref={profileRef}
              className={`flex items-center gap-3 cursor-pointer min-w-0 ${
                vipType === "yearly"
                  ? "w-full rounded-2xl p-2 pr-3 bg-gradient-to-r from-amber-400/90 via-yellow-300/80 to-amber-500/90 border-2 border-amber-500/70 shadow-[0_6px_18px_rgba(0,0,0,0.3)]"
                  : vipType === "monthly"
                    ? "w-full rounded-2xl p-2 pr-3 bg-gradient-to-r from-blue-500/90 via-cyan-400/80 to-blue-600/90 border-2 border-blue-400/70 shadow-[0_6px_18px_rgba(0,0,0,0.3)]"
                    : ""
              }`}
              onClick={() => setShowAvatarView(true)}
            >
              <div className="relative flex-none">
                {boostActiveHome && boostProfilAnim && (
                  <div className="absolute inset-0 -m-14 pointer-events-none z-0">
                    <Lottie
                      animationData={boostProfilAnim}
                      loop
                      autoplay
                      style={{ width: "100%", height: "100%" }}
                    />
                  </div>
                )}
                <div
                  className={`relative z-10 w-24 h-24 rounded-full p-[3px] ${vipType ? "bg-gradient-to-tr from-amber-300 to-orange-500" : "bg-gradient-to-tr from-indigo-400 to-purple-500"}`}
                >
                  <Avatar className="w-full h-full border-2 border-[#1a1a2e]">
                    <AvatarImage
                      src={profile?.avatar_url || user?.user_metadata?.avatar_url}
                      className="object-cover"
                    />
                    <AvatarFallback className="bg-slate-800 text-slate-400 text-sm">U</AvatarFallback>
                  </Avatar>
                </div>
                {isPremium && premiumBadgeAnim && (
                  <div className="absolute -top-1 -right-1 z-20 w-7 h-7 pointer-events-none">
                    <Lottie
                      animationData={premiumBadgeAnim}
                      loop
                      autoplay
                      style={{ width: "100%", height: "100%" }}
                    />
                  </div>
                )}
              </div>

              <div className="min-w-0">
                <h2 className="text-base font-bold leading-tight text-white drop-shadow-md truncate">
                  {profile?.username || "Misafir"}
                </h2>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs font-bold text-white">Seviye {level}</span>
                  <span className={`text-[9px] font-mono ${vipType ? "text-white/80" : "text-slate-400"}`}>
                    {levelData.experience}/{levelData.nextLevelExp}
                  </span>
                </div>
                <div className="relative w-36 mt-1.5 select-none pointer-events-none">
                  <img
                    src={levelBarImg}
                    alt="Seviye barı"
                    className="w-full h-auto block"
                    draggable={false}
                  />
                  {/* Dolmayan kısmı karart (bar iç alanı ~%15 - %86) */}
                  <div
                    className="absolute top-[22%] bottom-[22%] rounded-[2px] bg-black/90 transition-all duration-1000"
                    style={{
                      right: "14.5%",
                      width: `${(1 - Math.min(1, Math.max(0, progressPercent / 100))) * 70.5}%`,
                      boxShadow: "inset 0 0 6px rgba(0,0,0,0.95)",
                      filter: "saturate(0.2)",
                    }}
                  />

                </div>
                <div className="flex items-center gap-1.5 mt-1.5">
                  <span className={`text-[9px] uppercase tracking-[0.1em] ${vipType ? "text-white/80" : "text-slate-400"}`}>Puan</span>
                  <span className={`text-xs font-mono font-bold ${vipType ? "text-white" : "text-red-500"}`}>
                    {(profile?.total_score || 0).toLocaleString()}
                  </span>
                </div>
              </div>
            </div>


            </div>

            {/* Sağ kolon: bildirim + jokerler */}
            <div className="flex flex-col items-center gap-2 flex-none pointer-events-auto">
              <button
                type="button"
                onClick={() => {
                  playSound("buttonClick");
                  setShowSystemMessages(true);
                }}
                className="relative w-11 h-11 flex items-center justify-center active:scale-90 transition-transform"
                aria-label="Sistem mesajları"
              >
                <img
                  src="/bildirimGorsel.svg"
                  alt="Bildirimler"
                  className="w-10 h-10 object-contain drop-shadow-md"
                />
                {systemUnread > 0 && (
                  <span className="absolute -bottom-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 bg-red-500 rounded-full flex items-center justify-center text-[10px] font-bold text-white shadow-md ring-2 ring-[#0f1729]">
                    {systemUnread > 9 ? "9+" : systemUnread}
                  </span>
                )}
              </button>

              <div className="flex flex-col items-start gap-2 mt-6 self-start">
                {jokerList.map((j, i) => (
                  <div
                    key={i}
                    className="active:scale-90 transition-transform cursor-pointer"
                    onClick={() => {
                      playSound("buttonClick");
                      navigate("/market");
                    }}
                  >
                    <div
                      className={`relative w-12 h-12 rounded-full ${j.layer} border-2 border-white flex items-center justify-center shadow-[0_0_10px_rgba(255,255,255,0.18)]`}
                    >
                      <img src={j.img} className="w-6 h-6 object-contain drop-shadow" alt={j.name} />
                      <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-[#1e2d45] border-2 border-white flex items-center justify-center text-[9px] font-black text-white">
                        {j.count}
                      </span>
                    </div>
                  </div>
                ))}

                {/* KALAN SAYFA HAKKI — çıplak lottie + badge */}
                {(!isPremium || isUnlimitedLivesActive(profile)) && (
                  <div className="flex flex-col items-center gap-0.5">
                    <div className="relative w-12 h-12">
                      {kalanSayfaAnim ? (
                        <Lottie
                          animationData={kalanSayfaAnim}
                          loop
                          autoplay
                          style={{ width: "100%", height: "100%" }}
                        />
                      ) : null}
                      <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-[#1e2d45] border-2 border-white flex items-center justify-center text-[9px] font-black text-white">
                        {isUnlimitedLivesActive(profile) ? "∞" : totalCredits}
                      </span>
                    </div>
                    {isUnlimitedLivesActive(profile)
                      ? unlimitedTimeLeft && (
                          <span
                            className="text-[9px] font-mono font-bold tabular-nums text-white/90 whitespace-nowrap"
                            style={{ WebkitTextStroke: "0.3px #000", paintOrder: "stroke fill" } as any}
                          >
                            {unlimitedTimeLeft}
                          </span>
                        )
                      : timeUntilNextCredit && (
                          <span
                            className="text-[9px] font-mono font-bold tabular-nums text-white/90 whitespace-nowrap"
                            style={{ WebkitTextStroke: "0.3px #000", paintOrder: "stroke fill" } as any}
                          >
                            {timeUntilNextCredit}
                          </span>
                        )}
                  </div>
                )}
              </div>

            </div>
          </div>
        </div>


        {/* --------------------------------------------------------
        ADA HARİTASI — tam ekran katman
      -------------------------------------------------------- */}
        <div
          className="absolute left-0 right-0 z-10 flex items-center justify-center overflow-hidden"
          style={{ top: islandBounds.top, bottom: islandBounds.bottom }}
        >

          <div
            className="relative"
            style={{
              // Görselin genişliği daima yükseklikten oranla türetiliyor:
              // header/menü bar yükseklikleri cihazdan cihaza (APK/IPA) değişse de
              // ada görseli aynı oranı koruyup boşluğa göre büyüyüp küçülüyor.
              aspectRatio: "768 / 1152",
              height: "100%",
              width: "auto",
              scale: "1.08",
            }}
          >
            <HomeIslands
              pointSize={38}
              alerts={{
                sohbet: unreadChatCount > 0,
                arkadaslik: pendingFriendRequests > 0,
              }}
              onSelect={(key) => {
                playSound("buttonClick");
                if (key === "oyunModlari") setShowModePanel(true);
                else if (key === "duello") setShowChallengePanel(true);
                else if (key === "carki") navigate("/wheel");
                else if (key === "sohbet") navigate("/chat");
                else if (key === "arkadaslik") navigate("/friends");
              }}
            />
          </div>

        </div>

        {/* Bulutlar - ön katman */}
        <div className="absolute inset-0 z-[35] pointer-events-none">
          <HomeClouds layer="front" />
        </div>

        {/* ALT MENÜ BAR — harita katmanının üzerinde yüzer */}
        <div ref={navRef} className="absolute bottom-0 left-0 right-0 z-40">
          <HomeBottomNav pendingFriendRequests={pendingFriendRequests} onRadio={() => setShowRadio(true)} />
        </div>

        {/* --- PANELLER --- */}
        <HomeSlidePanel
          open={showChallengePanel}
          onClose={() => setShowChallengePanel(false)}
          title="Düello & Challenge"
          items={challengePanelItems}
        />
        <HomeSlidePanel
          open={showModePanel}
          onClose={() => setShowModePanel(false)}
          title="Oyun Modları"
          items={gameModePanelItems}
        />

        {/* --- MODALLAR --- */}
        {selectedMode && selectedMode === "private-room" ? (
          <PrivateRoomModal
            onClose={() => setSelectedMode(null)}
            onStartGame={(matchId, type) => {
              setSelectedMode(null);
              navigate(`/game/random-match?room=${matchId}&type=${type}`);
            }}
          />
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

        <RadioPicker open={showRadio} onClose={() => setShowRadio(false)} />

        <AvatarViewDialog
          open={showAvatarView}
          onOpenChange={setShowAvatarView}
          avatarUrl={profile?.avatar_url || user?.user_metadata?.avatar_url || ""}
          username={profile?.username || "Oyuncu"}
        />

        <SystemMessagesDialog
          open={showSystemMessages}
          onOpenChange={setShowSystemMessages}
          messages={systemMessages}
          loading={systemLoading}
          readIds={systemReadIds}
          markAllRead={markSystemRead}
        />
      </div>
    </>
  );
};

export default HomePage;
