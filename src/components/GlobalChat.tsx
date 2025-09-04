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
import { isUserBanned, containsBannedWords, banUser, getBanTimeLeft } from '@/utils/chatBot';

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
  let channel: any = null;

  if (isOpen && user?.id) {
    fetchMessages();
    channel = setupRealtimeSubscription();
  }

  return () => {
    if (channel) {
      console.log('🧹 Cleaning up global real-time channel');
      supabase.removeChannel(channel);
    }
  };
}, [isOpen, user?.id]);

const setupRealtimeSubscription = () => {
  console.log('🔄 Setting up GLOBAL real-time subscription');

  try {
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
          // ... mevcut kod
        }
      )
      .subscribe((status) => {
        console.log('📡 Global real-time subscription status:', status);
        if (status === 'CHANNEL_ERROR') {
          console.error('❌ Channel error, retrying in 5 seconds...');
          // Daha uzun bekleme süresi
          setTimeout(() => {
            if (isOpen) {
              setupRealtimeSubscription();
            }
          }, 5000);
        }
      });

    return channel;
  } catch (error) {
    console.error('Error setting up real-time subscription:', error);
    return null;
  }
};

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
  // Null, undefined ve geçersiz UUID'leri filtrele
  const validUserIds = userIds.filter(id => {
    if (!id || id === 'null' || id === 'undefined') return false;
    // UUID formatını kontrol et (36 karakter, tire'ler dahil)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidRegex.test(id);
  });

  if (validUserIds.length === 0) return;

  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, avatar_url')
      .in('id', validUserIds);

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

