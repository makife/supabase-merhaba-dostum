import { useEffect, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

/**
 * Arkadaş online olduğunda in-app toast gösterir.
 * Sadece friend_online_notify açıksa çalışır.
 */
export const useFriendOnlineToast = () => {
  const { user } = useAuth();
  const friendIdsRef = useRef<Set<string>>(new Set());
  const notifyEnabledRef = useRef(false);
  const friendNamesRef = useRef<Map<string, string>>(new Map());
  const onlineStateRef = useRef<Map<string, boolean>>(new Map());
  const lastToastTimeRef = useRef<Map<string, number>>(new Map());

  // Arkadaş listesini ve ayarı yükle
  useEffect(() => {
    if (!user) return;

    const loadFriendsAndSetting = async () => {
      // Paralel olarak arkadaşları ve ayarı çek
      const [friendsRes, settingsRes] = await Promise.all([
        supabase
          .from("friendships")
          .select("user_id, friend_id")
          .or(`user_id.eq.${user.id},friend_id.eq.${user.id}`)
          .eq("status", "accepted"),
        supabase.from("user_settings").select("friend_online_notify").eq("user_id", user.id).maybeSingle(),
      ]);

      notifyEnabledRef.current = settingsRes.data?.friend_online_notify ?? false;

      if (friendsRes.data && friendsRes.data.length > 0) {
        const ids = friendsRes.data.map((f) => (f.user_id === user.id ? f.friend_id : f.user_id));
        friendIdsRef.current = new Set(ids);

        // İsimleri çek
        const { data: profiles } = await supabase.from("profiles").select("id, username").in("id", ids);

        const nameMap = new Map<string, string>();
        profiles?.forEach((p) => nameMap.set(p.id, p.username || "Oyuncu"));
        friendNamesRef.current = nameMap;

        // Mevcut online durumlarını yükle (ilk açılışta yanlış toast atmasın)
        const { data: presences } = await supabase
          .from("user_presence")
          .select("user_id, is_online")
          .in("user_id", ids);

        presences?.forEach((p) => onlineStateRef.current.set(p.user_id, p.is_online ?? false));
      }
    };

    loadFriendsAndSetting();

    // Arkadaşlık değişikliklerini dinle
    const friendChannel = supabase
      .channel("friend-online-toast-friendships")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "friendships",
        },
        () => {
          loadFriendsAndSetting();
        },
      )
      .subscribe();

    // Ayar değişikliğini dinle
    const settingsChannel = supabase
      .channel("friend-online-toast-settings")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "user_settings",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          notifyEnabledRef.current = (payload.new as any)?.friend_online_notify ?? false;
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(friendChannel);
      supabase.removeChannel(settingsChannel);
    };
  }, [user]);

  // user_presence değişikliklerini dinle ve toast göster
  useEffect(() => {
    if (!user) return;

    const presenceChannel = supabase
      .channel("friend-online-toast-presence")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "user_presence",
        },
        (payload) => {
          const newRecord = payload.new as any;
          if (!newRecord?.user_id) return;

          // Bildirim kapalıysa atla
          if (!notifyEnabledRef.current) return;

          // Kendi presence değişikliğimizi atla
          if (newRecord.user_id === user.id) return;

          // Arkadaş değilse atla
          if (!friendIdsRef.current.has(newRecord.user_id)) return;

          // 🔥 BASİT: last_seen 2 dakika içindeyse online kabul et
          const lastSeen = new Date(newRecord.last_seen).getTime();
          const isNowOnline = (Date.now() - lastSeen) < 120 * 1000;

          const prevOnline = onlineStateRef.current.get(newRecord.user_id);

          // Sadece kesin false → true geçişinde toast göster
          if (isNowOnline && prevOnline === false) {
            // Cooldown: aynı arkadaş için 30 dakika içinde tekrar toast gösterme
            const lastToast = lastToastTimeRef.current.get(newRecord.user_id) || 0;
            const now = Date.now();
            if (now - lastToast < 30 * 60 * 1000) {
              onlineStateRef.current.set(newRecord.user_id, isNowOnline);
              return;
            }
            lastToastTimeRef.current.set(newRecord.user_id, now);

            const friendName = friendNamesRef.current.get(newRecord.user_id) || "Bir arkadaşın";

            toast(`🟢 ${friendName} şu an çevrimiçi! 👋`, {
              duration: 4000,
            });
          }
          // Her durumda son state'i güncelle
          onlineStateRef.current.set(newRecord.user_id, isNowOnline);
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(presenceChannel);
    };
  }, [user]);
};
