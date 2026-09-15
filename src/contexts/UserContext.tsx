// NativeRealtime kaldırıldı - Supabase JS SDK yeterli
import React, { createContext, useContext, useState, useEffect, ReactNode, useRef } from "react";
import { useAuth } from "./AuthContext";
import { supabase, setGlobalAccessToken, getGlobalAccessToken, loadSessionFromStorage } from "@/integrations/supabase/client";
import { useMobileNotifications } from "@/hooks/useMobileNotifications";
import { nativeStorage, STORAGE_KEYS } from "@/utils/nativeStorage";
import { Capacitor } from "@capacitor/core";
import { matchmakingMode } from "@/utils/matchmakingMode";

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
  bonus_spins?: number;
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
  const isNative = Capacitor.isNativePlatform();
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

  // Native bağlantı yönetimi kaldırıldı - window.location.reload() stratejisi kullanılıyor
  // Reload sonrası Supabase JS SDK tüm bağlantıları sıfırdan kuruyor

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

    // 🆕🔥 AUTH-READY HANDLER - Token refresh BİTTİKTEN sonra çalışır!
    // useSessionRecovery token'ı yeniledikten sonra auth-ready dispatch eder
    const handleAuthReady = async (event: any) => {
      const detail = (event as CustomEvent).detail;
      console.log("📱 [UserContext] 🎯 auth-ready eventi alındı:", detail?.source);

      // 1. 🛡️ DUPLICATE GUARD
      if (resumeFetchInProgressRef.current) {
        console.log("📱 [UserContext] ⭐️ İşlem zaten sürüyor, atlanıyor.");
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
        // 🔥🔥🔥 KRİTİK FİX: Supabase client'ın session'ını VERIFY et
        console.log("📱 [UserContext] 🔍 Supabase session kontrol ediliyor...");

        const {
          data: { session: currentSession },
          error: sessionError,
        } = await supabase.auth.getSession();

        if (sessionError || !currentSession?.access_token) {
          console.error("📱 [UserContext] ❌ Supabase session yok veya hatalı:", sessionError?.message);

          // 🔥 FIX: Storage'dan session yükle ve Supabase'e set et
          const stored = await loadSessionFromStorage();
          if (stored?.access_token) {
            console.log("📱 [UserContext] 🔄 Storage'dan session zorla yükleniyor...");

            const { error: setError } = await supabase.auth.setSession({
              access_token: stored.access_token,
              refresh_token: stored.refresh_token,
            });

            if (setError) {
              console.error("📱 [UserContext] ❌ setSession hatası:", setError.message);
              resumeFetchInProgressRef.current = false;
              return;
            }

            // Global token'ı da set et
            setGlobalAccessToken(stored.access_token);
            console.log("📱 [UserContext] ✅ Session ve token set edildi!");

            // Biraz bekle ki Supabase internal state güncellensin
            await new Promise((resolve) => setTimeout(resolve, 300));
          } else {
            console.error("📱 [UserContext] ❌ Storage'da da session yok!");
            resumeFetchInProgressRef.current = false;
            return;
          }
        } else {
          // Session var - global token'ı set et
          setGlobalAccessToken(currentSession.access_token);
          console.log("📱 [UserContext] ✅ Session mevcut, token set edildi");
        }

        // Native durum kontrolü kaldırıldı - reload stratejisi kullanılıyor

        // 🔥 PROFİL YENİLEME - TIMEOUT İLE
        console.log("📱 [UserContext] 🔄 Profil güncelleniyor...");

        // 🔥 Promise.race ile 10 saniye timeout (8 sn yerine)
        const profilePromise = refreshProfile(true);
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error("PROFILE_TIMEOUT")), 10000),
        );

        await Promise.race([profilePromise, timeoutPromise]);

        lastSuccessfulFetchRef.current = Date.now();
        setIsSystemConnected(true);

        // 🔥 data-ready eventi SADECE profil başarıyla yüklendiyse gönder
        console.log("📱 [UserContext] 📢 data-ready eventi dispatch ediliyor...");
        window.dispatchEvent(new CustomEvent("data-ready"));
      } catch (e: any) {
        const errorMsg = e?.message || "Bilinmeyen hata";
        console.error("📱 [UserContext] ❌ Resume sırasında hata:", errorMsg);

        if (errorMsg === "PROFILE_TIMEOUT") {
          console.warn("📱 [UserContext] ⏱️ Profil yenileme 10sn timeout - ağ yavaş olabilir");

          // Timeout durumunda cache'den yükle (async)
          try {
            const cachedStr = await nativeStorage.getItem(STORAGE_KEYS.CACHED_PROFILE);
            if (cachedStr) {
              const parsed = JSON.parse(cachedStr);
              if (parsed.id === userId && parsed.data) {
                console.log("📱 [UserContext] 📦 Timeout - cache'den yükleniyor");
                setProfile({ ...parsed.data, ink_count: parsed.data.ink_count ?? 0 });
              }
            }
          } catch {}
        }
      } finally {
        // İşlem bitti, kilidi aç
        resumeFetchInProgressRef.current = false;
      }
    };

    // 🆕 Eski app-resumed handler (basitleştirilmiş - sadece log)
    const handleAppResumed = () => {
      console.log("📱 [UserContext] 📡 app-resumed eventi alındı - auth-ready bekleniyor...");
      // Token refresh işlemi useSessionRecovery'de yapılıyor
      // Profil yenileme auth-ready eventinden sonra yapılacak
    };

    // 🔥🔥🔥 YENİ: data-ready eventini de dinle!
    // Bu event useAppForegroundState'ten GELİYOR (arka plandan dönüşte)
    const handleDataReady = async (event: any) => {
      const detail = (event as CustomEvent).detail;
      
      // Sadece foreground-resume kaynağından gelen eventi işle
      if (detail?.source === "foreground-resume") {
        console.log("📱 [UserContext] 🎯 data-ready (foreground-resume) alındı - profil yenileniyor!");
        
        const currentUser = userRef.current;
        if (currentUser?.id) {
          // 🔥 Kilitleri temizle ve profili yenile
          isFetchingProfileRef.current = false;
          isRefreshingCreditsRef.current = false;
          resumeFetchInProgressRef.current = false;
          
          try {
            await refreshProfile(true);
            console.log("📱 [UserContext] ✅ Profil foreground'da yenilendi!");
          } catch (e) {
            console.error("📱 [UserContext] ❌ Foreground profil yenileme hatası:", e);
          }
        }
      }
    };

    window.addEventListener("appBackground", handleBackground);
    window.addEventListener("offline", handleOffline);
    window.addEventListener("auth-ready", handleAuthReady);
    window.addEventListener("app-resumed", handleAppResumed);
    window.addEventListener("data-ready", handleDataReady);

    console.log("[UserContext] ✅ auth-ready, app-resumed ve data-ready listener'ları kaydedildi");

    return () => {
      window.removeEventListener("appBackground", handleBackground);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("auth-ready", handleAuthReady);
      window.removeEventListener("app-resumed", handleAppResumed);
      window.removeEventListener("data-ready", handleDataReady);
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
        nativeStorage.removeItem(STORAGE_KEYS.CACHED_PROFILE);
        intentionalLogoutRef.current = false;
      } else {
        console.log("[UserContext] ⏳ User null ama logout değil - profile korunuyor");
      }
      return;
    }

    isRefreshingCreditsRef.current = false;

    // Cache'den profil yükle (async)
    const loadCachedProfile = async () => {
      try {
        const cached = await nativeStorage.getItem(STORAGE_KEYS.CACHED_PROFILE);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (parsed.id === user.id) {
            console.log("[UserContext] ⚡ Cache'den hızlı hydrate:", parsed.data?.username);
            setProfile({ ...parsed.data, ink_count: parsed.data.ink_count ?? 0 });
            if (parsed.data?.avatar_url) {
              const img = new Image();
              img.src = parsed.data.avatar_url;
            }
          }
        }
      } catch (e) {
        console.error("Cache hydrate parse error:", e);
      }
    };

    loadCachedProfile();

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
    const currentUser = user || userRef.current;

    if (!currentUser) {
      console.log("⏳ [UserContext] refreshProfile: user yok, bekleniyor...");
      return;
    }

    // 1. KİLİT KONTROLÜ
    if (isFetchingProfileRef.current && !forceRefresh) {
      console.log("🛡️ [UserContext] Zaten profil çekiliyor, istek sıraya alınmadı (Concurrency Lock).");
      return;
    }

    if (forceRefresh && isFetchingProfileRef.current) {
      console.log("🔓 [UserContext] FORCE - kilit zorla açılıyor...");
      isFetchingProfileRef.current = false;
    }

    // 2. SPAM KORUMASI
    const now = Date.now();
    const COOLDOWN_MS = forceRefresh ? 500 : 2000;
    if (now - lastRefreshTimeRef.current < COOLDOWN_MS) {
      console.log(
        `🛡️ [UserContext] Profil çok yeni (${Math.round(now - lastRefreshTimeRef.current)}ms), istek atlandı (Debounce).`,
      );
      return;
    }

    const CACHE_DURATION = 30000; // 30 saniye

    // Cache kontrolü (force değilse) - async olduğu için ayrı fonksiyon
    const checkCache = async (): Promise<boolean> => {
      if (forceRefresh) return false;
      
      try {
        const cachedStr = await nativeStorage.getItem(STORAGE_KEYS.CACHED_PROFILE);
        if (!cachedStr) return false;
        
        const parsed = JSON.parse(cachedStr);
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
          return true;
        }
      } catch (e) {
        console.error("Cache parse error:", e);
      }
      return false;
    };

    if (await checkCache()) {
      isFetchingProfileRef.current = false;
      return;
    }

    // KİLİDİ KAPAT
    isFetchingProfileRef.current = true;
    setLoading(true);
    console.log("[UserContext] 🔄 Profil Supabase'den çekiliyor...", forceRefresh ? "(FORCE)" : "");

    try {
      // 🔥🔥🔥 KRİTİK FİX: İstek öncesi session kontrolü
      const {
        data: { session },
        error: sessionCheckError,
      } = await supabase.auth.getSession();

      if (sessionCheckError || !session?.access_token) {
        console.error("[UserContext] ❌ Session kontrolü başarısız:", sessionCheckError?.message);
        throw new Error("NO_VALID_SESSION");
      }

      console.log("[UserContext] ✅ Session geçerli, profil çekiliyor...");

      // 🔥 AbortController ile gerçek timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        console.log("[UserContext] ⏱️ 8sn timeout - istek iptal ediliyor...");
        controller.abort();
      }, 8000);

      // 🔥 Supabase query'sine abort signal geçir
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", currentUser.id)
        .abortSignal(controller.signal)
        .single();

      clearTimeout(timeoutId);

      if (error) {
        console.error("[UserContext] ❌ Profil çekme hatası:", error.message);
        console.error("[UserContext] 🔍 Hata detayları:", {
          code: error.code,
          details: error.details,
          hint: error.hint,
        });

        // 🔥 PGRST116 = Profile yok - otomatik oluştur!
        if (error.code === "PGRST116") {
          console.log("[UserContext] 🆕 Profile bulunamadı, otomatik oluşturuluyor...");
          try {
            const newProfile = {
              id: currentUser.id,
              email: currentUser.email || "",
              username: currentUser.user_metadata?.username || currentUser.email?.split("@")[0] || "Oyuncu",
              game_credits: 5,
              bonus_credits: 0,
              ink_count: 0,
              total_score: 0,
              total_games: 0,
              wins: 0,
              losses: 0,
            };

            const { data: createdProfile, error: createError } = await supabase
              .from("profiles")
              .insert(newProfile)
              .select()
              .single();

            if (createError) {
              console.error("[UserContext] ❌ Profile oluşturma hatası:", createError.message);
            } else if (createdProfile) {
              console.log("[UserContext] ✅ Yeni profile oluşturuldu:", createdProfile.username);
              setProfile({ ...createdProfile, ink_count: (createdProfile as any).ink_count ?? 0 });
              isFetchingProfileRef.current = false;
              setLoading(false);
              return; // Başarılı - erken çık
            }
          } catch (createErr) {
            console.error("[UserContext] ❌ Profile create exception:", createErr);
          }
        }

        // Fallback to cache on error (async)
        try {
          const cachedStr = await nativeStorage.getItem(STORAGE_KEYS.CACHED_PROFILE);
          if (cachedStr) {
            const parsed = JSON.parse(cachedStr);
            if (parsed.id === currentUser.id) {
              console.log("[UserContext] ⚠️ Hata - Cache'den fallback yükleniyor");
              setProfile({ ...parsed.data, ink_count: parsed.data.ink_count ?? 0 });
            }
          }
        } catch {}
      } else if (data) {
        await checkAndResetDailyStats(data);
        console.log("[UserContext] ✅ Profil başarıyla yüklendi:", data.username);
        console.log("[UserContext] 📊 Profil verileri:", {
          game_credits: data.game_credits,
          bonus_credits: data.bonus_credits,
          total_score: data.total_score,
          ink_count: (data as any).ink_count,
        });

        const profileData = {
          ...data,
          ink_count: (data as any).ink_count ?? 0,
        };

        console.log("[UserContext] 🎯 setProfile çağrılıyor, yeni veriler:", {
          username: profileData.username,
          game_credits: profileData.game_credits,
          total_score: profileData.total_score,
          ink_count: profileData.ink_count,
        });

        setProfile(profileData);

        // Zaman damgasını güncelle - BAŞARILI İŞLEM SONRASI
        lastRefreshTimeRef.current = Date.now();

        // Native storage'a kaydet
        await nativeStorage.setItem(
          STORAGE_KEYS.CACHED_PROFILE,
          JSON.stringify({
            id: currentUser.id,
            data: profileData,
            timestamp: Date.now(),
          }),
        );
      }
    } catch (error: any) {
      console.error("[UserContext] ❌ Profile fetch exception:", error?.message || error);

      // 🔥 Hata tipine göre detaylı log
      if (error?.message === "NO_VALID_SESSION") {
        console.error("[UserContext] 🚫 Session geçersiz - kullanıcı logout olabilir");
      } else if (error?.name === "AbortError") {
        console.error("[UserContext] ⏱️ İstek timeout'a düştü");
      } else {
        console.error("[UserContext] 🔍 Bilinmeyen hata tipi:", error);
      }
    } finally {
      // KİLİDİ AÇ
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
      // 🔥 KRİTİK FIX: Önce veritabanından güncel değerleri çek!
      // Bu sayede eski cache değeri üzerine yazmayı önlüyoruz
      const { data: freshProfile, error: fetchError } = await supabase
        .from("profiles")
        .select("game_credits, bonus_credits, last_credit_refresh")
        .eq("id", user.id)
        .single();

      if (fetchError || !freshProfile) {
        console.error("addBonusCredits: Fresh profile fetch failed:", fetchError);
        return;
      }

      const currentBase = freshProfile.game_credits || 0;
      const currentBonus = freshProfile.bonus_credits || 0;
      
      // 🔥 FIX: Mevcut game_credits 5'ten büyükse fazlayı da bonus'a taşı
      const existingOverage = Math.max(0, currentBase - 5);
      const effectiveBase = Math.min(currentBase, 5);
      
      const neededForFull = Math.max(0, 5 - effectiveBase);
      const newBase = Math.min(5, effectiveBase + bonusCredits);
      const remainingBonus = Math.max(0, bonusCredits - neededForFull);
      const newTotalBonus = currentBonus + remainingBonus + existingOverage;

      console.log(`addBonusCredits: Adding ${bonusCredits} credits. Before: game=${currentBase}, bonus=${currentBonus}. After: game=${newBase}, bonus=${newTotalBonus}`);

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
        last_credit_refresh: newBase >= 5 ? null : freshProfile.last_credit_refresh,
        ink_count: profile.ink_count ?? 0,
      };
      setProfile(updatedProfile);
      console.log("Bonus credits added successfully:", { newBase, newTotalBonus });
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

    // 🔥 KRİTİK FİX: Önce veritabanından GÜNCEL değerleri çek!
    // Bu race condition'ı önler - cache'deki eski veri sorunu çözülür
    try {
      const { data: freshProfile, error: fetchError } = await supabase
        .from("profiles")
        .select("game_credits, bonus_credits, last_credit_refresh, premium_until, unlimited_lives_until")
        .eq("id", user.id)
        .single();

      if (fetchError || !freshProfile) {
        console.error("consumeCredit: Fresh profile fetch failed:", fetchError);
        return false;
      }

      // 🔥 KRİTİK: Veritabanından GÜNCEL premium/unlimited durumunu kontrol et
      // Cache'deki isPremium stale olabilir (örn. marketten sınırsız paket alındıysa)
      const now = new Date();
      const freshIsPremium = 
        (freshProfile.premium_until && new Date(freshProfile.premium_until) > now) ||
        (freshProfile.unlimited_lives_until && new Date(freshProfile.unlimited_lives_until) > now);
      
      if (freshIsPremium) {
        console.log("consumeCredit: User is premium (fresh DB check), returning true");
        return true;
      }

      const freshTotalCredits = (freshProfile.game_credits || 0) + (freshProfile.bonus_credits || 0);
      if (freshTotalCredits <= 0) {
        console.log("consumeCredit: No credits available (fresh check)");
        return false;
      }

      let newGameCredits = freshProfile.game_credits || 0;
      let newBonusCredits = freshProfile.bonus_credits || 0;

      // Önce bonus krediden düş, sonra normal krediden
      if (newBonusCredits > 0) {
        newBonusCredits = newBonusCredits - 1;
        console.log(`consumeCredit: Using bonus credit. ${freshProfile.bonus_credits} -> ${newBonusCredits}`);
      } else if (newGameCredits > 0) {
        newGameCredits = newGameCredits - 1;
        console.log(`consumeCredit: Using game credit. ${freshProfile.game_credits} -> ${newGameCredits}`);
      }

      const shouldSetRefreshTime = newGameCredits < 5 && !freshProfile.last_credit_refresh;
      const updateData: any = {
        game_credits: newGameCredits,
        bonus_credits: newBonusCredits,
      };

      if (shouldSetRefreshTime) {
        updateData.last_credit_refresh = new Date().toISOString();
      }

      const { error } = await supabase.from("profiles").update(updateData).eq("id", user.id);

      if (error) throw error;

      // State'i de güncelle
      const updatedProfile = {
        ...profile,
        game_credits: newGameCredits,
        bonus_credits: newBonusCredits,
        last_credit_refresh: shouldSetRefreshTime ? new Date().toISOString() : freshProfile.last_credit_refresh,
        ink_count: profile.ink_count ?? 0,
      };
      setProfile(updatedProfile);
      
      console.log("consumeCredit: Success - Credits updated:", { newGameCredits, newBonusCredits });
      return true;
    } catch (error) {
      console.error("Error consuming credit:", error);
      return false;
    }
  };

  const isUserOnline = (userId: string) => {
    // Kendi kullanıcın her zaman online
    if (userId === user?.id) return true;
    return onlineUsers.some((u) => u.id === userId);
  };

  const refreshOnlineUsers = async () => {
    try {
      // 🔥 BASİT: last_seen 2 dakika içindeyse online
      const { data }: any = await supabase
        .from("user_presence" as any)
        .select(`user_id, last_seen, profiles!inner(username, avatar_url)`)
        .gte("last_seen", new Date(Date.now() - 120 * 1000).toISOString());

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

  // User presence management (OPTIMIZE: heartbeat useActivityTracker'a bırakıldı, polling 5s → 30s)
  useEffect(() => {
    if (!user?.id) return;

    // 🔥 updatePresence KALDIRILDI — useActivityTracker zaten user_presence + profiles.last_seen yazıyor
    // Burada sadece online kullanıcı listesini çekiyoruz

    const fetchOnlineUsers = async () => {
      // 🚀 Matchmaking aktifken atla
      if (matchmakingMode.isActive()) return;

      try {
        // 🔥 BASİT MANTIK: last_seen 2 dakika içindeyse online, değilse offline
        // is_online flag'i güvenilmez (mobilde visibility değişimleri bozuyor)
        const { data }: any = await supabase
          .from("user_presence" as any)
          .select(`user_id, last_seen, profiles!inner(username, avatar_url)`)
          .gte("last_seen", new Date(Date.now() - 120 * 1000).toISOString());

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
        fetchOnlineUsers();
      }
    };

    fetchOnlineUsers();

    // ✅ Realtime + polling fallback (Realtime kopunca liste donmasın)
    const channel = supabase
      .channel("presence_changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "user_presence" as any }, (payload) => {
        console.log("🔔 Realtime Presence Change:", payload);
        fetchOnlineUsers();
      })
      .subscribe();

    // Polling kaldırıldı - Realtime yeterli

    window.addEventListener("beforeunload", handleBeforeUnload);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      console.log("⚠️ [UserContext] Presence cleanup ATLANYOR (bağlantı koruması)");
      // pollingInterval kaldırıldı
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

  // ENHANCED Real-time profile subscription + Native global registry
  useEffect(() => {
    if (!user) return;

    console.log("🔄 Setting up real-time profile subscription for user:", user.id);
    const lastUpdateRef = { timestamp: 0, data: "" };

    // 🔥 Native platformda Kotlin WebSocket'e de kaydet
    const handleProfileUpdate = (payload: any) => {
      if (!payload?.new) return;

      const now = Date.now();
      const dataHash = JSON.stringify({
        game_credits: payload.new.game_credits,
        bonus_credits: payload.new.bonus_credits,
        total_score: payload.new.total_score,
        wins: payload.new.wins,
        losses: payload.new.losses,
        unlimited_lives_until: payload.new.unlimited_lives_until,
        ink_count: payload.new.ink_count,
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
        ink_count: payload.new.ink_count ?? 0,
      };

      console.log("📊 Profile stats updated:", {
        total_score: newProfile.total_score,
        wins: newProfile.wins,
        losses: newProfile.losses,
        game_credits: newProfile.game_credits,
        bonus_credits: newProfile.bonus_credits,
        ink_count: newProfile.ink_count,
        unlimited_lives_until: payload.new.unlimited_lives_until,
      });

      setProfile(newProfile);
      lastRefreshTimeRef.current = Date.now();

      nativeStorage.setItem(
        STORAGE_KEYS.CACHED_PROFILE,
        JSON.stringify({
          id: user.id,
          data: newProfile,
          timestamp: Date.now(),
        }),
      );
    };

    // Native subscription kaldırıldı - Supabase JS SDK yeterli

    // JS SDK channel (Native'de çalışmayabilir ama yine de kur)
    const channel = supabase
      .channel(`profile-realtime-${user.id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "profiles", filter: `id=eq.${user.id}` },
        (payload) => {
          handleProfileUpdate(payload);
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

    const handleVisibility = async () => {
      if (document.visibilityState === "visible") {
        console.log("[Profile] 👁️ Sayfa görünür, profil kontrol ediliyor...");
        try {
          const cachedStr = await nativeStorage.getItem(STORAGE_KEYS.CACHED_PROFILE);
          if (cachedStr) {
            const parsed = JSON.parse(cachedStr);
            if (Date.now() - parsed.timestamp > 30000) {
              refreshProfile(true);
            }
          } else {
            refreshProfile(true);
          }
        } catch (e) {
          refreshProfile(true);
        }
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      console.log("⚠️ [UserContext] Profile cleanup ATLANYOR (bağlantı koruması)");
      document.removeEventListener("visibilitychange", handleVisibility);
      // Native subscription'ı silme - bağlantı koruması
      // if (isNative) removeGlobalSubscription(`profiles:${user.id}`);
    };
  }, [user, isNative]);

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
