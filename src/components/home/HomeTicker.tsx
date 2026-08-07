import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useRadio } from "@/contexts/RadioContext";
import { useChatNotifications } from "@/hooks/useChatNotifications";

interface HomeTickerProps {
  /** Kalan çark çevirme hakkı */
  wheelSpinsLeft?: number | null;
  /** Bekleyen arkadaşlık istekleri */
  pendingFriendRequests?: number;
  /** Okunmamış sistem mesajı sayısı */
  systemUnread?: number;
  /** Kullanıcının rumuzu */
  username?: string | null;
  /** Kalan kredi (mürekkep) */
  credits?: number | null;
}

/**
 * Ana sayfa kayan mesaj boardu (sağdan sola).
 * Dinamik durumlara göre mesaj üretir: radyo, çark, sohbet, haftalık lider...
 */
export default function HomeTicker({
  wheelSpinsLeft,
  pendingFriendRequests = 0,
  systemUnread = 0,
  username,
  credits,
}: HomeTickerProps) {
  const { user } = useAuth();
  const { isPlaying, currentStation } = useRadio();
  const { unreadCount, lastMessageSender } = useChatNotifications() as any;
  const [weeklyLeader, setWeeklyLeader] = useState<string | null>(null);

  // Haftanın lideri
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await supabase.rpc("get_weekly_leaderboard", { limit_count: 1 });
        const top = Array.isArray(data) ? (data[0] as any) : null;
        if (!cancelled && top?.username) setWeeklyLeader(top.username);
      } catch {
        /* sessizce yoksay */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const messages = useMemo(() => {
    const list: string[] = [];

    if (isPlaying && currentStation?.name) {
      list.push(`🎧 Şu an ${currentStation.name} dinliyorsun`);
    }
    if ((wheelSpinsLeft ?? 0) > 0) {
      list.push("🎡 Şans çarkı seni bekliyor");
    }
    if (unreadCount > 0) {
      list.push(
        lastMessageSender
          ? `💬 ${lastMessageSender} sana mesaj gönderdi`
          : `💬 ${unreadCount} okunmamış mesajın var`
      );
    }
    if (pendingFriendRequests > 0) {
      list.push(`🤝 ${pendingFriendRequests} yeni arkadaşlık isteği var`);
    }
    if (systemUnread > 0) {
      list.push(`🔔 ${systemUnread} yeni sistem mesajı var`);
    }
    if (weeklyLeader) {
      list.push(`🏆 Haftanın 1.si ${weeklyLeader} oldu`);
    }
    if ((credits ?? 1) <= 0) {
      list.push("🖋️ Mürekkebin bitti, markete uğra");
    }
    if (list.length === 0) {
      list.push(
        username
          ? `👋 Hoş geldin ${username}, bugün bir maç yapmaya ne dersin?`
          : "👋 Hoş geldin! Rakip bulmak için oyun modlarına göz at"
      );
    }
    return list;
  }, [
    isPlaying,
    currentStation?.name,
    wheelSpinsLeft,
    unreadCount,
    lastMessageSender,
    pendingFriendRequests,
    systemUnread,
    weeklyLeader,
    credits,
    username,
  ]);

  const text = messages.join("             •             ") + "             •             ";
  // Uzunluğa göre süre: sabit ve daha hızlı akış
  const duration = Math.max(6, Math.min(30, text.length * 0.14));

  return (
    <div className="relative w-full overflow-hidden select-none pointer-events-none">
      <div
        className="overflow-hidden flex items-center h-9"
        style={{
          maskImage:
            "linear-gradient(to right, transparent 0%, black 12%, black 88%, transparent 100%)",
          WebkitMaskImage:
            "linear-gradient(to right, transparent 0%, black 12%, black 88%, transparent 100%)",
        }}
      >
        <div
          key={text}
          className="flex w-max items-center"
          style={{
            animation: `homeTickerScroll ${duration}s linear infinite`,
            willChange: "transform",
          }}
        >
          <span className="whitespace-nowrap text-[13px] leading-none font-semibold text-white/95 drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
            {text}
          </span>
          <span className="whitespace-nowrap text-[13px] leading-none font-semibold text-white/95 drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
            {text}
          </span>
        </div>
      </div>


      <style>{`
        @keyframes homeTickerScroll {
          0%   { transform: translate3d(0, 0, 0); }
          100% { transform: translate3d(-50%, 0, 0); }
        }
      `}</style>
    </div>
  );
}

