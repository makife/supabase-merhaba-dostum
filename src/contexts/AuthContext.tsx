import { useState, useEffect, createContext, useContext, ReactNode, useRef, useCallback } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { setCachedSession as setPersistentSession } from "@/utils/persistentState";
import { Preferences } from "@capacitor/preferences";
import { Capacitor } from "@capacitor/core";
import { NativeRealtime } from "@/plugins/NativeRealtime";
import { useAppState } from "@/hooks/useAppState";
import { isFreshWake, getColdStartTime } from "@/utils/coldStartTime";
interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signUp: (email: string, password: string, username: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: any }>;
}

const SUPABASE_URL = "https://nnlvtqmuwmrqfinsgvwc.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5ubHZ0cW11d21ycWZpbnNndndjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ1MTUzODAsImV4cCI6MjA3MDA5MTM4MH0.MrN6Cgs-uTHg9MF_zfae31VXAj6lTI6V9gdEFZBMvVE";
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// LocalStorage Yardımcıları
const getCachedSession = (): Session | null => {
  try {
    const cached = localStorage.getItem("kelimeci_cached_session");
    if (cached) return JSON.parse(cached);
  } catch (e) {
    console.log(e);
  }
  return null;
};

const setCachedData = (user: User | null, session: Session | null) => {
  try {
    if (user && session) {
      localStorage.setItem("kelimeci_cached_user", JSON.stringify(user));
      localStorage.setItem("kelimeci_cached_session", JSON.stringify(session));

      // 🆕 NATIVE STORAGE'A DA KAYDET (Optimistic Auth için)
      setPersistentSession({
        userId: user.id,
        email: user.email || "",
        accessToken: session.access_token,
        refreshToken: session.refresh_token || "",
        expiresAt: (session.expires_at || 0) * 1000, // seconds to ms
      });
    } else {
      localStorage.removeItem("kelimeci_cached_user");
      localStorage.removeItem("kelimeci_cached_session");
      setPersistentSession(null);
    }
  } catch (e) {
    console.log(e);
  }
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within an AuthProvider");
  return context;
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const mounted = useRef(true);
  const isRecoveringRef = useRef(false);
  const lastSignOutEventRef = useRef<number>(0);
  const loadingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const recoveryTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const optimisticAuthAppliedRef = useRef(false); // 🆕 Optimistic auth uygulandı mı?
  const intentionalLogoutRef = useRef(false); // 🆕 Kullanıcı bilerek çıkış mı yapıyor?

  // Token'ın süresi dolmuş mu kontrol eden fonksiyon
  const isTokenExpired = (session: Session) => {
    if (!session?.expires_at) return true;
    const now = Math.floor(Date.now() / 1000);
    return session.expires_at < now + 60;
  };

  // 🔧 CUSTOM STORAGE KEY - client.ts ile %100 AYNI OLMALI!
  // client.ts: storageKey: 'kelimele-auth-token'
  const CUSTOM_STORAGE_KEY = "kelimele-auth-token";
  const LEGACY_STORAGE_KEY = "sb-nnlvtqmuwmrqfinsgvwc-auth-token"; // Eski key fallback

  // 🆕 Session'ı Preferences'a manuel kaydet (giriş anında çağrılacak)
  const saveSessionToPreferences = async (session: Session) => {
    if (!session) return;

    try {
      const sessionData = JSON.stringify({
        access_token: session.access_token,
        refresh_token: session.refresh_token,
        expires_at: session.expires_at,
        expires_in: session.expires_in,
        token_type: session.token_type,
        user: session.user,
      });

      // Preferences'a kaydet (native storage)
      await Preferences.set({ key: CUSTOM_STORAGE_KEY, value: sessionData });
      console.log("[AuthContext] ✅ Session Preferences'a kaydedildi");

      // localStorage'a da kaydet (fallback)
      localStorage.setItem(CUSTOM_STORAGE_KEY, sessionData);
    } catch (e) {
      console.error("[AuthContext] ❌ Session kaydetme hatası:", e);
    }
  };

  // 🆕 OPTIMISTIC AUTH: Storage'dan anında session al, ağ bekleme
  const applyOptimisticAuth = useCallback(async (): Promise<boolean> => {
    if (optimisticAuthAppliedRef.current) return false;

    console.log("[AuthContext] ⚡ Optimistic Auth: Storage'dan anında yükleniyor...");

    let storedSession: string | null = null;

    // 1. Önce Preferences'dan dene (native storage, daha güvenilir) - önce yeni key
    try {
      const { value } = await Preferences.get({ key: CUSTOM_STORAGE_KEY });
      storedSession = value;
    } catch (e) {}

    // 1b. Eski key fallback
    if (!storedSession) {
      try {
        const { value } = await Preferences.get({ key: LEGACY_STORAGE_KEY });
        storedSession = value;
      } catch (e) {}
    }

    // 2. Yoksa localStorage'dan dene
    if (!storedSession) {
      try {
        storedSession = localStorage.getItem(CUSTOM_STORAGE_KEY) || localStorage.getItem(LEGACY_STORAGE_KEY);
      } catch (e) {}
    }

    if (storedSession) {
      try {
        const parsed = JSON.parse(storedSession);
        const expiresAt = parsed?.expires_at;
        const nowSec = Math.floor(Date.now() / 1000);

        // Token hala geçerli mi?
        if (expiresAt && expiresAt > nowSec) {
          console.log("[AuthContext] ⚡ Optimistic Auth: Geçerli session bulundu!");

          // User bilgisini construct et
          const optimisticUser: User = {
            id: parsed.user?.id || "",
            email: parsed.user?.email || "",
            aud: parsed.user?.aud || "authenticated",
            role: parsed.user?.role || "authenticated",
            app_metadata: parsed.user?.app_metadata || {},
            user_metadata: parsed.user?.user_metadata || {},
            created_at: parsed.user?.created_at || "",
          } as User;

          const optimisticSession: Session = {
            access_token: parsed.access_token || "",
            refresh_token: parsed.refresh_token || "",
            expires_at: parsed.expires_at,
            expires_in: parsed.expires_in || 3600,
            token_type: parsed.token_type || "bearer",
            user: optimisticUser,
          };

          if (mounted.current) {
            setUser(optimisticUser);
            setSession(optimisticSession);
            setLoading(false);
            optimisticAuthAppliedRef.current = true;
          }

          return true;
        }
      } catch (e) {
        console.log("[AuthContext] ⚠️ Optimistic Auth parse hatası");
      }
    }

    return false;
  }, []);

  // 🔧 Timeout helper - Auth çağrılarını sarmala (10 saniye - Android uyanış için çok daha toleranslı)
  const AUTH_TIMEOUT_MS = 10000;

  const withAuthTimeout = <T,>(promise: Promise<T>, ms: number = AUTH_TIMEOUT_MS): Promise<T | null> => {
    return Promise.race([
      promise,
      new Promise<null>((resolve) =>
        setTimeout(() => {
          // 🔧 Sessiz timeout - sadece debug için log (üretimde kaldırılabilir)
          console.debug(`[AuthContext] ⏱️ ${ms}ms auth timeout`);
          resolve(null);
        }, ms),
      ),
    ]);
  };

  // 🔧 FORCE SESSION RECOVERY - Foreground'da çağrılacak (arka planda)
  const forceRecoverSession = useCallback(async () => {
    if (isRecoveringRef.current) {
      console.log("[AuthContext] ⏳ Recovery zaten devam ediyor, atlanıyor...");
      return;
    }

    isRecoveringRef.current = true;
    console.log("[AuthContext] 🔄 FORCE Session Recovery başlıyor...");

    // 🆕 ProtectedRoute'a recovery başladığını bildir
    window.dispatchEvent(new CustomEvent("auth-recovery-start"));

    // 🔧 FAILSAFE: 6 saniye sonra kilidi zorla aç (timeout 5s + 1s margin)
    if (recoveryTimeoutRef.current) {
      clearTimeout(recoveryTimeoutRef.current);
    }
    recoveryTimeoutRef.current = setTimeout(() => {
      if (isRecoveringRef.current) {
        console.debug("[AuthContext] Recovery failsafe: 6s timeout, kilit açılıyor");
        isRecoveringRef.current = false;
        if (mounted.current) setLoading(false);
      }
    }, 6000);

    try {
      // 🔧 1. getSession WITH TIMEOUT (5 saniye - Android için toleranslı)
      const sessionResult = await withAuthTimeout(supabase.auth.getSession(), AUTH_TIMEOUT_MS);

      if (sessionResult?.data?.session?.access_token) {
        const currentSession = sessionResult.data.session;
        console.log("[AuthContext] ✅ Session mevcut:", currentSession.user?.email);
        if (mounted.current) {
          setSession(currentSession);
          setUser(currentSession.user);
          setCachedData(currentSession.user, currentSession);
          setLoading(false);
        }
        isRecoveringRef.current = false;
        if (recoveryTimeoutRef.current) clearTimeout(recoveryTimeoutRef.current);
        return;
      }

      // 🔧 getSession timeout veya null - optimistic auth'a güven
      if (!sessionResult) {
        console.log("[AuthContext] ⚠️ getSession timeout - optimistic auth ile devam");
        const hasOptimistic = await applyOptimisticAuth();
        if (hasOptimistic) {
          isRecoveringRef.current = false;
          if (recoveryTimeoutRef.current) clearTimeout(recoveryTimeoutRef.current);
          return;
        }
      }

      // 2. Session null ise, Preferences'dan manuel oku ve refreshSession dene
      console.log("[AuthContext] ⚠️ getSession null, Preferences'dan manuel restore...");

      let storedSession: string | null = null;

      // Önce yeni key, sonra eski key dene
      try {
        const { value } = await Preferences.get({ key: CUSTOM_STORAGE_KEY });
        storedSession = value;
        if (value) console.log("[AuthContext] ✅ Preferences'da session bulundu (yeni key)");
      } catch (e) {
        console.log("[AuthContext] ℹ️ Preferences okunamadı");
      }

      if (!storedSession) {
        try {
          const { value } = await Preferences.get({ key: LEGACY_STORAGE_KEY });
          storedSession = value;
          if (value) console.log("[AuthContext] ✅ Preferences'da session bulundu (eski key)");
        } catch (e) {}
      }

      if (!storedSession) {
        try {
          storedSession = localStorage.getItem(CUSTOM_STORAGE_KEY) || localStorage.getItem(LEGACY_STORAGE_KEY);
          if (storedSession) console.log("[AuthContext] ✅ localStorage'da session bulundu");
        } catch (e) {}
      }

      if (storedSession) {
        try {
          const parsed = JSON.parse(storedSession);
          if (parsed?.refresh_token) {
            console.log("[AuthContext] 🔄 Refresh token ile session yenileniyor...");

            // 🔧 refreshSession WITH TIMEOUT (5 saniye - Android için toleranslı)
            const refreshResult = await withAuthTimeout(
              supabase.auth.refreshSession({ refresh_token: parsed.refresh_token }),
              AUTH_TIMEOUT_MS,
            );

            if (refreshResult && !refreshResult.error && refreshResult.data?.session) {
              console.log("[AuthContext] ✅ Session başarıyla restore edildi!");
              if (mounted.current) {
                setSession(refreshResult.data.session);
                setUser(refreshResult.data.session.user);
                setCachedData(refreshResult.data.session.user, refreshResult.data.session);
                setLoading(false);
              }
            } else if (!refreshResult) {
              console.log("[AuthContext] ⚠️ refreshSession timeout - optimistic auth ile devam");
              await applyOptimisticAuth();
            } else if (refreshResult.error) {
              // 🆕 AUTH RECOVERY ROBUSTNESS: Invalid Refresh Token için retry logic
              const errorMessage = refreshResult.error?.message || "";
              const isInvalidToken =
                errorMessage.toLowerCase().includes("invalid") ||
                errorMessage.toLowerCase().includes("expired") ||
                errorMessage.toLowerCase().includes("refresh");

              if (isInvalidToken) {
                console.log("[AuthContext] ⚠️ Invalid token hatası - 3sn daha storage'a güveniyoruz");
                // Anında logout yapma! Storage'daki session'ı 3 saniye daha geçerli say
                const hasOptimistic = await applyOptimisticAuth();
                if (hasOptimistic) {
                  // 3 saniye sonra tekrar dene
                  setTimeout(async () => {
                    console.log("[AuthContext] 🔄 Invalid token retry...");
                    const retryResult = await withAuthTimeout(
                      supabase.auth.refreshSession({ refresh_token: parsed.refresh_token }),
                      AUTH_TIMEOUT_MS,
                    );
                    if (retryResult && !retryResult.error && retryResult.data?.session) {
                      console.log("[AuthContext] ✅ Retry başarılı!");
                      if (mounted.current) {
                        setSession(retryResult.data.session);
                        setUser(retryResult.data.session.user);
                        setCachedData(retryResult.data.session.user, retryResult.data.session);
                      }
                    } else {
                      console.log("[AuthContext] ❌ Retry de başarısız, logout");
                    }
                  }, 3000);
                }
              } else {
                console.error("[AuthContext] ❌ Refresh başarısız:", errorMessage);
              }
            }
          }
        } catch (parseError) {
          console.error("[AuthContext] ❌ Session parse hatası:", parseError);
        }
      } else {
        console.log("[AuthContext] ❌ Hiçbir storage'da session bulunamadı");
      }
    } catch (e) {
      console.error("[AuthContext] ❌ Force recovery hatası:", e);
    } finally {
      // 🔧 LOCK CLEAR: Her durumda kilidi mutlaka temizle
      isRecoveringRef.current = false;
      if (recoveryTimeoutRef.current) clearTimeout(recoveryTimeoutRef.current);
      if (mounted.current) setLoading(false);

      // 🆕 ProtectedRoute'a recovery bittiğini bildir
      window.dispatchEvent(new CustomEvent("auth-recovery-end"));
    }
  }, [applyOptimisticAuth]);

  // 🔥 YENİ EKLENEN KISIM: Arka plandan dönüşte oturumu kurtarma
  // 🔥 KRİTİK: Callback'ler SENKRON olmalı, async işlemler setTimeout ile DEFER edilmeli!
  useAppState({
    onForeground: () => {
      console.log("[AuthContext] ☀️ Uygulama ön plana geldi");
      
      // 🔥 KRİTİK: Tüm async işlemleri setTimeout(0) ile defer et!
      // Bu sayede appStateChange callback'i hemen tamamlanır, bridge bloke olmaz
      setTimeout(async () => {
        console.log("[AuthContext] 🔄 Session kontrol başlıyor (deferred)...");
        
        // Eğer zaten oturum varsa ve user null değilse bir şey yapma
        if (session && user) {
          console.log("[AuthContext] ✅ Oturum zaten aktif, devam ediliyor.");
          // Arkaplanda token süresi dolmuş olabilir, sessizce yenilemeyi dene
          try {
            const { data } = await supabase.auth.getSession();
            if (data.session && mounted.current) {
              setSession(data.session);
              saveSessionToPreferences(data.session);
            }
          } catch (e) {
            console.log("[AuthContext] ⚠️ Session refresh hatası (sessiz):", e);
          }
          return;
        }

        // Eğer USER NULL ise (Misafir görünüyorsa), storage'dan kurtarmayı dene!
        console.log("[AuthContext] ⚠️ Kullanıcı NULL görünüyor! Storage'dan kurtarılıyor...");
        if (mounted.current) setLoading(true);

        try {
          // 1. Native Storage'dan oku
          const { value } = await Preferences.get({ key: CUSTOM_STORAGE_KEY });
          if (value) {
            const parsed = JSON.parse(value);
            if (parsed?.access_token) {
              // 2. State'i hemen güncelle
              const restoredUser = parsed.user;
              const restoredSession = {
                access_token: parsed.access_token,
                refresh_token: parsed.refresh_token,
                expires_at: parsed.expires_at,
                user: restoredUser,
                token_type: "bearer",
              } as Session;

              if (mounted.current) {
                setUser(restoredUser);
                setSession(restoredSession);
              }
              await supabase.auth.setSession(restoredSession);
              console.log("[AuthContext] ♻️ Arka plan dönüşü oturum kurtarıldı!");
            }
          }
        } catch (e) {
          console.error("Recovery error:", e);
        } finally {
          if (mounted.current) setLoading(false);
        }
      }, 0);
    },
    onBackground: () => {
      console.log("[AuthContext] 🌑 Uygulama arka plana geçti");
    },
  });

  // 🆕 Orchestrator event'ini dinle
  useEffect(() => {
    const handleAuthRecovery = () => {
      console.log("[AuthContext] 🔄 Orchestrator triggered auth recovery");
      forceRecoverSession();
    };

    const handleForceRestore = () => {
      console.log("[AuthContext] 🔧 Force restore triggered");
      // Bridge health fail durumunda agresif recovery
      isRecoveringRef.current = false; // Kilidi aç
      applyOptimisticAuth().then(() => {
        setTimeout(() => forceRecoverSession(), 500);
      });
    };

    window.addEventListener("app-auth-recovery", handleAuthRecovery);
    window.addEventListener("app-force-restore", handleForceRestore);

    return () => {
      window.removeEventListener("app-auth-recovery", handleAuthRecovery);
      window.removeEventListener("app-force-restore", handleForceRestore);
    };
  }, [forceRecoverSession, applyOptimisticAuth]);

  useEffect(() => {
    mounted.current = true;

    const initAuth = async () => {
      console.log("🔒 Auth Başlatılıyor...");

      let recoveredSession = null;

      // 1. ADIM: Native Storage'dan (Disk) Session Oku
      try {
        // Önce 'kelimele-auth-token' (CUSTOM_KEY) dene
        const { value } = await Preferences.get({ key: "kelimele-auth-token" });
        if (value) {
          const parsed = JSON.parse(value);
          // Token var mı ve süresi dolmamış mı kontrol et
          if (parsed?.access_token && (!parsed.expires_at || parsed.expires_at > Date.now() / 1000)) {
            console.log("[AuthContext] ✅ Native Storage'dan Session Bulundu!");
            recoveredSession = parsed;
          }
        }
      } catch (e) {
        console.error("[AuthContext] Storage okuma hatası:", e);
      }

      // 2. ADIM: Eğer diskte oturum bulduysak, UI'ı HEMEN aç
      if (recoveredSession && mounted.current) {
        const restoredUser = recoveredSession.user;
        const restoredSession = {
          access_token: recoveredSession.access_token,
          refresh_token: recoveredSession.refresh_token,
          expires_at: recoveredSession.expires_at,
          user: restoredUser,
          token_type: "bearer",
        } as Session;

        // State'leri güncelle
        setUser(restoredUser);
        setSession(restoredSession);

        // Supabase client'a bu token'ı ver (Network istekleri için)
        supabase.auth.setSession(restoredSession);

        // 🔥🔥🔥 KRİTİK NOKTA: Native Servisi Yeniden Başlat 🔥🔥🔥
        // Uygulama kill edilip açıldıysa servis ölüdür. Burada manuel başlatıyoruz.
        if (Capacitor.isNativePlatform()) {
          console.log("🔌 Kill sonrası Native Service yeniden başlatılıyor...");

          NativeRealtime.connect({
            url: SUPABASE_URL,
            apiKey: SUPABASE_ANON_KEY,
            accessToken: recoveredSession.access_token,
          })
            .then(() => {
              console.log("✅ Native Service başarıyla bağlandı");
              // Servis bağlandıktan sonra Foreground moda (bildirimsiz) al
              // Çünkü şu an uygulama açık ve ön planda
              NativeRealtime.enterForegroundMode();
            })
            .catch((err) => {
              console.error("❌ Native Service başlatılamadı:", err);
            });
        }

        // Loading'i kapat, kullanıcı içeri girsin
        setLoading(false);
        console.log("🚀 UI Native Cache ile anında açıldı");
      }

      // 3. ADIM: Arka planda Supabase ile gerçek kontrolü yap
      // Diskteki veri bayat olabilir, sunucudan teyit alıyoruz.
      const { data } = await supabase.auth.getSession();

      if (mounted.current) {
        if (data.session) {
          // Sunucudan taze bilgi geldiyse güncelle
          setSession(data.session);
          setUser(data.session.user);

          // Native Storage'a da kaydet (Bir sonraki açılış için)
          const sessionData = JSON.stringify({
            access_token: data.session.access_token,
            refresh_token: data.session.refresh_token,
            expires_at: data.session.expires_at,
            user: data.session.user,
          });
          Preferences.set({ key: "kelimele-auth-token", value: sessionData });

          // Eğer diskten okuyamadıysak ama sunucudan geldiyse loading'i şimdi kapat
          if (!recoveredSession) setLoading(false);
        } else if (!recoveredSession) {
          // Ne diskte var ne sunucuda -> Gerçekten çıkış yapılmış
          setLoading(false);
        }
      }
    };

    initAuth();

    // 🔧 Auth State Değişimlerini Dinle - SIGNED_OUT için akıllı filtreleme
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      console.log(`[AuthContext] 🔔 Auth event: ${event}`);

      if (event === "TOKEN_REFRESHED" || event === "SIGNED_IN") {
        if (newSession) {
          console.log(`🔐 Token Yenilendi (${event})`);
          if (mounted.current) {
            setSession(newSession);
            setUser(newSession.user);
            setCachedData(newSession.user, newSession);
            setLoading(false);
          }
        }
      } else if (event === "SIGNED_OUT") {
        // 🛡️ KULLANICI BİLEREK ÇIKIŞ YAPTI MI?
        // Eğer intentionalLogoutRef true ise, koruma mekanizmasını ATLA!
        if (intentionalLogoutRef.current) {
          console.log("[AuthContext] ✅ Kullanıcı bilerek çıkış yaptı - koruma devre dışı");
          intentionalLogoutRef.current = false; // Reset flag
          // State zaten signOut fonksiyonunda temizleniyor, burada bir şey yapma
          return;
        }

        // 🛡️ MİSAFİR KORUMASI - SIGNED_OUT için maksimum zırh
        // Kill/restart/network drop sonrasında Supabase yanlışlıkla SIGNED_OUT fırlatabilir
        // Bu durumda ASLA state temizleme, ASLA /auth'a yönlendirme!

        const now = Date.now();
        const timeSinceLastSignOut = now - lastSignOutEventRef.current;
        lastSignOutEventRef.current = now;

        // 2 saniye içinde tekrar SIGNED_OUT gelirse spam, kesin ignore et
        if (timeSinceLastSignOut < 2000) {
          console.log("[AuthContext] 🛡️ SIGNED_OUT spam tespit edildi, IGNORE");
          return;
        }

        console.log("[AuthContext] ⚠️ SIGNED_OUT eventi geldi - storage kontrol ediliyor...");

        // 🆕 FOREGROUND ZAMANI KONTROLÜ - EXTREME ZIRH: 20 SANİYE
        // Uygulama uyanalı 20 saniyeden az olduysa, expired token bile olsa KOŞULSUZ ignore et
        // ASLA setUser(null) YAPMA! ASLA /auth'a yönlendirme!
        // 🔥 KRİTİK: Artık merkezi isFreshWake fonksiyonunu kullanıyoruz (cold start'ı da kapsar!)
        const isAppFreshWake = isFreshWake(20000); // 20 saniyeden az

        if (isAppFreshWake) {
          const coldStart = getColdStartTime();
          const foregroundTime = (window as any).__appForegroundTime || coldStart;
          const timeSinceWake = Date.now() - foregroundTime;

          console.log(
            "[AuthContext] 🛡️ ZIRH AKTİF: Uygulama yeni uyandı (" + Math.round(timeSinceWake / 1000) + "sn < 20sn)",
          );
          console.log("[AuthContext] 🛡️ Cold start time:", coldStart, "Foreground time:", foregroundTime);
          console.log("[AuthContext] 🛡️ SIGNED_OUT KOŞULSUZ IGNORE! setUser(null) ASLA YAPILMAYACAK!");
          console.log("[AuthContext] 🔄 Token expired bile olsa sadece forceRecoverSession çağrılıyor...");

          // 🛡️ State'e DOKUNMA! Sadece recovery başlat
          isRecoveringRef.current = true;
          window.dispatchEvent(new CustomEvent("auth-recovery-start"));

          // Sadece forceRecoverSession çağır ve bekle - BAŞKA HİÇBİR ŞEY YAPMA!
          setTimeout(() => {
            forceRecoverSession();
          }, 500);

          // 🛡️ KOŞULSUZ RETURN - aşağıdaki hiçbir kod çalışmayacak!
          return;
        }

        // 🔧 ASYNC STORAGE KONTROL: Her iki storage'ı da kontrol et
        const checkStorageForValidSession = async (): Promise<boolean> => {
          try {
            let storedSession: string | null = null;

            // 1. Preferences (Native Storage) - Yeni key
            try {
              const { value } = await Preferences.get({ key: CUSTOM_STORAGE_KEY });
              storedSession = value;
            } catch {}

            // 2. Preferences - Eski key fallback
            if (!storedSession) {
              try {
                const { value } = await Preferences.get({ key: LEGACY_STORAGE_KEY });
                storedSession = value;
              } catch {}
            }

            // 3. localStorage fallback
            if (!storedSession) {
              try {
                storedSession = localStorage.getItem(CUSTOM_STORAGE_KEY) || localStorage.getItem(LEGACY_STORAGE_KEY);
              } catch {}
            }

            if (storedSession) {
              const parsed = JSON.parse(storedSession);
              const expiresAt = parsed?.expires_at;
              const nowSec = Math.floor(Date.now() / 1000);

              // 🛡️ Token expired olmadıysa (0 saniye bile kaldıysa) geçerli say!
              // Supabase bazen refresh sırasında SIGNED_OUT fırlatıyor
              if (expiresAt && expiresAt > nowSec) {
                console.log("[AuthContext] 🛡️ Storage'da geçerli token VAR! expires_at:", expiresAt, "now:", nowSec);
                console.log("[AuthContext] 🛡️ SIGNED_OUT eventi TAMAMEN IGNORE ediliyor!");
                return true;
              } else {
                console.log("[AuthContext] ⏰ Token süresi dolmuş, expires_at:", expiresAt, "now:", nowSec);
              }
            }
          } catch (e) {
            console.log("[AuthContext] Storage kontrol hatası:", e);
          }
          return false;
        };

        // 🛡️ KORUMA KATMANI: Storage'da geçerli session varsa
        const hasValidSession = await checkStorageForValidSession();

        if (hasValidSession) {
          // ❌ STATE TEMİZLEME! ❌ /AUTH'A YÖNLENDİRME!
          // Sadece sessizce session'ı tazele
          console.log("[AuthContext] 🔄 forceRecoverSession ile sessiz tazeleme başlatılıyor...");

          // isRecoveringRef'i set et ki ProtectedRoute da bekleme moduna geçsin
          isRecoveringRef.current = true;
          window.dispatchEvent(new CustomEvent("auth-recovery-start"));

          // 500ms sonra recovery başlat (bridge stabilize olsun)
          setTimeout(() => {
            forceRecoverSession();
          }, 500);

          // BU EVENT'İ TAMAMEN IGNORE ET - return ile çık
          return;
        }

        // 🔧 GERÇEK ÇIKIŞ: Storage'da hiç geçerli session yok
        console.log("👋 Gerçek çıkış tespit edildi - state temizleniyor");
        if (mounted.current) {
          setSession(null);
          setUser(null);
          setCachedData(null, null);
        }
      }
    });

    return () => {
      mounted.current = false;
      if (loadingTimeoutRef.current) clearTimeout(loadingTimeoutRef.current);
      if (recoveryTimeoutRef.current) clearTimeout(recoveryTimeoutRef.current);
      subscription.unsubscribe();
    };
  }, [forceRecoverSession]);

  const signIn = async (email: string, password: string) => {
    setLoading(true);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      toast({ title: "Giriş Hatası", description: "Bilgileri kontrol ediniz.", variant: "destructive" });
    } else if (data.session) {
      setSession(data.session);
      setUser(data.session.user);
      setCachedData(data.session.user, data.session);

      // 🆕 Session'ı Preferences'a da kaydet (native storage persistence)
      await saveSessionToPreferences(data.session);
    }
    setLoading(false);
    return { error };
  };

  const signUp = async (email: string, password: string, username: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { username } },
    });
    if (error) toast({ title: "Kayıt Hatası", description: error.message, variant: "destructive" });
    return { error };
  };

  const signOut = async () => {
    console.log("[AuthContext] 🚪 Kullanıcı çıkış yapıyor...");

    // 🆕 ÖNCE storage'ı temizle - böylece SIGNED_OUT event'i geldiğinde
    // koruma mekanizması "geçerli token var" diye ignore etmesin
    setCachedData(null, null);

    // 🆕 Intentional logout flag'ini set et
    intentionalLogoutRef.current = true;

    setLoading(true);

    try {
      await supabase.auth.signOut();
    } catch (e) {
      console.error("[AuthContext] signOut hatası:", e);
    }

    // State'i temizle (SIGNED_OUT event'inden bağımsız)
    setSession(null);
    setUser(null);
    setLoading(false);

    toast({ title: "Çıkış Yapıldı" });
  };

  const resetPassword = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: "https://kelimeci.com.tr/auth/reset-password",
    });
    if (error) toast({ title: "Hata", variant: "destructive" });
    else toast({ title: "Mail Gönderildi" });
    return { error };
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, signIn, signUp, signOut, resetPassword }}>
      {children}
    </AuthContext.Provider>
  );
};
