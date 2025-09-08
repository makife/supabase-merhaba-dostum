import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useUser } from '@/contexts/UserContext';
import { supabase } from '@/integrations/supabase/client';

export function useChatNotifications() {
  const { user } = useAuth();
  const { profile } = useUser();
  const [unreadCount, setUnreadCount] = useState(0);
  const [globalMentionCount, setGlobalMentionCount] = useState(0);

  const loadUnreadMessages = async () => {
    if (!user?.id) return 0;
    
    const { count, error } = await (supabase as any)
      .from('private_messages')
      .select('*', { count: 'exact' })
      .eq('recipient_id', user.id)
      .eq('is_read', false);

    return count || 0;
  };

  const loadGlobalMentions = async () => {
    if (!user?.id || !profile?.username) return 0;
    
    const { data, error } = await (supabase as any)
      .from('global_messages')
      .select('id')
      .ilike('message', `%@${profile.username}%`)
      .eq('is_read', false);

    return data?.length || 0;
  };

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
    const privateCount = await loadUnreadMessages();
    const mentionCount = await loadGlobalMentions();
    setUnreadCount(privateCount);
    setGlobalMentionCount(mentionCount);
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
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'global_messages'
        },
        refreshUnreadCounts
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, profile?.username]);

  const totalNotifications = unreadCount + globalMentionCount;

  return { 
    unreadCount, 
    globalMentionCount,
    totalNotifications,
    markAllAsRead,
    markPrivateMessagesAsRead,
    refreshUnreadCounts
  };
}