import { useState, useEffect, createContext, useContext, ReactNode, useRef, useCallback } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase, saveSessionToStorage, loadSessionFromStorage, clearSessionStorage, setGlobalAccessToken } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Capacitor } from "@capacitor/core";
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
  const intentionalLogoutRef = useRef(false);
  const initCompletedRef = useRef(false);
  const isRestoringRef = useRef(false);
  
  // 🔥 REF'LER - closure sorununu çözmek için
  const sessionRef = useRef<Session | null>(null);
  const userRef = useRef<User | null>(null);

  const isNative = Capacitor.isNativePlatform();
  
  // 🔥 State değişince ref'leri güncelle
  useEffect(() => {
    sessionRef.current = session;
    userRef.current = user;
  }, [session, user]);

  // 🔥🔥🔥 TEK RESTORE FONKSİYONU
  const restoreFromStorage = useCallback(async (): Promise<boolean> => {
    if (isRestoringRef.current) {
      console.log("[Auth] ⏳ Restore zaten devam ediyor...");
      return false;
    }
    
    isRestoringRef.current = true;
    console.log("[Auth] 🔄 Storage'dan session restore...");
    
    try {
      const stored = await loadSessionFromStorage();
      
      if (!stored?.refresh_token || !stored?.user) {
        console.log("[Auth] ⚠️ Storage'da geçerli session yok");
        isRestoringRef.current = false;
        return false;
      }
      
      console.log("[Auth] ✅ Storage'da session bulundu:", stored.user.email);
      
      // 🔥🔥🔥 KRİTİK: HEMEN GLOBAL TOKEN'I SET ET!
      // Bu sayede optimistic UI kullanırken bile istekler çalışır
      setGlobalAccessToken(stored.access_token);
      console.log("[Auth] 🔐 Global token SET EDİLDİ (optimistic)!");
      
      // 🔥 HEMEN UI'ı aç (optimistic)
      if (mounted.current) {
        setUser(stored.user);
        setSession(stored);
        setLoading(false);
      }
      
      // 🔥 Arka planda token yenile - setSession KULLANMA!
      // Sadece refreshSession kullan - bu yeni token alır
      try {
        console.log("[Auth] 🔄 Background token refresh başlıyor...");
        
        // Önce Supabase'e session'ı bildir (auth state için)
        // Sonra refreshSession çağır
        const { data, error } = await supabase.auth.refreshSession({
          refresh_token: stored.refresh_token,
        });
        
        if (error) {
          console.log("[Auth] ⚠️ Refresh hatası:", error.message);
          
          // Token tamamen geçersizse - temizle
          if (error.message?.includes('Invalid') || error.message?.includes('expired') || error.message?.includes('revoked')) {
            console.log("[Auth] 🚫 Token geçersiz - logout");
            if (mounted.current) {
              setUser(null);
              setSession(null);
            }
            await clearSessionStorage();
            isRestoringRef.current = false;
            return false;
          }
          
          // Diğer hatalar için mevcut UI'ı koru
          isRestoringRef.current = false;
          return true; // UI açık kalsın
        }
        
        if (data?.session && mounted.current) {
          console.log("[Auth] ✅ Token yenilendi! Yeni session kaydediliyor...");
          
          // 🔥🔥🔥 KRİTİK: GLOBAL TOKEN'I SET ET!
          setGlobalAccessToken(data.session.access_token);
          console.log("[Auth] 🔐 Global token SET EDİLDİ (restore sonrası)!");
          
          setUser(data.session.user);
          setSession(data.session);
          
          // 🔥 YENİ refresh_token'ı kaydet - bu da global token'ı set eder
          await saveSessionToStorage(data.session);
        }
        
        isRestoringRef.current = false;
        return true;
        
      } catch (refreshError) {
        console.error("[Auth] ⚠️ Refresh exception:", refreshError);
        // Hata olsa bile UI açık kalsın
        isRestoringRef.current = false;
        return true;
      }
      
    } catch (e) {
      console.error("[Auth] ❌ Restore hatası:", e);
      isRestoringRef.current = false;
      return false;
    }
  }, []);

  // 🔥 FOREGROUND RECOVERY - SessionRecovery hook'una bırak
  // AuthContext sadece session-recovered eventini dinlesin
  useEffect(() => {
    if (!isNative) return;

    const handleSessionRecovered = async () => {
      console.log("[Auth] 🔄 Session recovered eventi alındı");

      try {
        const {
          data: { session: currentSession },
        } = await supabase.auth.getSession();

        if (currentSession) {
          setGlobalAccessToken(currentSession.access_token);
          if (mounted.current) {
            console.log("[Auth] ✅ Session güncellendi:", currentSession.user.email);
            setSession(currentSession);
            setUser(currentSession.user);
            setLoading(false);
          }
        }
      } catch (e) {
        console.error("[Auth] ❌ Session recovered handler hatası:", e);
      }
    };

    window.addEventListener("session-recovered", handleSessionRecovered);

    return () => {
      window.removeEventListener("session-recovered", handleSessionRecovered);
    };
  }, [isNative]);

  useAppState({
    onForeground: () => {
      console.log("[Auth] ☀️ Ön plana geldi - useSessionRecovery devralacak");
    },
    onBackground: () => {
      console.log("[Auth] 🌑 Arka plana geçti");
    },
  });

  const applySessionState = useCallback((nextSession: Session | null) => {
    if (!mounted.current) return;

    if (nextSession?.access_token) {
      setGlobalAccessToken(nextSession.access_token);
      console.log("[Auth] 🔐 Global token SET EDİLDİ!");
    }

    setSession(nextSession);
    setUser(nextSession?.user ?? null);
    setLoading(false);
  }, []);

  const queuePostAuthWork = useCallback(
    (event: string, nextSession: Session) => {
      window.dispatchEvent(
        new CustomEvent("auth-ready", {
          detail: {
            userId: nextSession.user.id,
            email: nextSession.user.email,
            source: `auth-${event.toLowerCase()}`,
          },
        }),
      );

      window.dispatchEvent(new CustomEvent("force-presence-update", { detail: { userId: nextSession.user.id } }));

      setTimeout(async () => {
        try {
          if (isNative) {
            await saveSessionToStorage(nextSession);
          }

          if (event === "SIGNED_IN" || event === "INITIAL_SESSION") {
            const { ensureProfileExists } = await import("@/utils/ensureProfileExists");
            await ensureProfileExists(nextSession.user);
          }
        } catch (error) {
          console.error(`[Auth] ❌ ${event} sonrası async iş hatası:`, error);
        }
      }, 0);
    },
    [isNative],
  );

  // 🔥 INIT
  useEffect(() => {
    mounted.current = true;

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, newSession) => {
      console.log(`[Auth] 🔔 Event: ${event}`);

      if (event === "SIGNED_OUT") {
        if (intentionalLogoutRef.current) {
          console.log("[Auth] ✅ Bilerek çıkış yapıldı");
          intentionalLogoutRef.current = false;
          applySessionState(null);
        } else if (isNative) {
          console.log("[Auth] 🛡️ Native SIGNED_OUT IGNORE - storage kontrol...");
          setTimeout(() => {
            void restoreFromStorage();
          }, 500);
        }
        return;
      }

      if (!newSession) return;

      if (event === "INITIAL_SESSION" || event === "TOKEN_REFRESHED" || event === "SIGNED_IN") {
        console.log(`🔐 Token güncellendi (${event})`);
        applySessionState(newSession);
        queuePostAuthWork(event, newSession);
      }
    });

    const initAuth = async () => {
      if (initCompletedRef.current) {
        console.log("[Auth] ⏭️ Init zaten tamamlandı, skip");
        return;
      }
      initCompletedRef.current = true;

      console.log("🔒 Auth Başlatılıyor... isNative:", isNative);

      if (isNative) {
        console.log("[Auth] 📱 Native mod - storage'dan restore başlıyor...");

        try {
          const restored = await restoreFromStorage();
          console.log("[Auth] 📱 Restore sonucu:", restored);

          if (!restored && mounted.current) {
            console.log("[Auth] 📱 Session bulunamadı, loading kapatılıyor");
            setLoading(false);
          }
        } catch (e) {
          console.error("[Auth] ❌ Native init hatası:", e);
          if (mounted.current) setLoading(false);
        }
        return;
      }

      console.log("[Auth] 🌐 Web mod - getSession...");
      try {
        const {
          data: { session: initialSession },
          error,
        } = await supabase.auth.getSession();

        if (error) {
          console.error("[Auth] ❌ Web getSession hatası:", error.message);
        }

        if (initialSession) {
          console.log("[Auth] 🌐 Session bulundu:", initialSession.user.email);
          applySessionState(initialSession);
        } else if (mounted.current) {
          setLoading(false);
        }
      } catch (e) {
        console.error("[Auth] ❌ Web init exception:", e);
        if (mounted.current) setLoading(false);
      }
    };

    const failsafe = setTimeout(() => {
      if (mounted.current && !sessionRef.current && !userRef.current) {
        console.warn("[Auth] ⚠️ FAILSAFE: 8s timeout - loading zorla kapatılıyor");
        setLoading(false);
      }
    }, 8000);

    void initAuth();

    return () => {
      mounted.current = false;
      clearTimeout(failsafe);
      subscription.unsubscribe();
    };
  }, [applySessionState, isNative, queuePostAuthWork, restoreFromStorage]);

  // 🔐 Sign In
  const signIn = async (email: string, password: string) => {
    setLoading(true);
    
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    
    if (error) {
      toast({ title: "Giriş Hatası", description: "Bilgileri kontrol ediniz.", variant: "destructive" });
    } else if (data.session) {
      // 🔥🔥🔥 KRİTİK: GLOBAL TOKEN'I SET ET!
      setGlobalAccessToken(data.session.access_token);
      console.log("[Auth] 🔐 Global token SET EDİLDİ (signIn)!");
      
      setSession(data.session);
      setUser(data.session.user);
      
      if (isNative) {
        await saveSessionToStorage(data.session);
      }
    }
    
    setLoading(false);
    return { error };
  };

  // 📝 Sign Up
  const signUp = async (email: string, password: string, username: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { 
        data: { username },
        emailRedirectTo: "https://kelimele.site/auth/confirm/"
      },
    });
    
    if (error) {
      toast({ title: "Kayıt Hatası", description: error.message, variant: "destructive" });
    } else if (data.session) {
      // 🔥🔥🔥 KRİTİK: YENİ KULLANICILAR İÇİN DE GLOBAL TOKEN SET ET!
      setGlobalAccessToken(data.session.access_token);
      console.log("[Auth] 🔐 Global token SET EDİLDİ (signUp)!");
      
      setSession(data.session);
      setUser(data.session.user);
      
      if (isNative) {
        await saveSessionToStorage(data.session);
      }
    }
    
    return { error };
  };

  // 🚪 Sign Out
  const signOut = async () => {
    console.log("[Auth] 🚪 Çıkış yapılıyor...");
    
    // 🔥 UserContext'e logout bildirimi gönder
    window.dispatchEvent(new Event("auth-logout"));
    
    // 🔥🔥🔥 KRİTİK: GLOBAL TOKEN'I TEMİZLE!
    setGlobalAccessToken(null);
    console.log("[Auth] 🔐 Global token TEMİZLENDİ (signOut)!");
    
    intentionalLogoutRef.current = true;
    setLoading(true);
    
    if (isNative) {
      await clearSessionStorage();
    }
    
    try {
      await supabase.auth.signOut();
    } catch {}
    
    setSession(null);
    setUser(null);
    setLoading(false);
  };


  // 🔑 Reset Password
  const resetPassword = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: "https://kelimele.site/auth/reset-password",
    });
    
    if (!error) {
      toast({ title: "Mail Gönderildi", description: "Şifre sıfırlama linki e-postanıza gönderildi." });
    } else {
      toast({ title: "Hata", description: error.message, variant: "destructive" });
    }
    
    return { error };
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, signIn, signUp, signOut, resetPassword }}>
      {children}
    </AuthContext.Provider>
  );
};
