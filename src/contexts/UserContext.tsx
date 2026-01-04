import NativeRealtime, { isNativeRealtimeAvailable } from "@/plugins/NativeRealtime";
import { useAppState } from "@/hooks/useAppState";
import React, { createContext, useContext, useState, useEffect, ReactNode, useRef } from "react";
import { useAuth } from "./AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useMobileNotifications } from "@/hooks/useMobileNotifications";

interface OnlineUser {
  id: string;
  username: string;
  avatar_url?: string;
  last_seen: string;
}

interface UserProfile {
  game_credits: number;
  bonus_credits: number;
  premium_until: string | null;
  hint_credits: number;
  last_credit_refresh: string | null;
  total_score: number;
  created_at: string;
  ink_count: number;
  unlimited_lives_until?: string | null;
  // Diğer alanlar...
  daily_games?: number;
  win_streak?: number;
  daily_wins?: number;
  best_streak?: number;
  average_score?: number;
  total_words?: number;
  favorite_letter?: string;
  total_play_time?: number;
  last_daily_reset?: string;
  total_games?: number;
  wins?: number;
  losses?: number;
  longest_word?: string;
  longest_word_length?: number;
  fastest_word_time?: number;
  username?: string;
  avatar_url?: string;
  disconnect_count?: number;
  win_count?: number;
  last_disconnect?: string;
  last_win?: string;
  banned_until?: string | null;
}

interface UserContextType {
  profile: UserProfile | null;
  loading: boolean;
  refreshProfile: (forceRefresh?: boolean) => Promise<void>;
  updateCredits: (newCredits: number) => void;
  addBonusCredits: (bonusCredits: number) => Promise<void>;
  consumeCredit: () => Promise<boolean>;
  checkAndRefreshCredits: () => Promise<void>;
  getTotalCredits: () => number;
  getDisplayCredits: () => { base: number; bonus: number };
  isPremium: boolean;
  forceRefreshProfile: () => Promise<void>;
  onlineUsers: OnlineUser[];
  isUserOnline: (userId: string) => boolean;
  refreshOnlineUsers: () => Promise<void>;
  isSystemConnected: boolean;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export const useUser = () => {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error("useUser must be used within a UserProvider");
  }
  return context;
};

interface UserProviderProps {
  children: ReactNode;
}

