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
      const now = new Date().toISOString();
      
      // Update profiles.last_seen
      await supabase
        .from('profiles')
        .update({ last_seen: now })
        .eq('id', user.id);

      // Upsert user_presence (triggers friend online notifications)
      await supabase
        .from('user_presence')
        .upsert(
          { user_id: user.id, is_online: true, last_seen: now },
          { onConflict: 'user_id' }
        );
        
      console.log('💓 Heartbeat sent (last_seen + presence updated)');
    } catch (error) {
      console.error('Error updating last_seen:', error);
    }
  };
}
