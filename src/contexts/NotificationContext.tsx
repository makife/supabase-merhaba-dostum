// contexts/NotificationContext.tsx
import { createContext, useContext, ReactNode } from 'react';
import { useChatNotifications } from '@/hooks/useChatNotifications';

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
