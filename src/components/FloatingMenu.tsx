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
  {
    title: "Ana Sayfa",
    route: "/",
    icon: Home,
    color: "from-blue-500 to-blue-600",
    // group-hover kullanarak tüm satıra gelindiğinde rengin değişmesini sağlıyoruz
    hoverColor: "group-hover:from-blue-600 group-hover:to-blue-700",
  },
  {
    title: "Liderlik",
    route: "/leaderboard",
    icon: Trophy,
    color: "from-yellow-500 to-amber-600",
    hoverColor: "group-hover:from-yellow-600 group-hover:to-amber-700",
  },
  {
    title: "Profil",
    route: "/profile",
    icon: User,
    color: "from-green-500 to-green-600",
    hoverColor: "group-hover:from-green-600 group-hover:to-green-700",
  },
  {
    title: "Kırtasiye",
    route: "/market",
    icon: Backpack,
    color: "from-purple-500 to-purple-600",
    hoverColor: "group-hover:from-purple-600 group-hover:to-purple-700",
  },
  {
    title: "Arkadaşlar",
    route: "/friends",
    icon: Users,
    color: "from-cyan-500 to-cyan-600",
    hoverColor: "group-hover:from-cyan-600 group-hover:to-cyan-700",
  },
  {
    title: "Ayarlar",
    route: "/settings",
    icon: Settings,
    color: "from-orange-500 to-orange-600",
    hoverColor: "group-hover:from-orange-600 group-hover:to-orange-700",
  },
];

interface FloatingMenuProps {
  onOpenChange?: (isOpen: boolean) => void;
}

const menuColors = {
  closed: "from-gray-800 to-slate-500 hover:from-gray-900 hover:to-slate-600",
  ping: "from-gray-800 to-slate-500",
  glow: "from-gray-800/50 to-slate-500/50",
};

