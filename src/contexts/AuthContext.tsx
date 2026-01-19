import { useState, useEffect, createContext, useContext, ReactNode, useRef, useCallback } from "react";
import { User, Session } from "@supabase/supabase-js";
import {
  supabase,
  saveSessionToStorage,
  loadSessionFromStorage,
  clearSessionStorage,
  setGlobalAccessToken,
} from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Capacitor } from "@capacitor/core";
// NativeRealtime kaldırıldı - Supabase JS SDK yeterli
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

const SUPABASE_URL = "https://nnlvtqmuwmrqfinsgvwc.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5ubHZ0cW11d21ycWZpbnNndndjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ1MTUzODAsImV4cCI6MjA3MDA5MTM4MH0.MrN6Cgs-uTHg9MF_zfae31VXAj6lTI6V9gdEFZBMvVE";

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

  // Native Service kaldırıldı - window.location.reload() stratejisi kullanılıyor
  // Reload sonrası Supabase JS SDK tüm bağlantıları sıfırdan kuruyor

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
          if (
            error.message?.includes("Invalid") ||
            error.message?.includes("expired") ||
            error.message?.includes("revoked")
          ) {
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

          // Native service kaldırıldı - reload stratejisi kullanılıyor
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

    const handleSessionRecovered = async (event: any) => {
      console.log("[Auth] 🔄 Session recovered eventi alındı");

      // Session recovery hook başarılı oldu, session'ı Supabase'den al
      try {
        const {
          data: { session: currentSession },
        } = await supabase.auth.getSession();

        if (currentSession && mounted.current) {
          console.log("[Auth] ✅ Session güncellendi:", currentSession.user.email);
          setSession(currentSession);
          setUser(currentSession.user);
          setLoading(false);
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
      // 🔥 ARTIK BURADA HİÇBİR ŞEY YAPMA!
      // useSessionRecovery hook'u tüm session recovery işlemlerini yapıyor
    },
    onBackground: () => {
      console.log("[Auth] 🌑 Arka plana geçti");
    },
  });

  // 🔥 INIT
  useEffect(() => {
    mounted.current = true;

    const initAuth = async () => {
      if (initCompletedRef.current) {
        console.log("[Auth] ⏭️ Init zaten tamamlandı, skip");
        return;
      }
      initCompletedRef.current = true;

      console.log("🔒 Auth Başlatılıyor... isNative:", isNative);

      if (isNative) {
        // NATIVE: Storage'dan restore
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
      } else {
        // WEB: Normal Supabase getSession
        console.log("[Auth] 🌐 Web mod - getSession...");
        try {
          const { data } = await supabase.auth.getSession();

          if (data?.session && mounted.current) {
            setSession(data.session);
            setUser(data.session.user);
          }
        } catch {}

        if (mounted.current) setLoading(false);
      }
    };

    // FAILSAFE: 8 saniye sonra loading kapat
    const failsafe = setTimeout(() => {
      if (loading && mounted.current) {
        console.warn("[Auth] ⚠️ FAILSAFE: 8s timeout - loading zorla kapatılıyor");
        setLoading(false);
      }
    }, 8000);

    // 🔥 HEMEN ÇALIŞTIR
    initAuth();

    // 🔔 Auth State Listener
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      console.log(`[Auth] 🔔 Event: ${event}`);

      // 🔥 NATIVE'DE SIGNED_OUT'U TAMAMEN IGNORE ET
      // Sadece intentional logout'u işle
      if (event === "SIGNED_OUT") {
        if (intentionalLogoutRef.current) {
          console.log("[Auth] ✅ Bilerek çıkış yapıldı");
          intentionalLogoutRef.current = false;
          if (mounted.current) {
            setSession(null);
            setUser(null);
          }
        } else if (isNative) {
          // 🛡️ Native'de SIGNED_OUT IGNORE - storage'dan restore dene
          console.log("[Auth] 🛡️ Native SIGNED_OUT IGNORE - storage kontrol...");
          setTimeout(() => restoreFromStorage(), 500);
        }
        return;
      }

      // TOKEN_REFRESHED veya SIGNED_IN
      if ((event === "TOKEN_REFRESHED" || event === "SIGNED_IN") && newSession) {
        console.log(`🔐 Token güncellendi (${event})`);

        // 🔥🔥🔥 KRİTİK: GLOBAL TOKEN'I HER ZAMAN SET ET!
        setGlobalAccessToken(newSession.access_token);
        console.log("[Auth] 🔐 Global token SET EDİLDİ!");

        if (mounted.current) {
          setSession(newSession);
          setUser(newSession.user);
          setLoading(false);
        }

        // Native'de storage'a kaydet - bu da token'ı set eder
        if (isNative) {
          await saveSessionToStorage(newSession);
        }
      }
    });

    return () => {
      mounted.current = false;
      clearTimeout(failsafe);
      subscription.unsubscribe();
    };
  }, [isNative, restoreFromStorage]);

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
      // Native service kaldırıldı
    }

    setLoading(false);
    return { error };
  };

  // 📝 Sign Up
  const signUp = async (email: string, password: string, username: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { username } },
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
      // Native service kaldırıldı
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

    toast({ title: "Çıkış Yapıldı" });
  };

  // 🔑 Reset Password
  const resetPassword = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: "https://kelimeci.com.tr/auth/reset-password",
    });

    if (!error) {
      toast({ title: "Mail Gönderildi" });
    }

    return { error };
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, signIn, signUp, signOut, resetPassword }}>
      {children}
    </AuthContext.Provider>
  );
};
