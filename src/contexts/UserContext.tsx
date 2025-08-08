import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { supabase } from '@/integrations/supabase/client';

interface UserProfile {
  game_credits: number;
  premium_until: string | null;
  hint_credits: number;
}

interface UserContextType {
  profile: UserProfile | null;
  loading: boolean;
  refreshProfile: () => Promise<void>;
  updateCredits: (newCredits: number) => void;
  consumeCredit: () => Promise<boolean>;
  isPremium: boolean;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export const useUser = () => {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
};

interface UserProviderProps {
  children: ReactNode;
}

export const UserProvider = ({ children }: UserProviderProps) => {
  const { user } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(false);

  const refreshProfile = async () => {
    if (!user) {
      setProfile(null);
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('game_credits, premium_until, hint_credits')
        .eq('id', user.id)
        .single();

      if (!error && data) {
        setProfile(data);
      }
    } catch (error) {
      console.error('Error loading profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateCredits = (newCredits: number) => {
    if (profile) {
      setProfile({ ...profile, game_credits: newCredits });
    }
  };

  const isPremium = profile?.premium_until ? new Date(profile.premium_until) > new Date() : false;

  const consumeCredit = async (): Promise<boolean> => {
    if (!user || !profile) return false;
    
    // Premium kullanıcılar için kredi tüketimi yok
    if (isPremium) return true;
    
    // Kredi kontrolü
    if (profile.game_credits <= 0) return false;
    
    try {
      const newCredits = profile.game_credits - 1;
      
      // Veritabanını güncelle
      const { error } = await supabase
        .from('profiles')
        .update({ game_credits: newCredits })
        .eq('id', user.id);
      
      if (error) throw error;
      
      // Local state'i güncelle
      setProfile({ ...profile, game_credits: newCredits });
      return true;
    } catch (error) {
      console.error('Error consuming credit:', error);
      return false;
    }
  };

  useEffect(() => {
    refreshProfile();
  }, [user]);

  // Real-time subscription for profile changes
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('profile-changes')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
          filter: `id=eq.${user.id}`
        },
        (payload) => {
          if (payload.new) {
            setProfile(payload.new as UserProfile);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  return (
    <UserContext.Provider value={{ profile, loading, refreshProfile, updateCredits, consumeCredit, isPremium }}>
      {children}
    </UserContext.Provider>
  );
};