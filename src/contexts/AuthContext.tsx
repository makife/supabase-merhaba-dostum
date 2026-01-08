import { useState, useEffect, createContext, useContext, ReactNode, useRef, useCallback } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase, saveSessionToStorage, loadSessionFromStorage, clearSessionStorage } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Capacitor } from "@capacitor/core";
import { NativeRealtime } from "@/plugins/NativeRealtime";
import { useAppState } from "@/hooks/useAppState";
import { isFreshWake } from "@/utils/coldStartTime";
import { setCachedSession } from "@/utils/persistentState";

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
  const isRecoveringRef = useRef(false);
  const intentionalLogoutRef = useRef(false);
  const initCompletedRef = useRef(false);

  // 🔧 Timeout helper
  const withAuthTimeout = <T,>(promise: Promise<T>, ms: number = 8000): Promise<T | null> => {
    return Promise.race([
      promise,
      new Promise<null>((resolve) => setTimeout(() => {
        console.debug(`[AuthContext] ⏱️ ${ms}ms auth timeout`);
        resolve(null);
      }, ms)),
    ]);
  };

  // 🔥 NATIVE SESSION RESTORE - Preferences'tan session yükle
  const restoreSessionFromStorage = useCallback(async (): Promise<Session | null> => {
    console.log("[AuthContext] 🔄 Storage'dan session restore ediliyor...");
    
    try {
      const storedSession = await loadSessionFromStorage();
      
      if (!storedSession || !storedSession.refresh_token || !storedSession.user) {
        console.log("[AuthContext] ⚠️ Storage'da geçerli session yok");
        return null;
      }
      
      console.log("[AuthContext] ✅ Storage'da session bulundu:", storedSession.user.email);
      
      // 🔥 HEMEN UI'ı aç - optimistic
      if (mounted.current) {
        setUser(storedSession.user);
        setSession(storedSession as Session);
        setLoading(false);
        
        await setCachedSession({
          userId: storedSession.user.id,
          email: storedSession.user.email || '',
          accessToken: storedSession.access_token,
          refreshToken: storedSession.refresh_token,
          expiresAt: (storedSession.expires_at || 0) * 1000,
        });
      }
      
      // 🔥🔥🔥 KRİTİK: refreshSession kullan - setSession DEĞİL!
      // setSession eski token'la 400 verir, refreshSession YENİ token alır
      setTimeout(async () => {
        try {
          console.log("[AuthContext] 🔄 refreshSession ile token yenileniyor...");
          
          // Önce mevcut session'ı set et (Supabase'e refresh_token'ı bildir)
          await supabase.auth.setSession({
            access_token: storedSession.access_token,
            refresh_token: storedSession.refresh_token,
          });
          
          // Şimdi refresh et - bu YENİ refresh_token döndürür
          const { data, error } = await supabase.auth.refreshSession();
          
          if (error) {
            console.log("[AuthContext] ⚠️ refreshSession hatası:", error.message);
            
            // 🔥 Refresh token expired ise kullanıcıyı çıkar
            if (error.message?.includes('expired') || error.message?.includes('invalid')) {
              console.log("[AuthContext] 🚫 Token tamamen geçersiz - logout");
              if (mounted.current) {
                setUser(null);
                setSession(null);
                await clearSessionStorage();
              }
            }
            return;
          }
          
          if (data?.session && mounted.current) {
            console.log("[AuthContext] ✅ Token refresh başarılı! Yeni token kaydediliyor...");
            setUser(data.session.user);
            setSession(data.session);
            
            // 🔥 YENİ SESSION'I KAYDET - refresh_token değişti!
            await saveSessionToStorage(data.session);
            
            await setCachedSession({
              userId: data.session.user.id,
              email: data.session.user.email || '',
              accessToken: data.session.access_token,
              refreshToken: data.session.refresh_token,
              expiresAt: (data.session.expires_at || 0) * 1000,
            });
          }
        } catch (e) {
          console.error("[AuthContext] ⚠️ Background refresh hatası:", e);
        }
      }, 500);
      
      return storedSession as Session;
    } catch (e) {
      console.error("[AuthContext] ❌ Session restore hatası:", e);
      return null;
    }
  }, []);

  // 🔧 Native Service'i başlat
  const startNativeService = useCallback(async (accessToken: string) => {
    if (!Capacitor.isNativePlatform()) return;
    
    console.log("🔌 Native Service başlatılıyor...");
    
    try {
      await NativeRealtime.connect({
        url: SUPABASE_URL,
        apiKey: SUPABASE_ANON_KEY,
        accessToken: accessToken,
      });
      console.log("✅ Native Service bağlandı");
      await NativeRealtime.enterForegroundMode();
    } catch (err) {
      console.error("❌ Native Service başlatılamadı:", err);
    }
  }, []);

  // 🔥 FOREGROUND RECOVERY
  useAppState({
    onForeground: () => {
      console.log("[AuthContext] ☀️ Uygulama ön plana geldi");
      
      setTimeout(async () => {
        // Zaten oturum varsa refreshSession ile tazele
        if (session && user) {
          console.log("[AuthContext] ✅ Oturum aktif, refreshSession ile tazeleniyor...");
          try {
            const { data, error } = await supabase.auth.refreshSession();
            
            if (error) {
              console.log("[AuthContext] ⚠️ refreshSession hatası:", error.message);
              // Hata olsa bile mevcut UI'ı koru
              return;
            }
            
            if (data?.session && mounted.current) {
              setSession(data.session);
              setUser(data.session.user);
              // 🔥 YENİ refresh_token'ı kaydet!
              await saveSessionToStorage(data.session);
            }
          } catch (e) {
            console.log("[AuthContext] ⚠️ Token tazeleme hatası:", e);
          }
          return;
        }
        
        // User null - storage'dan restore dene
        console.log("[AuthContext] ⚠️ User NULL! Storage'dan restore...");
        
        const restoredSession = await restoreSessionFromStorage();
        
        if (restoredSession) {
          await startNativeService(restoredSession.access_token);
        }
      }, 0);
    },
    onBackground: () => {
      console.log("[AuthContext] 🌑 Uygulama arka plana geçti");
    },
  });

  // 🔥 INIT - Uygulama açılışında session yükle
  useEffect(() => {
    mounted.current = true;
    
    const initAuth = async () => {
      if (initCompletedRef.current) return;
      initCompletedRef.current = true;
      
      console.log("🔒 Auth Başlatılıyor...");
      
      const isNative = Capacitor.isNativePlatform();
      
      if (isNative) {
        // 🔥 NATIVE: Preferences'tan session yükle
        const restoredSession = await restoreSessionFromStorage();
        
        if (restoredSession) {
          await startNativeService(restoredSession.access_token);
        }
        
        if (mounted.current) setLoading(false);
      } else {
        // WEB: Normal Supabase getSession kullan
        try {
          const { data } = await supabase.auth.getSession();
          
          if (data?.session && mounted.current) {
            setSession(data.session);
            setUser(data.session.user);
          }
        } catch (e) {
          console.error("[AuthContext] Web getSession hatası:", e);
        }
        
        if (mounted.current) setLoading(false);
      }
    };
    
    // 🔧 FAILSAFE: 6 saniye sonra loading zorla kapat
    const failsafe = setTimeout(() => {
      if (loading && mounted.current) {
        console.warn("[AuthContext] ⚠️ FAILSAFE: 6s timeout");
        setLoading(false);
      }
    }, 6000);
    
    initAuth();
    
    // 🔔 Auth State Listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      console.log(`[AuthContext] 🔔 Auth event: ${event}`);
      
      if (event === "TOKEN_REFRESHED" || event === "SIGNED_IN") {
        if (newSession && mounted.current) {
          console.log(`🔐 Token Yenilendi (${event})`);
          setSession(newSession);
          setUser(newSession.user);
          setLoading(false);
          
          // 🔥 NATIVE: Session'ı Preferences'a kaydet + ProtectedRoute cache
          if (Capacitor.isNativePlatform()) {
            await saveSessionToStorage(newSession);
            
            // ProtectedRoute için de cache güncelle
            await setCachedSession({
              userId: newSession.user.id,
              email: newSession.user.email || '',
              accessToken: newSession.access_token,
              refreshToken: newSession.refresh_token,
              expiresAt: (newSession.expires_at || 0) * 1000,
            });
          }
        }
      } else if (event === "SIGNED_OUT") {
        // Kullanıcı bilerek çıkış yaptı mı?
        if (intentionalLogoutRef.current) {
          console.log("[AuthContext] ✅ Bilerek çıkış yapıldı");
          intentionalLogoutRef.current = false;
          return;
        }
        
        // 🛡️ Fresh wake koruması (20 saniye)
        if (isFreshWake(20000)) {
          console.log("[AuthContext] 🛡️ ZIRH: Uygulama yeni uyandı, SIGNED_OUT IGNORE");
          
          // Storage'dan restore dene
          setTimeout(async () => {
            await restoreSessionFromStorage();
          }, 500);
          
          return;
        }
        
        // Storage'da session var mı kontrol et
        const storedSession = await loadSessionFromStorage();
        
        if (storedSession?.access_token) {
          const nowSec = Math.floor(Date.now() / 1000);
          const isValid = storedSession.expires_at && storedSession.expires_at > nowSec;
          
          if (isValid) {
            console.log("[AuthContext] 🛡️ Storage'da geçerli token VAR, IGNORE");
            setTimeout(async () => {
              await restoreSessionFromStorage();
            }, 500);
            return;
          }
        }
        
        // Gerçek çıkış
        console.log("👋 Gerçek çıkış - state temizleniyor");
        if (mounted.current) {
          setSession(null);
          setUser(null);
        }
      }
    });
    
    return () => {
      mounted.current = false;
      clearTimeout(failsafe);
      subscription.unsubscribe();
    };
  }, [restoreSessionFromStorage, startNativeService]);

  // 🔐 Sign In
  const signIn = async (email: string, password: string) => {
    setLoading(true);
    
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    
    if (error) {
      toast({ title: "Giriş Hatası", description: "Bilgileri kontrol ediniz.", variant: "destructive" });
    } else if (data.session) {
      setSession(data.session);
      setUser(data.session.user);
      
      // 🔥 NATIVE: Session'ı Preferences'a kaydet + ProtectedRoute cache
      if (Capacitor.isNativePlatform()) {
        await saveSessionToStorage(data.session);
        
        await setCachedSession({
          userId: data.session.user.id,
          email: data.session.user.email || '',
          accessToken: data.session.access_token,
          refreshToken: data.session.refresh_token,
          expiresAt: (data.session.expires_at || 0) * 1000,
        });
      }
      
      // Native service başlat
      await startNativeService(data.session.access_token);
    }
    
    setLoading(false);
    return { error };
  };

  // 📝 Sign Up
  const signUp = async (email: string, password: string, username: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { username } },
    });
    
    if (error) {
      toast({ title: "Kayıt Hatası", description: error.message, variant: "destructive" });
    }
    
    return { error };
  };

  // 🚪 Sign Out
  const signOut = async () => {
    console.log("[AuthContext] 🚪 Çıkış yapılıyor...");
    
    intentionalLogoutRef.current = true;
    setLoading(true);
    
    // Storage'ı temizle
    if (Capacitor.isNativePlatform()) {
      await clearSessionStorage();
      await setCachedSession(null); // ProtectedRoute cache'i de temizle
    }
    
    try {
      await supabase.auth.signOut();
    } catch (e) {
      console.error("[AuthContext] signOut hatası:", e);
    }
    
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
    
    if (error) {
      toast({ title: "Hata", variant: "destructive" });
    } else {
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
