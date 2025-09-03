import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useUser } from '@/contexts/UserContext';
import { supabase } from '@/integrations/supabase/client';
import { useSounds } from '@/hooks/useSounds';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ArrowLeft, Users, MessageCircle, Hash, Home, Dot, Mail } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { GlobalChat } from '@/components/GlobalChat';
import { PrivateChat } from '@/components/PrivateChat';
import { UserAvatar } from '@/components/UserAvatar';
import { useChatNotifications } from '@/hooks/useChatNotifications';

type ViewMode = 'global' | 'users' | 'private-chat';

interface SelectedUser {
  id: string;
  username: string;
  avatar_url?: string;
}

export default function ChatPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { profile, onlineUsers, isUserOnline } = useUser();
  
  const { playSound } = useSounds();
  const [viewMode, setViewMode] = useState<ViewMode>('global');
  const [selectedUser, setSelectedUser] = useState<SelectedUser | null>(null);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [allUsers, setAllUsers] = useState<SelectedUser[]>([]);
  const [unreadCounts, setUnreadCounts] = useState<{[key: string]: number}>({});
  const { markAllAsRead, markPrivateMessagesAsRead } = useChatNotifications();

  // Fetch all users for private chat
  const fetchAllUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, username, email, avatar_url')
        .neq('id', user?.id)
        .order('username', { ascending: true })
        .limit(50);

      if (error) throw error;
      setAllUsers(data || []);
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  };

  // Fetch unread counts
  const fetchUnreadCounts = async () => {
    if (!user) return;
    try {
      // Basit bir yaklaşımla unread counts hesapla
      setUnreadCounts({}); // Şimdilik boş bırak
    } catch (error) {
      console.error('Error with unread counts:', error);
    }
  };



    // viewMode 'users' olduğunda da özel mesaj bildirimlerini temizle
  useEffect(() => {
    if (viewMode === 'users' && user?.id) {
      markPrivateMessagesAsRead();
    }
  }, [viewMode, user?.id]);

 useEffect(() => {
    // Chat sayfası açıldığında özel mesaj bildirimlerini temizle
    const markPrivateMessagesAsRead = async () => {
      if (!user?.id) return;

      try {
        // Okunmamış özel mesajları okundu olarak işaretle
        const { error } = await supabase
          .from('private_messages')
          .update({ is_read: true })
          .eq('recipient_id', user.id) // recipient_id kullan
          .eq('is_read', false);

        if (error) {
          console.error('Mesajlar okundu olarak işaretlenirken hata:', error);
        } else {
          console.log('✅ Özel mesajlar okundu olarak işaretlendi');
        }
      } catch (error) {
        console.error('Error marking messages as read:', error);
      }
    };

    markPrivateMessagesAsRead();
  }, [user?.id]);

 useEffect(() => {
    const markChatMessagesAsRead = async () => {
      if (!activeChatId || !user?.id) return;

      try {
        await supabase
          .from('private_messages')
          .update({ is_read: true })
          .eq('chat_id', activeChatId)
          .eq('recipient_id', user.id)
          .eq('is_read', false);

        console.log('✅ Chat mesajları okundu olarak işaretlendi:', activeChatId);
      } catch (error) {
        console.error('Chat mesajlarını işaretlerken hata:', error);
      }
    };

    if (viewMode === 'private-chat' && activeChatId) {
      markChatMessagesAsRead();
    }
  }, [viewMode, activeChatId, user?.id]);

  const handleBackToMenu = () => {
    playSound('buttonClick');
    navigate('/');
  };

  const handleViewChange = (mode: ViewMode) => {
    playSound('buttonClick');
    setViewMode(mode);
    if (mode !== 'private-chat') {
      setSelectedUser(null);
      setActiveChatId(null);
    }
  };

  const startPrivateChat = async (targetUser: SelectedUser) => {
    if (!user) return;

    try {
      playSound('buttonClick');
      
      // Create or find existing chat
      const participants = [user.id, targetUser.id].sort();
      const chatId = `chat_${participants.join('_')}`;

      // Check if chat already exists
      const { data: existingChat, error: chatError } = await supabase
        .from('private_chats')
        .select('*')
        .eq('id', chatId)
        .single();

      if (chatError && chatError.code !== 'PGRST116') {
        throw chatError;
      }

      // Create chat if it doesn't exist
      if (!existingChat) {
        const { error: createError } = await supabase
          .from('private_chats')
          .insert({
            id: chatId,
            user1_id: participants[0],
            user2_id: participants[1]
          });

        if (createError) throw createError;
      }

      setSelectedUser(targetUser);
      setActiveChatId(chatId);
      setViewMode('private-chat');
    } catch (error) {
      console.error('Error starting private chat:', error);
    }
  };

