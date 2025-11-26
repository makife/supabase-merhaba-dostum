// FloatingMenu.tsx - Düzeltilmiş versiyon

import { useState } from "react";
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
  ShoppingCart,
  LogOut,
  Menu as MenuIcon,
  X,
  Home,
  MessageCircle,
  Trophy,
  Zap,
  Shield,
  Volume2,
  VolumeX,
} from "lucide-react";

// FloatingMenu.tsx - isUserBanned fonksiyonunu ekle
const isUserBanned = async (userId: string): Promise<boolean> => {
  try {
    const { data, error } = await supabase.from("profiles").select("banned_until").eq("id", userId).single();

    if (error) {
      console.log("Ban kontrolü hatası:", error);
      return false;
    }

    // Data yoksa veya banned_until null ise
    if (!data || !data.banned_until) {
      return false;
    }

    return new Date(data.banned_until) > new Date();
  } catch (error) {
    console.error("Ban kontrolü hatası:", error);
    return false;
  }
};

// isUserBanned ve getBanTimeLeft fonksiyonlarını import etmeniz veya tanımlamanız gerekiyor
const getBanTimeLeft = async (userId: string): Promise<string> => {
  try {
    const { data, error } = await supabase.from("profiles").select("banned_until").eq("id", userId).single();

    if (error) {
      console.log("Ban süresi alınamadı:", error);
      return "bilinmiyor";
    }

    // Data yoksa veya banned_until null ise
    if (!data || !data.banned_until) {
      return "yok";
    }

    const banTime = new Date(data.banned_until).getTime();
    const now = Date.now();
    const diff = banTime - now;

    if (diff <= 0) return "yok";

    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    return `${hours} saat ${minutes} dakika`;
  } catch (error) {
    console.error("Ban süresi hesaplama hatası:", error);
    return "bilinmiyor";
  }
};

const menuItems = [
  {
    title: "Ana Sayfa",
    route: "/",
    icon: Home,
    color: "from-blue-500 to-blue-600",
    hoverColor: "hover:from-blue-600 hover:to-blue-700",
  },
  {
    title: "Liderlik",
    route: "/leaderboard",
    icon: Trophy,
    color: "from-yellow-500 to-amber-600",
    hoverColor: "hover:from-yellow-600 hover:to-amber-700",
  },
  {
    title: "Profil",
    route: "/profile",
    icon: User,
    color: "from-green-500 to-green-600",
    hoverColor: "hover:from-green-600 hover:to-green-700",
  },
  {
    title: "Market",
    route: "/market",
    icon: ShoppingCart,
    color: "from-purple-500 to-purple-600",
    hoverColor: "hover:from-purple-600 hover:to-purple-700",
  },
  {
    title: "Ayarlar",
    route: "/settings",
    icon: Settings,
    color: "from-orange-500 to-orange-600",
    hoverColor: "hover:from-orange-600 hover:to-orange-700",
  },
];

