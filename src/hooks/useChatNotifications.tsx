// useChatNotifications.tsx - Geliştirilmiş versiyon (mevcut dosyanın yerine)
import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

export function useChatNotifications() {
  const { user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const [mentionCount, setMentionCount] = useState(0);
  const [privateMessageCount, setPrivateMessageCount] = useState(0);

  useEffect(() => {
    if (!user?.id) return;

    // Mevcut okunmamış mesajları yükle
    const loadUnreadMessages = async () => {
      try {
        // Özel mesajlar - recipient_id kullan
        const { data: unreadPrivateMessages, error: privateError } = await supabase
          .from('private_messages')
          .select('id')
          .eq('recipient_id', user.id) // recipient_id kullanıyoruz artık
          .eq('is_read', false);

        if (privateError) {
          console.error('Private messages fetch error:', privateError);
        }
        
        const privateCount = unreadPrivateMessages?.length || 0;
        setPrivateMessageCount(privateCount);

        // Mention'lar (notifications tablosundan)
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
        
        console.log(`📬 Okunmamış mesaj sayısı: ${totalCount} (Özel: ${privateCount}, Mention: ${unreadMentions?.length || 0})`);
      } catch (error) {
        console.error('Okunmamış mesajlar yüklenirken hata:', error);
      }
    };

    loadUnreadMessages();

    // Real-time subscription for new private messages
    const privateMessagesChannel = supabase
      .channel(`private-messages-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'private_messages',
          filter: `recipient_id=eq.${user.id}` // recipient_id kullanıyoruz
        },
        (payload) => {
          console.log('📨 Yeni özel mesaj geldi:', payload);
          const newMessage = payload.new as any;
          
          // Kendi mesajımızı ignore et
          if (newMessage.sender_id !== user.id) {
            setPrivateMessageCount(prev => prev + 1);
            setUnreadCount(prev => prev + 1);
            console.log('🔔 Özel mesaj bildirim sayısı artırıldı');
          }
        }
      )
      .subscribe();

    // Real-time subscription for mentions (notifications tablosu)
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
          console.log('📨 Yeni bildirim geldi:', payload);
          const notification = payload.new as any;
          
          if (notification.type === 'mention') {
            setMentionCount(prev => prev + 1);
            setUnreadCount(prev => prev + 1);
            console.log('🔔 Mention bildirim sayısı artırıldı');
          }
        }
      )
      .subscribe();

    // Clean up function
    return () => {
      console.log('🧹 Chat notifications temizleniyor');
      supabase.removeChannel(privateMessagesChannel);
      supabase.removeChannel(mentionsChannel);
    };
  }, [user?.id]);

  // Belirli türdeki bildirimleri sıfırlama
  const markPrivateMessagesAsRead = async () => {
    if (!user?.id) return;
    
    try {
      await supabase
        .from('private_messages')
        .update({ is_read: true })
        .eq('recipient_id', user.id) // recipient_id kullan
        .eq('is_read', false);
      
      setUnreadCount(prev => prev - privateMessageCount);
      setPrivateMessageCount(0);
      console.log('✅ Özel mesajlar okundu olarak işaretlendi');
    } catch (error) {
      console.error('Özel mesajları işaretlerken hata:', error);
    }
  };

  const markMentionsAsRead = async () => {
    if (!user?.id) return;
    
    try {
      await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', user.id)
        .eq('is_read', false)
        .eq('type', 'mention');
      
      setUnreadCount(prev => prev - mentionCount);
      setMentionCount(0);
      console.log('✅ Mention'lar okundu olarak işaretlendi');
    } catch (error) {
      console.error('Mention'ları işaretlerken hata:', error);
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
    markMentionsAsRead
  };
}