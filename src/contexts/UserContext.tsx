
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { supabase } from '@/integrations/supabase/client';

interface OnlineUser {
  id: string;
  username: string;
  avatar_url?: string;
  last_seen: string;
}

interface UserProfile {
  game_credits: number;
  bonus_credits: number;
  premium_until: string | null;
  hint_credits: number;
  last_credit_refresh: string | null;
  total_score: number;
  created_at: string;
  // Yeni eklenen alanlar:
  daily_games?: number;
  win_streak?: number;
  daily_wins?: number;
  best_streak?: number;
  average_score?: number;
  total_words?: number;
  favorite_letter?: string;
  total_play_time?: number;
  last_daily_reset?: string;
  // Diğer mevcut alanlar:
  total_games?: number;
  wins?: number;
  losses?: number;
  longest_word?: string;
  longest_word_length?: number;
  fastest_word_time?: number;
  username?: string;
  avatar_url?: string;
  disconnect_count?: number;
  win_count?: number;
  last_disconnect?: string;
  last_win?: string;
  banned_until?: string | null;
}

interface UserContextType {
  profile: UserProfile | null;
  loading: boolean;
  refreshProfile: (forceRefresh?: boolean) => Promise<void>;
  updateCredits: (newCredits: number) => void;
  addBonusCredits: (bonusCredits: number) => Promise<void>;
  consumeCredit: () => Promise<boolean>;
  checkAndRefreshCredits: () => Promise<void>;
  getTotalCredits: () => number;
  getDisplayCredits: () => { base: number; bonus: number };
  isPremium: boolean;
  forceRefreshProfile: () => Promise<void>;
  onlineUsers: OnlineUser[];
  isUserOnline: (userId: string) => boolean;
  refreshOnlineUsers: () => Promise<void>;
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
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);

  const refreshProfile = async (forceRefresh = false) => {
    if (!user) {
      setProfile(null);
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (!error && data) {
        console.log('Profile refreshed:', data);
        setProfile(data);
      }
    } catch (error) {
      console.error('Error loading profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const setUserOffline = async () => {
    if (!user?.id) return;
    
    try {
      await supabase.from('user_presence' as any).update({ 
        is_online: false 
      }).eq('user_id', user.id);
    } catch (error) {
      console.error('Error setting offline:', error);
    }
  };

  const updateCredits = (newCredits: number) => {
    if (profile) {
      const updatedProfile = { ...profile, game_credits: newCredits };
      setProfile(updatedProfile);
      console.log('Credits updated locally:', updatedProfile);
    }
  };

  const addBonusCredits = async (bonusCredits: number) => {
    if (!user || !profile) return;
    
    try {
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

      const updatedProfile = { 
        ...profile, 
        game_credits: newBase,
        bonus_credits: newTotalBonus
      };
      setProfile(updatedProfile);
      console.log('Bonus credits added:', updatedProfile);
    } catch (error) {
      console.error('Error adding bonus credits:', error);
    }
  };

  const checkAndRefreshCredits = async () => {
    if (!user) return;
    
    try {
      await supabase.rpc('check_and_refresh_credits', { user_id: user.id });
      await refreshProfile(true);
    } catch (error) {
      console.error('Error checking credits:', error);
    }
  };

  const forceRefreshProfile = async () => {
    await refreshProfile(true);
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
    
    if (isPremium) {
      console.log('consumeCredit: User is premium, returning true');
      return true;
    }
    
    const totalCredits = getTotalCredits();
    if (totalCredits <= 0) return false;
    
    try {
      let newGameCredits = profile.game_credits;
      let newBonusCredits = profile.bonus_credits;
      
      // Önce bonus kredilerden düş, sonra normal kredilerden
      if (profile.bonus_credits > 0) {
        newBonusCredits = profile.bonus_credits - 1;
      } else if (profile.game_credits > 0) {
        newGameCredits = profile.game_credits - 1;
      }
      
      const { error } = await supabase
        .from('profiles')
        .update({ 
          game_credits: newGameCredits,
          bonus_credits: newBonusCredits
        })
        .eq('id', user.id);
      
      if (error) throw error;
      
      const updatedProfile = { 
        ...profile, 
        game_credits: newGameCredits,
        bonus_credits: newBonusCredits
      };
      setProfile(updatedProfile);
      console.log('Credit consumed:', updatedProfile);
      return true;
    } catch (error) {
      console.error('Error consuming credit:', error);
      return false;
    }
  };

  const isUserOnline = (userId: string) => {
    return onlineUsers.some(user => user.id === userId);
  };

  const refreshOnlineUsers = async () => {
    try {
      const { data }: any = await supabase
        .from('user_presence' as any)
        .select(`
          user_id, 
          last_seen, 
          profiles!inner(
            username, 
            avatar_url
          )
        `)
        .eq('is_online', true)
        .gte('last_seen', new Date(Date.now() - 15 * 1000).toISOString());
      
      if (data) {
        setOnlineUsers(data.map((item: any) => ({
          id: item.user_id,
          username: item.profiles.username || 'Unknown',
          avatar_url: item.profiles.avatar_url,
          last_seen: item.last_seen
        })));
      }
    } catch (error) {
      console.error('Error refreshing online users:', error);
    }
  };

  // User presence management
  useEffect(() => {
    if (!user?.id) return;

    const updatePresence = async () => {
      try {
        await supabase.from('user_presence' as any).upsert({ 
          user_id: user.id, 
          is_online: true, 
          last_seen: new Date().toISOString() 
        });
      } catch (error) {
        console.error('Error updating presence:', error);
      }
    };

    const fetchOnlineUsers = async () => {
      try {
        const { data }: any = await supabase
          .from('user_presence' as any)
          .select(`
            user_id, 
            last_seen, 
            profiles!inner(
              username, 
              avatar_url
            )
          `)
          .eq('is_online', true)
          .gte('last_seen', new Date(Date.now() - 15 * 1000).toISOString());

        if (data) {
          setOnlineUsers(data.map((item: any) => ({
            id: item.user_id,
            username: item.profiles.username || 'Unknown',
            avatar_url: item.profiles.avatar_url,
            last_seen: item.last_seen
          })));
        }
      } catch (error) {
        console.error('Error fetching online users:', error);
      }
    };

    const handleBeforeUnload = () => {
      setUserOffline();
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        setUserOffline();
      } else {
        updatePresence();
        fetchOnlineUsers();
      }
    };

    updatePresence();
    fetchOnlineUsers();
    
    const interval = setInterval(updatePresence, 5000);
    const channel = supabase.channel('presence_changes').on('postgres_changes', {
      event: '*', 
      schema: 'public', 
      table: 'user_presence' as any
    }, fetchOnlineUsers).subscribe();

    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
      setUserOffline();
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [user?.id]);

  // Initial profile load
  useEffect(() => {
    if (user) {
      refreshProfile(true);
      checkAndRefreshCredits();
    } else {
      setProfile(null);
    }
  }, [user]);

  // Credit check interval
  useEffect(() => {
    if (!user || isPremium) return;
    
    const interval = setInterval(() => {
      checkAndRefreshCredits();
    }, 15 * 60 * 1000);

    return () => clearInterval(interval);
  }, [user, isPremium]);

  // ENHANCED Real-time profile subscription
  useEffect(() => {
    if (!user) return;

    console.log('🔄 Setting up real-time profile subscription for user:', user.id);

    const channel = supabase
      .channel('profile-realtime-updates')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
          filter: `id=eq.${user.id}`
        },
        (payload) => {
          console.log('🎯 Profile updated via real-time:', payload.new);
          if (payload.new) {
            // Immediately update the profile state
            const newProfile = payload.new as UserProfile;
            console.log('📊 Profile stats updated:', {
              total_score: newProfile.total_score,
              wins: newProfile.wins,
              losses: newProfile.losses,
              game_credits: newProfile.game_credits,
              bonus_credits: newProfile.bonus_credits
            });
            
            setProfile(newProfile);
            setLoading(false);
          }
        }
      )
      .subscribe((status) => {
        console.log('📡 Real-time subscription status:', status);
      });

    return () => {
      console.log('🔌 Cleaning up profile subscription');
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
      isPremium,
      forceRefreshProfile,
      onlineUsers,
      isUserOnline,
      refreshOnlineUsers
    }}>
      {children}
    </UserContext.Provider>
  );
};
