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

  // Token'ın süresi dolmuş mu kontrol eden fonksiyon
  const isTokenExpired = (session: Session) => {
    if (!session?.expires_at) return true;
    const now = Math.floor(Date.now() / 1000);
    return session.expires_at < now + 60;
  };

  // 🆕 OPTIMISTIC AUTH: Storage'dan anında session al, ağ bekleme
  const applyOptimisticAuth = useCallback(async (): Promise<boolean> => {
    if (optimisticAuthAppliedRef.current) return false;
    
    console.log("[AuthContext] ⚡ Optimistic Auth: Storage'dan anında yükleniyor...");
    
    const storedSessionKey = "sb-nnlvtqmuwmrqfinsgvwc-auth-token";
    let storedSession: string | null = null;

    // 1. Önce Preferences'dan dene (native storage, daha güvenilir)
    try {
      const { value } = await Preferences.get({ key: storedSessionKey });
      storedSession = value;
    } catch (e) {}

    // 2. Yoksa localStorage'dan dene
    if (!storedSession) {
      try {
        storedSession = localStorage.getItem(storedSessionKey);
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

  // 🔧 Timeout helper - Auth çağrılarını sarmala
  const withAuthTimeout = <T,>(promise: Promise<T>, ms: number): Promise<T | null> => {
    return Promise.race([
      promise,
      new Promise<null>((resolve) => setTimeout(() => {
        console.log(`[AuthContext] ⏱️ ${ms}ms auth timeout aşıldı!`);
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
    
    // 🔧 FAILSAFE: 3 saniye sonra kilidi zorla aç
    if (recoveryTimeoutRef.current) {
      clearTimeout(recoveryTimeoutRef.current);
    }
    recoveryTimeoutRef.current = setTimeout(() => {
      if (isRecoveringRef.current) {
        console.log("[AuthContext] ⚠️ Recovery failsafe: 3s timeout, kilit açılıyor");
        isRecoveringRef.current = false;
        if (mounted.current) setLoading(false);
      }
    }, 3000);
    
    try {
      // 🔧 1. getSession WITH TIMEOUT (2 saniye) - uzun süren istekler iptal
      const sessionResult = await withAuthTimeout(
        supabase.auth.getSession(),
        2000
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
      
      const storedSessionKey = "sb-nnlvtqmuwmrqfinsgvwc-auth-token";
      let storedSession: string | null = null;

      try {
        const { value } = await Preferences.get({ key: storedSessionKey });
        storedSession = value;
        if (value) console.log("[AuthContext] ✅ Preferences'da session bulundu");
      } catch (e) {
        console.log("[AuthContext] ℹ️ Preferences okunamadı");
      }

      if (!storedSession) {
        try {
          storedSession = localStorage.getItem(storedSessionKey);
          if (storedSession) console.log("[AuthContext] ✅ localStorage'da session bulundu");
        } catch (e) {}
      }

      if (storedSession) {
        try {
          const parsed = JSON.parse(storedSession);
          if (parsed?.refresh_token) {
            console.log("[AuthContext] 🔄 Refresh token ile session yenileniyor...");
            
            // 🔧 refreshSession WITH TIMEOUT (2 saniye)
            const refreshResult = await withAuthTimeout(
              supabase.auth.refreshSession({ refresh_token: parsed.refresh_token }),
              2000
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
            } else {
              console.error("[AuthContext] ❌ Refresh başarısız:", refreshResult.error?.message);
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

      // 🆕 1. OPTIMISTIC AUTH: Storage'dan anında yükle (ağ bekleme!)
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
        // 🔧 SILENT REFRESH KORUMASI: 
        // Arka planda internet kesilip geldiğinde Supabase yanlışlıkla SIGNED_OUT fırlatabilir
        // Bu durumda storage'da hala geçerli session var mı kontrol et
        const now = Date.now();
        const timeSinceLastSignOut = now - lastSignOutEventRef.current;
        lastSignOutEventRef.current = now;
        
        // 2 saniye içinde tekrar SIGNED_OUT gelirse spam, ignore et
        if (timeSinceLastSignOut < 2000) {
          console.log("[AuthContext] ⚠️ SIGNED_OUT spam tespit edildi, ignore ediliyor");
          return;
        }
        
        // Storage'da hala geçerli session var mı kontrol et
        console.log("[AuthContext] ⚠️ SIGNED_OUT geldi, storage kontrol ediliyor...");
        
        try {
          const storedSessionKey = "sb-nnlvtqmuwmrqfinsgvwc-auth-token";
          let storedSession: string | null = null;
          
          try {
            const { value } = await Preferences.get({ key: storedSessionKey });
            storedSession = value;
          } catch {}
          
          if (!storedSession) {
            storedSession = localStorage.getItem(storedSessionKey);
          }
          
          if (storedSession) {
            const parsed = JSON.parse(storedSession);
            const expiresAt = parsed?.expires_at;
            const nowSec = Math.floor(Date.now() / 1000);
            
            if (expiresAt && expiresAt > nowSec) {
              console.log("[AuthContext] 🛡️ Storage'da geçerli session var, SIGNED_OUT ignore ediliyor!");
              console.log("[AuthContext] 🔄 Session recovery başlatılıyor...");
              // SIGNED_OUT'u ignore et ve session'ı recover et
              setTimeout(() => forceRecoverSession(), 500);
              return;
            }
          }
        } catch (e) {
          console.log("[AuthContext] Storage kontrol hatası:", e);
        }
        
        // Gerçekten çıkış yapılmış - state'i temizle
        console.log("👋 Gerçek çıkış - state temizleniyor");
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
    setLoading(true); // Çıkış yaparken loading göster ki UI saçmalamasın
    await supabase.auth.signOut();
    setSession(null);
    setUser(null);
    setCachedData(null, null);
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