export function FloatingMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const navigate = useNavigate();
  const { signOut, user } = useAuth();
  const { playSound } = useSounds();
  const { musicEnabled, setMusicEnabled } = useMusic();
  const { totalNotifications } = useChatNotifications();
  const { isModerator, loading: roleLoading } = useUserRole();

  const handleToggle = () => {
    playSound("buttonClick");
    setIsOpen(!isOpen);
  };

  const handleMenuClick = (route: string, title: string) => {
    playSound("buttonClick");
    navigate(route);
    setIsOpen(false);
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

    // Chat'e gidince notification'ları temizle
    try {
      await supabase
        .from("notifications")
        .update({ is_read: true })
        .eq("user_id", user.id)
        .eq("type", "mention")
        .eq("is_read", false);
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
      {/* Backdrop overlay when menu is open */}
      {isOpen && <div className="fixed inset-0 bg-black/20 backdrop-blur-sm -z-10" onClick={() => setIsOpen(false)} />}

      {/* Menu items - Positioned higher */}
      <div
        className={`absolute bottom-24 right-0 flex flex-col items-end space-y-3 transition-all duration-300 ${
          isOpen ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4 pointer-events-none"
        }`}
      >
        {/* Music Toggle - En üstte */}
        <div
          className={`flex items-center space-x-3 transform transition-all duration-300 ${
            isOpen ? "translate-x-0 scale-100" : "translate-x-8 scale-75"
          }`}
          style={{
            transitionDelay: isOpen ? "0ms" : `${(menuItems.length + 3) * 40}ms`,
          }}
        >
          <div className="flex items-center space-x-2 bg-black/80 backdrop-blur-md rounded-full px-3 py-1.5 border border-white/20 shadow-xl">
            <span
              className="text-sm font-semibold text-white whitespace-nowrap pointer-events-none select-none tracking-wide"
              style={{
                fontFamily: '"Inter", "SF Pro Display", -apple-system, BlinkMacSystemFont, sans-serif',
                textShadow: "0 1px 3px rgba(0,0,0,0.8), 0 0 6px rgba(255,255,255,0.1)",
              }}
            >
              {musicEnabled ? "Ses Açık" : "Ses Kapalı"}
            </span>

            <Button
              onClick={() => {
                setMusicEnabled(!musicEnabled);
                playSound("buttonClick");
              }}
              className={`group relative overflow-hidden ${
                musicEnabled
                  ? "bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700"
                  : "bg-gradient-to-r from-gray-500 to-gray-600 hover:from-gray-600 hover:to-gray-700"
              } text-white border-2 border-white shadow-lg hover:shadow-xl transform hover:scale-105 
              transition-all duration-200 w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0`}
            >
              <div className="absolute inset-0 bg-white/20 scale-0 group-hover:scale-100 transition-transform duration-300 rounded-full" />

              {/* SES AÇ/KAPA İKONLARI BURADA */}
              {musicEnabled ? (
                <Volume2 className="w-5 h-5 relative z-10" />
              ) : (
                <VolumeX className="w-5 h-5 relative z-10 opacity-70" />
              )}
            </Button>
          </div>
        </div>

        {/* Regular menu items */}
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
            {/* Label with beautiful styling */}
            <div className="flex items-center space-x-2 bg-black/80 backdrop-blur-md rounded-full px-3 py-1.5 border border-white/20 shadow-xl">
              <span
                className="text-sm font-semibold text-white whitespace-nowrap pointer-events-none select-none tracking-wide"
                style={{
                  fontFamily: '"Inter", "SF Pro Display", -apple-system, BlinkMacSystemFont, sans-serif',
                  textShadow: "0 1px 3px rgba(0,0,0,0.8), 0 0 6px rgba(255,255,255,0.1)",
                }}
              >
                {item.title}
              </span>

              {/* Button */}
              <Button
                onClick={() => handleMenuClick(item.route, item.title)}
                className={`group relative overflow-hidden bg-gradient-to-r ${item.color} ${item.hoverColor} 
                           text-white border-2 border-white shadow-lg hover:shadow-xl transform hover:scale-105 
                           transition-all duration-200 w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0`}
              >
                {/* Ripple effect background */}
                <div className="absolute inset-0 bg-white/20 scale-0 group-hover:scale-100 transition-transform duration-300 rounded-full" />

                {/* Icon */}
                <item.icon className="w-4 h-4 relative z-10" />
              </Button>
            </div>
          </div>
        ))}

        {/* Moderator Button (only for moderators/admins) */}
        {!roleLoading && isModerator && (
          <div
            className={`flex items-center space-x-3 transform transition-all duration-300 ${
              isOpen ? "translate-x-0 scale-100" : "translate-x-8 scale-75"
            }`}
            style={{
              transitionDelay: isOpen ? `${(menuItems.length + 1) * 60}ms` : `${(3 - menuItems.length) * 40}ms`,
            }}
          >
            <div className="flex items-center space-x-2 bg-black/80 backdrop-blur-md rounded-full px-3 py-1.5 border border-white/20 shadow-xl">
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
                onClick={() => handleMenuClick("/moderator", "Moderatör")}
                className="group relative overflow-hidden bg-gradient-to-r from-indigo-500 to-indigo-600 hover:from-indigo-600 hover:to-indigo-700
                           text-white border-2 border-white shadow-lg hover:shadow-xl transform hover:scale-105 
                           transition-all duration-200 w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
              >
                <div className="absolute inset-0 bg-white/20 scale-0 group-hover:scale-100 transition-transform duration-300 rounded-full" />
                <Shield className="w-4 h-4 relative z-10" />
              </Button>
            </div>
          </div>
        )}

        {/* Chat Button */}
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
          <div className="flex items-center space-x-2 bg-black/80 backdrop-blur-md rounded-full px-3 py-1.5 border border-white/20 shadow-xl">
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
                onClick={handleChatOpen}
                className="group relative overflow-hidden bg-gradient-to-r from-teal-500 to-teal-600 hover:from-teal-600 hover:to-teal-700
                           text-white border-2 border-white shadow-lg hover:shadow-xl transform hover:scale-105 
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

        {/* Logout Button */}
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
          <div className="flex items-center space-x-2 bg-black/80 backdrop-blur-md rounded-full px-3 py-1.5 border border-white/20 shadow-xl">
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
              onClick={handleLogout}
              className="group relative overflow-hidden bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700
                         text-white border-2 border-white shadow-lg hover:shadow-xl transform hover:scale-105 
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
                         : "bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
                     }`}
        >
          {/* Pulse animation ring */}
          <div
            className={`absolute inset-0 rounded-full bg-gradient-to-r from-purple-600 to-blue-600 
                          animate-ping opacity-20 ${isOpen ? "hidden" : ""}`}
          />

          {/* Glow effect */}
          <div
            className="absolute inset-0 rounded-full bg-gradient-to-r from-purple-600/50 to-blue-600/50 
                         blur-lg scale-150 opacity-30"
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
