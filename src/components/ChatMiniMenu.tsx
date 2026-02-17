import { useState } from "react";
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
      title: "Özel Sohbetlerim",
      icon: Users,
      action: () => onViewChange("users"),
      iconColor: "text-emerald-300",
      dotColor: "bg-emerald-400",
      iconBg: "bg-emerald-500/20",
      isActive: currentView === "users",
    },
    {
      title: "Engellediklerim",
      icon: UserX,
      action: () => onViewChange("blocked-users"),
      iconColor: "text-red-300",
      dotColor: "bg-red-400",
      iconBg: "bg-red-500/20",
      isActive: currentView === "blocked-users",
    },
    {
      title: "Ana Sayfa",
      icon: Home,
      action: onGoHome,
      iconColor: "text-purple-300",
      dotColor: "bg-purple-400",
      iconBg: "bg-purple-500/20",
      isActive: false,
    },
  ];

  // FloatingMenu ile aynı row stili
  const rowBase =
    "flex items-center gap-3 cursor-pointer select-none " +
    "rounded-2xl px-3 py-2.5 " +
    "ring-1 ring-white/20 " +
    "active:scale-95 transition-all duration-150 ease-out " +
    "shadow-[0_2px_16px_rgba(0,0,0,0.45)]";

  const staggerStyle = (i: number): React.CSSProperties => ({
    transitionDelay: isOpen ? `${i * 45}ms` : "0ms",
    willChange: isOpen ? "transform, opacity" : "auto",
  });

  const itemAnim = () =>
    `transform transition-all duration-200 ease-out ${
      isOpen ? "opacity-100 translate-y-0 scale-100" : "opacity-0 translate-y-3 scale-95 pointer-events-none"
    }`;

  return (
    <div className="relative">
      {/* Overlay */}
      {isOpen && <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />}

      {/* Menu items — toggle butonunun altına açılıyor */}
      <div className="absolute top-16 right-0 flex flex-col items-end gap-2 z-50">
        {menuItems.map((item, index) => (
          <div key={item.title} className={itemAnim()} style={staggerStyle(index)}>
            <div
              onClick={() => handleMenuClick(item.action)}
              className={`${rowBase} ${
                item.isActive
                  ? "bg-[rgba(255,255,255,0.18)] hover:bg-[rgba(255,255,255,0.22)]"
                  : "bg-[rgba(255,255,255,0.10)] hover:bg-[rgba(255,255,255,0.16)]"
              }`}
            >
              {/* Sol renkli dot — aktifse dolu, değilse soluk */}
              <span
                className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${item.dotColor} ${
                  item.isActive ? "opacity-100" : "opacity-60"
                }`}
              />

              <span className="text-xs font-semibold text-white/95 whitespace-nowrap tracking-wide">{item.title}</span>

              <div
                className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 brightness-125
                  ${item.iconBg} ${item.iconColor}
                  ${item.isActive ? "ring-1 ring-white/30" : ""}`}
              >
                <item.icon className="w-4 h-4" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Toggle butonu — FloatingMenu ana butonu ile aynı stil */}
      <button
        onClick={handleToggle}
        className={`
          relative w-12 h-12 rounded-full
          flex items-center justify-center
          transition-all duration-200 ease-out
          active:scale-90 hover:scale-105
          ${
            isOpen
              ? "bg-white shadow-[0_6px_28px_rgba(0,0,0,0.5)] ring-2 ring-white/40"
              : "bg-gradient-to-br from-white to-gray-200 shadow-[0_4px_20px_rgba(255,255,255,0.15)] ring-2 ring-white/30 hover:shadow-[0_6px_28px_rgba(255,255,255,0.25)]"
          }
        `}
      >
        {isOpen ? (
          <X className="w-5 h-5 text-gray-900 transition-transform duration-200" />
        ) : (
          <Menu className="w-5 h-5 text-gray-900 transition-transform duration-200" />
        )}
      </button>
    </div>
  );
}
