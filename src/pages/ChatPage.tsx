import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useUser } from '@/contexts/UserContext';
import { supabase } from '@/integrations/supabase/client';
import { useSounds } from '@/hooks/useSounds';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ArrowLeft, Users, MessageCircle, Hash, Home, Mail } from 'lucide-react';
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
  const { markAllAsRead } = useChatNotifications();
  
  const [viewMode, setViewMode] = useState<ViewMode>('global');
  const [selectedUser, setSelectedUser] = useState<SelectedUser | null>(null);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [allUsers, setAllUsers] = useState<SelectedUser[]>([]);
  const [unreadCounts, setUnreadCounts] = useState<{[key: string]: number}>({});

  // Fetch all users for private chat
  const fetchAllUsers = async () => {
    try {
      const { data: allUsersData, error: usersError } = await supabase
        .from('profiles')
        .select('id, username, email, avatar_url')
        .neq('id', user?.id)
        .order('username', { ascending: true });

      if (usersError) {
        console.error('Users fetch error:', usersError);
        return;
      }

      // Chat history kontrol et
      const { data: chatHistoryData } = await supabase
        .from('private_messages')
        .select('sender_id, recipient_id, created_at')
        .or(`sender_id.eq.${user?.id},recipient_id.eq.${user?.id}`)
        .order('created_at', { ascending: false });

      // Chat history olan kullanıcıları önce sırala
      const chatUserIds = new Set<string>();
      chatHistoryData?.forEach(msg => {
        if (msg.sender_id !== user?.id) chatUserIds.add(msg.sender_id);
        if (msg.recipient_id !== user?.id) chatUserIds.add(msg.recipient_id);
      });

      const sortedUsers = allUsersData?.sort((a, b) => {
        const aHasHistory = chatUserIds.has(a.id);
        const bHasHistory = chatUserIds.has(b.id);
        
        if (aHasHistory && !bHasHistory) return -1;
        if (!aHasHistory && bHasHistory) return 1;
        return a.username.localeCompare(b.username, 'tr');
      }) || [];

      setAllUsers(sortedUsers);
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  };

  // Fetch unread counts - basitleştirilmiş versiyon
  const fetchUnreadCounts = async () => {
    if (!user) return;
    
    try {
      const { data: unreadMessages, error } = await supabase
        .from('private_messages')
        .select('sender_id')
        .eq('recipient_id', user.id)
        .eq('is_read', false);

      if (error) {
        console.error('Unread count fetch error:', error);
        setUnreadCounts({});
        return;
      }

      const counts: {[key: string]: number} = {};
      unreadMessages?.forEach((msg) => {
        if (msg.sender_id) {
          counts[msg.sender_id] = (counts[msg.sender_id] || 0) + 1;
        }
      });

      setUnreadCounts(counts);
    } catch (error) {
      console.error('fetchUnreadCounts error:', error);
      setUnreadCounts({});
    }
  };

  // 1. Component mount - tüm mesajları okundu işaretle
  useEffect(() => {
    const initializePage = async () => {
      if (!user?.id) return;

      try {
        console.log('📄 ChatPage initializing...');
        
        // Tüm okunmamış mesajları okundu işaretle
        await supabase
          .from('private_messages')
          .update({ is_read: true })
          .eq('recipient_id', user.id)
          .eq('is_read', false);

        // Hook'taki count'ları sıfırla
        await markAllAsRead();
        
        // Local count'ları sıfırla
        setUnreadCounts({});
        
        console.log('✅ ChatPage initialization complete');
      } catch (error) {
        console.error('❌ ChatPage initialization error:', error);
      }
    };

    initializePage();
  }, [user?.id, markAllAsRead]);

  // 2. ViewMode değiştiğinde
  useEffect(() => {
    if (viewMode === 'users') {
      fetchAllUsers();
      fetchUnreadCounts();
    }
  }, [viewMode, user]);

  // 3. Private chat'e girdiğinde
  useEffect(() => {
    const markChatAsRead = async () => {
      if (!activeChatId || !user?.id || viewMode !== 'private-chat') return;

      try {
        await supabase
          .from('private_messages')
          .update({ is_read: true })
          .eq('chat_id', activeChatId)
          .eq('recipient_id', user.id)
          .eq('is_read', false);

        // Count'ları güncelle
        setTimeout(() => {
          fetchUnreadCounts();
          forceRefresh();
        }, 500);
      } catch (error) {
        console.error('❌ Error marking chat as read:', error);
      }
    };

    markChatAsRead();
  }, [viewMode, activeChatId, user?.id, forceRefresh]);

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
      
      const participants = [user.id, targetUser.id].sort();
      const chatId = `chat_${participants.join('_')}`;

      // Chat oluştur (varsa skip)
      const { data: existingChat, error: chatError } = await supabase
        .from('private_chats')
        .select('*')
        .eq('id', chatId)
        .single();

      if (chatError && chatError.code !== 'PGRST116') {
        throw chatError;
      }

      if (!existingChat) {
        await supabase
          .from('private_chats')
          .insert({
            id: chatId,
            user1_id: participants[0],
            user2_id: participants[1]
          });
      }

      setSelectedUser(targetUser);
      setActiveChatId(chatId);
      setViewMode('private-chat');
    } catch (error) {
      console.error('Error starting private chat:', error);
    }
  };

  // Render users list
  const renderUsersList = () => (
    <ScrollArea className="flex-1">
      <div className="p-4 space-y-3">
        {allUsers.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>Kullanıcılar yükleniyor...</p>
          </div>
        ) : (
          allUsers.map((targetUser) => {
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
                    className={`${unreadCount > 0 ? 'ring-2 ring-chat-500' : ''} border-2 ${
                      isUserOnline(targetUser.id) ? 'border-green-400' : 'border-gray-300'
                    }`}
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
          })
        )}
      </div>
    </ScrollArea>
  );

  const renderContent = () => {
    if (viewMode === 'private-chat' && selectedUser && activeChatId) {
      return (
        <div className="h-full flex flex-col">
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
          
          {renderUsersList()}
        </div>
      );
    }

    // Global chat
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

  return (
    <div className="min-h-screen bg-chat-50">
      <div className="safe-area-top"></div>
      
      <div className="h-screen flex flex-col max-w-4xl mx-auto bg-white rounded-lg shadow-lg m-4 overflow-hidden border border-chat-200">
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

        <div className="flex-1 min-h-0">
          {renderContent()}
        </div>
      </div>
      
      <div className="safe-area-bottom"></div>
    </div>
  );
}