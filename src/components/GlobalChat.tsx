import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useUser } from '@/contexts/UserContext';
import { supabase } from '@/integrations/supabase/client';
import { useSounds } from '@/hooks/useSounds';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Send, MessageCircle, X, Trash2, Mail, Users } from 'lucide-react';
import { UserAvatar } from '@/components/UserAvatar';
import { PrivateChat } from '@/components/PrivateChat';
import { toast } from 'sonner';
import { sendMentionNotification } from '@/utils/notifications';
import { sendWelcomeMessage, containsBannedWords, banUser } from '@/utils/chatBot';

interface ChatMessage {
  id: string;
  user_id: string;
  username: string;
  message: string;
  created_at: string;
  avatar_url?: string;
}

interface MessageReaction {
  id: string;
  message_id: string;
  user_id: string;
  emoji: string;
  created_at: string;
}

interface GlobalChatProps {
  isOpen: boolean;
  onClose: () => void;
  isFullPage?: boolean;
  onStartPrivateChat?: (user: SelectedUser) => void;
}

type ViewMode = 'global' | 'users' | 'private-chat';

interface SelectedUser {
  id: string;
  username: string;
  avatar_url?: string;
}

export function GlobalChat({ isOpen, onClose, isFullPage = false, onStartPrivateChat }: GlobalChatProps) {
  const { user } = useAuth();
  const { profile, onlineUsers, isUserOnline } = useUser();
  const { playSound } = useSounds();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set());
  const [typingTimeout, setTypingTimeout] = useState<NodeJS.Timeout | null>(null);
  const [currentChannel, setCurrentChannel] = useState<any>(null);
  const [messageReactions, setMessageReactions] = useState<{[messageId: string]: MessageReaction[]}>({});
  const [showEmojiPicker, setShowEmojiPicker] = useState<string | null>(null);
  const [userAvatars, setUserAvatars] = useState<{[userId: string]: string}>({});
  const [viewMode, setViewMode] = useState<ViewMode>('global');
  const [privateChatEnabled, setPrivateChatEnabled] = useState(false);
  const [selectedUser, setSelectedUser] = useState<SelectedUser | null>(null);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [allUsers, setAllUsers] = useState<SelectedUser[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom when new messages arrive
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Fetch initial messages
  useEffect(() => {
    if (isOpen) {
      fetchMessages();
    }
  }, [isOpen]);

// GlobalChat.tsx - fetchReactions fonksiyonu
const fetchReactions = async () => {
  try {
    // Sadece gerçek UUID'leri filtrele (temp- ile başlamayanlar)
    const realMessageIds = messages
      .filter(m => !m.id.startsWith('temp-'))
      .map(m => m.id);
    
    if (realMessageIds.length === 0) return;

    const { data, error } = await supabase
      .from('message_reactions')
      .select('*')
      .in('message_id', realMessageIds);

    if (error) throw error;

    const reactionsByMessage: {[messageId: string]: MessageReaction[]} = {};
    data?.forEach(reaction => {
      if (!reactionsByMessage[reaction.message_id]) {
        reactionsByMessage[reaction.message_id] = [];
      }
      reactionsByMessage[reaction.message_id].push(reaction);
    });

    setMessageReactions(reactionsByMessage);
  } catch (error) {
    console.error('Error fetching reactions:', error);
  }
};

  // Fetch user avatars
  const fetchUserAvatars = async (userIds: string[]) => {
    if (userIds.length === 0) return;

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, avatar_url')
        .in('id', userIds);

      if (error) throw error;

      const avatarMap: {[userId: string]: string} = {};
      data?.forEach(profile => {
        if (profile.avatar_url) {
          avatarMap[profile.id] = profile.avatar_url;
        }
      });

      setUserAvatars(prev => ({ ...prev, ...avatarMap }));
    } catch (error) {
      console.error('Error fetching user avatars:', error);
    }
  };

  // Fetch avatars when messages change
  useEffect(() => {
    if (messages.length > 0) {
      const userIds = [...new Set(messages.map(m => m.user_id))];
      fetchUserAvatars(userIds);
    }
  }, [messages]);

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

  // Fetch users when private chat is enabled
  useEffect(() => {
    if (privateChatEnabled && isOpen) {
      fetchAllUsers();
    }
  }, [privateChatEnabled, isOpen]);

  useEffect(() => {
    if (messages.length > 0) {
      fetchReactions();
    }
  }, [messages]);