// Fetch avatars when messages change - düzeltilmiş versiyon
useEffect(() => {
  if (messages.length > 0) {
    // User ID'leri toplarken null/undefined kontrolü yap
    const userIds = messages
      .map(m => m.user_id)
      .filter(id => id && id !== 'null' && id !== 'undefined')
      .filter((id, index, arr) => arr.indexOf(id) === index); // Duplicate'leri kaldır

    if (userIds.length > 0) {
      fetchUserAvatars(userIds);
    }
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


// Bot hoşgeldin mesajı için ayrı useEffect - her açılışta gönder
useEffect(() => {
  const sendBotWelcome = async () => {
    if (!user?.id || !isOpen) return;
    
    try {
      console.log('🤖 Bot hoşgeldin mesajı gönderiliyor...');
      
      const { error } = await supabase
        .from('global_chat')
        .insert({
          user_id: null,
          username: 'kelimeciBot',
          message: 'Hoşgeldiniz! 🎉 Lütfen kurallar çerçevesinde sohbet ediniz. Küfür, argo ve hakaret içeren mesajlar otomatik olarak tespit edilir ve 2 gün sohbet yasağı uygulanır.',
          avatar_url: '/bot-avatar.png'
        });

      if (error) {
        console.error('❌ Bot mesajı gönderilemedi:', error);
      } else {
        console.log('✅ Bot hoşgeldin mesajı gönderildi!');
      }
    } catch (error) {
      console.error('❌ Bot kontrolü hatası:', error);
    }
  };

  // Her chat sayfası açılışında bot mesajı gönder
  if (isOpen) {
    setTimeout(() => {
      sendBotWelcome();
    }, 1000); // 1 saniye gecikme ile
  }
}, [isOpen, user?.id]);


// Real-time subscription için ayrı bir useEffect
useEffect(() => {
  if (!isOpen || !user?.id) return;

  const channel = supabase
    .channel('global-chat-realtime')
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'global_chat'
      },
      (payload) => {
        const newMessage = payload.new as any;
        
        setMessages(prev => {
          const exists = prev.some(msg => msg.id === newMessage.id);
          if (exists) return prev;
          return [...prev, newMessage];
        });
        
        playSound('correctWord');
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}, [isOpen, user?.id]);

 const fetchMessages = async () => {
  try {
    console.log('📝 Fetching messages from database...');
    
    const { data, error } = await supabase
      .from('global_chat')
      .select('*')
      .order('created_at', { ascending: false }) // En yeni 100 mesajı al
      .limit(100);

    if (error) throw error;

    console.log('📨 Raw messages from DB:', data);

    // Mesajları formatla ve null user_id kontrolü ekle
    const formattedData = data.map(msg => ({
      id: msg.id,
      user_id: msg.user_id || null, // null'ları açıkça belirt
      username: msg.username || 'Anonim', 
      message: msg.message || '',
      created_at: msg.created_at,
      avatar_url: msg.avatar_url || null
    }));

    console.log('✅ Formatted messages:', formattedData);
    // Görüntülemede kronolojik sıra için tekrar sırala (eski -> yeni)
    const sorted = [...formattedData].sort((a, b) =>
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
    setMessages(sorted);

  } catch (error) {
    console.error('❌ Error fetching messages:', error);
    // Hata durumunda mevcut mesajları koru, temizleme
  }
};

const sendMessage = async () => {
  if (!newMessage.trim() || !user || !profile) return;

  // Ban kontrolü
  const isBanned = await isUserBanned(user.id);
  if (isBanned) {
    const timeLeft = await getBanTimeLeft(user.id);
    toast.error(`Sohbet yasağınız var! Kalan süre: ${timeLeft}`);
    return;
  }

  const trimmedMessage = newMessage.trim();
  if (trimmedMessage.length > 200) {
    toast.error('Mesaj 200 karakterden uzun olamaz');
    return;
  }

  // Yasaklı kelime kontrolü
  if (containsBannedWords(trimmedMessage)) {
    toast.error('Mesajınız yasaklı kelime içeriyor ve sohbet yasağı aldınız!');
    await banUser(user.id, 'Yasaklı kelime kullanımı', 48);
    setNewMessage('');
    return;
  }

  const username = profile.username || user.email?.split('@')[0] || 'Anonim';
  
  setNewMessage('');
  setIsLoading(true);
  
  try {
    const { data: insertData, error: insertError } = await supabase
      .from('global_chat')
      .insert({
        user_id: user.id,
        username: username,
        message: trimmedMessage,
        avatar_url: profile.avatar_url
      })
      .select()
      .single();

    if (insertError) throw insertError;

    // Manuel olarak mesajı state'e ekle
    const newMsg = {
      id: insertData.id,
      user_id: user.id,
      username: username,
      message: trimmedMessage,
      created_at: insertData.created_at,
      avatar_url: profile.avatar_url
    };
    
    setMessages(prev => [...prev, newMsg].sort((a, b) => 
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    ));

    // Mention kontrolü
    const mentionRegex = /@(\w+)/g;
    let match;
    
    while ((match = mentionRegex.exec(trimmedMessage)) !== null) {
      const mentionedUsername = match[1];
      
      const { data: mentionedUser } = await supabase
        .from('profiles')
        .select('id, username')
        .eq('username', mentionedUsername)
        .single();
      
      if (mentionedUser && mentionedUser.id !== user.id) {
        await sendMentionNotification(mentionedUser.id, username, trimmedMessage);
      }
    }

    playSound('buttonClick');
  } catch (error) {
    console.error('Error sending message:', error);
    toast.error('Mesaj gönderilirken hata oluştu');
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
                  src={message.user_id ? userAvatars[message.user_id] : '/bot-avatar.png'} // Bot için özel avatar
                  alt={message.username}
                  fallback={message.username.charAt(0).toUpperCase()}
                  size="xs"
                  className={`border-2 ${message.username === 'kelimeciBot' ? 'border-blue-500' : 'border-chat-300'}`}
                />
                <span className={`text-sm font-medium ${
                  message.username === 'kelimeciBot' 
                    ? 'text-blue-600 font-bold' // Bot için özel stil
                    : message.user_id === user?.id 
                    ? 'text-chat-600' 
                    : 'text-gray-700'
                }`}>
                  {message.username}
                  {message.username === 'kelimeciBot' && ' 🤖'}
                </span>
                
                {/* Online indicator - sadece gerçek kullanıcılar için */}
                {message.user_id && message.username !== 'kelimeciBot' && isUserOnline(message.user_id) && (
                  <div className="w-2 h-2 bg-green-500 rounded-full" title="Çevrimiçi"></div>
                )}
                
                <span className="text-xs text-gray-500">
                  {formatTime(message.created_at)}
                </span>
                
                {/* Private message button - sadece gerçek kullanıcılar için */}
                {message.user_id && message.user_id !== user?.id && message.username !== 'kelimeciBot' && onStartPrivateChat && (
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
              
              {/* Delete button - sadece kendi mesajları için */}
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
            
            <div className={`text-gray-800 break-words ${
              message.username === 'kelimeciBot' ? 'font-medium text-blue-800' : ''
            }`}>
              {message.message}
            </div>
            
            {/* Reactions - temp mesajlar ve bot mesajları için gösterme */}
            {!message.id.startsWith('temp-') && message.username !== 'kelimeciBot' && messageReactions[message.id] && (
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
