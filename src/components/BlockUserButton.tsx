import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Shield, ShieldOff } from 'lucide-react';
import { useUserBlocking } from '@/hooks/useUserBlocking';

interface BlockUserButtonProps {
  targetUserId: string;
  username: string;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'default' | 'ghost' | 'outline';
}

export function BlockUserButton({ 
  targetUserId, 
  username, 
  size = 'sm',
  variant = 'ghost' 
}: BlockUserButtonProps) {
  const { blockUser, unblockUser, isUserBlocked } = useUserBlocking();
  const [reason, setReason] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const isBlocked = isUserBlocked(targetUserId);

  const handleBlock = async () => {
    setIsLoading(true);
    await blockUser(targetUserId, reason);
    setReason('');
    setIsLoading(false);
  };

  const handleUnblock = async () => {
    setIsLoading(true);
    await unblockUser(targetUserId);
    setIsLoading(false);
  };

  if (isBlocked) {
    return (
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button 
            variant={variant} 
            size={size}
            className="text-green-600 hover:text-green-700"
          >
            <ShieldOff className="w-4 h-4" />
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Engeli Kaldır</AlertDialogTitle>
            <AlertDialogDescription>
              {username} kullanıcısının engelini kaldırmak istediğinizden emin misiniz?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>İptal</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleUnblock}
              disabled={isLoading}
            >
              Engeli Kaldır
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    );
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button 
          variant={variant} 
          size={size}
          className="text-red-600 hover:text-red-700"
        >
          <Shield className="w-4 h-4" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Kullanıcıyı Engelle</AlertDialogTitle>
          <AlertDialogDescription>
            {username} kullanıcısını engellemek istediğinizden emin misiniz? 
            Bu kullanıcı size mesaj gönderemeyecek ve mesajlarını görmeyeceksiniz.
          </AlertDialogDescription>
        </AlertDialogHeader>
        
        <div className="space-y-4">
          <div>
            <Label htmlFor="reason">Sebep (Opsiyonel)</Label>
            <Textarea
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Engelleme sebebinizi yazabilirsiniz..."
              maxLength={200}
            />
          </div>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel>İptal</AlertDialogCancel>
          <AlertDialogAction 
            onClick={handleBlock}
            disabled={isLoading}
            className="bg-red-600 hover:bg-red-700"
          >
            Engelle
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