// Real-time subscription için ayrı bir useEffect
useEffect(() => {
  if (!isOpen || !user?.id) return;

  console.log('🔄 Setting up GLOBAL real-time subscription');

// GlobalChat.tsx - useEffect içinde
const sendBotWelcome = async () => {
  const hasWelcome = localStorage.getItem('chat_welcome_shown');
  if (!hasWelcome) {
    try {
      await supabase
        .from('global_chat')
        .insert({
          user_id: '00000000-0000-0000-0000-000000000000', // Bot ID
          username: 'kelimeciBot',
          message: 'Hoşgeldiniz! 🎉 Lütfen kurallar çerçevesinde sohbet ediniz. Küfür, argo ve hakaret içeren mesajlar otomatik olarak tespit edilir ve 2 gün sohbet yasağı uygulanır.',
          avatar_url: '/bot-avatar.png'
        });
      localStorage.setItem('chat_welcome_shown', 'true');
    } catch (error) {
      console.error('Bot mesajı gönderilemedi:', error);
    }
  }
};

// Bu fonksiyonu çağır
sendBotWelcome();


  const channel = supabase
    .channel('global-chat-realtime')
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'global_chat',
      },
      async (payload) => {
        console.log('📨 REAL-TIME GLOBAL MESSAGE:', payload);
        const newMessage = payload.new as any;
        
        // Kendi mesajımızı ignore et (optimistic update zaten ekledi)
        if (newMessage.user_id === user.id) {
          console.log('⏭️ Skipping own message');
          return;
        }

        // Kullanıcı bilgilerini al
        let username = newMessage.username || 'Anonim';
        let avatar_url = newMessage.avatar_url || null;

        // Eğer username yoksa, profilden çek
        if (!newMessage.username || newMessage.username === 'Anonim') {
          try {
            const { data: profile } = await supabase
              .from('profiles')
              .select('username, avatar_url')
              .eq('id', newMessage.user_id)
              .single();
            
            if (profile) {
              username = profile.username;
              avatar_url = profile.avatar_url;
            }
          } catch (error) {
            console.warn('Could not fetch user profile:', error);
          }
        }

        // Mesajı state'e ekle (duplicate kontrolü ile)
        setMessages(prev => {
          const alreadyExists = prev.some(msg => msg.id === newMessage.id);
          if (alreadyExists) {
            console.log('⚠️ Message already exists, skipping');
            return prev;
          }

          console.log('✅ Adding new message to state');
          return [...prev, {
            id: newMessage.id,
            user_id: newMessage.user_id,
            username: username,
            message: newMessage.message || newMessage.content || '',
            created_at: newMessage.created_at,
            avatar_url: avatar_url
          }];
        });

        // Ses çal
        try {
          playSound('correctWord');
        } catch (e) {
          console.log('🔇 Sound play failed:', e);
        }
      }
    )
    .on(
      'postgres_changes',
      {
        event: 'DELETE',
        schema: 'public',
        table: 'global_chat',
      },
      (payload) => {
        const deletedMessage = payload.old as any;
        setMessages(prev => prev.filter(m => m.id !== deletedMessage.id));
        console.log('🗑️ Message deleted:', deletedMessage.id);
      }
    )
    .subscribe((status) => {
      console.log('📡 Global real-time subscription status:', status);
    });

  return () => {
    console.log('🧹 Cleaning up global real-time channel');
    supabase.removeChannel(channel);
  };
}, [isOpen, user?.id, playSound]);

  const fetchMessages = async () => {
  try {
    const { data, error } = await supabase
      .from('global_chat')
      .select('*')
      .order('created_at', { ascending: true })
      .limit(50);

    if (error) {
      console.error('Global chat fetch error:', error);
      throw error;
    }

    console.log('Fetched global messages:', data);
    
    // Eğer data varsa ve içinde user_id yoksa, mevcut kullanıcıyı kullan
    const formattedData = data?.map(msg => ({
      ...msg,
      user_id: msg.user_id || user?.id || 'unknown',
      username: msg.username || 'Anonim'
    })) || [];

    setMessages(formattedData);
    
    // Avatar'ları çek
    const userIds = [...new Set(formattedData.map(msg => msg.user_id))];
    if (userIds.length > 0) {
      await fetchUserAvatars(userIds);
    }
    
  } catch (error) {
    console.error('Error fetching global messages:', error);
    toast.error('Mesajlar yüklenirken hata oluştu');
  }
};

