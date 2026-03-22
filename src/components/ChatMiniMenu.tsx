import { useState } from "react";
import { Menu, X } from "lucide-react";
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
      textIcon: "/icons/ozelsohbet-text.svg",
      gorselIcon: "/icons/ozelsohbet-gorsel.svg",
      action: () => onViewChange("users"),
      dotColor: "bg-emerald-400",
      bgColor: "bg-emerald-500/20",
      isActive: currentView === "users",
      alt: "Özel Sohbetlerim",
    },
    {
      textIcon: "/icons/engellediklerim-text.svg",
      gorselIcon: "/icons/engellediklerim-gorsel.svg",
      action: () => onViewChange("blocked-users"),
      dotColor: "bg-red-400",
      bgColor: "bg-red-500/20",
      isActive: currentView === "blocked-users",
      alt: "Engellediklerim",
    },
    {
      textIcon: "/icons/anasayfa-text.svg",
      gorselIcon: "/icons/anasayfa-gorsel.svg",
      action: onGoHome,
      dotColor: "bg-purple-400",
      bgColor: "bg-purple-500/20",
      isActive: false,
      alt: "Ana Sayfa",
    },
  ];

  const rowBase =
    "inline-flex items-center gap-3 cursor-pointer select-none " +
    "rounded-2xl px-3 py-2.5 " +
    "bg-gray-800 " +
    "border-2 border-gray-600 " +
    "active:bg-gray-700 " +
    "shadow-md whitespace-nowrap";

  return (
    <>
      {/* Overlay */}
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
              <div key={item.alt} onClick={() => handleMenuClick(item.action)}>
                <div className={rowBase}>
                  {/* Dot */}
                  <span
                    className={`w-2 h-2 rounded-full flex-shrink-0 ${item.dotColor} ${
                      item.isActive ? "opacity-100" : "opacity-60"
                    }`}
                  />
                  {/* Yazı SVG */}
                  <img
                    src={item.textIcon}
                    alt={item.alt}
                    style={{ height: 18, width: "auto", display: "block", flexShrink: 0 }}
                  />
                  {/* Görsel ikon */}
                  <div
                    className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${item.bgColor} ${
                      item.isActive ? "ring-1 ring-white/30" : ""
                    }`}
                  >
                    <img
                      src={item.gorselIcon}
                      alt=""
                      style={{ width: 20, height: 20, objectFit: "contain", display: "block" }}
                    />
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
