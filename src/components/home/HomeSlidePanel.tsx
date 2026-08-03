import { useEffect, useState } from "react";
import { X } from "lucide-react";

export interface SlidePanelItem {
  id: string;
  title: string;
  subtitle?: string;
  icon: React.ReactNode;
  gradient: string;
  badge?: React.ReactNode;
  dimmed?: boolean;
  onClick: () => void;
}

interface HomeSlidePanelProps {
  open: boolean;
  onClose: () => void;
  title: string;
  items: SlidePanelItem[];
}

export const HomeSlidePanel = ({ open, onClose, title, items }: HomeSlidePanelProps) => {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    if (open) {
      const id = requestAnimationFrame(() => setMounted(true));
      return () => cancelAnimationFrame(id);
    }
    setMounted(false);
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] flex flex-col" onClick={onClose}>
      <div
        className="absolute inset-0 bg-black/55"
        style={{ backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)" }}
      />

      <div className="relative z-10 flex-1 min-h-0 flex flex-col pt-8 pb-6 pl-4 pr-6">
        <div className="flex items-center justify-between mb-4">
          <h2
            className="text-lg font-black text-white uppercase tracking-widest"
            style={{ WebkitTextStroke: "1.5px #000", paintOrder: "stroke fill" } as any}
          >
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="w-10 h-10 rounded-full bg-white/15 border border-white/30 flex items-center justify-center active:scale-90 transition-transform"
            aria-label="Kapat"
          >
            <X className="w-5 h-5 text-white" />
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto scrollbar-hide flex flex-col gap-3">
          {items.map((item, i) => (
            <div
              key={item.id}
              onClick={(e) => {
                e.stopPropagation();
                item.onClick();
              }}
              className={`relative w-[86%] rounded-3xl p-4 flex items-center gap-4 overflow-hidden cursor-pointer border-2 border-white shadow-[0_0_12px_rgba(255,255,255,0.2)] active:scale-[0.97] transition-transform ${
                item.dimmed ? "opacity-70" : ""
              }`}
              style={{
                transform: mounted ? "translate3d(0,0,0)" : "translate3d(-120%,0,0)",
                opacity: mounted ? 1 : 0,
                transition: `transform 380ms cubic-bezier(0.16, 1, 0.3, 1) ${i * 80}ms, opacity 300ms ease-out ${i * 80}ms`,
                willChange: "transform, opacity",
              }}
            >
              <div
                className={`absolute inset-0 bg-gradient-to-br ${item.gradient} ${item.dimmed ? "opacity-50 grayscale-[30%]" : "opacity-95"} rounded-3xl`}
              />
              <div className="relative z-10 w-14 h-14 rounded-2xl bg-white/20 border border-white/25 flex items-center justify-center flex-shrink-0">
                {item.icon}
              </div>
              <div className="relative z-10 flex-1 min-w-0">
                <h3
                  className="text-base font-black text-white leading-tight uppercase tracking-wide"
                  style={{ WebkitTextStroke: "1.5px #000", paintOrder: "stroke fill" } as any}
                >
                  {item.title}
                </h3>
                {item.subtitle && (
                  <p className="text-[11px] text-white/90 font-semibold leading-tight mt-0.5 truncate">
                    {item.subtitle}
                  </p>
                )}
              </div>
              {item.badge && <div className="relative z-10 flex-shrink-0">{item.badge}</div>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default HomeSlidePanel;
