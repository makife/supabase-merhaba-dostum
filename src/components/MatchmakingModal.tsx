import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Users, Bot, Loader2, Zap, User } from 'lucide-react';
import { useGame } from '@/contexts/GameContext';
import { useSounds } from '@/hooks/useSounds';
import { useToast } from '@/hooks/use-toast';

interface MatchmakingModalProps {
  onClose: () => void;
  onMatchFound: (isAI: boolean) => void;
  gameType: 'timed' | 'score';
}

const MatchmakingModal = ({ onClose, onMatchFound, gameType }: MatchmakingModalProps) => {
  const [searchProgress, setSearchProgress] = useState(0);
  const [searchStatus, setSearchStatus] = useState<'searching' | 'ai-fallback' | 'found'>('searching');
  const [countdown, setCountdown] = useState(10);
  const { findRandomMatch, addAIOpponent } = useGame();
  const { playSound } = useSounds();
  const { toast } = useToast();

  useEffect(() => {
    let progressInterval: NodeJS.Timeout;
    let countdownInterval: NodeJS.Timeout;
    let searchTimeout: NodeJS.Timeout;

    const startSearch = async () => {
      console.log('🔍 Starting matchmaking for:', gameType);
      console.log('🔍 Setting up timers and intervals...');
      setSearchStatus('searching');
      
      // Progress animation
      progressInterval = setInterval(() => {
        setSearchProgress(prev => {
          if (prev >= 100) return 0;
          return prev + 5;
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

      // Auto fallback to AI after 10 seconds
      searchTimeout = setTimeout(async () => {
        console.log('⏰ 10 second timeout reached - switching to AI');
        setSearchStatus('ai-fallback');
        clearInterval(progressInterval);
        clearInterval(countdownInterval);
        
        console.log('🤖 Adding AI opponent...');
        // Add AI opponent to current room
        await addAIOpponent();
        
        toast({
          title: 'Oyuncu Bulunamadı',
          description: 'AI rakip eklendi, oyun başlıyor...',
          duration: 2000,
        });

        console.log('🎮 Starting game with AI in 2 seconds...');
        setTimeout(() => {
          console.log('🎮 Calling onMatchFound(true)...');
          onMatchFound(true);
        }, 2000);
      }, 10000);

      // Try to find a match
      try {
        console.log('🔍 Calling findRandomMatch...');
        const matchFound = await findRandomMatch(gameType);
        console.log('🔍 findRandomMatch result:', matchFound);
        
        if (matchFound) {
          // Immediate match found
          console.log('✅ Immediate match found! Clearing timers...');
          clearTimeout(searchTimeout);
          clearInterval(progressInterval);
          clearInterval(countdownInterval);
          setSearchStatus('found');
          playSound('correctWord');
          
          toast({
            title: 'Oyuncu Bulundu!',
            description: 'Gerçek oyuncu ile eşleştiniz',
          });
          
          setTimeout(() => {
            console.log('🎮 Starting game with real player...');
            onMatchFound(false);
          }, 1500);
        } else {
          console.log('❌ No immediate match found, waiting for timeout...');
        }
        // If no immediate match found, continue waiting and let timeout handle AI fallback
      } catch (error) {
        console.error('🚨 Matchmaking error:', error);
        console.log('🔄 Continuing with normal timeout flow after error');
        // Continue with normal timeout flow on error
      }
    };

    startSearch();

    return () => {
      clearInterval(progressInterval);
      clearInterval(countdownInterval);
      clearTimeout(searchTimeout);
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
          color: 'text-primary',
          bgColor: 'bg-primary'
        };
      case 'ai-fallback':
        return {
          icon: Bot,
          title: 'AI ile Oyun Başlıyor',
          description: 'Bilgisayar rakibiniz hazırlanıyor...',
          color: 'text-secondary',
          bgColor: 'bg-secondary'
        };
      case 'found':
        return {
          icon: User,
          title: 'Oyuncu Bulundu!',
          description: 'Rakip ile eşleştiniz',
          color: 'text-accent',
          bgColor: 'bg-accent'
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
                <div className="absolute inset-0 rounded-full border-4 border-primary/30 animate-ping"></div>
                <div className="absolute inset-2 rounded-full border-4 border-primary/20 animate-ping animation-delay-300"></div>
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
                {countdown} saniye sonra AI ile oyun
              </p>
            </div>
          )}

          {/* AI Fallback Options */}
          {searchStatus === 'ai-fallback' && (
            <div className="space-y-3">
              <div className="flex items-center justify-center space-x-2 text-sm text-muted-foreground">
                <Bot className="w-4 h-4" />
                <span>AI rakip hazırlanıyor...</span>
              </div>
              <Button
                onClick={handlePlayWithAI}
                className="w-full"
                size="lg"
              >
                Hemen Başla
              </Button>
            </div>
          )}

          {/* Found Match */}
          {searchStatus === 'found' && (
            <div className="space-y-3">
              <div className="flex items-center justify-center space-x-2 text-sm text-accent">
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