const sendMessage = async () => {
  if (!newMessage.trim() || !user || !profile) return;

  const trimmedMessage = newMessage.trim();
  if (trimmedMessage.length > 200) {
    toast.error('Mesaj 200 karakterden uzun olamaz');
    return;
  }

  // İlk yasaklanma kontrolü (frontend'de hızlı kontrol)
  const username = profile.username || user.email?.split('@')[0] || 'Anonim';
  
  // Optimistic update - hemen ekranı güncelle
  const tempMessage: ChatMessage = {
    id: `temp-${Date.now()}`,
    user_id: user.id,
    username: username,
    message: trimmedMessage,
    created_at: new Date().toISOString(),
    avatar_url: profile.avatar_url
  };

  setMessages(prev => [...prev, tempMessage]);
  setNewMessage('');
  scrollToBottom();

  setIsLoading(true);
  try {
    // Backend moderasyon ile mesaj gönder
    const { data: moderationResult, error } = await supabase
      .rpc('moderate_and_insert_message', {
        p_user_id: user.id,
        p_username: username,
        p_message: trimmedMessage,
        p_avatar_url: profile.avatar_url
      });

    if (error) throw error;

    // Type the result properly
    const result = moderationResult as any;
    
    if (!result?.success) {
      // Mesaj reddedildi
      setMessages(prev => prev.filter(msg => msg.id !== tempMessage.id));
      
      if (result?.error === 'user_banned') {
        toast.error('Sohbet yasağınız bulunmaktadır');
      } else if (result?.moderated) {
        toast.error('Mesajınız yasaklı içerik nedeniyle engellendi ve 2 gün yasaklandınız');
      }
      return;
    }

    // Başarılı - temp mesajı gerçek ID ile güncelle
    setMessages(prev => prev.map(msg => 
      msg.id === tempMessage.id ? {
        ...tempMessage,
        id: result.id
      } : msg
    ));

    // MENTION KONTROLÜ
    const mentionRegex = /@(\w+)/g;
    let match;
    
    while ((match = mentionRegex.exec(trimmedMessage)) !== null) {
      const mentionedUsername = match[1];
      
      // Kullanıcıyı bul
      const { data: mentionedUser } = await supabase
        .from('profiles')
        .select('id, username')
        .eq('username', mentionedUsername)
        .single();
      
      if (mentionedUser && mentionedUser.id !== user.id) {
        // BİLDİRİM GÖNDER
        await sendMentionNotification(
          mentionedUser.id, 
          username,
          trimmedMessage
        );
      }
    }

    playSound('buttonClick');
  } catch (error) {
    console.error('Error sending message:', error);
    toast.error('Mesaj gönderilirken hata oluştu');
    
    // Hata durumunda temp mesajı kaldır
    setMessages(prev => prev.filter(msg => msg.id !== tempMessage.id));
  } finally {
    setIsLoading(false);
  }
};

  const handleInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
  setNewMessage(e.target.value);
  
  if (user && currentChannel && currentChannel.state === 'joined') {
    try {
      const displayName = profile?.username || user.email?.split('@')[0] || 'Anonim';
      
      // Typing durumunu güncelle
      await currentChannel.track({
        user_id: user.id,
        username: displayName,
        typing: e.target.value.length > 0, // Yazı yazılıyorsa true
        online_at: new Date().toISOString(),
      });
      
      // Timeout'u temizle ve yeniden kur
      if (typingTimeout) {
        clearTimeout(typingTimeout);
      }
      
      const timeout = setTimeout(async () => {
        if (currentChannel && currentChannel.state === 'joined') {
          await currentChannel.track({
            user_id: user.id,
            username: displayName,
            typing: false, // Yazma durduruldu
            online_at: new Date().toISOString(),
          });
        }
      }, 2000);
      
      setTypingTimeout(timeout);
    } catch (error) {
      console.error('Error handling typing indicator:', error);
    }
  }
};

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const addReaction = async (messageId: string, emoji: string) => {
    if (!user) return;

    // Check if user already has this reaction
    const existingReaction = messageReactions[messageId]?.find(
      r => r.user_id === user.id && r.emoji === emoji
    );

    if (existingReaction) {
      toast.info('Bu emoji reaksiyonunu zaten vermişsiniz');
      setShowEmojiPicker(null);
      return;
    }

    try {
      // Optimistic update - add reaction immediately
      const tempReaction: MessageReaction = {
        id: `temp-${Date.now()}`,
        message_id: messageId,
        user_id: user.id,
        emoji: emoji,
        created_at: new Date().toISOString()
      };

      setMessageReactions(prev => ({
        ...prev,
        [messageId]: [
          ...(prev[messageId] || []),
          tempReaction
        ]
      }));

      const { error } = await supabase
        .from('message_reactions')
        .insert({
          message_id: messageId,
          user_id: user.id,
          emoji: emoji
        });

      if (error) {
        // Remove optimistic update on error
        setMessageReactions(prev => ({
          ...prev,
          [messageId]: (prev[messageId] || []).filter(r => r.id !== tempReaction.id)
        }));
        
        // Handle duplicate key error
        if (error.code === '23505') {
          toast.info('Bu emoji reaksiyonunu zaten vermişsiniz');
        } else {
          throw error;
        }
        return;
      }

      playSound('buttonClick');
      setShowEmojiPicker(null);
    } catch (error) {
      console.error('Error adding reaction:', error);
      toast.error('Reaksiyon eklenirken hata oluştu');
    }
  };

  // Remove emoji reaction
  const removeReaction = async (messageId: string, emoji: string) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('message_reactions')
        .delete()
        .eq('message_id', messageId)
        .eq('user_id', user.id)
        .eq('emoji', emoji);

      if (error) throw error;
      playSound('buttonClick');
    } catch (error) {
      console.error('Error removing reaction:', error);
      toast.error('Reaksiyon kaldırılırken hata oluştu');
    }
  };

  // Toggle emoji reaction
  const toggleReaction = async (messageId: string, emoji: string) => {
    if (!user) return;

    const userReaction = messageReactions[messageId]?.find(
      r => r.user_id === user.id && r.emoji === emoji
    );

    if (userReaction) {
      await removeReaction(messageId, emoji);
    } else {
      await addReaction(messageId, emoji);
    }
  };

  // Delete message
  const deleteMessage = async (messageId: string) => {
    if (!user) return;

    const confirmed = window.confirm('Bu mesajı silmek istediğinizden emin misiniz?');
    if (!confirmed) return;

    try {
      const { error } = await supabase
        .from('global_chat')
        .delete()
        .eq('id', messageId)
        .eq('user_id', user.id); // Sadece kendi mesajlarını silebilir

      if (error) throw error;
      
      playSound('buttonClick');
      toast.success('Mesaj silindi');
    } catch (error) {
      console.error('Error deleting message:', error);
      toast.error('Mesaj silinirken hata oluştu');
    }
  };

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString('tr-TR', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Group reactions by emoji
  const groupReactions = (reactions: MessageReaction[]) => {
    const grouped: {[emoji: string]: MessageReaction[]} = {};
    reactions.forEach(reaction => {
      if (!grouped[reaction.emoji]) {
        grouped[reaction.emoji] = [];
      }
      grouped[reaction.emoji].push(reaction);
    });
    return grouped;
  };

const startPrivateChat = async (targetUser: SelectedUser) => {
  if (!user) return;
  
  try {
    playSound('buttonClick');
    
    // Chat ID oluştur
    const participants = [user.id, targetUser.id].sort();
    const chatId = `private_${participants.join('_')}`;

    // Chat var mı kontrol et
    const { data: existingChat, error: chatError } = await supabase
      .from('private_chats')
      .select('id')
      .eq('id', chatId)
      .single();

    if (chatError && chatError.code !== 'PGRST116') {
      throw chatError;
    }

    // Yeni chat oluştur
    if (!existingChat) {
      const { error: createError } = await supabase
        .from('private_chats')
        .insert({
          id: chatId,
          user1_id: participants[0],
          user2_id: participants[1],
          created_at: new Date().toISOString()
        });

      if (createError) throw createError;
    }

    setSelectedUser(targetUser);
    setActiveChatId(chatId);
    setViewMode('private-chat');
    
    toast.success(`${targetUser.username} ile özel sohbet başlatıldı`, {
      icon: '💛',
      duration: 2000
    });
    
  } catch (error) {
    console.error('Error starting private chat:', error);
    toast.error('Özel sohbet başlatılırken hata oluştu');
  }
};

  // Render different views
  const renderContent = () => {
    if (viewMode === 'private-chat' && selectedUser && activeChatId) {
      return (
        <PrivateChat
          chatId={activeChatId}
          otherUser={selectedUser}
          onBack={() => {
            setViewMode('global');
            setSelectedUser(null);
            setActiveChatId(null);
          }}
        />
      );
    }

    if (viewMode === 'users') {
      return renderUsersList();
    }

    return renderGlobalChat();
  };

  const renderUsersList = () => (
  <>
    {/* Header */}
    <div className="bg-chat-500 text-white p-4 flex items-center justify-between">
      <div className="flex items-center space-x-2">
        <Users className="w-6 h-6" />
        <div>
          <h3 className="font-semibold text-lg">Kullanıcılar</h3>
          <p className="text-chat-100 text-sm">
            {onlineUsers.length} kişi çevrimiçi
          </p>
        </div>
      </div>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setViewMode('global')}
        className="text-white hover:bg-chat-600 p-2 rounded-full"
      >
        <X className="w-5 h-5" />
      </Button>
    </div>

    {/* Online Users */}
    {onlineUsers.length > 0 && (
      <div className="p-4 bg-chat-50 border-b border-chat-200">
        <div className="flex items-center space-x-2 mb-3">
          <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
          <span className="text-sm font-medium text-green-700">Çevrimiçi</span>
        </div>
        <div className="space-y-2">
          {onlineUsers.map((targetUser) => (
            <Card 
              key={targetUser.id} 
              className="p-3 hover:shadow-md transition-all cursor-pointer border-chat-200"
              onClick={() => startPrivateChat(targetUser)}
            >
              <div className="flex items-center space-x-3">
                <div className="relative">
                  <UserAvatar 
                    src={targetUser.avatar_url}
                    alt={targetUser.username}
                    fallback={targetUser.username?.charAt(0).toUpperCase()}
                    size="sm"
                    className="border-2 border-green-400"
                  />
                  <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-white"></div>
                </div>
                <div className="flex-1">
                  <div className="font-medium text-gray-800">{targetUser.username}</div>
                  <div className="text-xs text-green-600">Çevrimiçi</div>
                </div>
                <MessageCircle className="w-5 h-5 text-chat-500" />
              </div>
            </Card>
          ))}
        </div>
      </div>
    )}

    {/* All Users */}
    <ScrollArea className="flex-1">
      <div className="p-4 space-y-3">
        <div className="flex items-center space-x-2 mb-3">
          <Users className="w-4 h-4 text-gray-500" />
          <span className="text-sm font-medium text-gray-700">Tüm Kullanıcılar</span>
        </div>
        
        {allUsers.map((targetUser) => (
          <Card
            key={targetUser.id}
            className="p-4 hover:shadow-md transition-all cursor-pointer border-chat-100"
            onClick={() => startPrivateChat(targetUser)}
          >
            <div className="flex items-center space-x-3">
              <UserAvatar
                src={targetUser.avatar_url}
                alt={targetUser.username}
                fallback={targetUser.username.charAt(0).toUpperCase()}
                size="sm"
                className="border-2 border-chat-300"
              />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-800 truncate">{targetUser.username}</p>
                <p className="text-sm text-gray-500">Özel mesaj gönder</p>
              </div>
              <div className="flex items-center space-x-2">
                {isUserOnline(targetUser.id) && (
                  <div className="w-2 h-2 bg-green-500 rounded-full" title="Çevrimiçi"></div>
                )}
                <Mail className="w-5 h-5 text-chat-500" />
              </div>
            </div>
          </Card>
        ))}
        
        {allUsers.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            <Users className="w-12 h-12 mx-auto mb-3 opacity-50 text-chat-300" />
            <p>Henüz kullanıcı bulunamadı</p>
          </div>
        )}
      </div>
    </ScrollArea>
  </>
);
  // GlobalChat.tsx - Yeni tasarım
