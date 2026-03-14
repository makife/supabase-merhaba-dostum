import { useState } from "react";
import { Users, UserX, Home, Menu, X } from "lucide-react";
import { useSounds } from "@/hooks/useSounds";

type ViewMode = "global" | "users" | "private-chat" | "blocked-users";

interface ChatMiniMenuProps {
  onViewChange: (mode: ViewMode) => void;
  onGoHome: () => void;
  currentView: ViewMode;
  onOpenChange?: (isOpen: boolean) => void;
}

export function ChatMiniMenu({ onViewChange, onGoHome, currentView, onOpenChange }: ChatMiniMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { playSound } = useSounds();

  const handleToggle = () => {
    playSound("buttonClick");
    const next = !isOpen;
    setIsOpen(next);
    onOpenChange?.(next);
  };

  const handleMenuClick = (action: () => void) => {
    playSound("buttonClick");
    action();
    setIsOpen(false);
    onOpenChange?.(false);
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

  const rowBase =
    "flex items-center gap-3 cursor-pointer select-none " +
    "rounded-2xl px-3 py-2.5 " +
    "bg-gray-800 " +
    "border-2 border-gray-600 " +
    "active:bg-gray-700 " +
    "shadow-md";

  return (
    <>
      {/* Overlay — fixed, menü itemların ALTINDA (z-40), toggle butonunun da altında */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => {
            setIsOpen(false);
            onOpenChange?.(false);
          }}
        />
      )}

      <div className="relative z-50">
        {/* Menu items */}
        {isOpen && (
          <div className="absolute top-16 right-0 flex flex-col items-end gap-2">
            {menuItems.map((item) => (
              <div key={item.title}>
                <div
                  onClick={() => handleMenuClick(item.action)}
                  className={rowBase}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${item.dotColor} ${
                      item.isActive ? "opacity-100" : "opacity-60"
                    }`}
                  />
                  <span className="text-xs font-semibold text-white/95 whitespace-nowrap tracking-wide">
                    {item.title}
                  </span>
                  <div
                    className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0
                      ${item.iconBg} ${item.iconColor}
                      ${item.isActive ? "ring-1 ring-white/30" : ""}`}
                  >
                    <item.icon className="w-4 h-4" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Toggle butonu */}
        <button
          onClick={handleToggle}
          className={`
            relative w-12 h-12 rounded-full
            flex items-center justify-center
            active:scale-90
            ${
              isOpen
                ? "bg-white ring-2 ring-white/40"
                : "bg-gradient-to-br from-white to-gray-200 ring-2 ring-white/30"
            }
          `}
        >
          {isOpen ? (
            <X className="w-5 h-5 text-gray-900" />
          ) : (
            <Menu className="w-5 h-5 text-gray-900" />
          )}
        </button>
      </div>
    </>
  );
}
