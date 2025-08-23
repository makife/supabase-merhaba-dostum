// hooks/useChatNotifications.ts
import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

// hooks/useChatNotifications.ts - Basitleştirilmiş
export function useChatNotifications() {
  const { user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchUnreadCount = async () => {
    if (!user) return;
    // Şimdilik sabit değer döndür
    setUnreadCount(0);
  };

  useEffect(() => {
    if (user) {
      fetchUnreadCount();
    }
  }, [user]);

  return { unreadCount, fetchUnreadCount };
}
