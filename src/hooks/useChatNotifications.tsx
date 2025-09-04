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
    
    try {
      const { error } = await supabase
        .from('private_messages')
        .update({ is_read: true })
        .eq('recipient_id', user.id)
        .eq('is_read', false);
      
      if (error) throw error;
      setUnreadCount(0);
    } catch (error) {
      console.error('Error marking messages as read:', error);
    }
  };

  const markAllAsRead = async () => {
    await markPrivateMessagesAsRead();
  };

  useEffect(() => {
    if (!user?.id) return;

    // İlk yükleme
    loadUnreadMessages().then(count => setUnreadCount(count));

    // REAL-TIME: Sadece INSERT'leri dinle
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
        async () => {
          const newCount = await loadUnreadMessages();
          setUnreadCount(newCount);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, loadUnreadMessages]);

  return { unreadCount };
}