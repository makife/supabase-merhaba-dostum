// useChatNotifications.tsx - TAM ÇALIŞAN VERSİYON
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

export function useChatNotifications() {
  const { user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const [mentionCount, setMentionCount] = useState(0);
  const [privateMessageCount, setPrivateMessageCount] = useState(0);

  // Okunmamış mesajları yükleme fonksiyonu
const loadUnreadMessages = useCallback(async () => {
  if (!user?.id) return;

  try {
    console.log('🔄 Loading unread messages for user:', user.id);
    
    // Özel mesajlar - ARTIK DOĞRU recipient_id ile
    const { data: unreadPrivateMessages, error: privateError } = await supabase
      .from('private_messages')
      .select('id')
      .eq('recipient_id', user.id) // ✅ Artık doğru kullanıcı
      .eq('is_read', false);

    if (privateError) {
      console.error('Private messages fetch error:', privateError);
      return;
    }
    
    const privateCount = unreadPrivateMessages?.length || 0;
    setPrivateMessageCount(privateCount);

    // Mention'lar
    const { data: unreadMentions, error: mentionError } = await supabase
      .from('notifications')
      .select('id')
      .eq('user_id', user.id)
      .eq('is_read', false)
      .eq('type', 'mention');

    if (mentionError) {
      console.warn('Mention notifications fetch error:', mentionError);
      setMentionCount(0);
    } else {
      const mentionCountNum = unreadMentions?.length || 0;
      setMentionCount(mentionCountNum);
    }

    const totalCount = privateCount + (unreadMentions?.length || 0);
    setUnreadCount(totalCount);
    
    console.log(`📊 Unread counts - Total: ${totalCount}, Private: ${privateCount}, Mention: ${unreadMentions?.length || 0}`);

  } catch (error) {
    console.error('Error loading unread messages:', error);
  }
}, [user?.id]);

  // Real-time subscription için useEffect
  useEffect(() => {
    if (!user?.id) return;

    // İlk yükleme
    loadUnreadMessages();

    // Private messages real-time subscription
    const privateMessagesChannel = supabase
      .channel(`private-messages-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'private_messages',
          filter: `recipient_id=eq.${user.id}`
        },
        (payload) => {
          console.log('➕ New private message:', payload);
          loadUnreadMessages(); // Hemen güncelle
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
          console.log('✏️ Private message updated:', payload);
          loadUnreadMessages(); // Hemen güncelle
        }
      )
      .subscribe();

    // Notifications real-time subscription
    const mentionsChannel = supabase
      .channel(`mentions-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          console.log('➕ New notification:', payload);
          loadUnreadMessages(); // Hemen güncelle
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          console.log('✏️ Notification updated:', payload);
          loadUnreadMessages(); // Hemen güncelle
        }
      )
      .subscribe();

    // Clean up
    return () => {
      console.log('🧹 Cleaning up chat notifications');
      supabase.removeChannel(privateMessagesChannel);
      supabase.removeChannel(mentionsChannel);
    };
  }, [user?.id, loadUnreadMessages]);

  // Belirli türdeki bildirimleri sıfırlama
  const markPrivateMessagesAsRead = async () => {
    if (!user?.id) return;
    
    try {
      const { error } = await supabase
        .from('private_messages')
        .update({ is_read: true })
        .eq('recipient_id', user.id)
        .eq('is_read', false);
      
      if (error) {
        console.error('Error marking private messages as read:', error);
        return;
      }
      
      // Hemen güncelle
      await loadUnreadMessages();
      console.log('✅ Private messages marked as read');
    } catch (error) {
      console.error('Error marking private messages:', error);
    }
  };

  const markMentionsAsRead = async () => {
    if (!user?.id) return;
    
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', user.id)
        .eq('is_read', false)
        .eq('type', 'mention');
      
      if (error) {
        console.error('Error marking mentions as read:', error);
        return;
      }
      
      // Hemen güncelle
      await loadUnreadMessages();
      console.log('✅ Mentions marked as read');
    } catch (error) {
      console.error('Error marking mentions:', error);
    }
  };

  // Tümünü sıfırlama fonksiyonu
  const markAllAsRead = async () => {
    await markPrivateMessagesAsRead();
    await markMentionsAsRead();
  };

  return { 
    unreadCount,
    mentionCount,
    privateMessageCount,
    markAllAsRead,
    markPrivateMessagesAsRead,
    markMentionsAsRead,
    refreshUnreadCounts: loadUnreadMessages // Manuel refresh için
  };
}