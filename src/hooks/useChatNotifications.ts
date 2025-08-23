// hooks/useChatNotifications.ts
import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

export function useChatNotifications() {
  const { user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchUnreadCount = async () => {
    if (!user) return;
    
    try {
      // Özel sohbetlerdeki okunmamış mesajları say
      const { count, error } = await supabase
        .from('private_messages')
        .select('*', { count: 'exact' })
        .eq('recipient_id', user.id)
        .eq('is_read', false);

      if (error) {
        console.error('Error fetching unread count:', error);
        return;
      }

      setUnreadCount(count || 0);
    } catch (error) {
      console.error('Error in fetchUnreadCount:', error);
    }
  };

  useEffect(() => {
    if (user) {
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
            // Yeni mesaj geldiğinde sayacı güncelle
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
            // Mesaj okunduğunda sayacı güncelle
            fetchUnreadCount();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [user]);

  return { unreadCount, fetchUnreadCount };
}