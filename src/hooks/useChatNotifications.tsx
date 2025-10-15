import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useUser } from '@/contexts/UserContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';

export function useChatNotifications() {
  const { user } = useAuth();
  const { profile } = useUser();
  const navigate = useNavigate();
  const [unreadCount, setUnreadCount] = useState(0);
  const [globalMentionCount, setGlobalMentionCount] = useState(0);

  const loadUnreadMessages = async () => {
    if (!user?.id) return 0;
    
    try {
      const { count } = await supabase
        .from('private_messages')
        .select('*', { count: 'exact' })
        .eq('recipient_id', user.id)
        .eq('is_read', false);

      return count || 0;
    } catch (error) {
      console.error('Error loading unread messages:', error);
      return 0;
    }
  };

  const loadGlobalMentions = async () => {
    if (!user?.id || !profile?.username) return 0;
    
    try {
      // notifications tablosundan mention bildirimlerini kontrol et
      const { data } = await supabase
        .from('notifications')
        .select('id')
        .eq('user_id', user.id)
        .eq('type', 'mention')
        .eq('is_read', false);

      return data?.length || 0;
    } catch (error) {
      console.error('Error loading global mentions:', error);
      return 0;
    }
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
    await markGlobalMessagesAsRead();
    setGlobalMentionCount(0);
  };

  const markGlobalMessagesAsRead = async () => {
    if (!user?.id) return;
    
    // Mention notification'larını read olarak işaretle
    await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', user.id)
      .eq('type', 'mention')
      .eq('is_read', false);
      
    // Global chat mention sayacını sıfırla
    setGlobalMentionCount(0);
  };

  const refreshUnreadCounts = async () => {
    const privateCount = await loadUnreadMessages();
    const mentionCount = await loadGlobalMentions();
    setUnreadCount(privateCount);
    setGlobalMentionCount(mentionCount);
  };

  // Rematch davetini kabul et
  const acceptRematch = async (roomCode?: string | null) => {
    if (!user?.id || !roomCode) return;
    try {
      const { data: req } = await supabase
        .from('rematch_requests')
        .select('id, game_type')
        .eq('room_code', roomCode)
        .eq('to_user_id', user.id)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!req) {
        toast({ title: 'İstek bulunamadı', duration: 2500, variant: 'destructive' as any });
        return;
      }

      await supabase
        .from('rematch_requests')
        .update({ status: 'accepted', responded_at: new Date().toISOString() })
        .eq('id', req.id);

      const { data: room } = await supabase
        .from('game_rooms')
        .select('id, game_mode')
        .eq('room_code', roomCode)
        .single();

      if (room) {
        const baseRoute = room.game_mode?.includes('random-match') ? '/game/random-match' : '/game/private-room';
        navigate(`${baseRoute}?room=${room.id}&type=${req.game_type}`);
      }
    } catch (e) {
      console.error('acceptRematch error:', e);
    }
  };

  // Rematch davetini reddet
  const rejectRematch = async (roomCode?: string | null) => {
    if (!user?.id || !roomCode) return;
    try {
      const { data: req } = await supabase
        .from('rematch_requests')
        .select('id')
        .eq('room_code', roomCode)
        .eq('to_user_id', user.id)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!req) return;

      await supabase
        .from('rematch_requests')
        .update({ status: 'rejected', responded_at: new Date().toISOString() })
        .eq('id', req.id);

      toast({ title: 'İstek reddedildi', duration: 2000 });
    } catch (e) {
      console.error('rejectRematch error:', e);
    }
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
          table: 'notifications',
          filter: `user_id=eq.${user.id}`
        },
(payload) => {
          const notif: any = payload.new;
          if (!notif) return;
          if (notif.type === 'mention') {
            refreshUnreadCounts();
          } else if (notif.type === 'invite') {
            // Rematch veya oyun daveti bildirimi için kullanıcıya toast göster
            try {
              toast({
                title: '🎮 Tekrar Oyun İsteği',
                description: notif.message || 'Rakibiniz tekrar oyun istiyor!',
                duration: 10000,
                action: (
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => acceptRematch(notif.related_id)}>Kabul</Button>
                    <Button size="sm" variant="outline" onClick={() => rejectRematch(notif.related_id)}>Reddet</Button>
                  </div>
                ) as any,
              });
            } catch (e) {
              console.warn('Toast show failed:', e);
            }
          }
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
    markGlobalMessagesAsRead,
    refreshUnreadCounts
  };
}