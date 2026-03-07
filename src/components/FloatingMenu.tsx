// FloatingMenu.tsx

import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useUser } from "@/contexts/UserContext";
import { useSounds } from "@/hooks/useSounds";
import { useMusic } from "@/contexts/MusicContext";
import { Button } from "@/components/ui/button";
import { useChatNotifications } from "@/hooks/useChatNotifications";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";

import {
  User,
  Settings,
  Menu as MenuIcon,
  X,
  Home,
  MessageCircle,
  Trophy,
  Shield,
  Backpack,
  Volume2,
  VolumeX,
  LogOut,
  Users,
  Gamepad2,
} from "lucide-react";

// --- Yardımcı Fonksiyonlar --- (OPTIMIZE: Ban kontrolü artık UserContext profile'dan yapılıyor)
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

const menuItems = [
  { title: "Ana Sayfa", route: "/", icon: Home, iconColor: "text-blue-300", dotColor: "bg-blue-400" },
  { title: "Mini Oyunlar", route: "/mini-games", icon: Gamepad2, iconColor: "text-rose-300", dotColor: "bg-rose-400" },
  { title: "Liderlik", route: "/leaderboard", icon: Trophy, iconColor: "text-amber-300", dotColor: "bg-amber-400" },
  { title: "Profil", route: "/profile", icon: User, iconColor: "text-emerald-300", dotColor: "bg-emerald-400" },
  { title: "Kırtasiye", route: "/market", icon: Backpack, iconColor: "text-purple-300", dotColor: "bg-purple-400" },
  { title: "Arkadaşlar", route: "/friends", icon: Users, iconColor: "text-cyan-300", dotColor: "bg-cyan-400" },
  { title: "Ayarlar", route: "/settings", icon: Settings, iconColor: "text-orange-300", dotColor: "bg-orange-400" },
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
    // 🔥 OPTIMIZE: Artık DB sorgusu yok, cache'den kontrol
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

  // ─── Ortak item satır stili ───────────────────────────────────────────────
  const rowBase =
    "flex items-center gap-3 cursor-pointer select-none " +
    "rounded-2xl px-3 py-2.5 " +
    "bg-gray-800 " +
    "border-2 border-gray-600 " +
    "active:bg-gray-700 " +
    "shadow-md";

  // ─── Stagger animasyonu ───────────────────────────────────────────────────
  // PERFORMANS: translateX slide-in — GPU composite only, CPU yükü minimum
  const staggerStyle = (i: number): React.CSSProperties => ({
    transitionDelay: isOpen ? `${i * 25}ms` : "0ms",
    transform: isOpen ? "translateX(0)" : "translateX(100%)",
    opacity: isOpen ? 1 : 0,
  });

  const itemAnim = () =>
    "transition-[transform,opacity] duration-200 ease-out " +
    (!isOpen ? "pointer-events-none" : "");

  return (
    <div className="fixed bottom-4 right-4 z-50">
      {/* Overlay — transition yok, anında göster/gizle = sıfır GPU yükü */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 -z-10"
          onClick={() => {
            setIsOpen(false);
            onOpenChange?.(false);
          }}
        />
      )}

      {/* Menu items listesi — contain ile layout izole, GPU layer tek */}
      <div
        className={`absolute bottom-24 right-0 flex flex-col items-end gap-2 ${!isOpen ? "pointer-events-none" : ""}`}
        style={{ contain: "layout style", willChange: isOpen ? "contents" : "auto" }}
      >
        {/* ── 1. MÜZİK ── */}
        <div className={itemAnim()} style={staggerStyle(0)}>
          <div
            onClick={() => {
              setMusicEnabled(!musicEnabled);
              playSound("buttonClick");
            }}
            className={rowBase}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${musicEnabled ? "bg-emerald-400" : "bg-gray-500"}`}
            />
            <span className="text-xs font-semibold text-white/95 whitespace-nowrap tracking-wide">
              {musicEnabled ? "Ses Açık" : "Ses Kapalı"}
            </span>
            <div
              className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${
                musicEnabled ? "bg-emerald-500/20 text-emerald-300" : "bg-gray-500/20 text-gray-400"
              }`}
            >
              {musicEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </div>
          </div>
        </div>

        {/* ── 2. MENU ITEMS ── */}
        {menuItems.map((item, index) => (
          <div key={item.route} className={itemAnim()} style={staggerStyle(index + 1)}>
            <div onClick={() => handleMenuClick(item.route)} className={rowBase}>
              <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${item.dotColor}`} />
              <span className="text-xs font-semibold text-white/95 whitespace-nowrap tracking-wide">{item.title}</span>
              <div className="relative flex-shrink-0">
                <div
                  className={`w-8 h-8 rounded-xl flex items-center justify-center bg-white/10 ${item.iconColor} brightness-125`}
                >
                  <item.icon className="w-4 h-4" />
                </div>
                {item.route === "/friends" && pendingFriendRequests > 0 && (
                  <div className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 px-1 bg-red-500 rounded-full flex items-center justify-center text-[9px] font-bold text-white shadow-md">
                    {pendingFriendRequests > 9 ? "9+" : pendingFriendRequests}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}

        {/* ── 3. MODERATÖR ── */}
        {!roleLoading && isModerator && (
          <div className={itemAnim()} style={staggerStyle(menuItems.length + 1)}>
            <div onClick={() => handleMenuClick("/moderator")} className={rowBase}>
              <span className="w-1.5 h-1.5 rounded-full flex-shrink-0 bg-indigo-400" />
              <span className="text-xs font-semibold text-white/95 whitespace-nowrap tracking-wide">Moderatör</span>
              <div className="w-8 h-8 rounded-xl flex items-center justify-center bg-indigo-500/20 text-indigo-300 flex-shrink-0">
                <Shield className="w-4 h-4" />
              </div>
            </div>
          </div>
        )}

        {/* ── 4. SOHBET ── */}
        <div className={itemAnim()} style={staggerStyle(menuItems.length + 2)}>
          <div onClick={handleChatOpen} className={rowBase}>
            <span className="w-1.5 h-1.5 rounded-full flex-shrink-0 bg-teal-400" />
            <span className="text-xs font-semibold text-white/95 whitespace-nowrap tracking-wide">Sohbet</span>
            <div className="relative flex-shrink-0">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center bg-teal-500/20 text-teal-300">
                <MessageCircle className="w-4 h-4" />
              </div>
              {totalNotifications > 0 && (
                <div className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 px-1 bg-red-500 rounded-full flex items-center justify-center text-[9px] font-bold text-white shadow-md">
                  {totalNotifications > 9 ? "9+" : totalNotifications}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── 5. ÇIKIŞ ── */}
        <div className={itemAnim()} style={staggerStyle(menuItems.length + 3)}>
          <div onClick={handleLogout} className={rowBase}>
            <span className="w-1.5 h-1.5 rounded-full flex-shrink-0 bg-red-400" />
            <span className="text-xs font-semibold text-white/95 whitespace-nowrap tracking-wide">Çıkış</span>
            <div className="w-8 h-8 rounded-xl flex items-center justify-center bg-red-500/20 text-red-300 flex-shrink-0">
              <LogOut className="w-4 h-4" />
            </div>
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
