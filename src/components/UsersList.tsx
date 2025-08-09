import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Search, MessageCircle } from 'lucide-react';
import { UserAvatar } from '@/components/UserAvatar';
import { toast } from 'sonner';

interface User {
  id: string;
  username: string;
  avatar_url?: string;
  email: string;
}

interface UsersListProps {
  onStartChat: (userId: string, user: User) => void;
}

export function UsersList({ onStartChat }: UsersListProps) {
  const { user } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    fetchUsers();
  }, []);

  useEffect(() => {
    if (searchQuery.trim()) {
      const filtered = users.filter(u => 
        u.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
        u.email.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredUsers(filtered);
    } else {
      setFilteredUsers(users);
    }
  }, [searchQuery, users]);

  const fetchUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, username, email, avatar_url')
        .neq('id', user?.id) // Exclude current user
        .order('username', { ascending: true })
        .limit(50);

      if (error) throw error;
      setUsers(data || []);
    } catch (error) {
      console.error('Error fetching users:', error);
      toast.error('Kullanıcılar yüklenirken hata oluştu');
    }
  };

  const handleStartChat = async (targetUser: User) => {
    if (!user) return;
    
    setIsLoading(true);
    try {
      const { data: chatId, error } = await supabase
        .rpc('get_or_create_private_chat', {
          other_user_id: targetUser.id
        });

      if (error) throw error;
      
      onStartChat(chatId, targetUser);
      toast.success(`${targetUser.username} ile sohbet başlatıldı`);
    } catch (error) {
      console.error('Error starting chat:', error);
      toast.error('Sohbet başlatılırken hata oluştu');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-md h-[600px] flex flex-col bg-background border-2 border-primary/20">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border">
        <div className="flex items-center space-x-2">
          <MessageCircle className="w-5 h-5 text-primary" />
          <h3 className="font-semibold text-lg">Kullanıcılar</h3>
        </div>
      </div>

      {/* Search */}
      <div className="p-4 border-b border-border">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Kullanıcı ara..."
            className="pl-10"
          />
        </div>
      </div>

      {/* Users List */}
      <ScrollArea className="flex-1 p-4">
        <div className="space-y-2">
          {filteredUsers.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              {searchQuery ? 'Kullanıcı bulunamadı' : 'Henüz kullanıcı yok'}
            </div>
          ) : (
            filteredUsers.map((targetUser) => (
              <div
                key={targetUser.id}
                className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center space-x-3">
                  <UserAvatar
                    src={targetUser.avatar_url}
                    alt={targetUser.username}
                    fallback={targetUser.username.charAt(0).toUpperCase()}
                    size="md"
                  />
                  <div>
                    <div className="font-medium">{targetUser.username}</div>
                    <div className="text-sm text-muted-foreground truncate max-w-[150px]">
                      {targetUser.email}
                    </div>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleStartChat(targetUser)}
                  disabled={isLoading}
                  className="flex items-center space-x-2"
                >
                  <MessageCircle className="w-4 h-4" />
                  <span>Sohbet</span>
                </Button>
              </div>
            ))
          )}
        </div>
      </ScrollArea>
    </Card>
  );
}