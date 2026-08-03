import { useState, useEffect, memo, useCallback } from "react";
import { useMusic } from "@/contexts/MusicContext";
import { useAuth } from "@/contexts/AuthContext";
import { useUser } from "@/contexts/UserContext";
import { useSounds } from "@/hooks/useSounds";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { usePremiumDailyRewards } from "@/hooks/usePremiumDailyRewards";
import { AvatarViewDialog } from "@/components/AvatarViewDialog";
import { FloatingMenu } from "@/components/FloatingMenu";
import LeaderboardPrizeDialog from "@/components/LeaderboardPrizeDialog";
import ChallengePrizeDialog from "@/components/ChallengePrizeDialog";
import Lottie from "lottie-react";
import { useSystemMessages } from "@/hooks/useSystemMessages";
import { SystemMessagesDialog } from "@/components/SystemMessagesDialog";
import { HomeIslandScene } from "@/components/HomeIslandScene";

import { Clock, Gift } from "lucide-react";

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

const UnlimitedIcon = ({ className = "" }: { className?: string }) => (
  <img src="/icons/unlimited.svg" className={className} alt="" />
);

// --- ANA SAYFA ---

const HomePage = () => {
  const { user } = useAuth();
  const { profile, isPremium, refreshProfile, getTotalCredits } = useUser();
  const navigate = useNavigate();
  const { playSound } = useSounds();
  // 🔥 DÜZELTME: startBackgroundMusic ARTIK YOK. Native otomatik hallediyor.
  // const { startBackgroundMusic } = useMusic(); <-- SİLİNDİ
  usePremiumDailyRewards();

  const [timeUntilNextCredit, setTimeUntilNextCredit] = useState<string>("");
  const [unlimitedTimeLeft, setUnlimitedTimeLeft] = useState<string>("");
  const [premiumTimeLeft, setPremiumTimeLeft] = useState<string>("");
  const [sayfaHakAnim, setSayfaHakAnim] = useState<any>(null);
  const [boostProfilAnim, setBoostProfilAnim] = useState<any>(null);

  const boostUntilHome = (profile as any)?.score_boost_until ? new Date((profile as any).score_boost_until) : null;
  const boostSourceHome = (profile as any)?.score_boost_source;
  const boostRemainingMsHome = boostUntilHome ? boostUntilHome.getTime() - Date.now() : 0;
  const boostActiveHome = boostRemainingMsHome > 0 && (boostSourceHome === "kelime_avi" || boostSourceHome === "leaderboard" || boostRemainingMsHome > 2 * 60 * 60 * 1000);

  useEffect(() => {
    if (boostActiveHome && !boostProfilAnim) {
      fetch("/boostProfil.json").then(r => r.json()).then(setBoostProfilAnim).catch(() => {});
    }
  }, [boostActiveHome, boostProfilAnim]);

  const [showAvatarView, setShowAvatarView] = useState(false);
  const [showSystemMessages, setShowSystemMessages] = useState(false);
  const { messages: systemMessages, unreadCount: systemUnread, loading: systemLoading, markAllRead: markSystemRead, readIds: systemReadIds } = useSystemMessages();

  // Eski bot rematch URL'lerini temizle; bot rematch artık özel oda bekleme akışıyla başlar.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("autoRematch") !== "1") return;
    const url = new URL(window.location.href);
    url.searchParams.delete("autoRematch");
    url.searchParams.delete("botNow");
    window.history.replaceState({}, "", url.toString());
  }, []);


  // Sayfa hak animasyonunu yükle
  useEffect(() => {
    if (!user?.id) return;
    fetch("/sayfaHak.json")
      .then((r) => r.json())
      .then(setSayfaHakAnim)
      .catch(() => {});
  }, [user?.id]);

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
  }, []);

  // Sağ/sol ok tıklamalarında ilgili sayfaya git (dönüş animasyonu bittikten sonra)
  const goToProfile = useCallback(() => {
    playSound("buttonClick");
    navigate("/profile");
  }, [playSound, navigate]);

  const goToLeaderboard = useCallback(() => {
    playSound("buttonClick");
    navigate("/leaderboard");
  }, [playSound, navigate]);

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
        {/* Light Effects */}
        <div
          className={`absolute inset-0 bg-[radial-gradient(circle_at_top,_var(--tw-gradient-stops))] ${levelBgColors.gradient} via-transparent to-transparent pointer-events-none opacity-30`}
        />

        {/* --------------------------------------------------------
        SABİT ÜST ALAN (FIXED HEADER AREA) 
      -------------------------------------------------------- */}
        <div className="flex-none z-30 pb-4 relative border-b border-white/5">
          {/* HEADER (Profil & Mürekkep) */}
          <div className="px-5 pt-6 pb-2 flex items-center justify-between">
            {/* Profil */}
            <div className="flex items-center gap-3 cursor-pointer" onClick={() => setShowAvatarView(true)}>
              <div className="relative">
                {boostActiveHome && boostProfilAnim && (
                  <div className="absolute inset-0 -m-10 pointer-events-none z-0">
                    <Lottie
                      animationData={boostProfilAnim}
                      loop
                      autoplay
                      style={{ width: "100%", height: "100%" }}
                    />
                  </div>
                )}
                <div
                  className={`relative z-10 w-12 h-12 rounded-full p-[2px] ${vipType ? "bg-gradient-to-tr from-amber-300 to-orange-500" : "bg-gradient-to-tr from-indigo-400 to-purple-500"}`}
                >
                  <Avatar className="w-full h-full border-2 border-[#1a1a2e]">
                    <AvatarImage
                      src={profile?.avatar_url || user?.user_metadata?.avatar_url}
                      className="object-cover"
                    />
                    <AvatarFallback className="bg-slate-800 text-slate-400 text-xs">U</AvatarFallback>
                  </Avatar>
                </div>
              </div>
              <div>
                <h2 className="text-base font-bold leading-tight text-white drop-shadow-md">
                  {profile?.username || "Misafir"}
                </h2>
                <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">{greeting}</p>
              </div>
            </div>

            {/* Mürekkep + Bildirim */}
            <div className="flex items-center gap-2">
              <div
                onClick={() => {
                  playSound("buttonClick");
                  navigate("/market");
                }}
                className="flex items-center gap-2 bg-[#1e2d45] border border-indigo-500/20 rounded-full pl-1 pr-4 py-1.5 active:scale-95 transition-all cursor-pointer"
              >
                <div className="w-10 h-10 bg-indigo-500/10 rounded-full flex items-center justify-center">
                  <img src="/damlaMurekkep.png" alt="ink" className="w-7 h-7 object-contain brightness-110" />
                </div>
                <span className="text-base font-bold text-white">{profile?.ink_count || 0}</span>
              </div>

              {/* Sistem Mesajları Bildirim Görseli */}
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
            </div>

          </div>


          {/* --- LEVEL VE XP KARTI --- */}
          <div className="px-5 mt-2">
            {(() => {
              const level = levelData.level;
              let starGradient = "from-amber-400 to-orange-500";
              let shadowColor = "shadow-orange-500/20";

              if (level >= 70) {
                starGradient = "from-slate-400 to-slate-600";
                shadowColor = "shadow-slate-500/20";
              } else if (level >= 40) {
                starGradient = "from-blue-400 to-blue-600";
                shadowColor = "shadow-blue-500/20";
              } else if (level >= 25) {
                starGradient = "from-emerald-400 to-green-600";
                shadowColor = "shadow-green-500/20";
              } else if (level >= 10) {
                starGradient = "from-purple-500 to-indigo-600";
                shadowColor = "shadow-purple-500/20";
              }

              return (
                <div className="relative flex items-center justify-between px-8 py-4 bg-[#1e2d45] rounded-2xl border border-white/30">
                  <div className="flex items-center gap-4">
                    <img
                      src={getLevelFruitIcon(level)}
                      alt="level"
                      className="w-11 h-11 object-contain drop-shadow-md"
                    />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-white">Seviye {level}</span>
                        <span className="text-[10px] text-slate-500 font-mono">
                          {levelData.experience}/{levelData.nextLevelExp} XP
                        </span>
                      </div>
                      <div className="h-4 w-32 bg-slate-800 rounded-full mt-2 overflow-hidden border border-white/5">
                        <div
                          className={`h-full bg-gradient-to-r ${starGradient} transition-all duration-1000`}
                          style={{ width: `${progressPercent}%` }}
                        />
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-[9px] text-slate-500 block uppercase tracking-[0.1em] mb-1">Puan</span>
                    <span className="text-sm font-mono font-bold text-red-500">
                      {(profile?.total_score || 0).toLocaleString()}
                    </span>
                  </div>
                </div>
              );
            })()}
          </div>

          {/* INFO PANELS (SÜRE & HAK) */}
          <div className="px-5 mt-2 space-y-2">
            {isPremium && premiumTimeLeft && (
              <div
                className={`flex items-center justify-between rounded-xl p-3 px-4 border-2 ${
                  vipType === "yearly"
                    ? "bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 border-amber-600"
                    : vipType === "monthly"
                      ? "bg-gradient-to-r from-blue-400 via-cyan-400 to-blue-500 border-blue-600"
                      : "bg-gradient-to-r from-amber-50 to-orange-50 border-slate-600"
                }`}
              >
                <div className="flex items-center gap-2">
                  <VipCrownIcon className="w-10 h-10" />
                  <div className="flex flex-col">
                    <span
                      className={`text-sm font-bold ${
                        vipType === "yearly" || vipType === "monthly" ? "text-white" : "text-amber-800"
                      }`}
                    >
                      {vipType === "yearly"
                        ? "⭐ VIP Yazar (Yıllık)"
                        : vipType === "monthly"
                          ? "💎 VIP Yazar (Aylık)"
                          : "VIP Yazar"}
                    </span>
                    <span
                      className={`text-[10px] ${
                        vipType === "yearly" || vipType === "monthly" ? "text-white/80" : "text-amber-600"
                      }`}
                    >
                      Sınırsız hak • Günlük joker • 2x XP
                    </span>
                  </div>
                </div>
                <div
                  className={`px-2 py-1 rounded-lg ${
                    vipType === "yearly" || vipType === "monthly" ? "bg-white/20" : "bg-amber-100"
                  }`}
                >
                  <span
                    className={`text-xs font-mono font-bold ${
                      vipType === "yearly" || vipType === "monthly" ? "text-white" : "text-amber-600"
                    }`}
                  >
                    {premiumTimeLeft}
                  </span>
                </div>
              </div>
            )}

            {(!isPremium || isUnlimitedLivesActive(profile)) && (
              <div
                className={`flex items-center gap-2 backdrop-blur-md border border-white/30 rounded-xl p-2 pl-0 pr-2 overflow-hidden ${
                  isUnlimitedLivesActive(profile)
                    ? getUnlimitedType(profile) === "maraton"
                      ? "bg-gradient-to-r from-amber-500/10 to-orange-500/10"
                      : "bg-gradient-to-r from-blue-500/10 to-cyan-500/10"
                    : "bg-[#1e2d45]"
                }`}
              >
                {/* Sabit "Kalan Sayfalarım" etiketi — boyutu asla değişmez */}
                <span
                  className={`text-xs font-black uppercase tracking-wider flex-shrink-0 ${
                    isUnlimitedLivesActive(profile)
                      ? getUnlimitedType(profile) === "maraton"
                        ? "text-amber-400 px-2"
                        : "text-blue-400 px-2"
                      : "text-white self-stretch inline-flex items-center justify-center -my-2 px-3 py-2 rounded-l-xl shadow-inner"
                  }`}
                  style={
                    !isUnlimitedLivesActive(profile)
                      ? {
                          background: "linear-gradient(to bottom, #f87171, #dc2626, #7f1d1d)",
                        }
                      : undefined
                  }
                >
                  {isUnlimitedLivesActive(profile) ? (
                    <span className="flex items-center gap-1.5">
                      <UnlimitedIcon className="w-12 h-12 flex-shrink-0 -my-2" />
                      {getUnlimitedType(profile) === "maraton" ? "Maraton Modu" : "Sınırsız Akış"}
                    </span>
                  ) : (
                    <span
                      className="flex flex-col items-center leading-tight"
                      style={{ WebkitTextStroke: "0.5px #000", paintOrder: "stroke fill" } as any}
                    >
                      <span>Kalan</span>
                      <span>Sayfalarım</span>
                    </span>
                  )}
                </span>

                {isUnlimitedLivesActive(profile) ? (
                  <div className="flex items-center gap-2 ml-auto">
                    {unlimitedTimeLeft ? (
                      <div
                        className={`flex items-center gap-1.5 px-2 py-0.5 rounded-lg border ${
                          getUnlimitedType(profile) === "maraton"
                            ? "bg-amber-500/20 border-amber-500/30"
                            : "bg-blue-500/20 border-blue-500/30"
                        }`}
                      >
                        <Clock
                          className={`w-3 h-3 animate-pulse ${
                            getUnlimitedType(profile) === "maraton" ? "text-amber-400" : "text-blue-400"
                          }`}
                        />
                        <span
                          className={`text-xs font-mono font-bold tabular-nums ${
                            getUnlimitedType(profile) === "maraton" ? "text-amber-300" : "text-blue-300"
                          }`}
                        >
                          {unlimitedTimeLeft}
                        </span>
                      </div>
                    ) : (
                      <div className="w-16 h-5 bg-slate-700 rounded animate-pulse" />
                    )}
                    <Badge
                      className={`text-[10px] px-2 py-0.5 border ${
                        getUnlimitedType(profile) === "maraton"
                          ? "bg-amber-500/20 text-amber-300 border-amber-500/30"
                          : "bg-blue-500/20 text-blue-300 border-blue-500/30"
                      }`}
                    >
                      Sınırsız
                    </Badge>
                  </div>
                ) : (
                  <>
                    {/* Hak ikonları — kırmızı bandın hemen bitiminden başlar, sabit alan */}
                    <div className="flex -space-x-3 flex-shrink-0">
                      {Array.from({ length: 5 }, (_, i) => (
                        <HakIcon
                          key={i}
                          animData={sayfaHakAnim}
                          filled={i < Math.min(totalCredits, 5)}
                          size={44}
                        />
                      ))}
                    </div>

                    {/* Sağ uç: +N badge (kartın ucuna değer) veya çerçeveli sayaç */}
                    <div className="ml-auto flex items-center justify-end flex-shrink-0">
                      {totalCredits > 5 ? (
                        <div className="relative inline-flex items-center justify-center w-9 h-9 -mr-1">
                          <img src="/icons/kredifazlasi-badge.svg" alt="" className="w-9 h-9 object-contain" />
                          <span
                            className="absolute text-white text-[12px] font-bold"
                            style={{ WebkitTextStroke: "0.3px black", textShadow: "0 0 2px black" }}
                          >+{totalCredits - 5}</span>
                        </div>
                      ) : timeUntilNextCredit ? (
                        <div className="flex items-center gap-1 px-2 py-1 rounded-lg border border-white/30 bg-black/30">
                          <Clock className="w-3 h-3 text-white/80" />
                          <span
                            className="text-[11px] font-mono font-bold tabular-nums text-white whitespace-nowrap"
                            style={{ WebkitTextStroke: "0.3px #000", paintOrder: "stroke fill" } as any}
                          >
                            {timeUntilNextCredit}
                          </span>
                        </div>
                      ) : null}
                    </div>
                  </>
                )}
              </div>
            )}

          {/* HEDİYE BANNER */}
          {isPremium && isGiftPremium(profile) && (
            <div className="px-5 mt-4">
              <div className="bg-gradient-to-r from-pink-500 to-rose-500 rounded-2xl p-4 flex items-center gap-4 relative overflow-hidden">
                <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20" />
                <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-md z-10">
                  <Gift className="w-5 h-5 text-white animate-bounce" />
                </div>
                <div className="flex-1 z-10">
                  <h3 className="text-sm font-bold text-white">Hediye Premium!</h3>
                  <p className="text-[10px] text-white/90">
                    Kalan: {new Date(profile.premium_until).toLocaleDateString("tr-TR")}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
        </div>

        {/* --------------------------------------------------------
        3D SAHNE ALANI (YÜZEN ADA) 
      -------------------------------------------------------- */}
        <div className="flex-1 min-h-0 relative z-10">
          <HomeIslandScene onFinishLeft={goToProfile} onFinishRight={goToLeaderboard} />
        </div>


        <div className="fixed bottom-0 left-0 right-0 z-50">
          <FloatingMenu />
        </div>

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
