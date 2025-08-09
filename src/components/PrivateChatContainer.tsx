import { useState } from 'react';
import { UsersList } from '@/components/UsersList';
import { PrivateChat } from '@/components/PrivateChat';

interface User {
  id: string;
  username: string;
  avatar_url?: string;
  email: string;
}

interface PrivateChatContainerProps {
  isOpen: boolean;
  onClose: () => void;
}

export function PrivateChatContainer({ isOpen, onClose }: PrivateChatContainerProps) {
  const [currentView, setCurrentView] = useState<'users' | 'chat'>('users');
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [activeUser, setActiveUser] = useState<User | null>(null);

  const handleStartChat = (chatId: string, user: User) => {
    setActiveChatId(chatId);
    setActiveUser(user);
    setCurrentView('chat');
  };

  const handleBackToUsers = () => {
    setCurrentView('users');
    setActiveChatId(null);
    setActiveUser(null);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      {currentView === 'users' ? (
        <div className="relative">
          <UsersList onStartChat={handleStartChat} />
          <button
            onClick={onClose}
            className="absolute -top-2 -right-2 w-8 h-8 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center hover:bg-destructive/90 transition-colors"
          >
            ×
          </button>
        </div>
      ) : (
        currentView === 'chat' && activeChatId && activeUser && (
          <div className="relative">
            <PrivateChat
              chatId={activeChatId}
              otherUser={activeUser}
              onBack={handleBackToUsers}
            />
            <button
              onClick={onClose}
              className="absolute -top-2 -right-2 w-8 h-8 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center hover:bg-destructive/90 transition-colors"
            >
              ×
            </button>
          </div>
        )
      )}
    </div>
  );
}