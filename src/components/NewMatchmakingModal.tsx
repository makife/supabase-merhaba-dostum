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
  useNakama?: boolean;
}

const NewMatchmakingModal: React.FC<NewMatchmakingModalProps> = ({
  isOpen,
  onClose,
  gameType,
  onMatchFound,
  useNakama = false
}) => {
  const { 
    isSearching, 
    currentRoom, 
    searchProgress, 
    searchTimeout,
    useNakama: isUsingNakama,
    nakamaMatch,
    startSearch, 
    cancelSearch,
    restartSearch,
    playWithAI
  } = useMatchmaking();

  useEffect(() => {
    if (isOpen && !isSearching) {
      startSearch(gameType, useNakama);
    }
  }, [isOpen, gameType, useNakama]);

  const handleClose = () => {
    if (isSearching) {
      cancelSearch();
    }
    onClose();
  };

  const getSearchStatus = () => {
    // Timeout durumu kontrolü
    if (searchTimeout || (searchProgress >= 100 && (!currentRoom || currentRoom.current_players < 2))) {
      return {
        icon: Search,
        title: 'Oyuncu Bulunamadı',
        description: 'Şuan için oyuncu bulunamadı. Lütfen bir seçenek seçin.'
      };
    }

    if (!isSearching) return { icon: Search, title: 'Hazırlanıyor...', description: 'Eşleşme sistemi başlatılıyor' };
    
    if (currentRoom) {
      // Gerçek oyuncu bulundu
      if (currentRoom.status === 'matched' && currentRoom.current_players >= 2) {
        return {
          icon: Users,
          title: '🎉 Eşleşme Bulundu!',
          description: 'Oyuncu bulundu! Oyun başlıyor...'
        };
      }
      
      // Oda bekliyor
      if (currentRoom.current_players === 1) {
        if (searchProgress < 100) {
          return {
            icon: Users,
            title: 'Oyuncu Aranıyor',
            description: `Oyuncu aranıyor... (${currentRoom.current_players}/${currentRoom.max_players})`
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

  // Timeout durumu - seçenek kartı göster
  if (searchTimeout || (searchProgress >= 100 && (!currentRoom || currentRoom.current_players < 2))) {
    return (
      <Dialog open={isOpen} onOpenChange={() => {}}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Search className="h-5 w-5 text-orange-500" />
              Oyuncu Bulunamadı
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="text-center space-y-2">
              <div className="h-16 w-16 mx-auto bg-orange-100 rounded-full flex items-center justify-center">
                <Search className="h-8 w-8 text-orange-500" />
              </div>
              <p className="text-sm text-muted-foreground">
                Şuan için oyuncu bulunamadı. İsterseniz tekrar arama yapabilir ya da AI ile oynayabilirsiniz.
              </p>
            </div>

            <div className="flex flex-col gap-2">
              <Button
                variant="secondary"
                onClick={playWithAI}
                className="flex-1"
              >
                <Bot className="h-4 w-4 mr-2" />
                AI ile Oyna
              </Button>
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
  }

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
                <p>• ✅ Oyuncu bulundu!</p>
                <p>• 🚀 Oyun başlatılıyor...</p>
              </>
            ) : searchProgress < 100 ? (
              <>
                <p>• 🔍 {isUsingNakama ? 'Nakama sunucusunda' : 'Supabase'} oyuncular aranıyor</p>
                <p>• ⏱️ 30 saniye sonra seçenekler gösterilecek</p>
                <p>• 👤 {currentRoom?.current_players || 0}/2 oyuncu</p>
                {isUsingNakama ? (
                  <p>• 🌐 Nakama Match ID: {nakamaMatch?.matchId?.slice(-8) || 'Aranıyor...'}</p>
                ) : (
                  <p>• 🏠 Oda ID: {currentRoom?.id.slice(-8) || 'N/A'}</p>
                )}
              </>
            ) : (
              <>
                <p>• 🤖 Oyuncu aranıyor...</p>
                <p>• ⚡ Lütfen bekleyin</p>
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