export const UserProvider = ({ children }: UserProviderProps) => {
  const { user } = useAuth();
  const [isSystemConnected, setIsSystemConnected] = useState(true);
  const isNative = isNativeRealtimeAvailable();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
  const previousCreditsRef = useRef<number>(0);
  const lastNotificationRef = useRef<{ amount: number; timestamp: number } | null>(null);
  const isRefreshingCreditsRef = useRef(false);
  const lastNotifiedTotalRef = useRef<number>(0);
  const { showLocalNotification, isPermissionGranted } = useMobileNotifications();

  // 1. NATIVE BAĞLANTIYI DİNLE + JS SDK DURUMUNU İZLE
  useEffect(() => {
    // Native bağlantı durumu
    if (isNative && NativeRealtime) {
      const handleNativeState = (data: { state: string }) => {
        if (data.state === "connected") {
          setIsSystemConnected(true);
          console.log("🌐 [UserContext] Native üzerinden internet canlı.");
        }
        // Native koptuğunda JS durumunu kontrol et
        if (data.state === "disconnected") {
          // JS SDK bağlıysa hala sistem bağlı
          const jsConnected = supabase.realtime?.channels?.length > 0;
          setIsSystemConnected(jsConnected);
        }
      };

      NativeRealtime.addListener("connectionState", handleNativeState);
      return () => {
        NativeRealtime.removeAllListeners();
      };
    }
  }, [isNative]);

  // 2. JS SDK BAĞLANTI DURUMUNU İZLE - daha verimli yöntem
  useEffect(() => {
    // 🔧 İYİLEŞTİRME: Realtime bağlantı durumunu dinle
    const checkConnection = () => {
      try {
        const state = (supabase.realtime as any).connectionState?.();
        const isConnected = state === "open" || state === "connecting";
        
        // Sadece durum değiştiyse güncelle
        setIsSystemConnected((prev) => {
          if (isConnected !== prev) {
            console.log(`[UserContext] 🔌 Bağlantı durumu: ${state} -> ${isConnected}`);
          }
          return isConnected;
        });
      } catch (e) {
        // Sessizce devam
      }
    };

    // İlk kontrol
    checkConnection();

    // Reconnect event'ini dinle
    const handleReconnect = () => {
      console.log("🔄 [UserContext] JS SDK reconnected - isSystemConnected = true");
      setIsSystemConnected(true);
    };

    // Online/offline event'leri dinle
    const handleOnline = () => {
      console.log("🌐 [UserContext] Network online");
      setTimeout(checkConnection, 1000);
    };

    const handleOffline = () => {
      console.log("📴 [UserContext] Network offline");
      setIsSystemConnected(false);
    };

    // Visibility change - sayfa görünür olduğunda kontrol et
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        setTimeout(checkConnection, 500);
      }
    };

    window.addEventListener("supabase-reconnected", handleReconnect);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    document.addEventListener("visibilitychange", handleVisibility);
    
    // Periyodik kontrol (60 saniyede bir - 30'dan artırıldı)
    const interval = setInterval(checkConnection, 60000);

    return () => {
      window.removeEventListener("supabase-reconnected", handleReconnect);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      document.removeEventListener("visibilitychange", handleVisibility);
      clearInterval(interval);
    };
  }, []);

  // Hydrate profile from cache immediately on user change to avoid avatar flicker
  useEffect(() => {
    if (!user) {
      setProfile(null);
      return;
    }

    const cached = localStorage.getItem("cached_profile");
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (parsed.id === user.id) {
          setProfile((prev) => prev ?? { ...parsed.data, ink_count: parsed.data.ink_count ?? 0 });
          // Preload avatar image to ensure instant display
          if (parsed.data?.avatar_url) {
            const img = new Image();
            img.src = parsed.data.avatar_url;
          }
        }
      } catch (e) {
        console.error("Cache hydrate parse error:", e);
      }
    }

    // Kick an async refresh in the background
    refreshProfile(false);

    // Supabase reconnect olduğunda profili yeniden yükle
    const handleReconnect = () => {
      console.log("🔄 [UserContext] Reconnect - profil yeniden yükleniyor...");
      refreshProfile(true);
    };
    window.addEventListener("supabase-reconnected", handleReconnect);

    return () => {
      window.removeEventListener("supabase-reconnected", handleReconnect);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const refreshProfile = async (forceRefresh = false) => {
    if (!user) {
      setProfile(null);
      localStorage.removeItem("cached_profile");
      return;
    }

    // Check cache first if not forcing refresh
    if (!forceRefresh) {
      const cachedProfile = localStorage.getItem("cached_profile");
      if (cachedProfile) {
        try {
          const parsed = JSON.parse(cachedProfile);
          if (parsed.id === user.id && parsed.timestamp > Date.now() - 300000) {
            // 5 min cache
            setProfile({ ...parsed.data, ink_count: parsed.data.ink_count ?? 0 });
            setLoading(false);
            return;
          }
        } catch (e) {
          console.error("Cache parse error:", e);
        }
      }
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.from("profiles").select("*").eq("id", user.id).single();

      if (!error && data) {
        // Check if daily reset is needed
        await checkAndResetDailyStats(data);
        console.log("Profile refreshed:", data);

        const profileData = {
          ...data,
          ink_count: (data as any).ink_count ?? 0,
        };

        setProfile(profileData);

        // Cache profile data with avatar_url
        localStorage.setItem(
          "cached_profile",
          JSON.stringify({
            id: user.id,
            data: profileData,
            timestamp: Date.now(),
          }),
        );
      }
    } catch (error) {
      console.error("Error loading profile:", error);
    } finally {
      setLoading(false);
    }
  };

  const checkAndResetDailyStats = async (profileData: any) => {
    if (!user || !profileData) return;

    const now = new Date();
    const lastReset = profileData.last_daily_reset ? new Date(profileData.last_daily_reset) : null;
    const today = now.toISOString().split("T")[0];

    // If no reset recorded or last reset was before today
    if (!lastReset || lastReset.toISOString().split("T")[0] !== today) {
      console.log("🔄 Resetting daily stats for user:", user.id);

      try {
        const { error } = await supabase
          .from("profiles")
          .update({
            daily_games: 0,
            daily_wins: 0,
            win_streak: 0,
            last_daily_reset: today,
          })
          .eq("id", user.id);

        if (error) {
          console.error("Error resetting daily stats:", error);
        } else {
          console.log("✅ Daily stats reset completed");
        }
      } catch (error) {
        console.error("Error in daily reset:", error);
      }
    }
  };

  const setUserOffline = async () => {
    if (!user?.id) return;

    try {
      await supabase
        .from("user_presence" as any)
        .update({
          is_online: false,
        })
        .eq("user_id", user.id);
    } catch (error) {
      console.error("Error setting offline:", error);
    }
  };

  const updateCredits = (newCredits: number) => {
    if (profile) {
      const updatedProfile = {
        ...profile,
        game_credits: newCredits,
        ink_count: profile.ink_count ?? 0,
      };
      setProfile(updatedProfile);
      console.log("Credits updated locally:", updatedProfile);
    }
  };

  const addBonusCredits = async (bonusCredits: number) => {
    if (!user || !profile) return;

    try {
      const currentBase = profile.game_credits;
      const neededForFull = Math.max(0, 5 - currentBase);
      const newBase = Math.min(5, currentBase + bonusCredits);
      const remainingBonus = Math.max(0, bonusCredits - neededForFull);
      const newTotalBonus = profile.bonus_credits + remainingBonus;

      // Krediler 5/5'e ulaştıysa last_credit_refresh'i temizle (timer dursun)
      const updateData: any = {
        game_credits: newBase,
        bonus_credits: newTotalBonus,
      };

      if (newBase >= 5) {
        updateData.last_credit_refresh = null;
      }

      const { error } = await supabase.from("profiles").update(updateData).eq("id", user.id);

      if (error) throw error;

      const updatedProfile = {
        ...profile,
        game_credits: newBase,
        bonus_credits: newTotalBonus,
        last_credit_refresh: newBase >= 5 ? null : profile.last_credit_refresh,
        ink_count: profile.ink_count ?? 0,
      };
      setProfile(updatedProfile);
      console.log("Bonus credits added:", updatedProfile);
    } catch (error) {
      console.error("Error adding bonus credits:", error);
    }
  };

  const checkAndRefreshCredits = async () => {
    if (!user) return;

    if (isRefreshingCreditsRef.current) {
      console.log("checkAndRefreshCredits: skipped (in progress)");
      return;
    }
    isRefreshingCreditsRef.current = true;

    try {
      const baseline = previousCreditsRef.current || getTotalCredits();

      // Just call RPC, let real-time subscription handle profile updates
      await supabase.rpc("check_and_refresh_credits", { user_id: user.id });

      // Wait a moment for real-time to deliver the update
      await new Promise((resolve) => setTimeout(resolve, 1000));

      const newTotal = getTotalCredits();

      // Only notify if credits actually increased and enough time has passed
      const lastNotified = lastNotifiedTotalRef.current || 0;

      if (newTotal > baseline && newTotal > lastNotified && isPermissionGranted) {
        const creditsGained = newTotal - baseline;
        const now = Date.now();

        const lastNotif = lastNotificationRef.current;
        // Require at least 60 seconds between notifications to prevent spam
        const shouldShowNotification = !lastNotif || now - lastNotif.timestamp > 60000;

        if (shouldShowNotification) {
          console.log(`📢 Showing credit notification: +${creditsGained} credits (${baseline} -> ${newTotal})`);
          showLocalNotification("🎮 Hak Doldu!", `+${creditsGained} oyun hakkı kazandınız! Toplam: ${newTotal}/5`);
          lastNotificationRef.current = { amount: creditsGained, timestamp: now };
          lastNotifiedTotalRef.current = newTotal;
        } else {
          console.log(`🔇 Notification throttled: ${(now - lastNotif.timestamp) / 1000}s since last`);
        }
      }

      // Persist latest totals for next run
      previousCreditsRef.current = newTotal;
    } catch (error) {
      console.error("Error checking credits:", error);
    } finally {
      isRefreshingCreditsRef.current = false;
    }
  };

  const forceRefreshProfile = async () => {
    await refreshProfile(true);
  };

  const getTotalCredits = () => {
    if (!profile) return 0;
    return profile.game_credits + profile.bonus_credits;
  };

  const getDisplayCredits = () => {
    if (!profile) return { base: 0, bonus: 0 };
    return {
      base: profile.game_credits,
      bonus: profile.bonus_credits,
    };
  };

  // Check both premium_until and unlimited_lives_until for premium/unlimited status
  const isPremium = (() => {
    const now = new Date();

    // Check permanent premium subscription
    if (profile?.premium_until && new Date(profile.premium_until) > now) {
      return true;
    }

    // Check temporary unlimited lives (1 hour or 24 hour packages from market)
    if (profile?.unlimited_lives_until && new Date(profile.unlimited_lives_until) > now) {
      return true;
    }

    return false;
  })();

  const consumeCredit = async (): Promise<boolean> => {
    if (!user || !profile) {
      console.log("consumeCredit: No user or profile");
      return false;
    }

    if (isPremium) {
      console.log("consumeCredit: User is premium, returning true");
      return true;
    }

    const totalCredits = getTotalCredits();
    if (totalCredits <= 0) return false;

    try {
      let newGameCredits = profile.game_credits;
      let newBonusCredits = profile.bonus_credits;

      // Önce bonus kredilerden düş, sonra normal kredilerden
      if (profile.bonus_credits > 0) {
        newBonusCredits = profile.bonus_credits - 1;
      } else if (profile.game_credits > 0) {
        newGameCredits = profile.game_credits - 1;
      }

      // last_credit_refresh'i sadece kredi 5'in altına düştüğünde ve daha önce set edilmediyse güncelle
      // Böylece timer her kredi kullanımında sıfırlanmaz
      const shouldSetRefreshTime = newGameCredits < 5 && !profile.last_credit_refresh;

      const updateData: any = {
        game_credits: newGameCredits,
        bonus_credits: newBonusCredits,
      };

      // Sadece ilk kez 5'in altına düştüğünde last_credit_refresh set et
      if (shouldSetRefreshTime) {
        updateData.last_credit_refresh = new Date().toISOString();
      }

      const { error } = await supabase.from("profiles").update(updateData).eq("id", user.id);

      if (error) throw error;

      const updatedProfile = {
        ...profile,
        game_credits: newGameCredits,
        bonus_credits: newBonusCredits,
        last_credit_refresh: shouldSetRefreshTime ? new Date().toISOString() : profile.last_credit_refresh,
        ink_count: profile.ink_count ?? 0,
      };
      setProfile(updatedProfile);
      console.log("Credit consumed:", updatedProfile);
      return true;
    } catch (error) {
      console.error("Error consuming credit:", error);
      return false;
    }
  };

  const isUserOnline = (userId: string) => {
    return onlineUsers.some((user) => user.id === userId);
  };

  const refreshOnlineUsers = async () => {
    try {
      // is_online kontrolü yerine sadece last_seen kontrolü yap
      // Çünkü is_online her zaman doğru güncellenmeyebilir (mobil uygulamada bağlantı koptuğunda)
      const { data }: any = await supabase
        .from("user_presence" as any)
        .select(
          `
          user_id, 
          last_seen, 
          profiles!inner(
            username, 
            avatar_url
          )
        `,
        )
        .gte("last_seen", new Date(Date.now() - 45 * 1000).toISOString()); // Son 45 saniyede görülenler = ONLINE

      if (data) {
        setOnlineUsers(
          data.map((item: any) => ({
            id: item.user_id,
            username: item.profiles.username || "Unknown",
            avatar_url: item.profiles.avatar_url,
            last_seen: item.last_seen,
          })),
        );
      }
    } catch (error) {
      console.error("Error refreshing online users:", error);
    }
  };

  // User presence management - REALTIME + POLLING HYBRID
  useEffect(() => {
    if (!user?.id) return;

    // 1. Durumunu Güncelle (Ben Buradayım Sinyali)
    const updatePresence = async () => {
      try {
        await supabase.from("user_presence" as any).upsert({
          user_id: user.id,
          is_online: true,
          last_seen: new Date().toISOString(),
        });
      } catch (error) {
        console.error("Error updating presence:", error);
      }
    };

    // 2. Online Olanları Çek (Listeyi Güncelle)
    const fetchOnlineUsers = async () => {
      try {
        // is_online kontrolü yerine sadece last_seen kontrolü yap
        // Çünkü is_online her zaman doğru güncellenmeyebilir (mobil uygulamada bağlantı koptuğunda)
        const { data }: any = await supabase
          .from("user_presence" as any)
          .select(
            `
            user_id, 
            last_seen, 
            profiles!inner(
              username, 
              avatar_url
            )
          `,
          )
          .gte("last_seen", new Date(Date.now() - 45 * 1000).toISOString()); // Son 45 saniyede görülenler = ONLINE

        if (data) {
          // Gelen veriyi formatla
          const newUsers = data.map((item: any) => ({
            id: item.user_id,
            username: item.profiles.username || "Unknown",
            avatar_url: item.profiles.avatar_url,
            last_seen: item.last_seen,
          }));

          // STATE GÜNCELLEMESİ: Sadece veri değiştiyse set et (Render optimizasyonu)
          setOnlineUsers((prev) => {
            const isDifferent = JSON.stringify(prev) !== JSON.stringify(newUsers);
            return isDifferent ? newUsers : prev;
          });
        }
      } catch (error) {
        console.error("Error fetching online users:", error);
      }
    };

    const handleBeforeUnload = () => {
      setUserOffline();
    };

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        updatePresence();
        fetchOnlineUsers();
      }
    };

    // --- BAŞLATMA ---
    updatePresence();
    fetchOnlineUsers();

    // A. HEARTBEAT (GÖNDEREN): Her 30 saniyede bir veritabanına "Ben Online'ım" de.
    const heartbeatInterval = setInterval(updatePresence, 30000);

    // B. POLLING (ALICI): Her 5 saniyede bir "Kimler Online?" diye sor.
    // Bu, Realtime çalışmasa bile listenin en geç 5 saniye içinde güncellenmesini garanti eder.
    const pollingInterval = setInterval(fetchOnlineUsers, 5000);

    // C. REALTIME (ANLIK): Veritabanında bir değişiklik olursa ANINDA yakala.
    const channel = supabase
      .channel("presence_changes")
      .on(
        "postgres_changes",
        {
          event: "*", // INSERT, UPDATE veya DELETE olduğunda
          schema: "public",
          table: "user_presence" as any,
        },
        (payload) => {
          console.log("🔔 Realtime Presence Change:", payload);
          fetchOnlineUsers(); // Değişiklik olur olmaz listeyi çek
        },
      )
      .subscribe();

    window.addEventListener("beforeunload", handleBeforeUnload);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      clearInterval(heartbeatInterval);
      clearInterval(pollingInterval); // Polling'i temizle
      supabase.removeChannel(channel);
      // setUserOffline(); // Sayfa yenilenirken offline yapma, heartbeat timeout halletsin (Tercihen)
      window.removeEventListener("beforeunload", handleBeforeUnload);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [user?.id]);

  // Initial profile load
  useEffect(() => {
    if (user) {
      refreshProfile(true);
      // checkAndRefreshCredits() - Çift çağrıyı önle, interval zaten yapacak
    } else {
      setProfile(null);
    }
  }, [user]);

  // Credit check - REALTIME ONLY (NO POLLING)
  useEffect(() => {
    if (!user || isPremium) return;

    // İlk kontrolü hemen yap
    checkAndRefreshCredits();

    // ❌ Credit refresh subscription kaldırıldı - Profile subscription zaten tüm güncellemeleri yakalıyor
    // Bu subscription sonsuz döngüye neden oluyordu
  }, [user, isPremium]);

  // ENHANCED Real-time profile subscription - Only update if data changed
  useEffect(() => {
    if (!user) return;

    console.log("🔄 Setting up real-time profile subscription for user:", user.id);

    const lastUpdateRef = { timestamp: 0, data: "" };

    const channel = supabase
      .channel(`profile-realtime-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "profiles",
          filter: `id=eq.${user.id}`,
        },
        (payload) => {
          if (!payload.new) return;

          const now = Date.now();

          // 🔥 FIX: unlimited_lives_until alanını da hash'e ekle
          const dataHash = JSON.stringify({
            game_credits: (payload.new as any).game_credits,
            bonus_credits: (payload.new as any).bonus_credits,
            total_score: (payload.new as any).total_score,
            wins: (payload.new as any).wins,
            losses: (payload.new as any).losses,
            unlimited_lives_until: (payload.new as any).unlimited_lives_until, // ✅ EKLENEN
            ink_count: (payload.new as any).ink_count, // ✅ EKLENEN
          });

          // Ignore if same data within 2 seconds
          if (now - lastUpdateRef.timestamp < 2000 && dataHash === lastUpdateRef.data) {
            console.log("🚫 Ignoring duplicate profile update (same data)");
            return;
          }

          lastUpdateRef.timestamp = now;
          lastUpdateRef.data = dataHash;

          console.log("🎯 Profile updated via real-time:", payload.new);

          const newProfile = {
            ...(payload.new as UserProfile),
            ink_count: (payload.new as any).ink_count ?? 0,
          };

          // 🔥 FIX: Detaylı log ekle
          console.log("📊 Profile stats updated:", {
            total_score: newProfile.total_score,
            wins: newProfile.wins,
            losses: newProfile.losses,
            game_credits: newProfile.game_credits,
            bonus_credits: newProfile.bonus_credits,
            ink_count: newProfile.ink_count,
            unlimited_lives_until: (payload.new as any).unlimited_lives_until, // ✅ LOG EKLENEN
          });

          setProfile(newProfile);

          // 🔥 FIX: Cache'i de güncelle (HomePage refresh olsa bile çalışsın)
          localStorage.setItem(
            "cached_profile",
            JSON.stringify({
              id: user.id,
              data: newProfile,
              timestamp: Date.now(),
            }),
          );
        },
      )
      .subscribe();

    return () => {
      console.log("🔌 Cleaning up profile subscription");
      supabase.removeChannel(channel);
    };
  }, [user]);

  return (
    <UserContext.Provider
      value={{
        profile,
        loading,
        refreshProfile,
        updateCredits,
        addBonusCredits,
        consumeCredit,
        isSystemConnected,
        checkAndRefreshCredits,
        getTotalCredits,
        getDisplayCredits,
        isPremium,
        forceRefreshProfile,
        onlineUsers,
        isUserOnline,
        refreshOnlineUsers,
      }}
    >
      {children}
    </UserContext.Provider>
  );
};
