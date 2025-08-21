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
  fastest_word_time?: number;
  username?: string;
  avatar_url?: string;
  disconnect_count?: number;
  win_count?: number;
  last_disconnect?: string;
  last_win?: string;
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
      // Önbelleği atlamak için timestamp ekle
      const cacheBreaker = forceRefresh ? `?t=${Date.now()}` : '';
      
      // Tüm alanları seç - sadece bazılarını değil
      const { data, error } = await supabase
        .from('profiles')
        .select('*')  // Tüm alanları seç
        .eq('id', user.id)
        .single();

      if (!error && data) {
        setProfile(data);
        
        // Browser önbelleğini temizle
        if (forceRefresh && 'caches' in window) {
          try {
            const cacheNames = await caches.keys();
            await Promise.all(
              cacheNames.map(cacheName => caches.delete(cacheName))
            );
          } catch (cacheError) {
            console.log('Cache clearing failed:', cacheError);
          }
        }
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
      await refreshProfile(true); // Force refresh
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

  // Kullanıcının online olup olmadığını kontrol et
const isUserOnline = (userId: string) => {
  return onlineUsers.some(user => user.id === userId);
};

// Online kullanıcıları yenile
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
      .gte('last_seen', new Date(Date.now() - 5 * 60 * 1000).toISOString());
    
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
    console.log('Fetching online users...');
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
      .gte('last_seen', new Date(Date.now() - 5 * 60 * 1000).toISOString());

    console.log('Fetched data:', data);
    
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

  // Sayfa görünürlüğü değiştiğinde
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
  
  const interval = setInterval(updatePresence, 30000);
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
    // Event listener'ları temizle
    window.removeEventListener('beforeunload', handleBeforeUnload);
    document.removeEventListener('visibilitychange', handleVisibilityChange);
  };
}, [user?.id]);

  useEffect(() => {
    refreshProfile(true); // İlk yüklemede force refresh
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