// ChatPage.tsx - renderUsersList fonksiyonunu güncelle
const renderUsersList = () => {

  return (
    <ScrollArea className="flex-1">
      <div className="p-4 space-y-3">
        {allUsers.map((targetUser) => {
          const unreadCount = unreadCounts[targetUser.id] || 0;
          
          return (
            <Card
              key={targetUser.id}
              className={`p-4 hover:shadow-md transition-all cursor-pointer border-2 ${
                unreadCount > 0 
                  ? 'border-chat-500 bg-chat-50' 
                  : 'border-chat-200'
              }`}
              onClick={() => startPrivateChat(targetUser)}
            >
              <div className="flex items-center space-x-3">
                <UserAvatar
                  src={targetUser.avatar_url}
                  alt={targetUser.username}
                  fallback={targetUser.username.charAt(0).toUpperCase()}
                  size="sm"
                  className={unreadCount > 0 ? 'ring-2 ring-chat-500' : ''}
                />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-800 truncate">
                    {targetUser.username}
                  </p>
                  {unreadCount > 0 ? (
                    <p className="text-sm text-chat-600 font-semibold">
                      {unreadCount} okunmamış mesaj
                    </p>
                  ) : (
                    <p className="text-sm text-gray-500">Özel mesaj gönder</p>
                  )}
                </div>
                <div className="flex items-center space-x-2">
                  {isUserOnline(targetUser.id) && (
                    <div className="w-2 h-2 bg-green-500 rounded-full" title="Çevrimiçi" />
                  )}
                  {unreadCount > 0 && (
                    <div className="w-6 h-6 bg-red-500 rounded-full flex items-center justify-center text-xs text-white font-bold">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </div>
                  )}
                  <Mail className="w-5 h-5 text-chat-500" />
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </ScrollArea>
  );
};

  const renderContent = () => {
    console.log('renderContent called, viewMode:', viewMode);
    
    if (viewMode === 'private-chat' && selectedUser && activeChatId) {
      return (
        <div className="h-full flex flex-col">
          {/* Private Chat Header */}
          <div className="flex items-center justify-between p-4 border-b border-border bg-chat-500 text-white">
            <div className="flex items-center space-x-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleViewChange('users')}
                className="p-2 hover:bg-chat-600 rounded-full text-white"
              >
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <UserAvatar
                src={selectedUser.avatar_url}
                alt={selectedUser.username}
                fallback={selectedUser.username?.charAt(0).toUpperCase()}
                size="sm"
              />
              <div className="flex-1 min-w-0">
                <h2 className="text-lg font-semibold truncate text-white">{selectedUser.username}</h2>
                <p className="text-sm text-chat-100">Özel Sohbet</p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleBackToMenu}
              className="p-2 hover:bg-chat-600 rounded-full flex-shrink-0 text-white"
            >
              <Home className="w-5 h-5" />
            </Button>
          </div>
          
          {/* Private Chat Content */}
          <div className="flex-1 min-h-0">
            <PrivateChat
              chatId={activeChatId}
              otherUser={selectedUser}
              onBack={() => handleViewChange('users')}
            />
          </div>
        </div>
      );
    }

    if (viewMode === 'users') {
      return (
        <div className="h-full flex flex-col">
          {/* Users List Header */}
          <div className="flex items-center justify-between p-4 border-b border-border bg-chat-500 text-white">
            <div className="flex items-center space-x-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleViewChange('global')}
                className="p-2 hover:bg-chat-600 rounded-full text-white"
              >
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <Users className="w-5 h-5" />
              <div>
                <h2 className="text-lg font-semibold">Özel Sohbet</h2>
                <p className="text-sm text-chat-100">
                  {onlineUsers.length} kişi çevrimiçi
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleBackToMenu}
              className="p-2 hover:bg-chat-600 rounded-full text-white"
            >
              <Home className="w-5 h-5" />
            </Button>
          </div>
          
          {/* Users List Content */}
          {renderUsersList()}
        </div>
      );
    }

    // Global chat - HEADER OLMADAN sadece content
    return (
      <div className="h-full flex flex-col">
        <div className="flex-1 min-h-0">
          <GlobalChat 
             isOpen={true} 
             onClose={() => {}} 
             isFullPage={true}
             onStartPrivateChat={startPrivateChat} />
        </div>
      </div>
    );
  };

  // BURASI ANA RETURN - fonksiyonun dışında olmalı
  return (
    <div className="min-h-screen bg-chat-50">
      {/* Safe area top */}
      <div className="safe-area-top"></div>
      
      <div className="h-screen flex flex-col max-w-4xl mx-auto bg-white rounded-lg shadow-lg m-4 overflow-hidden border border-chat-200">
        {/* ANA HEADER - SADCE viewMode 'global' İKEN GÖSTERME */}
        {viewMode === 'global' && (
          <div className="bg-chat-500 text-white p-4 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleBackToMenu}
                className="p-2 hover:bg-chat-600 rounded-full text-white"
              >
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <div>

                    <h1 className="text-xl font-bold font-bungee tracking-wider uppercase bg-gradient-to-r from-primary via-purple-500 to-primary bg-clip-text text-transparent drop-shadow-lg"
                        style={{
                          textShadow: '1px 1px 0px hsl(var(--primary)), 2px 2px 0px rgba(0,0,0,0.3), 0 0 15px hsl(var(--primary) / 0.5)',
                          WebkitTextStroke: '0.5px hsl(var(--border))'
                        }}>
                      KELİMECİ sohbet
                    </h1>
                <p className="text-chat-100 text-sm">
                  {onlineUsers.length} kişi çevrimiçi
                </p>
              </div>
            </div>
            
            <div className="flex items-center space-x-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleViewChange('global')}
                className="p-2 rounded-full bg-chat-600 text-white"
              >
                <Hash className="w-5 h-5" />
              </Button>
              
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleViewChange('users')}
                className="p-2 rounded-full text-chat-100 hover:bg-chat-600"
              >
                <Users className="w-5 h-5" />
              </Button>
            </div>
          </div>
        )}

        {/* Content Area */}
        <div className="flex-1 min-h-0">
          {renderContent()}
        </div>
      </div>
      
      {/* Safe area bottom */}
      <div className="safe-area-bottom"></div>
    </div>
  );
}
