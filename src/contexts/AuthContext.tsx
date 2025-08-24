import { useState, useEffect, createContext, useContext, ReactNode } from 'react';
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
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

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
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();


  useEffect(() => {
    // Auth state listener'ı önce kur
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
      }
    );

    // Mevcut session'ı kontrol et
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
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
    } else {
      toast({
        title: 'Kayıt Başarılı',
        description: 'Hesabınız oluşturuldu!',
      });
    }

    return { error };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    toast({
      title: 'Çıkış Yapıldı',
      description: 'Güle güle!',
    });
  };

const resetPassword = async (email: string) => {
  const redirectUrl = `${window.location.origin}/auth/reset-password`;
  
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
