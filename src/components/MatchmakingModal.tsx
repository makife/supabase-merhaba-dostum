import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Users, Bot, Loader2, Zap, User } from 'lucide-react';
import { useGame } from '@/contexts/GameContext';
import { useSounds } from '@/hooks/useSounds';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

interface MatchmakingModalProps {
  onClose: () => void;
  onMatchFound: (isAI: boolean) => void;
  gameType: 'timed' | 'score';
}

const MatchmakingModal = ({ onClose, onMatchFound, gameType }: MatchmakingModalProps) => {
  const [searchProgress, setSearchProgress] = useState(0);
  const [searchStatus, setSearchStatus] = useState<'searching' | 'ai-fallback' | 'found'>('searching');
  const [countdown, setCountdown] = useState(15);
  const { findRandomMatch, currentRoom } = useGame();
  const { playSound } = useSounds();
  const { toast } = useToast();
  const { user } = useAuth();

  useEffect(() => {
    let progressInterval: NodeJS.Timeout;
    let countdownInterval: NodeJS.Timeout;
    let searchTimeout: NodeJS.Timeout;
    let realtimeChannel: any;

    const startSearch = async () => {
      setSearchStatus('searching');
      
      // Progress animation
      progressInterval = setInterval(() => {
        setSearchProgress(prev => {
          if (prev >= 100) return 0; // Reset when full
          return prev + 2;
        });
      }, 100);

      // Countdown
      countdownInterval = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) {
            clearInterval(countdownInterval);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      // Search timeout - switch to AI after 15 seconds
      searchTimeout = setTimeout(() => {
        setSearchStatus('ai-fallback');
        clearInterval(progressInterval);
        clearInterval(countdownInterval);
        
        toast({
          title: 'Oyuncu Bulunamadı',
          description: 'Şu an online oyuncu yok, AI ile oynayacaksın',
          duration: 3000,
        });

        // Auto proceed with AI after 3 seconds
        setTimeout(() => {
          onMatchFound(true);
        }, 3000);
      }, 15000);

      // Try to find real player
      try {
        console.log('🔍 Attempting to find random match...');
        const match = await findRandomMatch(gameType);
        console.log('🎮 Match result:', match);
        
        if (match) {
          // Immediate match found
          clearTimeout(searchTimeout);
          clearInterval(progressInterval);
          clearInterval(countdownInterval);
          setSearchStatus('found');
          playSound('correctWord');
          toast({
            title: 'Oyuncu Bulundu!',
            description: 'Rakip oyuncu ile eşleştiniz',
          });
          setTimeout(() => {
            onMatchFound(false);
          }, 1500);
        } else {
          // No immediate match, but room created - wait for others via realtime
          console.log('🏗️ Room created, setting up realtime listener for new participants...');
          
          // Set up realtime subscription to detect when someone joins our room
          if (currentRoom) {
            realtimeChannel = supabase
              .channel(`matchmaking-${currentRoom.id}`)
              .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'game_participants',
                filter: `room_id=eq.${currentRoom.id}`
              }, (payload) => {
                console.log('🎉 New participant joined during matchmaking:', payload);
                
                // Check if it's not our own join (we already joined)
                if (payload.new?.user_id !== user?.id) {
                  console.log('✅ Real player found via realtime!');
                  clearTimeout(searchTimeout);
                  clearInterval(progressInterval);
                  clearInterval(countdownInterval);
                  setSearchStatus('found');
                  playSound('correctWord');
                  toast({
                    title: 'Oyuncu Bulundu!',
                    description: 'Rakip oyuncu katıldı!',
                  });
                  setTimeout(() => {
                    onMatchFound(false);
                  }, 1500);
                }
              })
              .subscribe();
          }
        }
      } catch (error) {
        console.error('🚨 Matchmaking error:', error);
      }
    };

    startSearch();

    return () => {
      clearInterval(progressInterval);
      clearInterval(countdownInterval);
      clearTimeout(searchTimeout);
      if (realtimeChannel) {
        console.log('🧹 Cleaning up realtime channel');
        supabase.removeChannel(realtimeChannel);
      }
    };
  }, [findRandomMatch, gameType, playSound, toast, onMatchFound]);

  const handlePlayWithAI = () => {
    playSound('buttonClick');
    onMatchFound(true);
  };

  const getStatusInfo = () => {
    switch (searchStatus) {
      case 'searching':
        return {
          icon: Zap,
          title: 'Oyuncu Aranıyor...',
          description: 'Online oyuncular arasında rakip arıyoruz',
          color: 'text-purple-500',
          bgColor: 'bg-purple-500'
        };
      case 'ai-fallback':
        return {
          icon: Bot,
          title: 'Oyuncu Bulunamadı',
          description: 'AI ile oynama hazırlanıyor...',
          color: 'text-blue-500',
          bgColor: 'bg-blue-500'
        };
      case 'found':
        return {
          icon: User,
          title: 'Oyuncu Bulundu!',
          description: 'Rakip ile eşleştiniz',
          color: 'text-green-500',
          bgColor: 'bg-green-500'
        };
    }
  };

  const statusInfo = getStatusInfo();

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <Card className="w-full max-w-md">
        <CardContent className="p-8 text-center space-y-6">
          {/* Animated Icon */}
          <div className="relative">
            <div className={`w-20 h-20 ${statusInfo.bgColor} rounded-full mx-auto flex items-center justify-center ${
              searchStatus === 'searching' ? 'animate-pulse' : ''
            }`}>
              {searchStatus === 'searching' ? (
                <Loader2 className="w-10 h-10 text-white animate-spin" />
              ) : (
                <statusInfo.icon className="w-10 h-10 text-white" />
              )}
            </div>
            
            {/* Ripple effect for searching */}
            {searchStatus === 'searching' && (
              <>
                <div className="absolute inset-0 rounded-full border-4 border-purple-500/30 animate-ping"></div>
                <div className="absolute inset-2 rounded-full border-4 border-purple-500/20 animate-ping animation-delay-300"></div>
              </>
            )}
          </div>

          {/* Status Text */}
          <div className="space-y-2">
            <h2 className={`text-2xl font-bold ${statusInfo.color}`}>
              {statusInfo.title}
            </h2>
            <p className="text-muted-foreground">
              {statusInfo.description}
            </p>
          </div>

          {/* Game Type Badge */}
          <div className="inline-flex items-center px-3 py-1 bg-muted rounded-full">
            <span className="text-sm font-medium">
              {gameType === 'timed' ? 'Zamana Karşı' : 'Puana Karşı'}
            </span>
          </div>

          {/* Progress Bar (only during search) */}
          {searchStatus === 'searching' && (
            <div className="space-y-2">
              <Progress value={searchProgress} className="h-2" />
              <p className="text-sm text-muted-foreground">
                Arama sürecek: {countdown} saniye
              </p>
            </div>
          )}

          {/* AI Fallback Options */}
          {searchStatus === 'ai-fallback' && (
            <div className="space-y-3">
              <div className="flex items-center justify-center space-x-2 text-sm text-muted-foreground">
                <Bot className="w-4 h-4" />
                <span>AI ile oynama otomatik başlayacak</span>
              </div>
              <Button
                onClick={handlePlayWithAI}
                className="w-full"
                size="lg"
              >
                Hemen AI ile Oyna
              </Button>
            </div>
          )}

          {/* Found Match */}
          {searchStatus === 'found' && (
            <div className="space-y-3">
              <div className="flex items-center justify-center space-x-2 text-sm text-green-600">
                <Users className="w-4 h-4" />
                <span>Rakip oyuncu bulundu!</span>
              </div>
              <div className="text-sm text-muted-foreground">
                Oyuna yönlendiriliyorsunuz...
              </div>
            </div>
          )}

          {/* Cancel Button (only during search) */}
          {searchStatus === 'searching' && (
            <Button
              variant="outline"
              onClick={() => {
                playSound('buttonClick');
                onClose();
              }}
              className="w-full"
            >
              İptal
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default MatchmakingModal;