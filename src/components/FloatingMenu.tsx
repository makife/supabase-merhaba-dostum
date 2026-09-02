// FloatingMenu.tsx

import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useUser } from "@/contexts/UserContext";
import { useSounds } from "@/hooks/useSounds";
import { useMusic } from "@/contexts/MusicContext";
import { useChatNotifications } from "@/hooks/useChatNotifications";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { Menu as MenuIcon, X } from "lucide-react";
import { SvgAsset } from "@/components/ui/svg-asset";
import { RadioPicker } from "@/components/RadioPicker";
import { useRadio } from "@/contexts/RadioContext";
import cikisYapildiImg from "@/assets/cikisYapildi.webp";

// --- Yardımcı Fonksiyonlar ---
const isUserBannedFromProfile = (profile: any): boolean => {
  if (!profile?.banned_until) return false;
  return new Date(profile.banned_until) > new Date();
};

const getBanTimeLeftFromProfile = (profile: any): string => {
  if (!profile?.banned_until) return "yok";
  const banTime = new Date(profile.banned_until).getTime();
  const now = Date.now();
  const diff = banTime - now;
  if (diff <= 0) return "yok";
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  return `${hours} saat ${minutes} dakika`;
};

// ─── Menu item tanımları ───────────────────────────────────────────────────
const menuItems = [
  {
    route: "/leaderboard",
    textIcon: "/icons/liderlik-text.svg",
    gorselIcon: "/icons/liderlik-gorsel.svg",
    dotColor: "bg-amber-400",
    bgColor: "bg-amber-500/20",
  },
  {
    route: "/profile",
    textIcon: "/icons/profil-text.svg",
    gorselIcon: "/icons/profil-gorsel.svg",
    dotColor: "bg-emerald-400",
    bgColor: "bg-emerald-500/20",
  },
  {
    route: "/market",
    textIcon: "/icons/marketText.svg",
    gorselIcon: "/icons/kirtasiye-gorsel.svg",
    dotColor: "bg-purple-400",
    bgColor: "bg-purple-500/20",
  },
  {
    route: "/friends",
    textIcon: "/icons/arkadaslar-text.svg",
    gorselIcon: "/icons/arkadaslar-gorsel.svg",
    dotColor: "bg-cyan-400",
    bgColor: "bg-cyan-500/20",
  },
  {
    route: "/settings",
    textIcon: "/icons/ayarlar-text.svg",
    gorselIcon: "/icons/ayarlar-gorsel.svg",
    dotColor: "bg-orange-400",
    bgColor: "bg-orange-500/20",
  },
];

interface FloatingMenuProps {
  onOpenChange?: (isOpen: boolean) => void;
}

