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

  // Token'ın süresi dolmuş mu kontrol eden fonksiyon
  const isTokenExpired = (session: Session) => {
    if (!session?.expires_at) return true;
    const now = Math.floor(Date.now() / 1000);
    return session.expires_at < now + 60;
  };

  // 🔧 FORCE SESSION RECOVERY - Foreground'da çağrılacak
  const forceRecoverSession = useCallback(async () => {
    if (isRecoveringRef.current) {
      console.log("[AuthContext] ⏳ Recovery zaten devam ediyor, atlanıyor...");
      return;
    }
    
    isRecoveringRef.current = true;
    console.log("[AuthContext] 🔄 FORCE Session Recovery başlıyor...");
    
    try {
      // 1. Önce getSession dene (storage'dan okur)
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      
      if (currentSession?.access_token) {
        console.log("[AuthContext] ✅ Session mevcut:", currentSession.user?.email);
        if (mounted.current) {
          setSession(currentSession);
          setUser(currentSession.user);
          setCachedData(currentSession.user, currentSession);
          setLoading(false);
        }
        isRecoveringRef.current = false;
        return;
      }

      // 2. Session null ise, Preferences'dan manuel oku ve refreshSession dene
      console.log("[AuthContext] ⚠️ getSession null, Preferences'dan manuel restore...");
      
      const storedSessionKey = "sb-nnlvtqmuwmrqfinsgvwc-auth-token";
      let storedSession: string | null = null;

      // Önce Preferences'dan dene (native storage, daha güvenilir)
      try {
        const { value } = await Preferences.get({ key: storedSessionKey });
        storedSession = value;
        if (value) console.log("[AuthContext] ✅ Preferences'da session bulundu");
      } catch (e) {
        console.log("[AuthContext] ℹ️ Preferences okunamadı");
      }

      // Yoksa localStorage'dan dene
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
            const { data, error } = await supabase.auth.refreshSession({
              refresh_token: parsed.refresh_token
            });
            
            if (!error && data.session) {
              console.log("[AuthContext] ✅ Session başarıyla restore edildi!");
              if (mounted.current) {
                setSession(data.session);
                setUser(data.session.user);
                setCachedData(data.session.user, data.session);
                setLoading(false);
              }
            } else {
              console.error("[AuthContext] ❌ Refresh başarısız:", error?.message);
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
      isRecoveringRef.current = false;
    }
  }, []);

  // 🔧 useAppState ile foreground dinle
  useAppState({
    onForeground: () => {
      console.log("[AuthContext] 📱 App ön plana geldi - session kontrol ediliyor");
      forceRecoverSession();
    },
    onBackground: () => {
      console.log("[AuthContext] 📱 App arka plana gitti");
    }
  });

  useEffect(() => {
    mounted.current = true;

    const initAuth = async () => {
      console.log("🔒 Auth Check Başlıyor...");

      // 1. Önce Cache'e Bak
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
          }
        }
      }

      // 2. Supabase ile Gerçek Kontrol
      await forceRecoverSession();
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
