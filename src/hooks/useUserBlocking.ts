import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface BlockedUser {
  id: string;
  blocker_id: string;
  blocked_id: string;
  created_at: string;
  reason?: string;
  blocked_user?: {
    id: string;
    username: string;
    avatar_url?: string;
  };
}

export function useUserBlocking() {
  const { user } = useAuth();
  const [blockedUsers, setBlockedUsers] = useState<Set<string>>(new Set());
  const [blockedByUsers, setBlockedByUsers] = useState<Set<string>>(new Set());

  // Engellenen kullanıcıları yükle
  const loadBlockedUsers = async () => {
    if (!user?.id) return;

    try {
      // Benim engellediğim kullanıcılar
      const { data: blocked } = await supabase
        .from('user_blocks')
        .select('blocked_id')
        .eq('blocker_id', user.id);

      // Beni engelleyen kullanıcılar
      const { data: blockedBy } = await supabase
        .from('user_blocks')
        .select('blocker_id')
        .eq('blocked_id', user.id);

      setBlockedUsers(new Set(blocked?.map(b => b.blocked_id) || []));
      setBlockedByUsers(new Set(blockedBy?.map(b => b.blocker_id) || []));

    } catch (error) {
      console.error('Error loading blocked users:', error);
    }
  };

  // Kullanıcıyı engelle
  const blockUser = async (targetUserId: string, reason?: string) => {
    if (!user?.id || targetUserId === user.id) return false;

    try {
      const { error } = await supabase
        .from('user_blocks')
        .insert({
          blocker_id: user.id,
          blocked_id: targetUserId,
          reason: reason
        });

      if (error) {
        if (error.code === '23505') { // Duplicate key
          toast.info('Bu kullanıcı zaten engellenmiş');
          return false;
        }
        throw error;
      }

      setBlockedUsers(prev => new Set([...prev, targetUserId]));
      toast.success('Kullanıcı engellendi');
      return true;

    } catch (error) {
      console.error('Error blocking user:', error);
      toast.error('Kullanıcı engellenirken hata oluştu');
      return false;
    }
  };

  // Kullanıcının engelini kaldır
  const unblockUser = async (targetUserId: string) => {
    if (!user?.id) return false;

    try {
      const { error } = await supabase
        .from('user_blocks')
        .delete()
        .eq('blocker_id', user.id)
        .eq('blocked_id', targetUserId);

      if (error) throw error;

      setBlockedUsers(prev => {
        const newSet = new Set(prev);
        newSet.delete(targetUserId);
        return newSet;
      });

      toast.success('Kullanıcının engeli kaldırıldı');
      return true;

    } catch (error) {
      console.error('Error unblocking user:', error);
      toast.error('Engel kaldırılırken hata oluştu');
      return false;
    }
  };

  // Kullanıcı engellenmiş mi kontrol et
  const isUserBlocked = (targetUserId: string) => {
    return blockedUsers.has(targetUserId);
  };

  // Beni engelleyen kullanıcı mı kontrol et
  const isBlockedByUser = (targetUserId: string) => {
    return blockedByUsers.has(targetUserId);
  };

  // Mesajlaşma engellenmiş mi kontrol et
  const isMessagingBlocked = (targetUserId: string) => {
    return isUserBlocked(targetUserId) || isBlockedByUser(targetUserId);
  };

  // Engellenen kullanıcı listesi getir
  const getBlockedUsersList = async () => {
    if (!user?.id) return [];

    try {
      const { data } = await supabase
        .from('user_blocks')
        .select(`
          *,
          blocked_user:profiles!user_blocks_blocked_id_fkey (
            id,
            username,
            avatar_url
          )
        `)
        .eq('blocker_id', user.id)
        .order('created_at', { ascending: false });

      return data || [];

    } catch (error) {
      console.error('Error fetching blocked users list:', error);
      return [];
    }
  };

  useEffect(() => {
    loadBlockedUsers();
  }, [user?.id]);

  return {
    blockedUsers,
    blockedByUsers,
    blockUser,
    unblockUser,
    isUserBlocked,
    isBlockedByUser,
    isMessagingBlocked,
    getBlockedUsersList,
    loadBlockedUsers
  };
}
