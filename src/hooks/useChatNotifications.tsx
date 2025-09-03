// 1. useChatNotifications.tsx - Interval'ı kaldır
import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

export function useChatNotifications() {
  const { user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const [mentionCount, setMentionCount] = useState(0);
  const [privateMessageCount, setPrivateMessageCount] = useState(0);

  // Gerçek zamanlı count kontrol fonksiyonu - INTERVAL KALDIRILDI
  const refreshUnreadCounts = async () => {
    if (!user?.id) return;

    try {
      const { data: unreadMessages } = await supabase
        .from('private_messages')
        .select('id')
        .eq('recipient_id', user.id)
        .eq('is_read', false);

      const actualCount = unreadMessages?.length || 0;
      
      console.log('🔄 Refreshing unread count:', actualCount);
      
      setPrivateMessageCount(actualCount);
      setUnreadCount(actualCount);
      setMentionCount(0);

    } catch (error) {
      console.error('Error refreshing unread counts:', error);
    }
  };

  useEffect(() => {
    if (!user?.id) return;

    // İlk yüklemede count'ları al
    refreshUnreadCounts();

    // INTERVAL KALDIRILDI - sadece real-time events

    // Real-time subscription for new messages
    const insertChannel = supabase
      .channel(`unread-insert-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'private_messages',
          filter: `recipient_id=eq.${user.id}`
        },
        (payload) => {
          console.log('📨 New message received');
          const newMessage = payload.new as any;
          
          if (newMessage.sender_id !== user.id) {
            setPrivateMessageCount(prev => prev + 1);
            setUnreadCount(prev => prev + 1);
          }
        }
      )
      .subscribe();

    // Real-time subscription for message updates (read status)
    const updateChannel = supabase
      .channel(`unread-update-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'private_messages',
          filter: `recipient_id=eq.${user.id}`
        },
        (payload) => {
          console.log('📝 Message updated (read)');
          const oldMessage = payload.old as any;
          const newMessage = payload.new as any;
          
          if (oldMessage.is_read === false && newMessage.is_read === true) {
            setPrivateMessageCount(prev => Math.max(0, prev - 1));
            setUnreadCount(prev => Math.max(0, prev - 1));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(insertChannel);
      supabase.removeChannel(updateChannel);
      console.log('🧹 Notification channels cleaned up');
    };
  }, [user?.id]);

  // Manuel olarak tüm mesajları okundu işaretle - SADECE DATABASE UPDATE
  const markAllAsRead = async () => {
    if (!user?.id) return false;
    
    try {
      const { error } = await supabase
        .from('private_messages')
        .update({ is_read: true })
        .eq('recipient_id', user.id)
        .eq('is_read', false);

      if (error) throw error;

      // Count'ları direkt sıfırla - real-time update gelene kadar
      setPrivateMessageCount(0);
      setUnreadCount(0);
      setMentionCount(0);
      
      console.log('✅ All messages marked as read, counts reset');
      return true;
    } catch (error) {
      console.error('❌ Error marking all as read:', error);
      return false;
    }
  };

  return { 
    unreadCount,
    mentionCount,
    privateMessageCount,
    markAllAsRead,
    forceRefresh: refreshUnreadCounts // Sadece manuel çağrı için
  };
}