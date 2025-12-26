import { useState, useEffect, createContext, useContext, ReactNode, useRef } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

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

// LocalStorage'dan cache'lenmiş user bilgisini al
const getCachedUser = (): User | null => {
  try {
    const cached = localStorage.getItem('kelimeci_cached_user');
    if (cached) {
      return JSON.parse(cached);
    }
  } catch (e) {
    console.log('Cache okuma hatası:', e);
  }
  return null;
};

// User bilgisini cache'le
const setCachedUser = (user: User | null) => {
  try {
    if (user) {
      localStorage.setItem('kelimeci_cached_user', JSON.stringify(user));
    } else {
      localStorage.removeItem('kelimeci_cached_user');
    }
  } catch (e) {
    console.log('Cache yazma hatası:', e);
  }
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider = ({ children }: AuthProviderProps) => {
  // İlk değer olarak cache'den oku - böylece bağlantı kesilse bile kullanıcı görünür
  const [user, setUser] = useState<User | null>(() => getCachedUser());
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const hasInitialized = useRef(false);

  useEffect(() => {
    // Auth state listener'ı önce kur
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, newSession) => {
        console.log('🔐 Auth event:', event);
        
        // SIGNED_OUT event'i sadece gerçek çıkış yapıldığında işle
        if (event === 'SIGNED_OUT') {
          setSession(null);
          setUser(null);
          setCachedUser(null);
          setLoading(false);
          return;
        }
        
        // Session varsa güncelle
        if (newSession) {
          setSession(newSession);
          setUser(newSession.user);
          setCachedUser(newSession.user);
        }
        
        setLoading(false);
      }
    );

    // Mevcut session'ı kontrol et
    supabase.auth.getSession().then(({ data: { session: currentSession }, error }) => {
      // Hata varsa ve cache'de kullanıcı varsa, cache'i kullan
      if (error) {
        console.log('⚠️ Session kontrolü hatası, cache kullanılıyor:', error.message);
        const cachedUser = getCachedUser();
        if (cachedUser) {
          setUser(cachedUser);
          // Session yok ama kullanıcı var - bağlantı kesilmiş olabilir
        }
        setLoading(false);
        return;
      }
      
      if (currentSession) {
        setSession(currentSession);
        setUser(currentSession.user);
        setCachedUser(currentSession.user);
      } else if (!getCachedUser()) {
        // Session yok ve cache de yok - gerçekten giriş yapılmamış
        setUser(null);
      }
      // Eğer session yok ama cache varsa, user'ı değiştirme (cache'deki kalır)
      
      setLoading(false);
      hasInitialized.current = true;
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      toast({
        title: 'Giriş Hatası',
        description: 'E-posta veya şifre hatalı.',
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Giriş Başarılı',
        description: 'Hoş geldiniz!',
      });
    }

    return { error };
  };

  const signUp = async (email: string, password: string, username: string) => {
    const redirectUrl = `${window.location.origin}/`;
    
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          username: username,
        }
      }
    });

    if (error) {
      toast({
        title: 'Kayıt Hatası',
        description: error.message,
        variant: 'destructive',
      });
    }
    // Başarı mesajını burada gösterme, AuthPage'de göstereceğiz

    return { error };
  };

  const signOut = async () => {
    // Önce cache'i temizle
    setCachedUser(null);
    setUser(null);
    setSession(null);
    
    await supabase.auth.signOut();
    toast({
      title: 'Çıkış Yapıldı',
      description: 'Güle güle!',
    });
  };

const resetPassword = async (email: string) => {
  const redirectUrl = `https://kelimeci.com.tr/auth/reset-password`;
  
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: redirectUrl,
  });

  if (error) {
    toast({
      title: 'Hata',
      description: 'Şifre sıfırlama maili gönderilemedi.',
      variant: 'destructive',
    });
  } else {
    toast({
      title: 'Mail Gönderildi',
      description: 'Şifre sıfırlama linki e-posta adresinize gönderildi.',
    });
  }

  return { error };
};


  const value = {
    user,
    session,
    loading,
    signIn,
    signUp,
    signOut,
    resetPassword,
  };


  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
