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

  // Set up realtime subscription
  useEffect(() => {
    if (!chatId || !user?.id) return;

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
        (payload) => {
          const newMsg = payload.new as PrivateMessage;
          
          // Don't duplicate our own messages
          if (newMsg.sender_id === user?.id) {
            return;
          }
          
          setMessages(prev => [...prev, newMsg]);
          playSound('correctWord');
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [chatId, user?.id, playSound]);

  const fetchMessages = async () => {
    try {
      const { data, error } = await supabase
        .from('private_messages')
        .select('*')
        .eq('chat_id', chatId)
        .order('created_at', { ascending: true })
        .limit(100);

      if (error) throw error;
      setMessages(data || []);
    } catch (error) {
      console.error('Error fetching messages:', error);
      toast.error('Mesajlar yüklenirken hata oluştu');
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !user || !chatId) {
      console.log('Private message send blocked:', { 
        messageEmpty: !newMessage.trim(), 
        noUser: !user, 
        noChatId: !chatId 
      });
      return;
    }

    const trimmedMessage = newMessage.trim();
    if (trimmedMessage.length > 500) {
      toast.error('Mesaj 500 karakterden uzun olamaz');
      return;
    }

    console.log('Sending private message:', {
      chatId,
      senderId: user.id,
      message: trimmedMessage
    });

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

      console.log('Private message insert result:', { data, error });

      if (error) throw error;

      // Add message immediately to UI
      if (data) {
        console.log('Adding private message to UI:', data);
        setMessages(prev => [...prev, data]);
      }

      setNewMessage('');
      playSound('buttonClick');
      console.log('Private message sent successfully');
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