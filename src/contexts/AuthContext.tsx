import { useState, useEffect, createContext, useContext, ReactNode, useRef, useCallback } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { setCachedSession as setPersistentSession } from "@/utils/persistentState";
import { Preferences } from "@capacitor/preferences";
import { useAppState } from "@/hooks/useAppState";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signUp: (email: string, password: string, username: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: any }>;
}

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
            id: parsed.user?.id || '',
            email: parsed.user?.email || '',
            aud: parsed.user?.aud || 'authenticated',
            role: parsed.user?.role || 'authenticated',
            app_metadata: parsed.user?.app_metadata || {},
            user_metadata: parsed.user?.user_metadata || {},
            created_at: parsed.user?.created_at || '',
          } as User;
          
          const optimisticSession: Session = {
            access_token: parsed.access_token || '',
            refresh_token: parsed.refresh_token || '',
            expires_at: parsed.expires_at,
            expires_in: parsed.expires_in || 3600,
            token_type: parsed.token_type || 'bearer',
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

  // 🔧 Timeout helper - Auth çağrılarını sarmala (5 saniye - Android uyanış için daha toleranslı)
  const AUTH_TIMEOUT_MS = 5000;
  
  const withAuthTimeout = <T,>(promise: Promise<T>, ms: number = AUTH_TIMEOUT_MS): Promise<T | null> => {
    return Promise.race([
      promise,
      new Promise<null>((resolve) => setTimeout(() => {
        // 🔧 Sessiz timeout - sadece debug için log (üretimde kaldırılabilir)
        console.debug(`[AuthContext] ⏱️ ${ms}ms auth timeout`);
        resolve(null);
      }, ms))
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
    window.dispatchEvent(new CustomEvent('auth-recovery-start'));
    
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
      const sessionResult = await withAuthTimeout(
        supabase.auth.getSession(),
        AUTH_TIMEOUT_MS
      );
      
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
              AUTH_TIMEOUT_MS
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
              const errorMessage = refreshResult.error?.message || '';
              const isInvalidToken = errorMessage.toLowerCase().includes('invalid') || 
                                     errorMessage.toLowerCase().includes('expired') ||
                                     errorMessage.toLowerCase().includes('refresh');
              
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
                      AUTH_TIMEOUT_MS
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
      window.dispatchEvent(new CustomEvent('auth-recovery-end'));
    }
  }, [applyOptimisticAuth]);

  // 🔧 useAppState ile foreground dinle
  useAppState({
    onForeground: () => {
      console.log("[AuthContext] 📱 App ön plana geldi - orchestrator bekliyor...");
      // NOT: Artık burada direkt forceRecoverSession çağırmıyoruz
      // Orchestrator T+400ms'de app-auth-recovery event'i gönderecek
    },
    onBackground: () => {
      console.log("[AuthContext] 📱 App arka plana gitti");
    }
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
    
    window.addEventListener('app-auth-recovery', handleAuthRecovery);
    window.addEventListener('app-force-restore', handleForceRestore);
    
    return () => {
      window.removeEventListener('app-auth-recovery', handleAuthRecovery);
      window.removeEventListener('app-force-restore', handleForceRestore);
    };
  }, [forceRecoverSession, applyOptimisticAuth]);

  useEffect(() => {
    mounted.current = true;
    optimisticAuthAppliedRef.current = false;

    // 🔧 FAILSAFE: Maksimum 5 saniyede loading false olsun (eskisi 10s)
    if (loadingTimeoutRef.current) {
      clearTimeout(loadingTimeoutRef.current);
    }
    loadingTimeoutRef.current = setTimeout(() => {
      if (mounted.current && loading) {
        console.log("[AuthContext] ⚠️ Failsafe: Loading timeout, forcing false");
        setLoading(false);
      }
    }, 5000);

    const initAuth = async () => {
      console.log("🔒 Auth Check Başlıyor...");

      // 🆕 1. NATIVE STORAGE ÖNCELİĞİ: Supabase getSession'dan ÖNCE Preferences oku!
      // Bu sayede Android kill sonrası anında auth state geri gelir
      console.log("[AuthContext] ⚡ Native Storage öncelikli okuma başlıyor...");
      
      let nativeSessionFound = false;
      
      try {
        // Önce Preferences'dan (native storage) oku
        const { value: prefSession } = await Preferences.get({ key: CUSTOM_STORAGE_KEY });
        
        if (prefSession) {
          const parsed = JSON.parse(prefSession);
          const expiresAt = parsed?.expires_at;
          const nowSec = Math.floor(Date.now() / 1000);
          
          if (expiresAt && expiresAt > nowSec && parsed.user?.id) {
            console.log("[AuthContext] ⚡ Native Storage'da geçerli session bulundu - ANINDA yükleniyor!");
            
            const nativeUser: User = {
              id: parsed.user?.id || '',
              email: parsed.user?.email || '',
              aud: parsed.user?.aud || 'authenticated',
              role: parsed.user?.role || 'authenticated',
              app_metadata: parsed.user?.app_metadata || {},
              user_metadata: parsed.user?.user_metadata || {},
              created_at: parsed.user?.created_at || '',
            } as User;
            
            const nativeSession: Session = {
              access_token: parsed.access_token || '',
              refresh_token: parsed.refresh_token || '',
              expires_at: parsed.expires_at,
              expires_in: parsed.expires_in || 3600,
              token_type: parsed.token_type || 'bearer',
              user: nativeUser,
            };
            
            if (mounted.current) {
              setUser(nativeUser);
              setSession(nativeSession);
              setLoading(false);
              nativeSessionFound = true;
              optimisticAuthAppliedRef.current = true;
            }
            
            if (loadingTimeoutRef.current) clearTimeout(loadingTimeoutRef.current);
            
            console.log("[AuthContext] ✅ Native Storage'dan UI anında açıldı! Arka planda doğrulama yapılacak.");
          }
        }
      } catch (e) {
        console.log("[AuthContext] ⚠️ Native Storage okuma hatası, devam ediliyor:", e);
      }
      
      // 🆕 2. Native'den bulunduysa, arka planda sessiz doğrulama yap
      if (nativeSessionFound) {
        setTimeout(() => {
          console.log("[AuthContext] 🔄 Arka plan doğrulaması başlıyor...");
          forceRecoverSession();
        }, 1500);
        return;
      }

      // 3. Native'de yoksa, eski Optimistic Auth flow'a devam et
      const optimisticSuccess = await applyOptimisticAuth();
      
      if (optimisticSuccess) {
        console.log("[AuthContext] ⚡ Optimistic Auth başarılı - UI hemen açılıyor");
        if (loadingTimeoutRef.current) clearTimeout(loadingTimeoutRef.current);
        
        // Arka planda gerçek session'ı doğrula (bloklamadan)
        setTimeout(() => {
          forceRecoverSession();
        }, 1000);
        return;
      }

      // 2. Optimistic başarısız - eski cache'e bak
      const cachedSession = getCachedSession();

      if (cachedSession) {
        if (isTokenExpired(cachedSession)) {
          console.log("⚠️ Cache bulundu ama SÜRESİ DOLMUŞ. Yenisi isteniyor...");
        } else {
          console.log("✅ Cache geçerli, hemen içeri alınıyor.");
          if (mounted.current) {
            setSession(cachedSession);
            setUser(cachedSession.user);
            setLoading(false);
            if (loadingTimeoutRef.current) clearTimeout(loadingTimeoutRef.current);
          }
        }
      }

      // 3. Supabase ile Gerçek Kontrol (arka planda)
      try {
        await Promise.race([
          forceRecoverSession(),
          new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), 5000))
        ]);
      } catch (e) {
        console.warn("[AuthContext] ⚠️ Session recovery timeout veya hata:", e);
      }
      
      // Her durumda loading'i kapat
      if (mounted.current) {
        if (loadingTimeoutRef.current) clearTimeout(loadingTimeoutRef.current);
        setLoading(false);
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
        
        // 🆕 FOREGROUND ZAMANI KONTROLÜ - EXTREME: 20 SANİYE
        // Uygulama uyanalı 20 saniyeden az olduysa, expired token bile olsa KOŞULSUZ ignore et
        const appWakeTime = (window as any).__appForegroundTime || 0;
        const timeSinceWake = Date.now() - appWakeTime;
        const isFreshWake = timeSinceWake < 20000; // 20 saniyeden az - MAXIMUM koruma
        
        if (isFreshWake) {
          console.log("[AuthContext] 🛡️ EXTREME: Uygulama yeni uyandı (" + Math.round(timeSinceWake/1000) + "sn < 20sn), SIGNED_OUT KOŞULSUZ IGNORE!");
          console.log("[AuthContext] 🔄 Token expired bile olsa forceRecoverSession beklenecek...");
          
          isRecoveringRef.current = true;
          window.dispatchEvent(new CustomEvent('auth-recovery-start'));
          
          setTimeout(() => {
            forceRecoverSession();
          }, 500);
          
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
          window.dispatchEvent(new CustomEvent('auth-recovery-start'));
          
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
