import { useEffect } from 'react';
import { useUser } from '@/contexts/UserContext';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export function useActivityTracker() {
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;

    // İlk güncelleme
    updateLastSeen();

    // Her 20 saniyede bir last_seen güncelle (Heartbeat)
    // Edge function 30 saniye kontrolü yaptığı için 20 saniye güvenlidir.
    const interval = setInterval(() => {
      // Sadece sayfa görünürse güncelle (Tab arka plandaysa güncelleme)
      if (document.visibilityState === 'visible') {
        updateLastSeen();
      }
    }, 20000);

    // Tab görünürlük değişimini dinle
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        updateLastSeen();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [user]);

  const updateLastSeen = async () => {
    if (!user) return;
    
    try {
      await supabase
        .from('profiles')
        .update({ last_seen: new Date().toISOString() })
        .eq('id', user.id);
        
      console.log('💓 Heartbeat sent (last_seen updated)');
    } catch (error) {
      console.error('Error updating last_seen:', error);
    }
  };
}
