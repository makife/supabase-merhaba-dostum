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
import { Send, MessageCircle, X, Trash2, Mail } from 'lucide-react';
import { UserAvatar } from '@/components/UserAvatar';
import { PrivateChat } from '@/components/PrivateChat';
import { toast } from 'sonner';

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
}

type ViewMode = 'global' | 'users' | 'private-chat';

interface SelectedUser {
  id: string;
  username: string;
  avatar_url?: string;
}

export function GlobalChat({ isOpen, onClose }: GlobalChatProps) {
  const { user } = useAuth();
  const { profile } = useUser();
  const { playSound } = useSounds();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set());
  const [typingTimeout, setTypingTimeout] = useState<NodeJS.Timeout | null>(null);
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());
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

  // Fetch reactions for messages
  const fetchReactions = async () => {
    try {
      const messageIds = messages.map(m => m.id);
      if (messageIds.length === 0) return;

      const { data, error } = await supabase
        .from('message_reactions')
        .select('*')
        .in('message_id', messageIds);

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

  // Set up realtime subscription and presence
  useEffect(() => {
    if (!isOpen || !user?.id) return;

    console.log('Setting up presence for user:', user.id);
    
    // Cache username to avoid repeated API calls
    const cachedUsername = user.user_metadata?.username || user.email?.split('@')[0] || 'Anonim';

    const channel = supabase
      .channel(`global-chat-${user.id}`, {
        config: {
          presence: { key: user.id }
        }
      })
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'global_chat'
        },
        (payload) => {
          const newMessage = payload.new as ChatMessage;
          
          // Kendi mesajımızı tekrar ekleme, zaten manuel olarak eklendi
          if (newMessage.user_id === user?.id) {
            return;
          }
          
          setMessages(prev => [...prev, newMessage]);
          
          // Play sound for new messages from other users - use fixed callback to avoid dependency
          try {
            playSound('correctWord');
          } catch (e) {
            console.log('Sound play failed:', e);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'global_chat'
        },
        (payload) => {
          const deletedMessage = payload.old as ChatMessage;
          setMessages(prev => prev.filter(m => m.id !== deletedMessage.id));
          
          // Also remove reactions for this message
          setMessageReactions(prev => {
            const newReactions = { ...prev };
            delete newReactions[deletedMessage.id];
            return newReactions;
          });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'message_reactions'
        },
        (payload) => {
          const newReaction = payload.new as MessageReaction;
          console.log('New reaction received:', newReaction);
          
          // Don't add if it's already in state (optimistic update)
          setMessageReactions(prev => {
            const existing = prev[newReaction.message_id] || [];
            const hasTemp = existing.some(r => r.id.startsWith('temp-') && r.user_id === newReaction.user_id && r.emoji === newReaction.emoji);
            
            if (hasTemp) {
              // Replace temp reaction with real one
              return {
                ...prev,
                [newReaction.message_id]: existing.map(r => 
                  r.id.startsWith('temp-') && r.user_id === newReaction.user_id && r.emoji === newReaction.emoji 
                    ? newReaction 
                    : r
                )
              };
            } else {
              // Add new reaction
              return {
                ...prev,
                [newReaction.message_id]: [...existing, newReaction]
              };
            }
          });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'message_reactions'
        },
        (payload) => {
          const deletedReaction = payload.old as MessageReaction;
          console.log('Reaction deleted:', deletedReaction);
          setMessageReactions(prev => ({
            ...prev,
            [deletedReaction.message_id]: (prev[deletedReaction.message_id] || [])
              .filter(r => r.id !== deletedReaction.id)
          }));
        }
      )
      .on('presence', { event: 'sync' }, () => {
        const newState = channel.presenceState();
        console.log('Presence sync - raw state:', newState);
        
        const typing = new Set<string>();
        const online = new Set<string>();
        
        Object.values(newState).forEach((presences: any) => {
          console.log('Processing presences array:', presences);
          presences.forEach((presence: any) => {
            console.log('Processing presence:', presence);
            if (presence.username) {
              online.add(presence.username);
              console.log('Added to online:', presence.username);
              if (presence.typing) {
                typing.add(presence.username);
              }
            }
          });
        });
        
        console.log('Final online users:', Array.from(online));
        console.log('Final typing users:', Array.from(typing));
        setTypingUsers(typing);
        setOnlineUsers(online);
      })
      .on('presence', { event: 'join' }, ({ newPresences }) => {
        console.log('User joined presence:', newPresences);
      })
      .on('presence', { event: 'leave' }, ({ leftPresences }) => {
        console.log('User left presence:', leftPresences);
      })
      .subscribe(async (status) => {
        console.log('Channel status:', status);
        if (status === 'SUBSCRIBED') {
          setCurrentChannel(channel);
          
          const presenceData = {
            user_id: user.id,
            username: cachedUsername,
            typing: false,
            online_at: new Date().toISOString(),
          };
          
          console.log('Tracking presence:', presenceData);
          
          // Add immediate fallback
          setOnlineUsers(prev => new Set([...prev, cachedUsername]));
          
          // Try tracking - but don't wait for it
          channel.track(presenceData).then(result => {
            console.log('Track result:', result);
          }).catch(error => {
            console.log('Track error (using fallback):', error);
          });
        }
      });

    return () => {
      console.log('Cleaning up channel');
      if (channel) {
        supabase.removeChannel(channel);
      }
      setCurrentChannel(null);
      setOnlineUsers(new Set());
      setTypingUsers(new Set());
    };
  }, [isOpen, user?.id]); // playSound'u dependency'den çıkardım

  const fetchMessages = async () => {
    try {
      const { data, error } = await supabase
        .from('global_chat')
        .select('*')
        .order('created_at', { ascending: true })
        .limit(50);

      if (error) throw error;
      setMessages(data || []);
    } catch (error) {
      console.error('Error fetching messages:', error);
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

    setIsLoading(true);
    try {
      // Use cached username to avoid API call
      const displayName = user.user_metadata?.username || user.email?.split('@')[0] || 'Anonim';

      const { data, error } = await supabase
        .from('global_chat')
        .insert({
          user_id: user.id,
          username: displayName,
          message: trimmedMessage
        })
        .select()
        .single();

      if (error) throw error;

      // Anında kendi mesajımızı listeye ekle
      if (data) {
        setMessages(prev => [...prev, data]);
      }

      setNewMessage('');
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
    
    // Typing indicator
    if (user && currentChannel && currentChannel.state === 'joined') {
      try {
        // Use cached username to avoid API call
        const displayName = user.user_metadata?.username || user.email?.split('@')[0] || 'Anonim';
        
        if (currentChannel && currentChannel.state === 'joined') {
          // Send typing status
          try {
            await currentChannel.track({
              user_id: user.id,
              username: displayName,
              typing: true,
              online_at: new Date().toISOString(),
            });
            
            // Clear previous timeout
            if (typingTimeout) {
              clearTimeout(typingTimeout);
            }
            
            // Set new timeout to stop typing
            const timeout = setTimeout(async () => {
              try {
                await currentChannel.track({
                  user_id: user.id,
                  username: displayName,
                  typing: false,
                  online_at: new Date().toISOString(),
                });
              } catch (error) {
                console.error('Error stopping typing indicator:', error);
              }
            }, 2000);
            
            setTypingTimeout(timeout);
          } catch (error) {
            console.error('Error sending typing indicator:', error);
          }
        }
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

  // Start private chat
  const startPrivateChat = async (targetUser: SelectedUser) => {
    if (!user) return;
    
    try {
      const { data: chatId, error } = await supabase
        .rpc('get_or_create_private_chat', {
          other_user_id: targetUser.id
        });

      if (error) throw error;
      
      setActiveChatId(chatId);
      setSelectedUser(targetUser);
      setViewMode('private-chat');
      toast.success(`${targetUser.username} ile özel sohbet başlatıldı`);
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
      <div className="flex items-center justify-between p-4 border-b border-border">
        <div className="flex items-center space-x-2">
          <MessageCircle className="w-5 h-5 text-primary" />
          <h3 className="font-semibold text-lg">Kullanıcılar</h3>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setViewMode('global')}
          className="text-muted-foreground hover:text-foreground"
        >
          <X className="w-4 h-4" />
        </Button>
      </div>

      {/* Users List */}
      <ScrollArea className="flex-1 p-4">
        <div className="space-y-2">
          {allUsers.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              Henüz kullanıcı yok
            </div>
          ) : (
            allUsers.map((targetUser) => (
              <div
                key={targetUser.id}
                className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center space-x-3">
                  <UserAvatar
                    src={targetUser.avatar_url}
                    alt={targetUser.username}
                    fallback={targetUser.username.charAt(0).toUpperCase()}
                    size="xxs"
                  />
                  <div>
                    <div className="font-medium">{targetUser.username}</div>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => startPrivateChat(targetUser)}
                  className="flex items-center space-x-2"
                >
                  <Mail className="w-4 h-4" />
                  <span>Sohbet</span>
                </Button>
              </div>
            ))
          )}
        </div>
      </ScrollArea>
    </>
  );

  const renderGlobalChat = () => (
    <>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border">
        <div className="flex items-center space-x-2">
          <MessageCircle className="w-5 h-5 text-primary" />
          <div>
            <h3 className="font-semibold text-lg">Global Sohbet</h3>
            <p className="text-xs text-muted-foreground">
              {onlineUsers.size > 0 ? `${onlineUsers.size} kişi çevrimiçi` : 'Kimse çevrimiçi değil'}
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <div className="flex items-center space-x-2">
            <span className="text-sm text-muted-foreground">Özel Mesaj</span>
            <Switch
              checked={privateChatEnabled}
              onCheckedChange={setPrivateChatEnabled}
            />
          </div>
          {privateChatEnabled && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setViewMode('users')}
              className="text-muted-foreground hover:text-foreground"
            >
              <Mail className="w-4 h-4" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-4 overflow-hidden">
        <div className="space-y-4 overflow-hidden">
          {messages.map((message) => (
            <div key={message.id} className="group flex flex-col space-y-1 hover:bg-muted/30 rounded-lg p-2 -m-2 transition-colors">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <UserAvatar
                    src={userAvatars[message.user_id]}
                    alt={message.username}
                    fallback={message.username.charAt(0).toUpperCase()}
                    size="xxs"
                  />
                  <span 
                    className={`text-sm font-medium ${
                      message.user_id === user?.id ? 'text-primary' : 'text-muted-foreground'
                    }`}
                  >
                    {message.username}
                  </span>
                  {onlineUsers.has(message.username) && (
                    <div className="w-2 h-2 bg-green-500 rounded-full" title="Çevrimiçi"></div>
                  )}
                  <span className="text-xs text-muted-foreground">
                    {formatTime(message.created_at)}
                  </span>
                  
                  {/* Private Message Button */}
                  {privateChatEnabled && message.user_id !== user?.id && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => startPrivateChat({
                        id: message.user_id,
                        username: message.username,
                        avatar_url: userAvatars[message.user_id]
                      })}
                      className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-primary/20"
                      title="Özel mesaj gönder"
                    >
                      <Mail className="w-3 h-3 text-primary" />
                    </Button>
                  )}
                </div>
                
                {/* Delete button for own messages */}
                {message.user_id === user?.id && (
                  <button
                    onClick={() => deleteMessage(message.id)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-destructive/20 rounded"
                    title="Mesajı sil"
                  >
                    <Trash2 className="w-3 h-3 text-destructive" />
                  </button>
                )}
              </div>
              <div className="break-words text-foreground">
                {message.message}
              </div>
              
              {/* Reactions */}
              <div className="flex items-center space-x-2 mt-1">
                {/* Show existing reactions */}
                {messageReactions[message.id] && Object.entries(groupReactions(messageReactions[message.id])).map(([emoji, reactions]) => (
                  <button
                    key={emoji}
                    onClick={() => toggleReaction(message.id, emoji)}
                    className={`flex items-center space-x-1 px-2 py-1 rounded-full text-xs transition-colors ${
                      reactions.some(r => r.user_id === user?.id)
                        ? 'bg-primary/20 text-primary border border-primary/30'
                        : 'bg-muted hover:bg-muted/80'
                    }`}
                  >
                    <span>{emoji}</span>
                    <span>{reactions.length}</span>
                  </button>
                ))}
                
                {/* Add reaction button */}
                <div className="relative">
                  <button
                    onClick={() => setShowEmojiPicker(showEmojiPicker === message.id ? null : message.id)}
                    className="w-6 h-6 rounded-full bg-muted hover:bg-muted/80 flex items-center justify-center text-xs"
                    title="Reaksiyon ekle"
                  >
                    +
                  </button>
                  
                  {/* Quick emoji picker */}
                  {showEmojiPicker === message.id && (
                    <div className="absolute bottom-full left-0 mb-1 bg-popover border rounded-lg p-2 shadow-md z-10">
                      <div className="flex space-x-1">
                        {['👍', '❤️', '😂', '😮', '😢', '😡'].map(emoji => (
                          <button
                            key={emoji}
                            onClick={() => addReaction(message.id, emoji)}
                            className="w-8 h-8 rounded hover:bg-muted/50 flex items-center justify-center"
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
          
          {/* Typing indicator */}
          {typingUsers.size > 0 && (
            <div className="flex items-center space-x-2 text-muted-foreground text-sm italic">
              <div className="flex space-x-1">
                <div className="w-2 h-2 bg-primary rounded-full animate-bounce"></div>
                <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
              </div>
              <span>
                {Array.from(typingUsers).slice(0, 2).join(', ')} yazıyor...
                {typingUsers.size > 2 && ` ve ${typingUsers.size - 2} kişi daha`}
              </span>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      <Separator />

      {/* Message Input */}
      <div className="p-4">
        <div className="flex space-x-2">
          <Input
            value={newMessage}
            onChange={handleInputChange}
            onKeyPress={handleKeyPress}
            placeholder="Mesajınızı yazın..."
            maxLength={200}
            disabled={isLoading}
            className="flex-1"
          />
          <Button
            onClick={sendMessage}
            disabled={!newMessage.trim() || isLoading}
            size="sm"
            className="px-3"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
        <div className="text-xs text-muted-foreground mt-1 text-right">
          {newMessage.length}/200
        </div>
      </div>
    </>
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md h-[600px] flex flex-col bg-background border-2 border-primary/20">
        {renderContent()}
      </Card>
    </div>
  );
}