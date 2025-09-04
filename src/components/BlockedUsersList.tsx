import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { UserAvatar } from '@/components/UserAvatar';
import { ShieldOff, Calendar } from 'lucide-react';
import { useUserBlocking } from '@/hooks/useUserBlocking';

export function BlockedUsersList() {
  const { getBlockedUsersList, unblockUser } = useUserBlocking();
  const [blockedList, setBlockedList] = useState<any[]>([]);

  const loadList = async () => {
    const list = await getBlockedUsersList();
    setBlockedList(list);
  };

  useEffect(() => {
    loadList();
  }, []);

  const handleUnblock = async (userId: string) => {
    const success = await unblockUser(userId);
    if (success) {
      loadList(); // Listeyi yenile
    }
  };

  return (
    <Card className="p-4">
      <div className="flex items-center space-x-2 mb-4">
        <Shield className="w-5 h-5" />
        <h3 className="text-lg font-semibold">Engellenen Kullanıcılar</h3>
      </div>

      <ScrollArea className="h-64">
        {blockedList.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <Shield className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>Henüz engellenen kullanıcı yok</p>
          </div>
        ) : (
          <div className="space-y-3">
            {blockedList.map((block) => (
              <div 
                key={block.id}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
              >
                <div className="flex items-center space-x-3">
                  <UserAvatar
                    src={block.blocked_user?.avatar_url}
                    alt={block.blocked_user?.username}
                    fallback={block.blocked_user?.username?.charAt(0).toUpperCase()}
                    size="sm"
                  />
                  <div>
                    <p className="font-medium">{block.blocked_user?.username}</p>
                    <div className="flex items-center space-x-1 text-xs text-gray-500">
                      <Calendar className="w-3 h-3" />
                      <span>{new Date(block.created_at).toLocaleDateString('tr-TR')}</span>
                    </div>
                    {block.reason && (
                      <p className="text-xs text-gray-600 mt-1">{block.reason}</p>
                    )}
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleUnblock(block.blocked_id)}
                  className="text-green-600 hover:text-green-700"
                >
                  <ShieldOff className="w-4 h-4 mr-1" />
                  Engeli Kaldır
                </Button>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>
    </Card>
  );
}
