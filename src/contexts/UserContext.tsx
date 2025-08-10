import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { supabase } from '@/integrations/supabase/client';

interface UserProfile {
  game_credits: number;
  bonus_credits: number;
  premium_until: string | null;
  hint_credits: number;
  last_credit_refresh: string | null;
  daily_games: number;
  win_streak: number;
  total_score: number;
  created_at: string;
}

interface UserContextType {
  profile: UserProfile | null;
  loading: boolean;
  refreshProfile: () => Promise<void>;
  updateCredits: (newCredits: number) => void;
  addBonusCredits: (bonusCredits: number) => Promise<void>;
  consumeCredit: () => Promise<boolean>;
  checkAndRefreshCredits: () => Promise<void>;
  getTotalCredits: () => number;
  getDisplayCredits: () => { base: number; bonus: number };
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
        .select('game_credits, bonus_credits, premium_until, hint_credits, last_credit_refresh, daily_games, win_streak, total_score, created_at')
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

  const addBonusCredits = async (bonusCredits: number) => {
    if (!user || !profile) return;
    
    try {
      // Önce ana hakları 5'e tamamla
      const currentBase = profile.game_credits;
      const neededForFull = Math.max(0, 5 - currentBase);
      const newBase = Math.min(5, currentBase + bonusCredits);
      const remainingBonus = Math.max(0, bonusCredits - neededForFull);
      const newTotalBonus = profile.bonus_credits + remainingBonus;

      const { error } = await supabase
        .from('profiles')
        .update({ 
          game_credits: newBase,
          bonus_credits: newTotalBonus
        })
        .eq('id', user.id);

      if (error) throw error;

      setProfile({ 
        ...profile, 
        game_credits: newBase,
        bonus_credits: newTotalBonus
      });
    } catch (error) {
      console.error('Error adding bonus credits:', error);
    }
  };

  const checkAndRefreshCredits = async () => {
    if (!user) return;
    
    try {
      await supabase.rpc('check_and_refresh_credits', { user_id: user.id });
      await refreshProfile();
    } catch (error) {
      console.error('Error checking credits:', error);
    }
  };

  const getTotalCredits = () => {
    if (!profile) return 0;
    return profile.game_credits + profile.bonus_credits;
  };

  const getDisplayCredits = () => {
    if (!profile) return { base: 0, bonus: 0 };
    return { 
      base: profile.game_credits, 
      bonus: profile.bonus_credits 
    };
  };

  const isPremium = profile?.premium_until ? new Date(profile.premium_until) > new Date() : false;

  const consumeCredit = async (): Promise<boolean> => {
    if (!user || !profile) {
      console.log('consumeCredit: No user or profile');
      return false;
    }
    
    console.log('consumeCredit: profile?.premium_until:', profile?.premium_until);
    console.log('consumeCredit: isPremium:', isPremium);
    console.log('consumeCredit: current date:', new Date());
    
    // Premium kullanıcılar için kredi tüketimi yok
    if (isPremium) {
      console.log('consumeCredit: User is premium, returning true');
      return true;
    }
    
    // Toplam kredi kontrolü
    const totalCredits = getTotalCredits();
    if (totalCredits <= 0) return false;
    
    try {
      let newGameCredits = profile.game_credits;
      let newBonusCredits = profile.bonus_credits;
      
      // Önce ana hakları kullan
      if (profile.game_credits > 0) {
        newGameCredits = profile.game_credits - 1;
      } else if (profile.bonus_credits > 0) {
        // Ana haklar bitmiş, bonus hakları kullan
        newBonusCredits = profile.bonus_credits - 1;
      }
      
      // Veritabanını güncelle
      const { error } = await supabase
        .from('profiles')
        .update({ 
          game_credits: newGameCredits,
          bonus_credits: newBonusCredits
        })
        .eq('id', user.id);
      
      if (error) throw error;
      
      // Local state'i güncelle
      setProfile({ 
        ...profile, 
        game_credits: newGameCredits,
        bonus_credits: newBonusCredits
      });
      return true;
    } catch (error) {
      console.error('Error consuming credit:', error);
      return false;
    }
  };

  useEffect(() => {
    refreshProfile();
    // İlk yüklemede kredi kontrolü yap
    if (user) {
      checkAndRefreshCredits();
    }
  }, [user]);

  // Her 15 dakikada bir kredi kontrolü yap
  useEffect(() => {
    if (!user || isPremium) return;
    
    const interval = setInterval(() => {
      checkAndRefreshCredits();
    }, 15 * 60 * 1000); // 15 dakika

    return () => clearInterval(interval);
  }, [user, isPremium]);

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
    <UserContext.Provider value={{ 
      profile, 
      loading, 
      refreshProfile, 
      updateCredits, 
      addBonusCredits,
      consumeCredit, 
      checkAndRefreshCredits,
      getTotalCredits,
      getDisplayCredits,
      isPremium 
    }}>
      {children}
    </UserContext.Provider>
  );
};