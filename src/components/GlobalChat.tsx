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
import { Send, MessageCircle, X, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

interface ChatMessage {
  id: string;
  user_id: string;
  username: string;
  message: string;
  created_at: string;
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
  const [messageReactions, setMessageReactions] = useState<{[messageId: string]: MessageReaction[]}>({});
  const [showEmojiPicker, setShowEmojiPicker] = useState<string | null>(null);
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

  // Fetch reactions when messages change
  useEffect(() => {
    if (messages.length > 0) {
      fetchReactions();
    }
  }, [messages]);

  // Set up realtime subscription and presence
  useEffect(() => {
    if (!isOpen || !user?.id) return;

    const setupPresence = async () => {
      try {
        // Get username for presence
        const { data: profileData } = await supabase
          .from('profiles')
          .select('username, email')
          .eq('id', user.id)
          .maybeSingle();

        const displayName = profileData?.username || profileData?.email?.split('@')[0] || 'Anonim';

        const channel = supabase
          .channel('global-chat')
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
              
              // Play sound for new messages from other users
              playSound('correctWord');
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
              setMessageReactions(prev => ({
                ...prev,
                [newReaction.message_id]: [
                  ...(prev[newReaction.message_id] || []),
                  newReaction
                ]
              }));
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
              setMessageReactions(prev => ({
                ...prev,
                [deletedReaction.message_id]: (prev[deletedReaction.message_id] || [])
                  .filter(r => r.id !== deletedReaction.id)
              }));
            }
          )
          .on('presence', { event: 'sync' }, () => {
            const newState = channel.presenceState();
            const typing = new Set<string>();
            const online = new Set<string>();
            
            Object.values(newState).forEach((presences: any) => {
              presences.forEach((presence: any) => {
                if (presence.user_id !== user.id) {
                  online.add(presence.username);
                  if (presence.typing) {
                    typing.add(presence.username);
                  }
                }
              });
            });
            
            setTypingUsers(typing);
            setOnlineUsers(online);
          })
          .subscribe(async (status) => {
            if (status === 'SUBSCRIBED') {
              // Track user presence when subscribed
              await channel.track({
                user_id: user.id,
                username: displayName,
                typing: false,
                online_at: new Date().toISOString(),
              });
            }
          });

        return () => {
          supabase.removeChannel(channel);
        };
      } catch (error) {
        console.error('Error setting up presence:', error);
      }
    };

    const cleanup = setupPresence();
    return () => {
      cleanup.then(cleanupFn => cleanupFn && cleanupFn());
    };
  }, [isOpen, user?.id, playSound]);

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
      // Get username from profiles table
      const { data: profileData } = await supabase
        .from('profiles')
        .select('username, email')
        .eq('id', user.id)
        .maybeSingle();

      const displayName = profileData?.username || profileData?.email?.split('@')[0] || 'Anonim';

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
    if (user) {
      try {
        // Get username from profiles table  
        const { data: profileData } = await supabase
          .from('profiles')
          .select('username, email')
          .eq('id', user.id)
          .maybeSingle();

        const displayName = profileData?.username || profileData?.email?.split('@')[0] || 'Anonim';
        
        const channel = supabase.channel('global-chat');
        
        // Send typing status
        channel.track({
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
        const timeout = setTimeout(() => {
          channel.track({
            user_id: user.id,
            username: displayName,
            typing: false,
            online_at: new Date().toISOString(),
          });
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

  // Add emoji reaction
  const addReaction = async (messageId: string, emoji: string) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('message_reactions')
        .insert({
          message_id: messageId,
          user_id: user.id,
          emoji: emoji
        });

      if (error) throw error;
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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md h-[600px] flex flex-col bg-background border-2 border-primary/20">
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
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Messages */}
        <ScrollArea className="flex-1 p-4">
          <div className="space-y-4">
            {messages.map((message) => (
              <div key={message.id} className="group flex flex-col space-y-1 hover:bg-muted/30 rounded-lg p-2 -m-2 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span 
                      className={`text-sm font-medium ${
                        message.user_id === user?.id ? 'text-primary' : 'text-muted-foreground'
                      }`}
                    >
                      {message.username}
                    </span>
                    {onlineUsers.has(message.username) && message.user_id !== user?.id && (
                      <div className="w-2 h-2 bg-green-500 rounded-full" title="Çevrimiçi"></div>
                    )}
                    <span className="text-xs text-muted-foreground">
                      {formatTime(message.created_at)}
                    </span>
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
      </Card>
    </div>
  );
}