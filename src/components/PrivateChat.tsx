import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useSounds } from '@/hooks/useSounds';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Send, ArrowLeft } from 'lucide-react';
import { UserAvatar } from '@/components/UserAvatar';
import { toast } from 'sonner';

interface PrivateMessage {
  id: string;
  chat_id: string;
  sender_id: string;
  message: string;
  created_at: string;
  is_read: boolean;
}

interface PrivateChatProps {
  chatId: string;
  otherUser: {
    id: string;
    username: string;
    avatar_url?: string;
  };
  onBack: () => void;
}

export function PrivateChat({ chatId, otherUser, onBack }: PrivateChatProps) {
  const { user } = useAuth();
  const { playSound } = useSounds();
  const [messages, setMessages] = useState<PrivateMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom when new messages arrive
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Fetch messages
  useEffect(() => {
    if (chatId) {
      fetchMessages();
    }
  }, [chatId]);

// PrivateChat.tsx'e real-time subscription ekle
useEffect(() => {
  if (!chatId || !user?.id) return;

  console.log('🔄 Setting up PRIVATE real-time for chat:', chatId);

  const channel = supabase
    .channel(`private-chat-${chatId}-realtime`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'private_messages',
        filter: `chat_id=eq.${chatId}`
      },
      async (payload) => {
        console.log('📨 REAL-TIME PRIVATE MESSAGE:', payload);
        const newMsg = payload.new as any;
        
        // Kendi mesajımızı ignore et
        if (newMsg.sender_id === user.id) {
          console.log('⏭️ Skipping own private message');
          return;
        }

        // Kullanıcı bilgilerini al
        let username = 'Bilinmeyen';
        let avatar_url = null;

        try {
          const { data: profile } = await supabase
            .from('profiles')
            .select('username, avatar_url')
            .eq('id', newMsg.sender_id)
            .single();

          if (profile) {
            username = profile.username;
            avatar_url = profile.avatar_url;
          }
        } catch (error) {
          console.warn('Could not fetch user profile for real-time message:', error);
        }

        // Mesajı state'e ekle
        setMessages(prev => {
          const alreadyExists = prev.some(msg => msg.id === newMsg.id);
          if (alreadyExists) {
            console.log('⚠️ Private message already exists, skipping');
            return prev;
          }

          console.log('✅ Adding new private message to state');
          return [...prev, {
            id: newMsg.id,
            chat_id: newMsg.chat_id,
            sender_id: newMsg.sender_id,
            message: newMsg.message,
            created_at: newMsg.created_at,
            is_read: newMsg.is_read,
            username: username,
            avatar_url: avatar_url
          }];
        });

        // Okundu olarak işaretle
        try {
          await supabase
            .from('private_messages')
            .update({ is_read: true })
            .eq('id', newMsg.id)
            .eq('chat_id', chatId);
        } catch (error) {
          console.warn('Could not mark message as read:', error);
        }

        playSound('correctWord');
      }
    )
    .subscribe((status) => {
      console.log('📡 Private chat real-time status:', status);
      if (status === 'SUBSCRIBED') {
        console.log('✅ Private chat real-time subscribed successfully');
      }
    });

  return () => {
    console.log('🧹 Cleaning up private chat real-time channel');
    supabase.removeChannel(channel);
  };
}, [chatId, user?.id, playSound]);

  const fetchMessages = async () => {
  try {
    console.log('Fetching private messages for chat:', chatId);
    
    // Mevcut tablo yapısına göre sorgu
    const { data: messagesData, error: messagesError } = await supabase
      .from('private_messages')
      .select(`
        id,
        chat_id,
        sender_id,
        message,
        created_at,
        is_read
      `)
      .eq('chat_id', chatId)
      .order('created_at', { ascending: true })
      .limit(100);

    if (messagesError) {
      console.error('Private messages fetch error:', messagesError);
      throw messagesError;
    }

    if (!messagesData || messagesData.length === 0) {
      setMessages([]);
      return;
    }

    // Kullanıcı ID'lerini topla
    const senderIds = [...new Set(messagesData.map(msg => msg.sender_id))];
    console.log('Sender IDs found:', senderIds);

    // Kullanıcı bilgilerini çek
    const { data: profilesData, error: profilesError } = await supabase
      .from('profiles')
      .select('id, username, avatar_url')
      .in('id', senderIds);

    // Hata olsa bile mesajları göster
    if (profilesError) {
      console.warn('Profiles fetch warning:', profilesError);
    }

    // Mesajları formatla
    const formattedMessages = messagesData.map(msg => {
      const userProfile = profilesData?.find(profile => profile.id === msg.sender_id);
      return {
        ...msg,
        username: userProfile?.username || 'Bilinmeyen',
        avatar_url: userProfile?.avatar_url || null
      };
    });

    console.log('Formatted private messages:', formattedMessages);
    setMessages(formattedMessages);
    
  } catch (error) {
    console.error('Error fetching private messages:', error);
    toast.error('Özel mesajlar yüklenirken hata oluştu');
  }
};