export function FloatingMenu({ onOpenChange }: FloatingMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const navigate = useNavigate();
  const { signOut, user } = useAuth();
  const { profile } = useUser();
  const { playSound } = useSounds();
  const { musicEnabled, setMusicEnabled } = useMusic();
  const { totalNotifications } = useChatNotifications();
  const { isModerator, loading: roleLoading } = useUserRole();
  const { isPlaying: radioPlaying, stop: stopRadio } = useRadio();
  const soundOn = musicEnabled && !radioPlaying;
  const [radioOpen, setRadioOpen] = useState(false);
  const [pendingFriendRequests, setPendingFriendRequests] = useState(0);

  const fetchPendingFriends = useCallback(async () => {
    if (!user) return;
    try {
      const { count } = await supabase
        .from("friendships")
        .select("id", { count: "exact", head: true })
        .eq("friend_id", user.id)
        .eq("status", "pending");
      setPendingFriendRequests(count || 0);
    } catch {}
  }, [user]);

  useEffect(() => {
    fetchPendingFriends();
    const interval = setInterval(fetchPendingFriends, 30000);
    return () => clearInterval(interval);
  }, [fetchPendingFriends]);

  const handleToggle = () => {
    playSound("buttonClick");
    const newState = !isOpen;
    setIsOpen(newState);
    onOpenChange?.(newState);
  };

  const handleMenuClick = (route: string) => {
    playSound("buttonClick");
    navigate(route);
    setIsOpen(false);
    onOpenChange?.(false);
  };

  const handleChatOpen = async () => {
    playSound("buttonClick");
    const isBanned = isUserBannedFromProfile(profile);
    if (isBanned) {
      const timeLeft = getBanTimeLeftFromProfile(profile);
      toast.error(`Sohbet yasağınız bulunuyor. 🚫\nKalan süre: ${timeLeft}\nYasak sebebi: Yasaklı kelime kullanımı`, {
        duration: 7000,
        icon: "⏰",
      });
      return;
    }
    try {
      await supabase
        .from("notifications")
        .update({ is_read: true } as any)
        .eq("user_id", user.id as any)
        .eq("type", "mention" as any)
        .eq("is_read", false as any);
    } catch (error) {
      console.error("Error marking notifications as read:", error);
    }
    navigate("/chat");
    setIsOpen(false);
  };

  const [showSignedOutImage, setShowSignedOutImage] = useState(false);

  const handleLogout = async () => {
    playSound("buttonClick");
    setIsOpen(false);
    setShowSignedOutImage(true);
    await signOut();
    setTimeout(() => {
      setShowSignedOutImage(false);
      navigate("/auth");
    }, 1800);
  };

  // ─── Ortak satır stili ──────────────
  const rowBase =
    "inline-flex w-[240px] min-h-[56px] items-center justify-between gap-3 cursor-pointer select-none " +
    "rounded-2xl px-4 py-2 " +
    "border border-white/80 " +
    "active:opacity-80 " +
    "shadow-md whitespace-nowrap";

  const rowBgStyle: React.CSSProperties = {
    backgroundImage: "url('/alttaban/menubutonalttaban.svg')",
    backgroundSize: "cover",
    backgroundPosition: "center",
  };

  const slideStyle: React.CSSProperties = {
    transform: isOpen ? "translate3d(0, 0, 0)" : "translate3d(120%, 0, 0)",
    WebkitTransform: isOpen ? "translate3d(0, 0, 0)" : "translate3d(120%, 0, 0)",
    opacity: isOpen ? 1 : 0,
    visibility: isOpen ? "visible" : "hidden",
    backfaceVisibility: "hidden",
    WebkitBackfaceVisibility: "hidden",
    willChange: "transform, opacity",
    transition: "transform 200ms ease-out, opacity 200ms ease-out, visibility 200ms ease-out",
  };

  const itemAnim = () =>
    (!isOpen ? "pointer-events-none" : "");

  // ─── Tek satır: dot + yazı SVG + görsel ikon ─────────────────────────────
  const renderRow = (
    dot: string,
    textSrc: string,
    textAlt: string,
    gorselSrc: string,
    bgColor: string,
    badge?: React.ReactNode
  ) => (
    <div className={rowBase} style={rowBgStyle}>
      {/* Dot */}
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${dot}`} />

      {/* Yazı SVG */}
      <SvgAsset
        src={textSrc}
        alt={textAlt}
        className={`${textSrc.includes("radyotext") ? "h-7 w-32" : "h-5 w-28"} flex-shrink-0 bg-left`}
      />

      {/* Görsel ikon */}
      <div className="relative flex h-10 w-10 flex-shrink-0 items-center justify-center">
        <SvgAsset
          src={gorselSrc}
          className="h-10 w-10"
        />
        {badge}
      </div>
    </div>
  );

  return (
    <div className="fixed bottom-4 right-4 z-50">
      {/* Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 -z-10"
          onClick={() => {
            setIsOpen(false);
            onOpenChange?.(false);
          }}
        />
      )}

      {/* Menu items — items end, hiç overflow-hidden yok */}
      <div className={`absolute bottom-24 right-0 flex flex-col items-end gap-2 ${!isOpen ? "pointer-events-none" : ""}`} style={{ clipPath: isOpen ? 'none' : 'inset(0 0 0 100%)' }}>

        {/* ── 1. MÜZİK ── */}
        <div className={itemAnim()} style={slideStyle}>
          <div
            onClick={() => {
              playSound("buttonClick");
              if (radioPlaying) {
                stopRadio();
                if (!musicEnabled) setMusicEnabled(true);
              } else {
                setMusicEnabled(!musicEnabled);
              }
            }}
          >
            {renderRow(
              soundOn ? "bg-emerald-400" : "bg-gray-500",
              soundOn ? "/icons/sesacik-text.svg" : "/icons/seskapali-text.svg",
              soundOn ? "Ses Açık" : "Ses Kapalı",
              soundOn ? "/icons/sesacik-gorsel.svg" : "/icons/seskapali-gorsel.svg",
              soundOn ? "bg-emerald-500/20" : "bg-gray-500/20"
            )}
          </div>
        </div>

        {/* ── 1b. RADYO ── */}
        <div className={itemAnim()} style={slideStyle}>
          <div
            onClick={() => {
              playSound("buttonClick");
              setRadioOpen(true);
              setIsOpen(false);
              onOpenChange?.(false);
            }}
          >
            {renderRow(
              radioPlaying ? "bg-amber-400 animate-pulse" : "bg-amber-400",
              "/icons/radyotext.svg",
              "Radyo",
              "/icons/radyo-gorsel.svg",
              "bg-amber-500/20"
            )}
          </div>
        </div>


        {/* ── 2. MENU ITEMS ── */}
        {menuItems.map((item) => (
          <div key={item.route} className={itemAnim()} style={slideStyle}>
            <div onClick={() => handleMenuClick(item.route)}>
              {renderRow(
                item.dotColor,
                item.textIcon,
                item.route,
                item.gorselIcon,
                item.bgColor,
                item.route === "/friends" && pendingFriendRequests > 0 ? (
                  <div className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 px-1 bg-red-500 rounded-full flex items-center justify-center text-[9px] font-bold text-white shadow-md">
                    {pendingFriendRequests > 9 ? "9+" : pendingFriendRequests}
                  </div>
                ) : undefined
              )}
            </div>
          </div>
        ))}

        {/* ── 3. MODERATÖR ── */}
        {!roleLoading && isModerator && (
          <div className={itemAnim()} style={slideStyle}>
            <div onClick={() => handleMenuClick("/moderator")}>
              {renderRow(
                "bg-indigo-400",
                "/icons/moderator-text.svg",
                "Moderatör",
                "/icons/moderator-gorsel.svg",
                "bg-indigo-500/20"
              )}
            </div>
          </div>
        )}

        {/* ── 4. SOHBET ── */}
        <div className={itemAnim()} style={slideStyle}>
          <div onClick={handleChatOpen}>
            {renderRow(
              "bg-teal-400",
              "/icons/sohbet-text.svg",
              "Sohbet",
              "/icons/sohbet-gorsel.svg",
              "bg-teal-500/20",
              totalNotifications > 0 ? (
                <div className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 px-1 bg-red-500 rounded-full flex items-center justify-center text-[9px] font-bold text-white shadow-md">
                  {totalNotifications > 9 ? "9+" : totalNotifications}
                </div>
              ) : undefined
            )}
          </div>
        </div>

        {/* ── 5. ÇIKIŞ ── */}
        <div className={itemAnim()} style={slideStyle}>
          <div onClick={handleLogout}>
            {renderRow(
              "bg-red-400",
              "/icons/cikis-text.svg",
              "Çıkış",
              "/icons/cikis-gorsel.svg",
              "bg-red-500/20"
            )}
          </div>
        </div>
      </div>

      {/* ── Ana toggle butonu ── */}
      <div className="fixed bottom-4 right-4" data-onboarding="floating-menu">
        <button
          onClick={handleToggle}
          className={`
            relative w-[72px] h-[72px] rounded-full
            flex items-center justify-center
            active:scale-90
            ${
              isOpen
                ? "bg-white shadow-[0_6px_28px_rgba(0,0,0,0.5)] ring-2 ring-white/40"
                : "bg-gradient-to-br from-white to-gray-200 shadow-[0_4px_20px_rgba(255,255,255,0.15)] ring-2 ring-white/30"
            }
          `}
        >
          {isOpen ? <X className="w-8 h-8 text-gray-900" /> : <MenuIcon className="w-8 h-8 text-gray-900" />}
          {!isOpen && totalNotifications > 0 && (
            <span className="absolute top-1.5 right-1.5 w-3 h-3 rounded-full bg-red-500 ring-2 ring-white shadow-md" />
          )}
        </button>
      </div>

      <RadioPicker open={radioOpen} onClose={() => setRadioOpen(false)} />

      {showSignedOutImage && (
        <div className="fixed inset-0 z-[2147483000] flex items-center justify-center bg-black/70 backdrop-blur-sm px-4">
          <img
            src={cikisYapildiImg}
            alt="Çıkış Yapıldı"
            className="w-full max-w-[420px] h-auto select-none"
            draggable={false}
          />
        </div>
      )}
    </div>
  );
}

