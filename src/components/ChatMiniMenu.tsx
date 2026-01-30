import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Users, UserX, Home, Menu, X } from "lucide-react";
import { useSounds } from "@/hooks/useSounds";

type ViewMode = "global" | "users" | "private-chat" | "blocked-users";

interface ChatMiniMenuProps {
  onViewChange: (mode: ViewMode) => void;
  onGoHome: () => void;
  currentView: ViewMode;
}

export function ChatMiniMenu({ onViewChange, onGoHome, currentView }: ChatMiniMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { playSound } = useSounds();

  const handleToggle = () => {
    playSound("buttonClick");
    setIsOpen(!isOpen);
  };

  const handleMenuClick = (action: () => void) => {
    playSound("buttonClick");
    action();
    setIsOpen(false);
  };

  const menuItems = [
    {
      title: "Özel Mesajlar",
      icon: Users,
      action: () => onViewChange("users"),
      color: "from-green-500 to-green-600",
      hoverColor: "group-hover:from-green-600 group-hover:to-green-700",
      isActive: currentView === "users",
    },
    {
      title: "Engelliler",
      icon: UserX,
      action: () => onViewChange("blocked-users"),
      color: "from-red-500 to-red-600",
      hoverColor: "group-hover:from-red-600 group-hover:to-red-700",
      isActive: currentView === "blocked-users",
    },
    {
      title: "Ana Sayfa",
      icon: Home,
      action: onGoHome,
      color: "from-purple-500 to-purple-600",
      hoverColor: "group-hover:from-purple-600 group-hover:to-purple-700",
      isActive: false,
    },
  ];

  return (
    <div className="relative">
      {/* Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Menu Toggle Button */}
      <Button
        onClick={handleToggle}
        className={`relative overflow-hidden w-10 h-10 rounded-full border-2 border-white shadow-lg 
                    transform transition-all duration-300 hover:scale-105 active:scale-95
                    ${
                      isOpen
                        ? "bg-gradient-to-r from-red-500 to-pink-600 hover:from-red-600 hover:to-pink-700"
                        : "bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700"
                    }`}
      >
        {isOpen ? (
          <X className="w-5 h-5 text-white" />
        ) : (
          <Menu className="w-5 h-5 text-white" />
        )}
      </Button>

      {/* Dropdown Menu - Top to Bottom */}
      <div
        className={`absolute top-14 right-0 flex flex-col items-end space-y-2 transition-all duration-300 z-50 ${
          isOpen ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-4 pointer-events-none"
        }`}
      >
        {menuItems.map((item, index) => (
          <div
            key={item.title}
            className={`transform transition-all duration-300 ${
              isOpen ? "translate-y-0 scale-100" : "-translate-y-4 scale-75"
            }`}
            style={{
              transitionDelay: isOpen ? `${index * 50}ms` : `${(menuItems.length - index) * 30}ms`,
            }}
          >
            <div
              onClick={() => handleMenuClick(item.action)}
              className={`flex items-center space-x-2 backdrop-blur-md rounded-full px-3 py-1.5 border border-white/30 shadow-xl cursor-pointer group active:scale-95 transition-all duration-200
                ${item.isActive ? "bg-white/30" : "bg-black/70"}`}
            >
              <span
                className="text-sm font-semibold text-white whitespace-nowrap pointer-events-none select-none tracking-wide"
                style={{
                  fontFamily: '"Inter", "SF Pro Display", -apple-system, BlinkMacSystemFont, sans-serif',
                  textShadow: "0 1px 3px rgba(0,0,0,0.8)",
                }}
              >
                {item.title}
              </span>

              <Button
                className={`relative overflow-hidden pointer-events-none bg-gradient-to-r ${item.color} ${item.hoverColor} 
                           text-white border-2 border-white shadow-lg group-hover:shadow-xl transform group-hover:scale-105 
                           transition-all duration-200 w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0`}
              >
                <div className="absolute inset-0 bg-white/20 scale-0 group-hover:scale-100 transition-transform duration-300 rounded-full" />
                <item.icon className="w-4 h-4 relative z-10" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
