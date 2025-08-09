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
import { Send, MessageCircle, X } from 'lucide-react';
import { toast } from 'sonner';

interface ChatMessage {
  id: string;
  user_id: string;
  username: string;
  message: string;
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

  // Set up realtime subscription
  useEffect(() => {
    if (!isOpen) return;

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
      .subscribe();

    return () => {
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
        .single();

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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md h-[600px] flex flex-col bg-background border-2 border-primary/20">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center space-x-2">
            <MessageCircle className="w-5 h-5 text-primary" />
            <h3 className="font-semibold text-lg">Global Sohbet</h3>
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
              <div key={message.id} className="flex flex-col space-y-1">
                <div className="flex items-center space-x-2">
                  <span 
                    className={`text-sm font-medium ${
                      message.user_id === user?.id ? 'text-primary' : 'text-muted-foreground'
                    }`}
                  >
                    {message.username}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {formatTime(message.created_at)}
                  </span>
                </div>
                <div className="break-words text-foreground">
                  {message.message}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>

        <Separator />

        {/* Message Input */}
        <div className="p-4">
          <div className="flex space-x-2">
            <Input
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
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