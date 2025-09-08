import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

export function useUserBlocking() {
  const { user } = useAuth();
  const [blockedUsers, setBlockedUsers] = useState<string[]>([]);

  // Engellenen kullanıcıları yükle
  useEffect(() => {
    if (!user?.id) return;

    const loadBlockedUsers = async () => {
      const { data, error } = await supabase
        .from('user_blocks')
        .select('blocked_id')
        .eq('blocker_id', user.id);

      if (!error && data) {
        setBlockedUsers(data.map(block => block.blocked_id));
      }
    };

    loadBlockedUsers();
  }, [user?.id]);

  const blockUser = async (userId: string, reason?: string) => {
    if (!user?.id || userId === user.id) return false;

    try {
      const { error } = await supabase
        .from('user_blocks')
        .insert({
          blocker_id: user.id,
          blocked_id: userId,
          reason: reason || 'Kullanıcı engellendi'
        });

      if (!error) {
        setBlockedUsers(prev => [...prev, userId]);
        return true;
      }
    } catch (error) {
      console.error('Error blocking user:', error);
    }
    return false;
  };

  const unblockUser = async (userId: string) => {
    if (!user?.id) return false;

    try {
      const { error } = await supabase
        .from('user_blocks')
        .delete()
        .eq('blocker_id', user.id)
        .eq('blocked_id', userId);

      if (!error) {
        setBlockedUsers(prev => prev.filter(id => id !== userId));
        return true;
      }
    } catch (error) {
      console.error('Error unblocking user:', error);
    }
    return false;
  };

  const isUserBlocked = (userId: string) => {
    return blockedUsers.includes(userId);
  };

  return {
    blockedUsers,
    blockUser,
    unblockUser,
    isUserBlocked
  };
}