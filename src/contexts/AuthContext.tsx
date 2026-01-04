import { useState, useEffect, createContext, useContext, ReactNode, useRef } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { setCachedSession as setPersistentSession } from "@/utils/persistentState";
import { Capacitor } from "@capacitor/core";
import { Preferences } from "@capacitor/preferences";

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

  // Token'ın süresi dolmuş mu kontrol eden fonksiyon
  const isTokenExpired = (session: Session) => {
    if (!session?.expires_at) return true;
    const now = Math.floor(Date.now() / 1000);
    // Güvenlik payı: Sürenin bitmesine 60 saniye kaldıysa bile "bitmiş" sayalım.
    return session.expires_at < now + 60;
  };

  useEffect(() => {
    mounted.current = true;

    const initAuth = async () => {
      console.log("🔒 Auth Check Başlıyor...");

      // 1. Önce Cache'e Bak
      const cachedSession = getCachedSession();

      if (cachedSession) {
        // 2. KRİTİK NOKTA: Cache var ama süresi dolmuş mu?
        if (isTokenExpired(cachedSession)) {
          console.log("⚠️ Cache bulundu ama SÜRESİ DOLMUŞ (Bayat Token). Yenisi isteniyor...");
          // Session'ı state'e ATMA! Bekle, yenisi gelsin.
        } else {
          console.log("✅ Cache geçerli, hemen içeri alınıyor.");
          // Token taze, kullanıcıyı bekletme, hemen içeri al
          if (mounted.current) {
            setSession(cachedSession);
            setUser(cachedSession.user);
            setLoading(false); // Kullanıcı uygulamayı kullanmaya başlasın
          }
        }
      }

      // 3. Supabase ile Gerçek Kontrol
      try {
        const {
          data: { session: currentSession },
          error,
        } = await supabase.auth.getSession();

        if (currentSession) {
          // Session var - kullan
          if (mounted.current) {
            if (currentSession.access_token !== session?.access_token) {
              console.log("✅ Sunucudan güncel oturum alındı.");
              setSession(currentSession);
              setUser(currentSession.user);
              setCachedData(currentSession.user, currentSession);
            }
          }
        } else if (cachedSession && !isTokenExpired(cachedSession)) {
          // getSession başarısız ama cache taze - cache'i kullan
          console.log("⚠️ Network hatası ama cache taze, devam ediliyor.");
        } else {
          // Session yok ve cache de yok/bayat - giriş gerekli
          console.log("❌ Oturum yok, giriş sayfasına yönlendirilecek.");
          if (mounted.current) {
            setSession(null);
            setUser(null);
            setCachedData(null, null);
          }
        }
      } catch (e) {
        console.error("Auth Init Error:", e);
        // Hata durumunda cache'i koru
      } finally {
        if (mounted.current) setLoading(false);
      }
    };

    initAuth();

    // Auth State Değişimlerini Dinle
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      if (event === "TOKEN_REFRESHED" || event === "SIGNED_IN") {
        if (newSession) {
          console.log(`🔐 Token Yenilendi (${event})`);
          setSession(newSession);
          setUser(newSession.user);
          setCachedData(newSession.user, newSession);
        }
      } else if (event === "SIGNED_OUT") {
        console.log("👋 Çıkış yapıldı");
        setSession(null);
        setUser(null);
        setCachedData(null, null);
      }
    });

    // 🆕 NATIVE: Arka plandan gelince session'ı yeniden kontrol et
    const handleForeground = async () => {
      if (!Capacitor.isNativePlatform()) return;
      
      console.log("[AuthContext] 📱 Foreground - session kontrol ediliyor...");
      
      try {
        // Önce mevcut session'ı kontrol et
        const { data: { session: currentSession } } = await supabase.auth.getSession();
        
        if (currentSession?.access_token) {
          console.log("[AuthContext] ✅ Session mevcut");
          if (currentSession.access_token !== session?.access_token) {
            setSession(currentSession);
            setUser(currentSession.user);
            setCachedData(currentSession.user, currentSession);
          }
          return;
        }

        // Session yoksa, storage'dan restore dene
        console.log("[AuthContext] ⚠️ Session yok, storage'dan restore deneniyor...");
        
        const { value: storedSession } = await Preferences.get({ 
          key: "sb-nnlvtqmuwmrqfinsgvwc-auth-token" 
        });

        if (storedSession) {
          const parsed = JSON.parse(storedSession);
          if (parsed?.refresh_token) {
            console.log("[AuthContext] 🔄 Refresh token ile session yenileniyor...");
            const { data, error } = await supabase.auth.refreshSession({
              refresh_token: parsed.refresh_token
            });
            
            if (!error && data.session) {
              console.log("[AuthContext] ✅ Session restore edildi!");
              setSession(data.session);
              setUser(data.session.user);
              setCachedData(data.session.user, data.session);
            } else {
              console.error("[AuthContext] ❌ Refresh başarısız:", error?.message);
            }
          }
        }
      } catch (e) {
        console.error("[AuthContext] ❌ Foreground session check hatası:", e);
      }
    };

    // Visibility change listener
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        handleForeground();
      }
    };

    // Native app state listener
    let appStateCleanup: (() => void) | undefined;
    
    if (Capacitor.isNativePlatform()) {
      import("@capacitor/app").then(({ App }) => {
        App.addListener("appStateChange", ({ isActive }) => {
          if (isActive) {
            handleForeground();
          }
        }).then(listener => {
          appStateCleanup = () => listener.remove();
        });
      });
    }

    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("appForeground", handleForeground);

    return () => {
      mounted.current = false;
      subscription.unsubscribe();
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("appForeground", handleForeground);
      appStateCleanup?.();
    };
  }, []);

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
