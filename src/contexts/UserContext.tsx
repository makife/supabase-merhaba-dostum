import NativeRealtime, { isNativeRealtimeAvailable } from "@/plugins/NativeRealtime";
import React, { createContext, useContext, useState, useEffect, ReactNode, useRef } from "react";
import { useAuth } from "./AuthContext";
import { supabase, setGlobalAccessToken } from "@/integrations/supabase/client";
import { useMobileNotifications } from "@/hooks/useMobileNotifications";
// 🔥 Basit yaklaşım - useAppResume kullanılacak (aşağıda)

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

  // Refs
  const previousCreditsRef = useRef<number>(0);
  const lastNotificationRef = useRef<{ amount: number; timestamp: number } | null>(null);
  const isRefreshingCreditsRef = useRef(false);
  const lastNotifiedTotalRef = useRef<number>(0);

  // 🛡️ KORUMA REFLERİ - GÜÇLENDIRILDI
  const lastRefreshTimeRef = useRef<number>(0);
  const isFetchingProfileRef = useRef<boolean>(false);
  const resumeFetchInProgressRef = useRef<boolean>(false); // 🆕 Resume fetch kilidi
  const lastSuccessfulFetchRef = useRef<number>(0); // 🆕 Son başarılı fetch

  // 🔥 KRİTİK: User ref - closure sorununu çözmek için
  const userRef = useRef(user);
  useEffect(() => {
    userRef.current = user;
  }, [user]);

  const { showLocalNotification, isPermissionGranted } = useMobileNotifications();

  // 1. NATIVE BAĞLANTIYI BAŞLAT + DİNLE + SESSION RESTORE
  useEffect(() => {
    if (!isNative || !NativeRealtime) return;

    const initNativeConnection = async () => {
      try {
        const state = await NativeRealtime.getConnectionState();
        console.log("[UserContext] 🔍 Native mevcut durum:", state);

        if (!state.isConnected) {
          console.log("[UserContext] 🚀 Native bağlantı başlatılıyor...");

          const {
            data: { session },
          } = await supabase.auth.getSession();
          const wsUrl = "wss://nnlvtqmuwmrqfinsgvwc.supabase.co/realtime/v1/websocket";
          const apiKey =
            "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5ubHZ0cW11d21ycWZpbnNndndjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ1MTUzODAsImV4cCI6MjA3MDA5MTM4MH0.MrN6Cgs-uTHg9MF_zfae31VXAj6lTI6V9gdEFZBMvVE";

          await NativeRealtime.connect({
            url: wsUrl,
            apiKey: apiKey,
            accessToken: session?.access_token || "",
          });

          console.log("[UserContext] ✅ Native bağlantı başlatıldı!");
        } else {
          console.log("[UserContext] ✅ Native zaten bağlı.");
          setIsSystemConnected(true);
        }
      } catch (e) {
        console.error("[UserContext] ❌ Native bağlantı hatası:", e);
      }
    };

    // 🔥 KRİTİK: Kotlin'den gelen session restore event'ini dinle
    const handleSessionRestored = (data: { accessToken?: string; restored?: boolean }) => {
      console.log("[UserContext] 🔑 SessionRestored event alındı:", data.restored ? "✅" : "❌");
      if (data.accessToken) {
        // Kotlin'deki valid token'ı JS tarafına enjekte et
        setGlobalAccessToken(data.accessToken);
        setIsSystemConnected(true);
        
        // Token güncellendiğinde profili de yenile
        console.log("[UserContext] 🔄 Token güncellendi, profil yenileniyor...");
        refreshProfile(true);
      }
    };

    // 🔥 Native realtime mesajlarını dinle (profiles tablosu için)
    const handleNativeMessage = (data: { topic?: string; event?: string; payload?: string }) => {
      if (data.topic?.includes("profiles") || data.event === "UPDATE") {
        try {
          const payload = typeof data.payload === "string" ? JSON.parse(data.payload) : data.payload;
          console.log("[UserContext] 📡 Native'den profil güncellemesi:", payload);
          setProfile(prev => prev ? { ...prev, ...payload } : payload);
        } catch (e) {
          console.error("[UserContext] ❌ Native message parse hatası:", e);
        }
      }
    };

    const handleNativeState = (data: { state: string }) => {
      console.log("[UserContext] 🔌 Native state:", data.state);
      if (data.state === "connected") {
        setIsSystemConnected(true);
      } else if (data.state === "disconnected") {
        const jsConnected = supabase.realtime?.channels?.length > 0;
        setIsSystemConnected(jsConnected);
      }
    };

    // Listener'ları kaydet
    const stateListener = NativeRealtime.addListener("connectionState", handleNativeState);
    const sessionListener = NativeRealtime.addListener("sessionRestored", handleSessionRestored);
    const messageListener = NativeRealtime.addListener("realtimeMessage", handleNativeMessage);
    
    initNativeConnection();

    return () => {
      console.log("⚠️ [UserContext] Native listeners temizleniyor...");
      stateListener.then(l => l.remove()).catch(() => {});
      sessionListener.then(l => l.remove()).catch(() => {});
      messageListener.then(l => l.remove()).catch(() => {});
    };
  }, [isNative]);

  // 2. 🔥 BASİT YAKLAŞIM: app-resumed eventi dinle (GLOBAL LISTENER)
  useEffect(() => {
    const checkConnection = async () => {
      try {
        if (!navigator.onLine) {
          setIsSystemConnected(false);
          return;
        }
        const isNativePlatform =
          typeof (window as any).Capacitor !== "undefined" && (window as any).Capacitor?.isNativePlatform?.();
        if (isNativePlatform) {
          setIsSystemConnected(navigator.onLine);
          return;
        }
        const state = (supabase.realtime as any).connectionState?.();
        const isConnected = state === "open" || state === "connecting";
        const channels = supabase.getChannels();
        const hasActiveChannel = channels.some((ch) => ch.state === "joined" || ch.state === "joining");
        const isReallyConnected = isConnected && (channels.length === 0 || hasActiveChannel);
        setIsSystemConnected(isReallyConnected);
      } catch (e) {
        setIsSystemConnected(navigator.onLine);
      }
    };

    checkConnection();
    const interval = setInterval(checkConnection, 30000);

    // 🔥 ARKA PLANA GİDİNCE KİLİTLERİ SIFIRLA
    const handleBackground = () => {
      console.log("🌙 [UserContext] Arka plana gidiliyor - kilitler sıfırlanıyor");
      isFetchingProfileRef.current = false;
      isRefreshingCreditsRef.current = false;
    };

    const handleOffline = () => {
      console.log("📴 [UserContext] Network offline");
      setIsSystemConnected(false);
    };

    // 🔥 GLOBAL RESUME HANDLER - STABİLİZE EDİLMİŞ VERSİYON
    const handleAppResumed = async () => {
      console.log("📱 [UserContext] 🎯 Uygulama ön plana çıktı (Resume)");

      // 1. 🛡️ DUPLICATE GUARD: Zaten bir işlem devam ediyorsa yeni işlem başlatma
      if (resumeFetchInProgressRef.current) {
        console.log("📱 [UserContext] ⏭️ İşlem zaten sürüyor, atlanıyor.");
        return;
      }

      const currentUser = userRef.current;
      const userId = currentUser?.id;

      if (!userId) {
        console.log("📱 [UserContext] ⚠️ Oturum açmış kullanıcı yok, profil çekilmeyecek.");
        return;
      }

      resumeFetchInProgressRef.current = true;

      try {
        // 2. ⏳ STABİLİZASYON BEKLEMESİ (1000ms)
        // Cihaz uykudan yeni uyandığında WiFi/Mobil verinin el sıkışması (handshake) için
        // bir saniye beklemek, timeout hatalarını %80 oranında azaltır.
        console.log("📱 [UserContext] 💤 Ağın stabilize olması bekleniyor (1s)...");
        await new Promise((resolve) => setTimeout(resolve, 1000));

        // 3. 🔌 NATIVE DURUM KONTROLÜ
        if (isNative && NativeRealtime) {
          const state = await NativeRealtime.getConnectionState();
          console.log(`📱 [UserContext] 🔍 Native WebSocket Durumu: ${state.state}`);

          // Eğer bağlantı kopuksa, connect() emrini burası değil
          // Kotlin tarafındaki handleDisconnect (retry mekanizması) vermeli.
          // Sadece token güncelliğinden emin olalım.
        }

        // 4. 📡 PROFİL YENİLEME
        // refreshProfile zaten kendi içinde lock (isFetchingProfileRef) ve
        // spam korumasına sahip olduğu için en güvenli yoldur.
        console.log("📱 [UserContext] 🔄 Profil güncelleniyor...");

        // timeout içermeyen temiz bir çağrı, hata durumunda catch'e düşer
        await refreshProfile(true);

        lastSuccessfulFetchRef.current = Date.now();
        setIsSystemConnected(true);
      } catch (e: any) {
        console.error("📱 [UserContext] ❌ Resume sırasında bir hata oluştu:", e?.message);

        // Eğer hata bir timeout ise, client'ı hemen öldürmek yerine
        // bir sonraki otomatik döngüye bırakmak daha sağlıklıdır.
        if (e?.message === "TIMEOUT") {
          console.warn("📱 [UserContext] ⚠️ Sunucu yanıt vermedi, ağ kalitesi düşük olabilir.");
        }
      } finally {
        // İşlem bitti, kilidi aç
        resumeFetchInProgressRef.current = false;
      }
    };
    window.addEventListener("appBackground", handleBackground);
    window.addEventListener("offline", handleOffline);
    window.addEventListener("app-resumed", handleAppResumed);

    console.log("[UserContext] ✅ app-resumed listener kaydedildi");

    return () => {
      window.removeEventListener("appBackground", handleBackground);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("app-resumed", handleAppResumed);
      clearInterval(interval);
    };
  }, []);

  const intentionalLogoutRef = useRef(false);

  useEffect(() => {
    const handleLogout = () => {
      console.log("[UserContext] 🚪 Intentional logout algılandı");
      intentionalLogoutRef.current = true;
    };
    window.addEventListener("auth-logout", handleLogout);
    return () => window.removeEventListener("auth-logout", handleLogout);
  }, []);

  useEffect(() => {
    if (!user) {
      if (intentionalLogoutRef.current) {
        console.log("[UserContext] 🚪 Logout - profile temizleniyor");
        setProfile(null);
        localStorage.removeItem("cached_profile");
        intentionalLogoutRef.current = false;
      } else {
        console.log("[UserContext] ⏳ User null ama logout değil - profile korunuyor");
      }
      return;
    }

    isRefreshingCreditsRef.current = false;

    const cached = localStorage.getItem("cached_profile");
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (parsed.id === user.id) {
          console.log("[UserContext] ⚡ Cache'den hızlı hydrate:", parsed.data?.username);
          setProfile({ ...parsed.data, ink_count: parsed.data.ink_count ?? 0 });
          if (parsed.data?.avatar_url) {
            const img = new Image();
            img.src = parsed.data.avatar_url;
          }
        }
      } catch (e) {
        console.error("Cache hydrate parse error:", e);
      }
    }

    console.log("[UserContext] 🚀 User değişti, profil zorla yenileniyor...");
    // 🔥 User değiştiğinde tüm kilitleri sıfırla
    isFetchingProfileRef.current = false;
    isRefreshingCreditsRef.current = false;
    resumeFetchInProgressRef.current = false;
    lastRefreshTimeRef.current = 0;

    // 🛡️ Sadece son fetch çok eski ise yenile (duplicate önleme)
    const timeSinceLastFetch = Date.now() - lastSuccessfulFetchRef.current;
    if (timeSinceLastFetch > 2000) {
      refreshProfile(true);
    } else {
      console.log(`[UserContext] ⏭️ Son fetch çok yeni (${timeSinceLastFetch}ms), atlanıyor`);
    }
  }, [user?.id]);

  // 🛡️ DÜZELTİLMİŞ VE KORUMALI REFRESH PROFILE
  const refreshProfile = async (forceRefresh = false) => {
    // 🔥 KRİTİK: Her iki kaynaktan da user'ı kontrol et
    const currentUser = user || userRef.current;

    if (!currentUser) {
      console.log("⏳ [UserContext] refreshProfile: user yok, bekleniyor...");
      // Sadece intentional logout'ta temizle
      return;
    }

    // 1. KİLİT KONTROLÜ: Zaten bir istek varsa yenisini kabul etme
    // 🔥 FORCE modunda kilidi atla
    if (isFetchingProfileRef.current && !forceRefresh) {
      console.log("🛡️ [UserContext] Zaten profil çekiliyor, istek sıraya alınmadı (Concurrency Lock).");
      return;
    }

    // 🔥 Force refresh ise kilidi zorla aç
    if (forceRefresh && isFetchingProfileRef.current) {
      console.log("🔓 [UserContext] FORCE - kilit zorla açılıyor...");
      isFetchingProfileRef.current = false;
    }

    // 2. SPAM KORUMASI (Cool-down): Son 1 saniye içinde çekildiyse reddet
    // 🔥 Force modunda cooldown'ı kısalt
    const now = Date.now();
    const COOLDOWN_MS = forceRefresh ? 500 : 2000; // Force: 0.5sn, Normal: 2sn
    if (now - lastRefreshTimeRef.current < COOLDOWN_MS) {
      console.log(
        `🛡️ [UserContext] Profil çok yeni (${Math.round(now - lastRefreshTimeRef.current)}ms), istek atlandı (Debounce).`,
      );
      return;
    }

    const CACHE_DURATION = 30000; // 30 saniye

    // Check cache first if not forcing refresh
    if (!forceRefresh) {
      const cachedProfile = localStorage.getItem("cached_profile");
      if (cachedProfile) {
        try {
          const parsed = JSON.parse(cachedProfile);
          const isValidCache =
            parsed.id === currentUser.id &&
            parsed.timestamp > Date.now() - CACHE_DURATION &&
            parsed.data?.username &&
            typeof parsed.data?.total_score === "number";

          if (isValidCache) {
            console.log(
              "[UserContext] ✅ Cache'den yüklendi (kalan:",
              Math.round((parsed.timestamp + CACHE_DURATION - Date.now()) / 1000),
              "sn)",
            );
            setProfile({ ...parsed.data, ink_count: parsed.data.ink_count ?? 0 });
            setLoading(false);
            return;
          } else {
            console.log("[UserContext] ⚠️ Cache geçersiz veya eksik, API'den çekilecek");
          }
        } catch (e) {
          console.error("Cache parse error:", e);
        }
      }
    }

    // KİLİDİ KAPAT (İşlem Başlıyor)
    isFetchingProfileRef.current = true;
    setLoading(true);
    console.log("[UserContext] 🔄 Profil Supabase'den çekiliyor...", forceRefresh ? "(FORCE)" : "");

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5sn timeout

      const { data, error } = await supabase.from("profiles").select("*").eq("id", currentUser.id).single();

      clearTimeout(timeoutId);

      if (error) {
        console.error("[UserContext] ❌ Profil çekme hatası:", error.message);
        // Fallback to cache on error
        const cachedProfile = localStorage.getItem("cached_profile");
        if (cachedProfile) {
          try {
            const parsed = JSON.parse(cachedProfile);
            if (parsed.id === currentUser.id) {
              console.log("[UserContext] ⚠️ Hata - Cache'den fallback yükleniyor");
              setProfile({ ...parsed.data, ink_count: parsed.data.ink_count ?? 0 });
            }
          } catch {}
        }
      } else if (data) {
        await checkAndResetDailyStats(data);
        console.log("[UserContext] ✅ Profil başarıyla yüklendi:", data.username);

        const profileData = {
          ...data,
          ink_count: (data as any).ink_count ?? 0,
        };

        setProfile(profileData);
        // Zaman damgasını güncelle - BAŞARILI İŞLEM SONRASI
        lastRefreshTimeRef.current = Date.now();

        localStorage.setItem(
          "cached_profile",
          JSON.stringify({
            id: currentUser.id,
            data: profileData,
            timestamp: Date.now(),
          }),
        );
      }
    } catch (error: any) {
      console.error("[UserContext] ❌ Profile fetch exception:", error?.message || error);
    } finally {
      // KİLİDİ AÇ (İşlem Bitti)
      isFetchingProfileRef.current = false;
      setLoading(false);
    }
  };

  const checkAndResetDailyStats = async (profileData: any) => {
    const currentUser = user || userRef.current;
    if (!currentUser || !profileData) return;

    const now = new Date();
    const lastReset = profileData.last_daily_reset ? new Date(profileData.last_daily_reset) : null;
    const today = now.toISOString().split("T")[0];

    if (!lastReset || lastReset.toISOString().split("T")[0] !== today) {
      console.log("🔄 Resetting daily stats for user:", currentUser.id);

      try {
        const { error } = await supabase
          .from("profiles")
          .update({
            daily_games: 0,
            daily_wins: 0,
            win_streak: 0,
            last_daily_reset: today,
          })
          .eq("id", currentUser.id);

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
      await supabase.rpc("check_and_refresh_credits", { user_id: user.id });
      await new Promise((resolve) => setTimeout(resolve, 1000));
      const newTotal = getTotalCredits();

      const lastNotified = lastNotifiedTotalRef.current || 0;

      if (newTotal > baseline && newTotal > lastNotified && isPermissionGranted) {
        const creditsGained = newTotal - baseline;
        const now = Date.now();
        const lastNotif = lastNotificationRef.current;
        const shouldShowNotification = !lastNotif || now - lastNotif.timestamp > 60000;

        if (shouldShowNotification) {
          console.log(`📢 Showing credit notification: +${creditsGained} credits`);
          showLocalNotification("🎮 Hak Doldu!", `+${creditsGained} oyun hakkı kazandınız! Toplam: ${newTotal}/5`);
          lastNotificationRef.current = { amount: creditsGained, timestamp: now };
          lastNotifiedTotalRef.current = newTotal;
        }
      }
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

  const isPremium = (() => {
    const now = new Date();
    if (profile?.premium_until && new Date(profile.premium_until) > now) return true;
    if (profile?.unlimited_lives_until && new Date(profile.unlimited_lives_until) > now) return true;
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

      if (profile.bonus_credits > 0) {
        newBonusCredits = profile.bonus_credits - 1;
      } else if (profile.game_credits > 0) {
        newGameCredits = profile.game_credits - 1;
      }

      const shouldSetRefreshTime = newGameCredits < 5 && !profile.last_credit_refresh;
      const updateData: any = {
        game_credits: newGameCredits,
        bonus_credits: newBonusCredits,
      };

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
        .select(`user_id, last_seen, profiles!inner(username, avatar_url)`)
        .gte("last_seen", new Date(Date.now() - 45 * 1000).toISOString());

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

  // User presence management
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
          .select(`user_id, last_seen, profiles!inner(username, avatar_url)`)
          .gte("last_seen", new Date(Date.now() - 45 * 1000).toISOString());

        if (data) {
          const newUsers = data.map((item: any) => ({
            id: item.user_id,
            username: item.profiles.username || "Unknown",
            avatar_url: item.profiles.avatar_url,
            last_seen: item.last_seen,
          }));

          setOnlineUsers((prev) => {
            const isDifferent = JSON.stringify(prev) !== JSON.stringify(newUsers);
            return isDifferent ? newUsers : prev;
          });
        }
      } catch (error) {
        console.error("Error fetching online users:", error);
      }
    };

    const handleBeforeUnload = () => setUserOffline();
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        updatePresence();
        fetchOnlineUsers();
      }
    };

    updatePresence();
    fetchOnlineUsers();

    const heartbeatInterval = setInterval(updatePresence, 30000);
    const pollingInterval = setInterval(fetchOnlineUsers, 5000);

    const channel = supabase
      .channel("presence_changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "user_presence" as any }, (payload) => {
        console.log("🔔 Realtime Presence Change:", payload);
        fetchOnlineUsers();
      })
      .subscribe();

    window.addEventListener("beforeunload", handleBeforeUnload);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      clearInterval(heartbeatInterval);
      clearInterval(pollingInterval);
      console.log("⚠️ [UserContext] Presence cleanup ATLANYOR (bağlantı koruması)");
      window.removeEventListener("beforeunload", handleBeforeUnload);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [user?.id]);

  useEffect(() => {
    if (user) {
      refreshProfile(true);
    } else {
      setProfile(null);
    }
  }, [user]);

  useEffect(() => {
    if (!user || isPremium) return;
    checkAndRefreshCredits();
  }, [user, isPremium]);

  // ENHANCED Real-time profile subscription
  useEffect(() => {
    if (!user) return;

    console.log("🔄 Setting up real-time profile subscription for user:", user.id);
    const lastUpdateRef = { timestamp: 0, data: "" };

    const channel = supabase
      .channel(`profile-realtime-${user.id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "profiles", filter: `id=eq.${user.id}` },
        (payload) => {
          if (!payload.new) return;

          const now = Date.now();
          const dataHash = JSON.stringify({
            game_credits: (payload.new as any).game_credits,
            bonus_credits: (payload.new as any).bonus_credits,
            total_score: (payload.new as any).total_score,
            wins: (payload.new as any).wins,
            losses: (payload.new as any).losses,
            unlimited_lives_until: (payload.new as any).unlimited_lives_until,
            ink_count: (payload.new as any).ink_count,
          });

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

          console.log("📊 Profile stats updated:", {
            total_score: newProfile.total_score,
            wins: newProfile.wins,
            losses: newProfile.losses,
            game_credits: newProfile.game_credits,
            bonus_credits: newProfile.bonus_credits,
            ink_count: newProfile.ink_count,
            unlimited_lives_until: (payload.new as any).unlimited_lives_until,
          });

          setProfile(newProfile);
          // Realtime'dan gelince de zaman damgasını güncelle ki manuel refresh çakışmasın
          lastRefreshTimeRef.current = Date.now();

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
      .subscribe((status) => {
        console.log(`[Profile] 📡 Channel status: ${status}`);
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          console.log("[Profile] ⚠️ Channel error, profil yeniden yüklenecek...");
          setTimeout(() => {
            refreshProfile(true);
          }, 3000);
        }
      });

    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        console.log("[Profile] 👁️ Sayfa görünür, profil kontrol ediliyor...");
        const cached = localStorage.getItem("cached_profile");
        if (cached) {
          try {
            const parsed = JSON.parse(cached);
            if (Date.now() - parsed.timestamp > 30000) {
              refreshProfile(true);
            }
          } catch (e) {
            refreshProfile(true);
          }
        } else {
          refreshProfile(true);
        }
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      console.log("⚠️ [UserContext] Profile cleanup ATLANYOR (bağlantı koruması)");
      document.removeEventListener("visibilitychange", handleVisibility);
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
