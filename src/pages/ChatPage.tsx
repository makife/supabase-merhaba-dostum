import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useUser } from '@/contexts/UserContext';
import { supabase } from '@/integrations/supabase/client';
import { useSounds } from '@/hooks/useSounds';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ArrowLeft, Users, MessageCircle, Hash, Home } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { GlobalChat } from '@/components/GlobalChat';
import { PrivateChat } from '@/components/PrivateChat';
import { UserAvatar } from '@/components/UserAvatar';
const { profile, onlineUsers, isUserOnline } = useUser();

type ViewMode = 'global' | 'users' | 'private-chat';

interface SelectedUser {
  id: string;
  username: string;
  avatar_url?: string;
}

export default function ChatPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { profile } = useUser();
  const { playSound } = useSounds();
  const [viewMode, setViewMode] = useState<ViewMode>('global');
  const [selectedUser, setSelectedUser] = useState<SelectedUser | null>(null);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [allUsers, setAllUsers] = useState<SelectedUser[]>([]);

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

  useEffect(() => {
    fetchAllUsers();
  }, []);

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

  const renderUsersList = () => (
    <div className="h-full flex flex-col">
      {/* Mobile Header */}
      <div className="flex items-center justify-between p-4 border-b border-border bg-background sticky top-0 z-10">
        <div className="flex items-center space-x-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleViewChange('global')}
            className="p-2 hover:bg-accent rounded-full"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <Users className="w-5 h-5 text-primary" />
          <div>
    <h2 className="text-lg font-semibold">Özel Sohbet</h2>
    <p className="text-xs text-muted-foreground">
      {onlineUsers.length} kişi çevrimiçi
    </p>
  </div>
</div>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleBackToMenu}
          className="p-2 hover:bg-accent rounded-full"
        >
          <Home className="w-5 h-5" />
        </Button>
      </div>
      // Online Users Section ekle (mevcut header'dan sonra)
{onlineUsers.length > 0 && (
  <div className="p-4 border-b border-border bg-muted/20">
    <div className="flex items-center space-x-2 mb-3">
      <Dot className="w-4 h-4 text-green-500 animate-pulse" />
      <span className="text-sm font-medium text-green-600">Çevrimiçi</span>
    </div>
    <div className="space-y-2">
      {onlineUsers
        .filter(onlineUser => onlineUser.id !== user?.id)
        .map((targetUser) => (
          <Card key={targetUser.id} className="p-3 hover:bg-accent cursor-pointer">
            <div className="flex items-center space-x-3">
              <div className="relative">
                <UserAvatar src={targetUser.avatar_url} />
                <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-background"></div>
              </div>
              <span>{targetUser.username}</span>
            </div>
          </Card>
        ))}
    </div>
  </div>
)}

      {/* Users List - Scrollable */}
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-3">
          {allUsers.map((targetUser) => (
            <Card
              key={targetUser.id}
              className="p-4 hover:bg-accent cursor-pointer transition-colors active:bg-accent/80"
              onClick={() => startPrivateChat(targetUser)}
            >
              <div className="flex items-center space-x-3">
                <UserAvatar
                  src={targetUser.avatar_url}
                  alt={targetUser.username}
                  fallback={targetUser.username?.charAt(0).toUpperCase()}
                  size="sm"
                />
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{targetUser.username}</p>
                  <p className="text-sm text-muted-foreground">Özel mesaj gönder</p>
                </div>
                <MessageCircle className="w-5 h-5 text-muted-foreground flex-shrink-0" />
              </div>
            </Card>
          ))}
          {allUsers.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>Henüz kullanıcı bulunamadı</p>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );

  const renderContent = () => {
    if (viewMode === 'private-chat' && selectedUser && activeChatId) {
      return (
        <div className="h-full flex flex-col">
          {/* Private Chat Header */}
          <div className="flex items-center justify-between p-4 border-b border-border bg-background sticky top-0 z-10">
            <div className="flex items-center space-x-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleViewChange('users')}
                className="p-2 hover:bg-accent rounded-full"
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
                <h2 className="text-lg font-semibold truncate">{selectedUser.username}</h2>
                <p className="text-sm text-muted-foreground">Özel Sohbet</p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleBackToMenu}
              className="p-2 hover:bg-accent rounded-full flex-shrink-0"
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
      return renderUsersList();
    }

    // Global chat
    return (
      <div className="h-full flex flex-col">
        {/* Global Chat Header */}
        <div className="flex items-center justify-between p-4 border-b border-border bg-background sticky top-0 z-10">
          <div className="flex items-center space-x-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleBackToMenu}
              className="p-2 hover:bg-accent rounded-full"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <Hash className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-semibold">Genel Sohbet</h2>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleViewChange('users')}
            className="flex items-center space-x-2"
          >
            <MessageCircle className="w-4 h-4" />
            <span className="hidden sm:inline">Özel Mesaj</span>
          </Button>
        </div>

        {/* Global Chat Content */}
        <div className="flex-1 min-h-0">
          <GlobalChat isOpen={true} onClose={() => {}} isFullPage={true} />
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Safe area top */}
      <div className="safe-area-top"></div>
      
      <div className="h-screen flex flex-col">
        <div className="flex-1 min-h-0">
          {renderContent()}
        </div>
      </div>
      
      {/* Safe area bottom */}
      <div className="safe-area-bottom"></div>
    </div>
  );
}