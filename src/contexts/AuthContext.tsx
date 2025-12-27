import { useState, useEffect, createContext, useContext, ReactNode, useRef } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

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

// LocalStorage Cache İşlemleri
const getCachedUser = (): User | null => {
  try {
    const cached = localStorage.getItem("kelimeci_cached_user");
    if (cached) return JSON.parse(cached);
  } catch (e) {
    console.log("Cache okuma hatası:", e);
  }
  return null;
};

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
    } else {
      localStorage.removeItem("kelimeci_cached_user");
      localStorage.removeItem("kelimeci_cached_session");
    }
  } catch (e) {
    console.log("Cache yazma hatası:", e);
  }
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider = ({ children }: AuthProviderProps) => {
  // 1. ÖNEMLİ: Başlangıç state'ini direkt Cache'den alıyoruz.
  // Cache varsa loading FALSE başlar. Kullanıcı anında içeri girer.
  const cachedUser = getCachedUser();
  const cachedSession = getCachedSession();

  const [user, setUser] = useState<User | null>(cachedUser);
  const [session, setSession] = useState<Session | null>(cachedSession);

  // Eğer cache varsa, loading FALSE olsun ki kullanıcı beklemesin
  const [loading, setLoading] = useState(!cachedUser);

  const { toast } = useToast();
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;

    // Supabase Listener
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      console.log("🔐 Auth Event:", event);

      // Sadece açıkça çıkış yapılırsa veya token geçersizse sil
      if (event === "SIGNED_OUT") {
        setSession(null);
        setUser(null);
        setCachedData(null, null);
        setLoading(false);
        return;
      }

      // Token yenilendi veya giriş yapıldıysa güncelle
      if (newSession) {
        setSession(newSession);
        setUser(newSession.user);
        setCachedData(newSession.user, newSession);
        setLoading(false);
      }
    });

    // Başlangıç Kontrolü (Arka Planda)
    const initAuth = async () => {
      try {
        // Supabase'den güncel durumu iste
        const {
          data: { session: currentSession },
          error,
        } = await supabase.auth.getSession();

        if (error) {
          console.log("⚠️ Network/Auth hatası (Cache korunuyor):", error.message);
          // HATA VARSA HİÇBİR ŞEY YAPMA!
          // Cache'deki kullanıcıyla devam et.
          if (mounted.current) setLoading(false);
          return;
        }

        if (currentSession) {
          // Her şey yolunda, veriyi güncelle
          if (mounted.current) {
            setSession(currentSession);
            setUser(currentSession.user);
            setCachedData(currentSession.user, currentSession);
          }
        } else {
          // Session yok. AMA...
          // Eğer cache'de user varsa hemen silme! Belki token yenileniyordur.
          // refreshSession deneyelim.
          console.log("⚠️ Session null geldi, refresh deneniyor...");
          const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();

          if (refreshData.session) {
            console.log("✅ Session kurtarıldı!");
            if (mounted.current) {
              setSession(refreshData.session);
              setUser(refreshData.session.user);
              setCachedData(refreshData.session.user, refreshData.session);
            }
          } else {
            // Artık eminiz, gerçekten oturum yok.
            // Eğer cache boşsa null yap, doluysa (offline olabilir) dokunma.
            if (!cachedUser) {
              console.log("❌ Kurtarılamadı, oturum yok.");
              if (mounted.current) {
                setUser(null);
                setSession(null);
              }
            } else {
              console.log("⚠️ Offline olabilir, Cache ile devam ediliyor.");
            }
          }
        }
      } catch (err) {
        console.error("Auth Init Crash:", err);
        // Crash olsa bile cache'i silme
      } finally {
        if (mounted.current) setLoading(false);
      }
    };

    initAuth();

    return () => {
      mounted.current = false;
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    setLoading(true);
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      toast({
        title: "Giriş Hatası",
        description: "E-posta veya şifre hatalı.",
        variant: "destructive",
      });
    } else if (data.session) {
      // Manuel girişte hemen state'i güncelle
      setSession(data.session);
      setUser(data.session.user);
      setCachedData(data.session.user, data.session);
      toast({
        title: "Giriş Başarılı",
        description: "Hoş geldiniz!",
      });
    }
    setLoading(false);
    return { error };
  };

  const signUp = async (email: string, password: string, username: string) => {
    const redirectUrl = `${window.location.origin}/`;

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: { username: username },
      },
    });

    if (error) {
      toast({
        title: "Kayıt Hatası",
        description: error.message,
        variant: "destructive",
      });
    }
    return { error };
  };

  const signOut = async () => {
    // Önce UI'ı temizle (Hızlı tepki için)
    setCachedData(null, null);
    setUser(null);
    setSession(null);

    // Sonra arka planı hallet
    await supabase.auth.signOut();
    toast({
      title: "Çıkış Yapıldı",
      description: "Güle güle!",
    });
  };

  const resetPassword = async (email: string) => {
    const redirectUrl = `https://kelimeci.com.tr/auth/reset-password`;

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: redirectUrl,
    });

    if (error) {
      toast({
        title: "Hata",
        description: "Şifre sıfırlama maili gönderilemedi.",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Mail Gönderildi",
        description: "Şifre sıfırlama linki e-posta adresinize gönderildi.",
      });
    }
    return { error };
  };

  const value = {
    user,
    session,
    loading, // Cache varsa burası hep false olur
    signIn,
    signUp,
    signOut,
    resetPassword,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