const sendMessage = async () => {
  if (!newMessage.trim() || !user || !chatId) {
    return;
  }

  const trimmedMessage = newMessage.trim();
  if (trimmedMessage.length > 500) {
    toast.error('Mesaj 500 karakterden uzun olamaz');
    return;
  }

  // Optimistic update
  const tempMessage: any = {
    id: `temp-${Date.now()}`,
    chat_id: chatId,
    sender_id: user.id,
    message: trimmedMessage,
    created_at: new Date().toISOString(),
    is_read: false,
    username: 'Sen', // Geçici değer
    avatar_url: null
  };

  setMessages(prev => [...prev, tempMessage]);
  setNewMessage('');
  scrollToBottom();

  setIsLoading(true);
  try {
    const { data, error } = await supabase
      .from('private_messages')
      .insert({
        chat_id: chatId,
        sender_id: user.id,
        message: trimmedMessage
      })
      .select()
      .single();

    if (error) throw error;

    // Temp mesajı gerçek mesajla değiştir
    setMessages(prev => prev.map(msg => 
      msg.id === tempMessage.id ? {
        ...data,
        username: 'Sen', // Gerçek veri geldiğinde
        avatar_url: null
      } : msg
    ));

    playSound('buttonClick');
  } catch (error) {
    console.error('Error sending private message:', error);
    toast.error('Mesaj gönderilirken hata oluştu');
    
    // Hata durumunda temp mesajı kaldır
    setMessages(prev => prev.filter(msg => msg.id !== tempMessage.id));
  } finally {
    setIsLoading(false);
  }
};

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString('tr-TR', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="w-full h-full flex flex-col bg-background">
      {/* Messages */}
      <ScrollArea className="flex-1 p-4 overflow-hidden">
        <div className="space-y-4 overflow-hidden">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${
                message.sender_id === user?.id ? 'justify-end' : 'justify-start'
              }`}
            >
              <div
                className={`max-w-[70%] p-3 rounded-lg ${
                  message.sender_id === user?.id
                    ? 'bg-primary text-primary-foreground ml-auto'
                    : 'bg-muted'
                }`}
              >
                <div className="break-words text-sm">
                  {message.message}
                </div>
                <div className={`text-xs mt-1 ${
                  message.sender_id === user?.id
                    ? 'text-primary-foreground/70'
                    : 'text-muted-foreground'
                }`}>
                  {formatTime(message.created_at)}
                </div>
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      <Separator />

      {/* Message Input */}
      <div className="p-4 bg-background">
        <div className="flex space-x-2">
          <Input
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Mesajınızı yazın..."
            maxLength={500}
            disabled={isLoading}
            className="flex-1"
          />
          <Button
            onClick={sendMessage}
            disabled={!newMessage.trim() || isLoading}
            size="sm"
            className="px-3 flex-shrink-0"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
        <div className="text-xs text-muted-foreground mt-1 text-right">
          {newMessage.length}/500
        </div>
      </div>
    </div>
  );
}