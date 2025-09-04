import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

export function useChatNotifications() {
  const { user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);

  const loadUnreadMessages = useCallback(async () => {
    if (!user?.id) return 0;
    
    const { count, error } = await supabase
      .from('private_messages')
      .select('*', { count: 'exact' })
      .eq('recipient_id', user.id)
      .eq('is_read', false);

    return count || 0;
  }, [user?.id]);

  const markPrivateMessagesAsRead = async () => {
    if (!user?.id) return;
    
    const { error } = await supabase
      .from('private_messages')
      .update({ is_read: true })
      .eq('recipient_id', user.id)
      .eq('is_read', false);
    
    if (!error) {
      setUnreadCount(0);
    }
  };

  const markAllAsRead = async () => {
    await markPrivateMessagesAsRead();
  };

  const refreshUnreadCounts = async () => {
    const count = await loadUnreadMessages();
    setUnreadCount(count);
  };

  useEffect(() => {
    if (!user?.id) return;

    refreshUnreadCounts();

    const channel = supabase
      .channel('notifications-channel')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'private_messages',
          filter: `recipient_id=eq.${user.id}`
        },
        refreshUnreadCounts
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  return { 
    unreadCount, 
    markAllAsRead,
    markPrivateMessagesAsRead,
    refreshUnreadCounts
  };
}