export function FloatingMenu({ onOpenChange }: FloatingMenuProps) {
  const colors = menuColors;
  const [isOpen, setIsOpen] = useState(false);
  const navigate = useNavigate();
  const { signOut, user } = useAuth();
  const { playSound } = useSounds();
  const { musicEnabled, setMusicEnabled } = useMusic();
  const { totalNotifications } = useChatNotifications();
  const { isModerator, loading: roleLoading } = useUserRole();

  // Pending friend request count (poll every 30s)
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

  return (
    <div className="fixed bottom-4 right-4 z-50">
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/40 -z-10"
          onClick={() => {
            setIsOpen(false);
            onOpenChange?.(false);
          }}
        />
      )}

      <div
        className={`absolute bottom-24 right-0 flex flex-col items-end space-y-3 transition-all duration-300 ${
          isOpen ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4 pointer-events-none"
        }`}
      >
        {/* 1. MUSIC TOGGLE - Tüm satır tıklanabilir */}
        <div
          className={`flex items-center space-x-3 transform transition-all duration-300 ${
            isOpen ? "translate-x-0 scale-100" : "translate-x-8 scale-75"
          }`}
          style={{ transitionDelay: isOpen ? "0ms" : `${(menuItems.length + 3) * 40}ms` }}
        >
          {/* TIKLAMA OLAYI BURAYA TAŞINDI */}
          <div
            onClick={() => {
              setMusicEnabled(!musicEnabled);
              playSound("buttonClick");
            }}
            className="flex items-center space-x-2 bg-red-600/80 backdrop-blur-md rounded-full px-3 py-1.5 border border-white/20 shadow-xl cursor-pointer group active:scale-95 transition-transform"
          >
            <span
              className="text-sm font-semibold text-white whitespace-nowrap pointer-events-none select-none tracking-wide"
              style={{
                fontFamily: '"Inter", "SF Pro Display", -apple-system, BlinkMacSystemFont, sans-serif',
                textShadow: "0 1px 3px rgba(0,0,0,0.8), 0 0 6px rgba(255,255,255,0.1)",
              }}
            >
              {musicEnabled ? "Ses Açık" : "Ses Kapalı"}
            </span>

            {/* Butondaki onClick kaldırıldı ve pointer-events-none eklendi */}
            <Button
              className={`relative overflow-hidden pointer-events-none ${
                musicEnabled
                  ? "bg-gradient-to-r from-green-500 to-green-600 group-hover:from-green-600 group-hover:to-green-700"
                  : "bg-gradient-to-r from-gray-500 to-gray-600 group-hover:from-gray-600 group-hover:to-gray-700"
              } text-white border-2 border-white shadow-lg group-hover:shadow-xl transform group-hover:scale-105 
              transition-all duration-200 w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0`}
            >
              <div className="absolute inset-0 bg-white/20 scale-0 group-hover:scale-100 transition-transform duration-300 rounded-full" />
              {musicEnabled ? (
                <Volume2 className="w-5 h-5 relative z-10" />
              ) : (
                <VolumeX className="w-5 h-5 relative z-10 opacity-70" />
              )}
            </Button>
          </div>
        </div>

        {/* 2. MENU ITEMS - Tüm satır tıklanabilir */}
        {menuItems.map((item, index) => (
          <div
            key={item.route}
            className={`flex items-center space-x-3 transform transition-all duration-300 ${
              isOpen ? "translate-x-0 scale-100" : "translate-x-8 scale-75"
            }`}
            style={{
              transitionDelay: isOpen ? `${(index + 1) * 60}ms` : `${(menuItems.length + 2 - index) * 40}ms`,
            }}
          >
            {/* TIKLAMA OLAYI BURAYA TAŞINDI */}
            <div
              onClick={() => handleMenuClick(item.route)}
              className="flex items-center space-x-2 bg-black/80 backdrop-blur-md rounded-full px-3 py-1.5 border border-white/20 shadow-xl cursor-pointer group active:scale-95 transition-transform"
            >
              <span
                className="text-sm font-semibold text-white whitespace-nowrap pointer-events-none select-none tracking-wide"
                style={{
                  fontFamily: '"Inter", "SF Pro Display", -apple-system, BlinkMacSystemFont, sans-serif',
                  textShadow: "0 1px 3px rgba(0,0,0,0.8), 0 0 6px rgba(255,255,255,0.1)",
                }}
              >
                {item.title}
              </span>

              {/* Butondaki onClick kaldırıldı, renkler group-hover yapıldı */}
              <div className="relative">
                <Button
                  className={`relative overflow-hidden pointer-events-none bg-gradient-to-r ${item.color} ${item.hoverColor} 
                             text-white border-2 border-white shadow-lg group-hover:shadow-xl transform group-hover:scale-105 
                             transition-all duration-200 w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0`}
                >
                  <div className="absolute inset-0 bg-white/20 scale-0 group-hover:scale-100 transition-transform duration-300 rounded-full" />
                  <item.icon className="w-4 h-4 relative z-10" />
                </Button>
                {item.route === "/friends" && pendingFriendRequests > 0 && (
                  <div className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center text-[9px] font-bold text-white border border-white shadow-lg z-50">
                    {pendingFriendRequests > 9 ? "9+" : pendingFriendRequests}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}

        {/* 3. MODERATOR BUTTON - Tüm satır tıklanabilir */}
        {!roleLoading && isModerator && (
          <div
            className={`flex items-center space-x-3 transform transition-all duration-300 ${
              isOpen ? "translate-x-0 scale-100" : "translate-x-8 scale-75"
            }`}
            style={{
              transitionDelay: isOpen ? `${(menuItems.length + 1) * 60}ms` : `${(3 - menuItems.length) * 40}ms`,
            }}
          >
            {/* TIKLAMA OLAYI BURAYA TAŞINDI */}
            <div
              onClick={() => handleMenuClick("/moderator")}
              className="flex items-center space-x-2 bg-black/80 backdrop-blur-md rounded-full px-3 py-1.5 border border-white/20 shadow-xl cursor-pointer group active:scale-95 transition-transform"
            >
              <span
                className="text-sm font-semibold text-white whitespace-nowrap pointer-events-none select-none tracking-wide"
                style={{
                  fontFamily: '"Inter", "SF Pro Display", -apple-system, BlinkMacSystemFont, sans-serif',
                  textShadow: "0 1px 3px rgba(0,0,0,0.8), 0 0 6px rgba(255,255,255,0.1)",
                }}
              >
                Moderatör
              </span>

              <Button
                className="relative overflow-hidden pointer-events-none bg-gradient-to-r from-indigo-500 to-indigo-600 group-hover:from-indigo-600 group-hover:to-indigo-700
                           text-white border-2 border-white shadow-lg group-hover:shadow-xl transform group-hover:scale-105 
                           transition-all duration-200 w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
              >
                <div className="absolute inset-0 bg-white/20 scale-0 group-hover:scale-100 transition-transform duration-300 rounded-full" />
                <Shield className="w-4 h-4 relative z-10" />
              </Button>
            </div>
          </div>
        )}

        {/* 4. CHAT BUTTON - Tüm satır tıklanabilir */}
        <div
          className={`flex items-center space-x-3 transform transition-all duration-300 ${
            isOpen ? "translate-x-0 scale-100" : "translate-x-8 scale-75"
          }`}
          style={{
            transitionDelay: isOpen
              ? `${(menuItems.length + 1 + (isModerator ? 1 : 0)) * 60}ms`
              : `${(2 - menuItems.length) * 40}ms`,
          }}
        >
          {/* TIKLAMA OLAYI BURAYA TAŞINDI */}
          <div
            onClick={handleChatOpen}
            className="flex items-center space-x-2 bg-orange-500/80 backdrop-blur-md rounded-full px-3 py-1.5 border border-white/20 shadow-xl cursor-pointer group active:scale-95 transition-transform"
          >
            <span
              className="text-sm font-semibold text-white whitespace-nowrap pointer-events-none select-none tracking-wide"
              style={{
                fontFamily: '"Inter", "SF Pro Display", -apple-system, BlinkMacSystemFont, sans-serif',
                textShadow: "0 1px 3px rgba(0,0,0,0.8), 0 0 6px rgba(255,255,255,0.1)",
              }}
            >
              Sohbet
            </span>
            <div className="relative">
              <Button
                className="relative overflow-hidden pointer-events-none bg-gradient-to-r from-teal-500 to-teal-600 group-hover:from-teal-600 group-hover:to-teal-700
                           text-white border-2 border-white shadow-lg group-hover:shadow-xl transform group-hover:scale-105 
                           transition-all duration-200 w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
              >
                <div className="absolute inset-0 bg-white/20 scale-0 group-hover:scale-100 transition-transform duration-300 rounded-full" />
                <MessageCircle className="w-4 h-4 relative z-10" />
              </Button>

              {/* Notification Badge */}
              {totalNotifications > 0 && (
                <div className="absolute -top-3 -right-3 w-7 h-7 bg-red-500 rounded-full flex items-center justify-center text-xs font-bold text-white border-2 border-white shadow-xl animate-bounce z-50">
                  {totalNotifications > 9 ? "9+" : totalNotifications}
                  <div className="absolute inset-0 bg-white/30 rounded-full animate-ping" />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 5. LOGOUT BUTTON - Tüm satır tıklanabilir */}
        <div
          className={`flex items-center space-x-3 transform transition-all duration-300 ${
            isOpen ? "translate-x-0 scale-100" : "translate-x-8 scale-75"
          }`}
          style={{
            transitionDelay: isOpen
              ? `${(menuItems.length + 2 + (isModerator ? 1 : 0)) * 60}ms`
              : `${(1 - menuItems.length) * 40}ms`,
          }}
        >
          {/* TIKLAMA OLAYI BURAYA TAŞINDI */}
          <div
            onClick={handleLogout}
            className="flex items-center space-x-2 bg-black/80 backdrop-blur-md rounded-full px-3 py-1.5 border border-white/20 shadow-xl cursor-pointer group active:scale-95 transition-transform"
          >
            <span
              className="text-sm font-semibold text-white whitespace-nowrap pointer-events-none select-none tracking-wide"
              style={{
                fontFamily: '"Inter", "SF Pro Display", -apple-system, BlinkMacSystemFont, sans-serif',
                textShadow: "0 1px 3px rgba(0,0,0,0.8), 0 0 6px rgba(255,255,255,0.1)",
              }}
            >
              Çıkış
            </span>

            <Button
              className="relative overflow-hidden pointer-events-none bg-gradient-to-r from-red-500 to-red-600 group-hover:from-red-600 group-hover:to-red-700
                         text-white border-2 border-white shadow-lg group-hover:shadow-xl transform group-hover:scale-105 
                         transition-all duration-200 w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
            >
              <div className="absolute inset-0 bg-white/20 scale-0 group-hover:scale-100 transition-transform duration-300 rounded-full" />
              <LogOut className="w-4 h-4 relative z-10" />
            </Button>
          </div>
        </div>
      </div>

      {/* Main toggle button - Fixed position */}
      <div className="fixed bottom-4 right-4" data-onboarding="floating-menu">
        <Button
          onClick={handleToggle}
          className={`group relative overflow-hidden w-[84px] h-[84px] rounded-full border-2 border-white shadow-2xl 
                      transform transition-all duration-300 hover:scale-110 active:scale-95
                      ${
                        isOpen
                          ? "bg-gradient-to-r from-red-500 to-pink-600 hover:from-red-600 hover:to-pink-700 rotate-45"
                          : `bg-gradient-to-r ${colors.closed}`
                      }`}
        >
          {/* Pulse animation ring */}
          <div
            className={`absolute inset-0 rounded-full bg-gradient-to-r ${colors.ping} 
                           animate-ping opacity-20 ${isOpen ? "hidden" : ""}`}
          />

          {/* Glow effect */}
          <div
            className={`absolute inset-0 rounded-full bg-gradient-to-r ${colors.glow} 
                           blur-lg scale-150 opacity-30`}
          />

          {/* Button content */}
          <div className="relative z-10 flex items-center justify-center">
            {isOpen ? (
              <X className="w-9 h-9 text-white transition-transform duration-300" />
            ) : (
              <MenuIcon className="w-9 h-9 text-white transition-transform duration-300" />
            )}
          </div>

          {/* Ripple effect on click */}
          <div
            className="absolute inset-0 bg-white/30 scale-0 group-active:scale-100 
                           transition-transform duration-150 rounded-full"
          />
        </Button>
      </div>
    </div>
  );
}
