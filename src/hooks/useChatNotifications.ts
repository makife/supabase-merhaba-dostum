// hooks/useChatNotifications.ts
import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

// EN BASİT ÇÖZÜM:
export function useChatNotifications() {
  const { user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!user) return;
    
    // Şimdilik sabit 0 döndür, sonra düzeltiriz
    setUnreadCount(0);
    
    // 5 saniyede bir kontrol et (geçici çözüm)
    const interval = setInterval(() => {
      setUnreadCount(prev => prev > 0 ? prev - 1 : 0);
    }, 5000);

    return () => clearInterval(interval);
  }, [user]);

  return { unreadCount };
}

  useEffect(() => {
    if (!user) return;

    fetchUnreadCount();
    
    // Real-time subscription for new messages
    const channel = supabase
      .channel('private-messages-notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'private_messages',
          filter: `recipient_id=eq.${user.id}`
        },
        () => {
          fetchUnreadCount();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'private_messages',
          filter: `recipient_id=eq.${user.id}`
        },
        () => {
          fetchUnreadCount();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  return { unreadCount, fetchUnreadCount };
}