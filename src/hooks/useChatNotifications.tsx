import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

export function useChatNotifications() {
  const { user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!user?.id) return;

    // Mevcut okunmamış mesajları yükle
    const loadUnreadMessages = async () => {
      try {
        const { data: unreadPrivateMessages, error } = await supabase
          .from('private_messages')
          .select('id')
          .eq('recipient_id', user.id)
          .eq('is_read', false);

        if (error) throw error;
        
        const count = unreadPrivateMessages?.length || 0;
        setUnreadCount(count);
        console.log(`📬 Okunmamış mesaj sayısı: ${count}`);
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
          filter: `recipient_id=eq.${user.id}`
        },
        (payload) => {
          console.log('📨 Yeni özel mesaj geldi:', payload);
          const newMessage = payload.new as any;
          
          // Kendi mesajımızı ignore et
          if (newMessage.sender_id !== user.id) {
            setUnreadCount(prev => prev + 1);
            console.log('🔔 Bildirim sayısı artırıldı');
          }
        }
      )
      .subscribe();

    // Clean up function
    return () => {
      console.log('🧹 Chat notifications temizleniyor');
      supabase.removeChannel(privateMessagesChannel);
    };
  }, [user?.id]);

  // Bildirim sayısını sıfırlama fonksiyonu
  const markAllAsRead = async () => {
    if (!user?.id) return;
    
    try {
      await supabase
        .from('private_messages')
        .update({ is_read: true })
        .eq('recipient_id', user.id)
        .eq('is_read', false);
      
      setUnreadCount(0);
      console.log('✅ Tüm mesajlar okundu olarak işaretlendi');
    } catch (error) {
      console.error('Mesajları işaretlerken hata:', error);
    }
  };

  return { 
    unreadCount,
    markAllAsRead
  };

}