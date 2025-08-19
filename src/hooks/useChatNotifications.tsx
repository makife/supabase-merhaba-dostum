import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

interface ChatNotification {
  id: string;
  type: 'mention' | 'private_message';
  message: string;
  sender: string;
  timestamp: string;
  read: boolean;
}

export function useChatNotifications() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<ChatNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!user?.id) return;

    // Set up realtime subscription for global chat mentions
    const globalChatChannel = supabase
      .channel(`chat-notifications-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'global_chat'
        },
        (payload) => {
          const newMessage = payload.new as any;
          
          // Check if user is mentioned (exclude own messages)
          if (newMessage.user_id !== user.id && newMessage.message) {
            const username = user.user_metadata?.username || user.email?.split('@')[0] || 'Anonim';
            const isMentioned = newMessage.message.toLowerCase().includes(`@${username.toLowerCase()}`);
            
            if (isMentioned) {
              const notification: ChatNotification = {
                id: `mention-${newMessage.id}`,
                type: 'mention',
                message: `@${newMessage.username} sizi bahsetti: "${newMessage.message}"`,
                sender: newMessage.username,
                timestamp: newMessage.created_at,
                read: false
              };
              
              setNotifications(prev => [notification, ...prev.slice(0, 9)]); // Keep last 10
              setUnreadCount(prev => prev + 1);
            }
          }
        }
      )
      .subscribe();

    // Set up realtime subscription for private messages
    const privateChatChannel = supabase
      .channel(`private-notifications-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'private_messages'
        },
        (payload) => {
          const newMessage = payload.new as any;
          
          // Check if message is for current user (exclude own messages)
          if (newMessage.sender_id !== user.id) {
            // We need to check if this message is in a chat where current user is participant
            checkPrivateMessageForUser(newMessage);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(globalChatChannel);
      supabase.removeChannel(privateChatChannel);
    };
  }, [user?.id]);

  const checkPrivateMessageForUser = async (message: any) => {
    try {
      const { data: chat, error } = await supabase
        .from('private_chats')
        .select('user1_id, user2_id')
        .eq('id', message.chat_id)
        .single();

      if (error || !chat) return;

      // Check if current user is part of this chat
      if (chat.user1_id === user?.id || chat.user2_id === user?.id) {
        // Get sender username
        const { data: senderProfile } = await supabase
          .from('profiles')
          .select('username')
          .eq('id', message.sender_id)
          .single();

        const senderName = senderProfile?.username || 'Bilinmeyen Kullanıcı';
        
        const notification: ChatNotification = {
          id: `private-${message.id}`,
          type: 'private_message',
          message: `${senderName} size özel mesaj gönderdi: "${message.message}"`,
          sender: senderName,
          timestamp: message.created_at,
          read: false
        };
        
        setNotifications(prev => [notification, ...prev.slice(0, 9)]); // Keep last 10
        setUnreadCount(prev => prev + 1);
      }
    } catch (error) {
      console.error('Error checking private message:', error);
    }
  };

  const markAsRead = (notificationId: string) => {
    setNotifications(prev => 
      prev.map(n => 
        n.id === notificationId ? { ...n, read: true } : n
      )
    );
    setUnreadCount(prev => Math.max(0, prev - 1));
  };

  const markAllAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    setUnreadCount(0);
  };

  const clearNotifications = () => {
    setNotifications([]);
    setUnreadCount(0);
  };

  return {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    clearNotifications
  };
}