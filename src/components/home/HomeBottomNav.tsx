import { useNavigate, useLocation } from "react-router-dom";
import { useSounds } from "@/hooks/useSounds";

interface NavItem {
  route: string;
  label: string;
  icon: string;
  badge?: number;
}

interface HomeBottomNavProps {
  pendingFriendRequests?: number;
}

export const HomeBottomNav = ({ pendingFriendRequests = 0 }: HomeBottomNavProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { playSound } = useSounds();

  const items: NavItem[] = [
    { route: "/friends", label: "Arkadaşlar", icon: "/icons/arkadaslar-gorsel.svg", badge: pendingFriendRequests },
    { route: "/leaderboard", label: "Liderlik", icon: "/icons/liderlik-gorsel.svg" },
    { route: "/profile", label: "Profil", icon: "/icons/profil-gorsel.svg" },
    { route: "/market", label: "Market", icon: "/icons/kirtasiye-gorsel.svg" },
    { route: "/settings", label: "Ayarlar", icon: "/icons/ayarlar-gorsel.svg" },
  ];

  return (
    <nav
      className="flex-none z-40 px-3 pt-2"
      style={{ paddingBottom: "max(env(safe-area-inset-bottom), 10px)" }}
    >
      <div
        className="relative flex items-end justify-around rounded-3xl bg-white/10 border border-white/25 shadow-[0_-4px_18px_rgba(0,0,0,0.25)] px-2 py-2"
        style={{ backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)" }}
      >
        {items.map((item) => {
          const active = location.pathname === item.route;
          return (
            <button
              key={item.route}
              type="button"
              onClick={() => {
                playSound("buttonClick");
                navigate(item.route);
              }}
              className="relative flex flex-col items-center justify-end gap-1 flex-1 active:scale-90 transition-transform"
              style={{ WebkitTapHighlightColor: "transparent" }}
            >
              <div
                className={`relative flex items-center justify-center transition-all duration-200 ${
                  active ? "w-14 h-14 -mt-5" : "w-10 h-10"
                }`}
              >
                <img
                  src={item.icon}
                  alt={item.label}
                  className={`object-contain drop-shadow-[0_2px_6px_rgba(0,0,0,0.45)] ${active ? "w-14 h-14" : "w-10 h-10"}`}
                />
                {!!item.badge && item.badge > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 bg-red-500 rounded-full flex items-center justify-center text-[10px] font-bold text-white ring-2 ring-[#1e2d45]">
                    {item.badge > 9 ? "9+" : item.badge}
                  </span>
                )}
              </div>
              <span
                className={`text-[9px] font-black uppercase tracking-wide text-white`}
              >
                {item.label}
              </span>
            </button>
          );
        })}
      </div>

    </nav>
  );
};

export default HomeBottomNav;
