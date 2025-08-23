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
import { toast } from 'sonner';

type ViewMode = 'global' | 'users' | 'private-chat';

interface SelectedUser {
  id: string;
  username: string;
  avatar_url?: string;
}

// Ban kontrol fonksiyonu
const checkUserBanStatus = async (userId: string): Promise<{
  is_banned: boolean;
  ban_reason?: string;
  banned_until?: string;
  remaining_hours?: number;
}> => {
  try {
    const { data, error } = await supabase
      .rpc('check_user_ban_status', { p_user_id: userId });
    
    if (error) {
      console.error('Ban check error:', error);
      return { is_banned: false };
    }
    
    if (data && data.length > 0) {
      const banInfo = data[0];
      return {
        is_banned: banInfo.is_banned || false,
        ban_reason: banInfo.ban_reason,
        banned_until: banInfo.banned_until,
        remaining_hours: banInfo.remaining_hours
      };
    }
    
    return { is_banned: false };
  } catch (error) {
    console.error('Error checking ban status:', error);
    return { is_banned: false };
  }
};

const formatBanTimeLeft = (hours: number): string => {
  if (hours <= 0) return "Yakında";
  
  const days = Math.floor(hours / 24);
  const remainingHours = Math.floor(hours % 24);
  const minutes = Math.floor((hours % 1) * 60);
  
  if (days > 0) {
    return `${days} gün ${remainingHours} saat`;
  } else if (remainingHours > 0) {
    return `${remainingHours} saat ${minutes} dakika`;
  } else {
    return `${minutes} dakika`;
  }
};

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
  const [isBanned, setIsBanned] = useState(false);
  const [banInfo, setBanInfo] = useState<any>(null);

  // Ban durumunu kontrol et
  useEffect(() => {
    if (!user?.id) return;

    const checkBanStatus = async () => {
      try {
        const banStatus = await checkUserBanStatus(user.id);
        
        if (banStatus.is_banned) {
          setIsBanned(true);
          setBanInfo(banStatus);
          
          const timeLeft = formatBanTimeLeft(banStatus.remaining_hours || 0);
          
          toast.error(
            `Sohbet yasağınız bulunuyor! 🚫`,
            {
              duration: 10000,
              description: `Kalan süre: ${timeLeft}\nSebep: ${banStatus.ban_reason || 'Yasaklı kelime kullanımı'}`,
              action: {
                label: 'Ana Sayfaya Dön',
                onClick: () => navigate('/')
              }
            }
          );
        } else {
          setIsBanned(false);
          setBanInfo(null);
        }
      } catch (error) {
        console.error('Ban control error:', error);
        // Hata durumunda sohbete devam etmesine izin ver
      }
    };

    checkBanStatus();
  }, [user?.id, navigate]);

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

  // Fetch users when viewMode changes to users
  useEffect(() => {
    if (viewMode === 'users') {
      fetchAllUsers();
      fetchUnreadCounts();
    }
  }, [viewMode, user]);

  useEffect(() => {
    // Sohbet sayfası açıldığında bildirimleri temizle
    const markChatNotificationsAsRead = async () => {
      if (!user) return;

      try {
        // Chat notifications için supabase.rpc kullanmayı deneyelim daha sonra
        
        console.log('Chat notifications marked as read');
      } catch (error) {
        console.error('Error marking notifications as read:', error);
      }
    };

    markChatNotificationsAsRead();
  }, [user]);

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

  // Ban durumu varsa ban ekranını göster
  if (isBanned && banInfo) {
    return (
      <div className="min-h-screen bg-chat-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full p-8 text-center border-red-200 bg-red-50">
          <div className="mb-6">
            <div className="w-20 h-20 bg-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
              <MessageCircle className="w-10 h-10 text-white" />
            </div>
            <h2 className="text-2xl font-bold text-red-700 mb-2">
              Sohbet Yasağı 🚫
            </h2>
            <p className="text-red-600 mb-4">
              Sohbet yasağınız bulunmaktadır
            </p>
          </div>
          
          <div className="bg-white rounded-lg p-4 mb-6 border border-red-200">
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="font-medium">Sebep:</span>
                <span className="text-red-600">{banInfo.ban_reason || 'Yasaklı kelime kullanımı'}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-medium">Kalan Süre:</span>
                <span className="text-red-600 font-semibold">
                  {formatBanTimeLeft(banInfo.remaining_hours || 0)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="font-medium">Bitiş Tarihi:</span>
                <span className="text-gray-600">
                  {new Date(banInfo.banned_until).toLocaleString('tr-TR')}
                </span>
              </div>
            </div>
          </div>
          
          <div className="space-y-3">
            <p className="text-sm text-gray-600">
              Sohbet kurallarına uygun davranarak yasağınızın bitmesini bekleyebilirsiniz.
            </p>
            <Button 
              onClick={handleBackToMenu}
              className="w-full bg-blue-500 hover:bg-blue-600"
            >
              <Home className="w-4 h-4 mr-2" />
              Ana Sayfaya Dön
            </Button>
          </div>
        </Card>
      </div>
    );
  }

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
                <h1 className="text-xl font-bold">Sohbet Odası</h1>
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