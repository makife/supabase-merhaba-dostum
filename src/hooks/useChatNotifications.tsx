// useChatNotifications.tsx - TAM ÇALIŞAN VERSİYON
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

export function useChatNotifications() {
  const { user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);

  const loadUnreadMessages = useCallback(async () => {
    if (!user?.id) return;

    try {
      // KESİN ÇÖZÜM: recipient_id ve is_read kontrolü
      const { count, error } = await supabase
        .from('private_messages')
        .select('*', { count: 'exact' })
        .eq('recipient_id', user.id)
        .eq('is_read', false);

      if (error) {
        console.error('Unread count error:', error);
        return;
      }

      console.log('📊 Unread messages count:', count);
      setUnreadCount(count || 0);
    } catch (error) {
      console.error('Error loading unread messages:', error);
    }
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) return;

    loadUnreadMessages();

    // ✅ DOĞRU REAL-TIME FIX: chat_id filter yerine recipient_id
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
          console.log('🔔 New message notification:', payload);
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
      .subscribe((status) => {
        console.log('🔔 Notification channel status:', status);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, loadUnreadMessages]);

  return { unreadCount, refreshUnreadCounts: loadUnreadMessages };
}