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
import { sendMessageNotification } from '@/utils/notifications';
import { Trash2 } from 'lucide-react';
import { useChatNotifications } from '@/hooks/useChatNotifications';

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
  const { refreshUnreadCounts } = useChatNotifications();

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
    .channel(`private-chat-${chatId}-${Date.now()}`) // Unique channel name
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'private_messages',
        filter: `chat_id=eq.${chatId}` // ✅ BU ÇOK ÖNEMLİ
      },
      async (payload) => {
        console.log('📨 New private message:', payload.new);
        
        const newMsg = payload.new;
        // Hemen state'e ekle (duplicate kontrolü ile)
        setMessages(prev => {
          const exists = prev.some(msg => msg.id === newMsg.id);
          if (exists) return prev;
          return [...prev, newMsg];
        });
        
        playSound('correctWord');
        
        // Eğer mesaj bana gelmişse, hemen okundu olarak işaretle
        if (newMsg.recipient_id === user.id) {
          await supabase
            .from('private_messages')
            .update({ is_read: true })
            .eq('id', newMsg.id);
        }
      }
    )
    .subscribe((status) => {
      console.log(`📡 Private chat ${chatId} status:`, status);
    });

  return () => {
    console.log('🧹 Cleaning up private chat channel');
    supabase.removeChannel(channel);
  };
}, [chatId, user?.id]);

  // PrivateChat.tsx - Mesajları okundu olarak işaretle
useEffect(() => {
  if (!chatId || !user) return;

  // Bu sohbetteki okunmamış mesajları okundu yap
  const markMessagesAsRead = async () => {
    try {
      await supabase
        .from('private_messages')
        .update({ is_read: true })
        .eq('chat_id', chatId)
        .neq('sender_id', user.id)
        .eq('is_read', false);

      // Bildirimleri de okundu yap - şimdilik pas geç
      console.log('Marking notifications as read for chat:', chatId);

    } catch (error) {
      console.error('Error marking messages as read:', error);
    }
  };

  markMessagesAsRead();
}, [chatId, user]);

const deleteMessage = async (messageId: string, senderId: string) => {
  if (!user || senderId !== user.id) {
    toast.error('Sadece kendi mesajlarınızı silebilirsiniz');
    return;
  }

  const confirmed = window.confirm('Bu mesajı silmek istediğinizden emin misiniz?');
  if (!confirmed) return;

  try {
    const { error } = await supabase
      .from('private_messages')
      .delete()
      .eq('id', messageId)
      .eq('sender_id', user.id); // Güvenlik için tekrar kontrol

    if (error) throw error;
    
    playSound('buttonClick');
    toast.success('Mesaj silindi');
  } catch (error) {
    console.error('Error deleting private message:', error);
    toast.error('Mesaj silinirken hata oluştu');
  }
};

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

// PrivateChat.tsx - sendMessage fonksiyonunu düzelt
const sendMessage = async () => {
  if (!newMessage.trim() || !user || !chatId) {
    return;
  }

  const trimmedMessage = newMessage.trim();
  if (trimmedMessage.length > 500) {
    toast.error('Mesaj 500 karakterden uzun olamaz');
    return;
  }

  const username = user.user_metadata?.username || user.email?.split('@')[0] || 'Anonim';

  setNewMessage('');
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

    // Manuel olarak mesajı state'e ekle (optimistic update kaldırıldı)
    const newMsg = {
      ...data,
      username: 'Sen',
      avatar_url: null
    };
    
    setMessages(prev => [...prev, newMsg]);
    scrollToBottom();

    // Bildirim gönder
    await sendMessageNotification(otherUser.id, username, chatId);
    playSound('buttonClick');
    
  } catch (error) {
    console.error('Error sending private message:', error);
    toast.error('Mesaj gönderilirken hata oluştu');
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
      className={`group flex ${
        message.sender_id === user?.id ? 'justify-end' : 'justify-start'
      }`}
    >
      <div
        className={`max-w-[70%] p-3 rounded-lg relative ${
          message.sender_id === user?.id
            ? 'bg-primary text-primary-foreground ml-auto'
            : 'bg-muted'
        }`}
      >
        {/* Silme butonu - sadece kendi mesajlarında göster */}
        {message.sender_id === user?.id && !message.id.startsWith('temp-') && (
          <button
            onClick={() => deleteMessage(message.id, message.sender_id)}
            className="absolute -top-2 -right-2 opacity-0 group-hover:opacity-100 transition-opacity bg-red-500 hover:bg-red-600 text-white rounded-full p-1 shadow-lg z-10"
            title="Mesajı sil"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        )}
        
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
