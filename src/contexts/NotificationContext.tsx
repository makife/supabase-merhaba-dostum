import { createContext, useContext, ReactNode, useEffect } from 'react';
import { useChatNotifications } from '@/hooks/useChatNotifications';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { PushNotifications } from '@capacitor/push-notifications';
import { Capacitor } from '@capacitor/core';

interface NotificationContextType {
  unreadCount: number;
  markAsRead: (notificationId: string) => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};

interface NotificationProviderProps {
  children: ReactNode;
}

export const NotificationProvider = ({ children }: NotificationProviderProps) => {
  const { unreadCount } = useChatNotifications();
  const { user } = useAuth();

  // 🔔 1️⃣ Uygulama açılırken bildirim iznini iste
  useEffect(() => {
    const registerNotifications = async () => {
      if (Capacitor.getPlatform() === 'android') {
        try {
          const permission = await PushNotifications.requestPermissions();
          if (permission.receive === 'granted') {
            await PushNotifications.register();
            console.log('Bildirim izni verildi ✅');
          } else {
            console.warn('Bildirim izni reddedildi ❌');
          }
        } catch (err) {
          console.error('Bildirim izni alınırken hata:', err);
        }
      }
    };

    registerNotifications();
  }, []);

  // 🔔 2️⃣ Supabase bildirimleri dinle
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('badge-notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          const notification = payload.new as any;
          if (notification.type === 'badge_earned') {
            toast.success(notification.message, {
              duration: 5000,
              icon: '🏆'
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const markAsRead = async (notificationId: string) => {
    try {
      await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', notificationId);
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  return (
    <NotificationContext.Provider value={{ unreadCount, markAsRead }}>
      {children}
    </NotificationContext.Provider>
  );
};
