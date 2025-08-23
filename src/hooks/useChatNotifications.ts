// hooks/useChatNotifications.ts - ÇALIŞAN EN BASİT VERSİYON
import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';

export function useChatNotifications() {
  const { user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);

  // Şimdilik sabit 0 döndür, sonra düzeltiriz
  useEffect(() => {
    setUnreadCount(0);
  }, [user]);

  return { unreadCount };
}