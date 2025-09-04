import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

export function useChatNotifications() {
  const { user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);

  const loadUnreadMessages = useCallback(async () => {
    if (!user?.id) return;

    try {
      const { count, error } = await supabase
        .from('private_messages')
        .select('*', { count: 'exact' })
        .eq('recipient_id', user.id)
        .eq('is_read', false);

      if (error) {
        console.error('Unread count error:', error);
        return;
      }

      setUnreadCount(count || 0);
    } catch (error) {
      console.error('Error loading unread messages:', error);
    }
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

    loadUnreadMessages();

    const channel = supabase
      .channel(`private-messages-notifications-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'private_messages',
          filter: `recipient_id=eq.${user.id}`
        },
        (payload) => {
          if (payload.new.is_read === false) {
            setUnreadCount(prev => prev + 1);
          }
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
        (payload) => {
          if (payload.new.is_read === true) {
            setUnreadCount(prev => Math.max(0, prev - 1));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, loadUnreadMessages]);

  return { 
    unreadCount, 
    refreshUnreadCounts: loadUnreadMessages,
    markAllAsRead,
    markPrivateMessagesAsRead
  };
}