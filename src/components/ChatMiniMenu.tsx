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
      isActive: currentView === "users",
      alt: "Özel Sohbetlerim",
    },
    {
      textIcon: "/icons/yasakli-text.svg",
      gorselIcon: "/icons/engellediklerim-gorsel.svg",
      action: () => onViewChange("blocked-users"),
      dotColor: "bg-red-400",
      isActive: currentView === "blocked-users",
      alt: "Yasaklı",
    },
    {
      textIcon: "/icons/anasayfa-text.svg",
      gorselIcon: "/icons/anasayfa-gorsel.svg",
      action: onGoHome,
      dotColor: "bg-purple-400",
      isActive: false,
      alt: "Ana Sayfa",
    },
  ];

  // ─── FloatingMenu ile birebir aynı stil ───────────────────────────────────
  const rowBase =
    "inline-flex w-fit min-h-[56px] items-center gap-3 cursor-pointer select-none " +
    "rounded-2xl px-4 py-2 " +
    "bg-[#2a2a2a] " +
    "border border-white/80 " +
    "active:bg-[#3a3a3a] " +
    "shadow-md whitespace-nowrap";

  const slideStyle: React.CSSProperties = {
    transform: isOpen ? "translateX(0)" : "translateX(120%)",
    opacity: isOpen ? 1 : 0,
    visibility: isOpen ? "visible" : "hidden",
    transition: "transform 200ms ease-out, opacity 200ms ease-out, visibility 200ms ease-out",
  };

  const itemAnim = () => (!isOpen ? "pointer-events-none" : "");

  const renderRow = (dot: string, textSrc: string, textAlt: string, gorselSrc: string, isActive?: boolean) => (
    <div className={rowBase}>
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${dot} ${isActive ? "opacity-100" : "opacity-60"}`} />
      <img src={textSrc} alt={textAlt} className="block h-4 w-auto max-w-none flex-shrink-0" />
      <div
        className={`relative flex-shrink-0 w-10 h-10 flex items-center justify-center ${isActive ? "ring-1 ring-white/30 rounded-xl" : ""}`}
      >
        <img src={gorselSrc} alt="" className="w-10 h-10 object-contain" />
      </div>
    </div>
  );

  return (
    <>
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
        <div
          className={`absolute top-16 right-0 flex flex-col items-end gap-2 ${!isOpen ? "pointer-events-none" : ""}`}
          style={{ clipPath: isOpen ? "none" : "inset(0 0 0 100%)" }}
        >
          {menuItems.map((item) => (
            <div key={item.alt} className={itemAnim()} style={slideStyle}>
              <div onClick={() => handleMenuClick(item.action)}>
                {renderRow(item.dotColor, item.textIcon, item.alt, item.gorselIcon, item.isActive)}
              </div>
            </div>
          ))}
        </div>

        {/* Toggle butonu */}
        <button
          onClick={handleToggle}
          className={`
            relative w-12 h-12 rounded-full
            flex items-center justify-center
            active:scale-90
            ${
              isOpen ? "bg-white ring-2 ring-white/40" : "bg-gradient-to-br from-white to-gray-200 ring-2 ring-white/30"
            }
          `}
        >
          {isOpen ? <X className="w-5 h-5 text-gray-900" /> : <Menu className="w-5 h-5 text-gray-900" />}
        </button>
      </div>
    </>
  );
}
