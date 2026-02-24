// FloatingMenu.tsx

import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
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
} from "lucide-react";

// --- Yardımcı Fonksiyonlar ---
const isUserBanned = async (userId: string): Promise<boolean> => {
  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("banned_until")
      .eq("id", userId as any)
      .single();
    if (error || !data) return false;
    const result = data as { banned_until: string | null };
    if (!result.banned_until) return false;
    return new Date(result.banned_until) > new Date();
  } catch (error) {
    console.error("Ban kontrolü hatası:", error);
    return false;
  }
};

const getBanTimeLeft = async (userId: string): Promise<string> => {
  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("banned_until")
      .eq("id", userId as any)
      .single();
    if (error || !data) return "yok";
    const result = data as { banned_until: string | null };
    if (!result.banned_until) return "yok";
    const banTime = new Date(result.banned_until).getTime();
    const now = Date.now();
    const diff = banTime - now;
    if (diff <= 0) return "yok";
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours} saat ${minutes} dakika`;
  } catch (error) {
    return "bilinmiyor";
  }
};

const menuItems = [
  { title: "Ana Sayfa", route: "/", icon: Home, iconColor: "text-blue-300", dotColor: "bg-blue-400" },
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
    const isBanned = await isUserBanned(user.id);
    if (isBanned) {
      const timeLeft = await getBanTimeLeft(user.id);
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
    "bg-[rgba(255,255,255,0.10)] " +
    "border-2 border-white/40 " + // 👈 2px ve daha belirgin
    "hover:bg-[rgba(255,255,255,0.16)] hover:ring-white/60 " +
    "active:scale-95 transition-colors duration-150 " +
    "shadow-md";

  // ─── Stagger animasyonu ───────────────────────────────────────────────────
  // DEĞİŞTİRİLENLER:
  // 1. scale kaldırıldı → boyut hesabı yok = titreme yok
  // 2. will-change artık dinamik değil, sabit string = layout thrashing yok
  // 3. translate-y-2 (küçük kayma), eskiden translate-y-3 idi
  const staggerStyle = (i: number): React.CSSProperties => ({
    transitionDelay: isOpen ? `${i * 40}ms` : "0ms",
    willChange: "transform, opacity", // sabit — state'e göre değişmiyor
  });

  const itemAnim = () =>
    "transition-[transform,opacity] duration-200 ease-out " +
    (isOpen ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2 pointer-events-none");
  // scale-95 → kaldırıldı (titreme sebebiydi)

  return (
    <div className="fixed bottom-4 right-4 z-50">
      {/* Overlay — blur YOK, sadece koyu opacity
          blur-md büyük ekran alanında GPU'yu çok zorlar (Snapdragon 680)
          bg-black/50 aynı "odak" hissini verir, sıfır GPU ek yükü */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 -z-10 transition-opacity duration-200"
          onClick={() => {
            setIsOpen(false);
            onOpenChange?.(false);
          }}
        />
      )}

      {/* Menu items listesi */}
      <div
        className={`absolute bottom-24 right-0 flex flex-col items-end gap-2 ${!isOpen ? "pointer-events-none" : ""}`}
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
          // willChange sabit inline style — toggle sırasında layout thrashing önler
          style={{ willChange: "transform" }}
          className={`
            relative w-[72px] h-[72px] rounded-full
            flex items-center justify-center
            transition-transform duration-200 ease-out
            active:scale-90 hover:scale-105
            ${
              isOpen
                ? "bg-white shadow-[0_6px_28px_rgba(0,0,0,0.5)] ring-2 ring-white/40"
                : "bg-gradient-to-br from-white to-gray-200 shadow-[0_6px_28px_rgba(255,255,255,0.15)] ring-2 ring-white/30"
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
