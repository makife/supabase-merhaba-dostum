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
import { useChatNotifications } from '@/hooks/useChatNotifications';

interface PrivateMessage {
  id: string;
  chat_id: string;
  sender_id: string;
  message: string;
  created_at: string;
  is_read: boolean;
  recipient_id?: string;
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

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const fetchMessages = async () => {
    try {
      const { data, error } = await supabase
        .from('private_messages')
        .select('*')
        .eq('chat_id', chatId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setMessages(data || []);
    } catch (error) {
      console.error('Error fetching messages:', error);
    }
  };

  useEffect(() => {
    if (!chatId) return;

    fetchMessages();

    const channel = supabase
      .channel(`private-chat-${chatId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'private_messages',
          filter: `chat_id=eq.${chatId}`
        },
        fetchMessages
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [chatId]);

  const sendMessage = async () => {
    if (!newMessage.trim() || !user || !chatId) return;

    const trimmedMessage = newMessage.trim();
    setNewMessage('');
    setIsLoading(true);
    
    try {
      const otherUserId = chatId.includes(user.id) 
        ? chatId.replace(`chat_${user.id}_`, '').replace(`${user.id}_chat_`, '')
        : otherUser.id;

      const { error } = await supabase
        .from('private_messages')
        .insert({
          chat_id: chatId,
          sender_id: user.id,
          recipient_id: otherUserId,
          message: trimmedMessage
        });

      if (error) throw error;
      
      playSound('buttonClick');
      refreshUnreadCounts();
    } catch (error) {
      console.error('Error sending message:', error);
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
      <ScrollArea className="flex-1 p-4 overflow-hidden">
        <div className="space-y-4">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.sender_id === user?.id ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[70%] p-3 rounded-lg ${
                  message.sender_id === user?.id
                    ? 'bg-primary text-primary-foreground'
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