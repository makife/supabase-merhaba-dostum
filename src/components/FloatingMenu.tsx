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
    textIcon: "/icons/kirtasiye-text.svg",
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

  const handleLogout = async () => {
    playSound("buttonClick");
    await signOut();
    setIsOpen(false);
  };

  // ─── Ortak satır stili ──────────────
  const rowBase =
    "inline-flex items-center gap-2.5 cursor-pointer select-none " +
    "rounded-2xl px-3 py-2.5 " +
    "bg-[#1a2744] " +
    "border border-white/80 " +
    "active:bg-gray-600 " +
    "shadow-md whitespace-nowrap";

  const slideStyle: React.CSSProperties = {
    transform: isOpen ? "translateX(0)" : "translateX(120%)",
    opacity: isOpen ? 1 : 0,
    visibility: isOpen ? "visible" : "hidden",
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
    <div className={rowBase}>
      {/* Dot */}
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${dot}`} />

      {/* Yazı SVG */}
      <img
        src={textSrc}
        alt={textAlt}
        className="h-4 w-auto flex-shrink-0"
        style={{ maxWidth: 120 }}
      />

      {/* Görsel ikon */}
      <div className="relative flex-shrink-0">
        <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${bgColor}`}>
          <img
            src={gorselSrc}
            alt=""
            className="w-4 h-4 object-contain"
          />
        </div>
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
              setMusicEnabled(!musicEnabled);
              playSound("buttonClick");
            }}
          >
            {renderRow(
              musicEnabled ? "bg-emerald-400" : "bg-gray-500",
              musicEnabled ? "/icons/sesacik-text.svg" : "/icons/seskapali-text.svg",
              musicEnabled ? "Ses Açık" : "Ses Kapalı",
              musicEnabled ? "/icons/sesacik-gorsel.svg" : "/icons/seskapali-gorsel.svg",
              musicEnabled ? "bg-emerald-500/20" : "bg-gray-500/20"
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
    </div>
  );
}
