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
  // Yeni eklenen alanlar:
  daily_games?: number;
  win_streak?: number;
  daily_wins?: number;
  best_streak?: number;
  average_score?: number;
  total_words?: number;
  favorite_letter?: string;
  total_play_time?: number;
  last_daily_reset?: string;
  ink_count: number;
  // Diğer mevcut alanlar:
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
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
  const previousCreditsRef = useRef<number>(0);
  const lastNotificationRef = useRef<{ amount: number; timestamp: number } | null>(null);
  const isRefreshingCreditsRef = useRef(false);
  const lastNotifiedTotalRef = useRef<number>(0);
  const { showLocalNotification, isPermissionGranted } = useMobileNotifications();

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
          setProfile((prev) => prev ?? parsed.data);
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
            setProfile(parsed.data);
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
        setProfile(data);

        // Cache profile data with avatar_url
        localStorage.setItem(
          "cached_profile",
          JSON.stringify({
            id: user.id,
            data: data,
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
      const updatedProfile = { ...profile, game_credits: newCredits };
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

      const { error } = await supabase
        .from("profiles")
        .update({
          game_credits: newBase,
          bonus_credits: newTotalBonus,
        })
        .eq("id", user.id);

      if (error) throw error;

      const updatedProfile = {
        ...profile,
        game_credits: newBase,
        bonus_credits: newTotalBonus,
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

  const isPremium = profile?.premium_until ? new Date(profile.premium_until) > new Date() : false;

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

      const { error } = await supabase
        .from("profiles")
        .update({
          game_credits: newGameCredits,
          bonus_credits: newBonusCredits,
          last_credit_refresh: new Date().toISOString(),
        })
        .eq("id", user.id);

      if (error) throw error;

      const updatedProfile = {
        ...profile,
        game_credits: newGameCredits,
        bonus_credits: newBonusCredits,
        last_credit_refresh: new Date().toISOString(),
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
        .eq("is_online", true)
        .gte("last_seen", new Date(Date.now() - 45 * 1000).toISOString()); // 45 saniye window

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

  // User presence management - REALTIME ONLY (NO POLLING)
  useEffect(() => {
    if (!user?.id) return;

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

    const fetchOnlineUsers = async () => {
      try {
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
          .eq("is_online", true)
          .gte("last_seen", new Date(Date.now() - 45 * 1000).toISOString()); // 45 saniye window

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
        console.error("Error fetching online users:", error);
      }
    };

    const handleBeforeUnload = () => {
      setUserOffline();
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        setUserOffline();
      } else {
        updatePresence();
        fetchOnlineUsers();
      }
    };

    // İlk presence güncellemesi
    updatePresence();
    fetchOnlineUsers();

    // ❌ POLLING KALDIRILDI - Sadece realtime subscription kullan
    // Diğer kullanıcıların presence'ını realtime dinle
    const channel = supabase
      .channel("presence_changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "user_presence" as any,
        },
        fetchOnlineUsers,
      )
      .subscribe();

    window.addEventListener("beforeunload", handleBeforeUnload);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      supabase.removeChannel(channel);
      setUserOffline();
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

  // ENHANCED Real-time profile subscription - Deduplication fix
  useEffect(() => {
    if (!user) return;

    console.log("🔄 Setting up real-time profile subscription for user:", user.id);

    let isProcessing = false;

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
          // Prevent duplicate processing
          if (isProcessing) {
            console.log("🚫 Skipping duplicate profile update");
            return;
          }

          isProcessing = true;

          console.log("🎯 Profile updated via real-time:", payload.new);
          if (payload.new) {
            // Immediately update the profile state
            const newProfile = payload.new as UserProfile;
            console.log("📊 Profile stats updated:", {
              total_score: newProfile.total_score,
              wins: newProfile.wins,
              losses: newProfile.losses,
              game_credits: newProfile.game_credits,
              bonus_credits: newProfile.bonus_credits,
            });

            setProfile(newProfile);
            setLoading(false);
          }

          // Reset processing flag after a short delay
          setTimeout(() => {
            isProcessing = false;
          }, 500);
        },
      )
      .subscribe((status) => {
        console.log("📡 Real-time subscription status:", status);
      });

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
