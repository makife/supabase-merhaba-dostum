import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useUser } from '@/contexts/UserContext';
import { supabase } from '@/integrations/supabase/client';
import { useSounds } from '@/hooks/useSounds';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ArrowLeft, Users, MessageCircle, Hash, Home, Dot, Mail, UserX, UserCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { GlobalChat } from '@/components/GlobalChat';
import { PrivateChat } from '@/components/PrivateChat';
import { UserAvatar } from '@/components/UserAvatar';
import { SwipeToDeleteCard } from '@/components/SwipeToDeleteCard';
import { useChatNotifications } from '@/hooks/useChatNotifications';
import { useUserBlocking } from '@/hooks/useUserBlocking';
import { toast } from 'sonner';

type ViewMode = 'global' | 'users' | 'private-chat' | 'blocked-users';

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
  const { 
    unreadCount, 
    markAllAsRead, 
    markPrivateMessagesAsRead, 
    markGlobalMessagesAsRead,
    refreshUnreadCounts 
  } = useChatNotifications();
  const { blockedUsers, blockUser, unblockUser, isUserBlocked } = useUserBlocking();

  // Tüm fonksiyonlar aynı kalacak (kısaltıyorum)
  const fetchAllUsers = async () => {
    try {
      console.log('🔍 DEBUG: fetchAllUsers başladı, user.id:', user?.id);
      
      const { data: messages, error: messagesError } = await supabase
        .from('private_messages')
        .select('sender_id, recipient_id')
        .or(`sender_id.eq.${user?.id},recipient_id.eq.${user?.id}`)
        .not('sender_id', 'is', null)
        .not('recipient_id', 'is', null);

      if (messagesError) {
        console.error('🔍 DEBUG: Messages query error:', messagesError);
        return;
      }

      const userIDs = new Set<string>();
      messages?.forEach(msg => {
        if (msg.sender_id && msg.sender_id !== user?.id) {
          userIDs.add(msg.sender_id);
        }
        if (msg.recipient_id && msg.recipient_id !== user?.id) {
          userIDs.add(msg.recipient_id);
        }
      });

      if (userIDs.size === 0) {
        setAllUsers([]);
        return;
      }

      const validUserIDs = Array.from(userIDs).filter(id => {
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        return id && uuidRegex.test(id);
      });

      if (validUserIDs.length === 0) {
        setAllUsers([]);
        return;
      }

      const { data: users, error: usersError } = await supabase
        .from('profiles')
        .select('id, username, avatar_url')
        .in('id', validUserIDs);

      if (usersError) {
        console.error('🔍 DEBUG: Users query error:', usersError);
        return;
      }

      setAllUsers(users || []);
    } catch (error) {
      console.error('🔍 DEBUG: fetchAllUsers error:', error);
    }
  };

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
        const senderId = msg.sender_id;
        if (senderId) {
          counts[senderId] = (counts[senderId] || 0) + 1;
        }
      });

      setUnreadCounts(counts);
    } catch (error) {
      console.error('Error with unread counts:', error);
      setUnreadCounts({});
    }
  };

  useEffect(() => {
    if (viewMode === 'users' && user?.id) {
      fetchAllUsers();
      fetchUnreadCounts();
    }
  }, [viewMode, user?.id]);

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
    
    // Badge temizleme
    if (mode === 'global') {
      markGlobalMessagesAsRead();
    }
  };

  const startPrivateChat = async (targetUser: SelectedUser) => {
    // Engellenen kullanıcı kontrolü
    if (isUserBlocked(targetUser.id)) {
      toast.error('Bu kullanıcıyı engellemişsiniz');
      return;
    }
    if (!user) return;

    try {
      playSound('buttonClick');
      
      const participants = [user.id, targetUser.id].sort();
      const chatId = `chat_${participants.join('_')}`;

      const { data: existingChat, error: chatError } = await supabase
        .from('private_chats')
        .select('*')
        .eq('id', chatId)
        .single();

      if (chatError && chatError.code !== 'PGRST116') {
        throw chatError;
      }

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
      
      // Özel sohbete girildiğinde badge'leri temizle
      markPrivateMessagesAsRead();
      setViewMode('private-chat');
      
    } catch (error) {
      console.error('Error starting private chat:', error);
    }
  };

  const deletePrivateChat = async (otherUserId: string) => {
    if (!user) return;
    
    try {
      const chatId = `chat_${[user.id, otherUserId].sort().join('_')}`;
      
      const { data: existingMessages } = await supabase
        .from('private_messages')
        .select('id')
        .eq('chat_id', chatId);
      
      const { error: reactionsError } = await supabase
        .from('message_reactions')
        .delete()
        .in('message_id', existingMessages?.map(m => m.id) || []);
      
      const { error: messagesError } = await supabase
        .from('private_messages')
        .delete()
        .eq('chat_id', chatId);

      if (messagesError) throw messagesError;

      const { error: chatError } = await supabase
        .from('private_chats')
        .delete()
        .eq('id', chatId);

      setAllUsers(prev => prev.filter(u => u.id !== otherUserId));
      setUnreadCounts(prev => {
        const updated = { ...prev };
        delete updated[otherUserId];
        return updated;
      });

      toast.success('Özel sohbet silindi');
      
    } catch (error) {
      console.error('Error deleting private chat:', error);
      toast.error('Sohbet silinirken hata oluştu');
    }
  };

  // Ortak header bileşeni
  const renderHeader = (title: string, subtitle: string, showBackButton: boolean = false) => (
    <div className="bg-gradient-to-r from-chat-500 via-chat-600 to-chat-500 text-white p-4 border-b-2 border-chat-300 shadow-lg">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          {showBackButton && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                if (viewMode === 'private-chat') {
                  handleViewChange('users');
                } else {
                  handleViewChange('global');
                }
              }}
              className="p-2 hover:bg-white/20 rounded-full text-white transition-all duration-200 hover:scale-110"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
          )}
          
          <div className="flex flex-col">
            <h1 className="text-xl font-bold font-bungee tracking-wider uppercase bg-gradient-to-r from-yellow-300 via-white to-yellow-300 bg-clip-text text-transparent drop-shadow-lg">
              {title}
            </h1>
            <p className="text-chat-100 text-sm font-medium">{subtitle}</p>
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          {viewMode === 'global' && (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleViewChange('global')}
                className="p-2 rounded-full bg-white/20 text-white border border-white/30 hover:bg-white/30 transition-all duration-200"
              >
                <Hash className="w-5 h-5" />
              </Button>
              
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleViewChange('users')}
                className="p-2 rounded-full text-white hover:bg-white/20 border border-transparent hover:border-white/30 transition-all duration-200"
              >
                <Users className="w-5 h-5" />
              </Button>
              
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleViewChange('blocked-users')}
                className="p-2 rounded-full text-white hover:bg-red-500/20 border border-transparent hover:border-red-300/30 transition-all duration-200"
                title="Engelli Kullanıcılar"
              >
                <UserX className="w-5 h-5" />
              </Button>
            </>
          )}
          
          <Button
            variant="ghost"
            size="sm"
            onClick={handleBackToMenu}
            className="p-2 hover:bg-red-500/80 rounded-full text-white border border-transparent hover:border-red-300 transition-all duration-200 hover:scale-110"
          >
            <Home className="w-5 h-5" />
          </Button>
        </div>
      </div>
    </div>
  );

  const renderUsersList = () => {
    return (
      <ScrollArea className="flex-1 bg-gradient-to-b from-gray-50 to-white">
        <div className="p-4 space-y-3">
          {allUsers.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <div className="bg-gradient-to-br from-chat-100 to-chat-200 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4">
                <Users className="w-10 h-10 text-chat-500" />
              </div>
              <p className="text-lg font-medium">Henüz özel mesajınız yok</p>
              <p className="text-sm">Global sohbetten birine özel mesaj gönderin</p>
            </div>
          ) : (
            allUsers.filter(user => !isUserBlocked(user.id)).map((targetUser) => {
              const unreadCount = unreadCounts[targetUser.id] || 0;
              const hasHistory = Object.keys(unreadCounts).includes(targetUser.id) || unreadCount > 0;

              return (
                <SwipeToDeleteCard
                  key={targetUser.id}
                  onDelete={() => deletePrivateChat(targetUser.id)}
                  className={`p-4 hover:shadow-lg transition-all duration-300 cursor-pointer border-2 rounded-xl ${
                    unreadCount > 0 
                      ? 'border-chat-500 bg-gradient-to-r from-chat-50 to-chat-100 shadow-md' 
                      : hasHistory
                      ? 'border-chat-300 bg-gradient-to-r from-gray-50 to-white hover:from-chat-50 hover:to-chat-100'
                      : 'border-chat-200 bg-white hover:bg-gradient-to-r hover:from-chat-50 hover:to-white'
                  } hover:border-chat-400 hover:scale-[1.02]`}
                  onClick={() => startPrivateChat(targetUser)}
                >
                  <div className="flex items-center space-x-3">
                    <UserAvatar
                      src={targetUser.avatar_url}
                      alt={targetUser.username}
                      fallback={targetUser.username.charAt(0).toUpperCase()}
                      size="sm"
                      className={`${unreadCount > 0 ? 'ring-2 ring-chat-500 ring-offset-2' : ''} border-2 transition-all duration-200 ${
                        isUserOnline(targetUser.id) ? 'border-green-400 shadow-green-200 shadow-md' : 'border-gray-300'
                      }`}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-800 truncate text-lg">
                        {targetUser.username}
                      </p>
                      {unreadCount > 0 ? (
                        <p className="text-sm text-chat-600 font-bold">
                          {unreadCount} okunmamış mesaj
                        </p>
                      ) : hasHistory ? (
                        <p className="text-sm text-gray-600 font-medium">Mesaj geçmişi var</p>
                      ) : (
                        <p className="text-sm text-gray-500">Özel mesaj gönder</p>
                      )}
                    </div>
                    <div className="flex items-center space-x-2">
                      {isUserOnline(targetUser.id) && (
                        <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse border border-white shadow-sm" title="Çevrimiçi" />
                      )}
                      {unreadCount > 0 && (
                        <div className="w-7 h-7 bg-gradient-to-r from-red-500 to-red-600 rounded-full flex items-center justify-center text-xs text-white font-bold shadow-lg animate-pulse">
                          {unreadCount > 9 ? '9+' : unreadCount}
                        </div>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (isUserBlocked(targetUser.id)) {
                            unblockUser(targetUser.id);
                            toast.success('Kullanıcı engeli kaldırıldı');
                          } else {
                            blockUser(targetUser.id);
                            toast.success('Kullanıcı engellendi');
                          }
                        }}
                        className={`p-1 h-7 w-7 ${isUserBlocked(targetUser.id) ? 'text-green-500 hover:text-green-600' : 'text-red-500 hover:text-red-600'}`}
                        title={isUserBlocked(targetUser.id) ? 'Engeli Kaldır' : 'Kullanıcıyı Engelle'}
                      >
                        {isUserBlocked(targetUser.id) ? <UserCheck className="w-4 h-4" /> : <UserX className="w-4 h-4" />}
                      </Button>
                      <Mail className="w-5 h-5 text-chat-500" />
                    </div>
                  </div>
                </SwipeToDeleteCard>
              );
            })
          )}
        </div>
      </ScrollArea>
    );
  };

  const renderBlockedUsersList = () => (
    <ScrollArea className="flex-1 p-4">
      <div className="space-y-3">
        {blockedUsers.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <UserX className="w-16 h-16 mx-auto mb-4 opacity-30" />
            <h3 className="text-lg font-medium mb-2">Engellenen kullanıcı yok</h3>
            <p className="text-sm">Kullanıcıları engellemek için kullanıcılar listesini kullanın</p>
          </div>
        ) : (
          allUsers
            .filter(user => blockedUsers.includes(user.id))
            .map((blockedUser) => (
              <Card
                key={blockedUser.id}
                className="p-4 border-red-200 bg-red-50/50 hover:bg-red-50 transition-colors"
              >
                <div className="flex items-center space-x-3">
                   <div 
                    className="cursor-pointer"
                    onClick={() => navigate(`/profile/${blockedUser.id}`, { state: { from: '/chat' } })}
                  >
                    <UserAvatar
                      src={blockedUser.avatar_url}
                      alt={blockedUser.username}
                      fallback={blockedUser.username.charAt(0).toUpperCase()}
                      size="md"
                      className="border-2 border-red-300 opacity-60"
                    />
                  </div>
                  <div 
                    className="flex-1 min-w-0 cursor-pointer"
                    onClick={() => navigate(`/profile/${blockedUser.id}`, { state: { from: '/chat' } })}
                  >
                    <p className="font-medium text-red-800 truncate hover:text-red-600 transition-colors">
                      {blockedUser.username}
                    </p>
                    <p className="text-sm text-red-600 flex items-center">
                      <UserX className="w-3 h-3 mr-1" />
                      Engellendi
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      unblockUser(blockedUser.id);
                      toast.success(`${blockedUser.username} engellemeden kaldırıldı`);
                    }}
                    className="text-xs px-3 py-1 h-8 text-green-600 border-green-600 hover:bg-green-50"
                  >
                    <UserCheck className="w-3 h-3 mr-1" />
                    Engeli Kaldır
                  </Button>
                </div>
              </Card>
            ))
        )}
      </div>
    </ScrollArea>
  );

  const renderContent = () => {
    if (viewMode === 'private-chat' && selectedUser && activeChatId) {
      return (
        <div className="h-full flex flex-col">
          {renderHeader(
            `KELİMECİ - ${selectedUser.username}`,
            'Özel Sohbet',
            true
          )}
          
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
          {renderHeader(
            'KELİMECİ - Özel Mesajlar',
            `${onlineUsers.length} kişi çevrimiçi`,
            true
          )}
          
          {renderUsersList()}
        </div>
      );
    }

    if (viewMode === 'blocked-users') {
      return (
        <div className="h-full flex flex-col">
          {renderHeader(
            'KELİMECİ - Engelli Kullanıcılar',
            `${blockedUsers.length} kişi engellendi`,
            true
          )}
          
          {renderBlockedUsersList()}
        </div>
      );
    }

    // Global chat (default)
    return (
      <div className="h-full flex flex-col">
        {renderHeader(
          'KELİMECİ SOHBET',
          `${onlineUsers.length} kişi çevrimiçi`
        )}
        
        <div className="flex-1 min-h-0">
          <GlobalChat 
            isOpen={true} 
            onClose={() => {}} 
            isFullPage={true}
            onStartPrivateChat={startPrivateChat}
          />
        </div>
      </div>
    );
  };

  // Real-time subscription (aynı kalacak)
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel('chatpage-private-messages', {
        config: {
          broadcast: { self: true },
        }
      })
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'private_messages'
        },
        (payload) => {
          const newMessage = payload.new as any;
          
          if (newMessage.sender_id === user.id || newMessage.recipient_id === user.id) {
            setTimeout(() => {
              fetchAllUsers();
              fetchUnreadCounts();
            }, 1000);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  return (
    <div className="h-screen bg-gradient-to-br from-chat-50 via-gray-50 to-chat-100 overflow-hidden">
      {/* Safe area top */}
      <div className="safe-area-top"></div>
      
      <div className="h-full flex flex-col max-w-4xl mx-auto bg-white rounded-lg shadow-2xl m-4 border-2 border-chat-200 overflow-hidden">
        {/* Content Area */}
        <div className="flex-1 min-h-0 overflow-hidden">
          {renderContent()}
        </div>
      </div>
      
      {/* Safe area bottom */}
      <div className="safe-area-bottom"></div>
    </div>
  );
}