const renderGlobalChat = () => (
  <>
    {/* Messages */}
    <ScrollArea className="flex-1 p-4 bg-chat-50">
      <div className="space-y-3">
        {messages.map((message) => (
          <div key={message.id} className="group flex flex-col space-y-1 p-3 rounded-lg bg-white shadow-sm border border-chat-100 hover:border-chat-300 transition-all">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <UserAvatar
                  src={userAvatars[message.user_id]}
                  alt={message.username}
                  fallback={message.username.charAt(0).toUpperCase()}
                  size="xs"
                  className="border-2 border-chat-300"
                />
                <span className={`text-sm font-medium ${
                  message.user_id === user?.id 
                    ? 'text-chat-600' 
                    : 'text-gray-700'
                }`}>
                  {message.username}
                </span>
                {isUserOnline(message.user_id) && (
                  <div className="w-2 h-2 bg-green-500 rounded-full" title="Çevrimiçi"></div>
                )}
                <span className="text-xs text-gray-500">
                  {formatTime(message.created_at)}
                </span>
                
                {message.user_id !== user?.id && onStartPrivateChat && (
  <Button
    size="sm"
    variant="ghost"
    onClick={() => {
      onStartPrivateChat({
        id: message.user_id,
        username: message.username,
        avatar_url: userAvatars[message.user_id]
      });
    }}
    className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-chat-100"
    title="Özel mesaj gönder"
  >
    <Mail className="w-3 h-3 text-chat-600" />
  </Button>
)}
              </div>
              
              {message.user_id === user?.id && (
                <button
                  onClick={() => deleteMessage(message.id)}
                  className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-red-100 rounded"
                  title="Mesajı sil"
                >
                  <Trash2 className="w-3 h-3 text-red-500" />
                </button>
              )}
            </div>
            
            <div className="text-gray-800 break-words">
              {message.message}
            </div>
            
            {/* Reactions - temp mesajlar için gösterme */}
            {!message.id.startsWith('temp-') && messageReactions[message.id] && (
              <div className="flex items-center space-x-2 mt-2">
                {Object.entries(groupReactions(messageReactions[message.id])).map(([emoji, reactions]) => (
                  <button
                    key={emoji}
                    onClick={() => toggleReaction(message.id, emoji)}
                    className={`flex items-center space-x-1 px-2 py-1 rounded-full text-xs transition-colors ${
                      reactions.some(r => r.user_id === user?.id)
                        ? 'bg-chat-100 text-chat-700 border border-chat-300'
                        : 'bg-gray-100 hover:bg-gray-200'
                    }`}
                  >
                    <span>{emoji}</span>
                    <span>{reactions.length}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
        
        {/* Typing indicator */}
        {typingUsers.size > 0 && (
          <div className="flex items-center space-x-2 text-chat-600 text-sm italic p-2 bg-chat-100 rounded-lg">
            <div className="flex space-x-1">
              <div className="w-2 h-2 bg-chat-600 rounded-full animate-bounce"></div>
              <div className="w-2 h-2 bg-chat-600 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
              <div className="w-2 h-2 bg-chat-600 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
            </div>
            <span>
              {Array.from(typingUsers).slice(0, 2).join(', ')} yazıyor...
            </span>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>
    </ScrollArea>

    {/* Message Input */}
    <div className="p-4 bg-white border-t border-chat-200">
      <div className="flex space-x-2">
        <Input
          value={newMessage}
          onChange={handleInputChange}
          onKeyPress={handleKeyPress}
          placeholder="Mesajınızı yazın..."
          maxLength={200}
          disabled={isLoading}
          className="flex-1 border-chat-300 focus:border-chat-500 focus:ring-chat-500"
        />
        <Button
          onClick={sendMessage}
          disabled={!newMessage.trim() || isLoading}
          size="sm"
          className="px-4 bg-chat-500 hover:bg-chat-600 text-white"
        >
          <Send className="w-4 h-4" />
        </Button>
      </div>
      <div className="text-xs text-gray-500 mt-1 text-right">
        {newMessage.length}/200
      </div>
    </div>
  </>
);

  if (!isOpen) return null;

  // If it's full page mode, don't wrap in modal
  if (isFullPage) {
    return (
      <div className="h-full w-full flex flex-col">
        {renderGlobalChat()}
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md h-[600px] flex flex-col bg-background border-2 border-primary/20">
        {renderContent()}
      </Card>
    </div>
  );
}
