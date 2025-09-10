import React, { useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useMatchmaking } from '@/contexts/NewMatchmakingContext';
import { Search, Users, Bot, X } from 'lucide-react';

interface NewMatchmakingModalProps {
  isOpen: boolean;
  onClose: () => void;
  gameType: 'timed' | 'score';
  onMatchFound: (roomId: string) => void;
}

const NewMatchmakingModal: React.FC<NewMatchmakingModalProps> = ({
  isOpen,
  onClose,
  gameType,
  onMatchFound
}) => {
  const { 
    isSearching, 
    currentRoom, 
    searchProgress, 
    startSearch, 
    cancelSearch 
  } = useMatchmaking();

  useEffect(() => {
    if (isOpen && !isSearching) {
      startSearch(gameType);
    }
  }, [isOpen, gameType]);

  const handleClose = () => {
    if (isSearching) {
      cancelSearch();
    }
    onClose();
  };

  const getSearchStatus = () => {
    if (!isSearching) return { icon: Search, title: 'Hazırlanıyor...', description: 'Eşleşme sistemi başlatılıyor' };
    
    if (currentRoom) {
      // Gerçek oyuncu bulundu
      if (currentRoom.status === 'matched' && currentRoom.current_players >= 2) {
        return {
          icon: Users,
          title: '🎉 Eşleşme Bulundu!',
          description: 'Gerçek oyuncu bulundu! Oyun başlıyor...'
        };
      }
      
      // Oda bekliyor
      if (currentRoom.current_players === 1) {
        if (searchProgress < 100) {
          return {
            icon: Users,
            title: 'Oyuncu Aranıyor',
            description: `Gerçek oyuncu aranıyor... (${currentRoom.current_players}/${currentRoom.max_players})`
          };
        } else {
          return {
            icon: Bot,
            title: 'AI Rakip Hazırlanıyor',
            description: 'Gerçek oyuncu bulunamadı, AI rakip ekleniyor...'
          };
        }
      }
      
      // Birden fazla oyuncu var
      return {
        icon: Users,
        title: 'Oyuncular Hazır!',
        description: `${currentRoom.current_players}/${currentRoom.max_players} oyuncu - Eşleşme tamamlanıyor...`
      };
    }

    return { icon: Search, title: 'Arama Başlıyor...', description: 'Lütfen bekleyin' };
  };

  const status = getSearchStatus();
  const StatusIcon = status.icon;

  return (
    <Dialog open={isOpen} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <StatusIcon className="h-5 w-5 animate-pulse text-primary" />
            {status.title}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="text-center space-y-2">
            <div className="h-16 w-16 mx-auto bg-primary/10 rounded-full flex items-center justify-center">
              <StatusIcon className="h-8 w-8 text-primary animate-pulse" />
            </div>
            <p className="text-sm text-muted-foreground">
              {status.description}
            </p>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Arama İlerlemesi</span>
              <span>{Math.round(searchProgress)}%</span>
            </div>
            <Progress value={searchProgress} className="h-2" />
          </div>

          <div className="text-xs text-center text-muted-foreground space-y-1">
            {currentRoom?.status === 'matched' ? (
              <>
                <p>• ✅ Gerçek oyuncu bulundu!</p>
                <p>• 🚀 Oyun başlatılıyor...</p>
              </>
            ) : searchProgress < 100 ? (
              <>
                <p>• 🔍 Gerçek oyuncular aranıyor</p>
                <p>• ⏱️ 30 saniye sonra AI rakip eklenecek</p>
                <p>• 👤 {currentRoom?.current_players || 0}/2 oyuncu</p>
                <p>• 🏠 Oda ID: {currentRoom?.id.slice(-8) || 'N/A'}</p>
              </>
            ) : (
              <>
                <p>• 🤖 AI rakip hazırlanıyor</p>
                <p>• ⚡ Oyun yakında başlayacek</p>
              </>
            )}
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={handleClose}
              className="flex-1"
            >
              <X className="h-4 w-4 mr-2" />
              İptal Et
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default NewMatchmakingModal;