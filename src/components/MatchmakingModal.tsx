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
  const [countdown, setCountdown] = useState(15); // 10 → 15 saniye
  const { findRandomMatch, addAIOpponent, currentRoom, participants } = useGame();
  const { playSound } = useSounds();
  const { toast } = useToast();
  const { user } = useAuth();

  // 🔧 YENİ: Real-time matchmaking listener
  useEffect(() => {
    if (!currentRoom || searchStatus !== 'searching' || !user) return;
    
    console.log('🎯 Real-time matchmaking dinleyicisi başlatılıyor...');
    console.log('🎯 Dinlenecek oda:', currentRoom.id);
    
    const channel = supabase
      .channel(`matchmaking-${currentRoom.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public', 
        table: 'game_participants',
        filter: `room_id=eq.${currentRoom.id}`
      }, (payload) => {
        console.log('🎉 YENİ KATILIMCI TESPİT EDİLDİ!', payload);
        console.log('🔍 Payload detayı:', {
          newUserId: payload.new.user_id,
          currentUserId: user.id,
          isBot: payload.new.is_bot,
          roomId: payload.new.room_id
        });
        
        // Eğer bot değilse ve farklı oyuncuysa
        if (!payload.new.is_bot && payload.new.user_id !== user.id && payload.new.user_id !== null) {
          console.log('✅ GERÇEK OYUNCU EŞLEŞMESI BULUNDU!');
          setSearchStatus('found');
          
          playSound('correctWord');
          toast({
            title: '🎉 Oyuncu Bulundu!',
            description: 'Gerçek oyuncu ile eşleştiniz!',
            duration: 2000,
          });
          
          // 1.5 saniye sonra oyunu başlat
          setTimeout(() => {
            console.log('🎮 Gerçek oyuncu ile oyun başlatılıyor...');
            onMatchFound(false); // false = gerçek oyuncu
          }, 1500);
        } else {
          console.log('🤖 Bot katıldı veya aynı oyuncu, eşleşme sayılmaz');
        }
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'game_participants', 
        filter: `room_id=eq.${currentRoom.id}`
      }, (payload) => {
        console.log('📊 Katılımcı güncellendi:', payload);
      })
      .subscribe();

    return () => {
      console.log('🧹 Real-time matchmaking dinleyicisi temizleniyor...');
      supabase.removeChannel(channel);
    };
  }, [currentRoom, searchStatus, user, playSound, toast, onMatchFound]);

  // 🔧 YENİ: Participants değişikliklerini izle
  useEffect(() => {
    if (!currentRoom || searchStatus !== 'searching' || !user) return;
    
    console.log('👥 Katılımcı listesi değişti:', participants.length);
    console.log('👥 Katılımcılar:', participants);
    
    // Gerçek oyuncu sayısını kontrol et (bot olmayanlar ve kendisi hariç)
    const realPlayers = participants.filter(p => !p.is_bot && p.user_id !== user.id);
    console.log('👤 Gerçek oyuncu sayısı (kendisi hariç):', realPlayers.length);
    
    if (realPlayers.length > 0 && searchStatus === 'searching') {
      console.log('✅ PARTICIPANTS ÜZERİNDEN EŞLEŞME TESPİT EDİLDİ!');
      setSearchStatus('found');
      
      playSound('correctWord');
      toast({
        title: '🎉 Oyuncu Bulundu!',
        description: 'Gerçek oyuncu ile eşleştiniz!',
        duration: 2000,
      });
      
      setTimeout(() => {
        console.log('🎮 Participants üzerinden oyun başlatılıyor...');
        onMatchFound(false);
      }, 1500);
    }
  }, [participants, currentRoom, searchStatus, user, playSound, toast, onMatchFound]);

  useEffect(() => {
    let progressInterval: NodeJS.Timeout;
    let countdownInterval: NodeJS.Timeout;
    let searchTimeout: NodeJS.Timeout;

    const startSearch = async () => {
      console.log('🔍 Matchmaking başlatılıyor:', gameType);
      setSearchStatus('searching');
      
      // Progress animasyonu
      progressInterval = setInterval(() => {
        setSearchProgress(prev => {
          if (prev >= 100) return 0;
          return prev + 3; // 5 → 3 (daha yavaş)
        });
      }, 150); // 100 → 150ms (daha yavaş)

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

      // 🔧 DEĞIŞIKLIK: 10 → 15 saniye timeout
      searchTimeout = setTimeout(async () => {
        console.log('⏰ 15 saniye timeout - AI ile devam ediliyor');
        
        // Eğer hala searching durumundaysa AI'ya geç
        if (searchStatus === 'searching') {
          setSearchStatus('ai-fallback');
          clearInterval(progressInterval);
          clearInterval(countdownInterval);
          
          console.log('🤖 AI rakip ekleniyor...');
          await addAIOpponent();
          
          toast({
            title: 'Oyuncu Bulunamadı',
            description: 'AI rakip eklendi, oyun başlıyor...',
            duration: 2000,
          });

          setTimeout(() => {
            console.log('🎮 AI ile oyun başlatılıyor...');
            onMatchFound(true); // true = AI
          }, 2000);
        }
      }, 15000); // 10000 → 15000ms

      // Match arama
      try {
        console.log('🔍 findRandomMatch çağrılıyor...');
        const matchFound = await findRandomMatch(gameType);
        console.log('🔍 findRandomMatch sonucu:', matchFound);
        
        if (matchFound) {
          // Anında eşleşme bulundu
          console.log('✅ Anında eşleşme bulundu! Timer temizleniyor...');
          clearTimeout(searchTimeout);
          clearInterval(progressInterval);
          clearInterval(countdownInterval);
          setSearchStatus('found');
          playSound('correctWord');
          
          toast({
            title: '🎉 Oyuncu Bulundu!',
            description: 'Gerçek oyuncu ile anında eşleştiniz',
            duration: 2000,
          });
          
          setTimeout(() => {
            console.log('🎮 Anında eşleşme ile oyun başlatılıyor...');
            onMatchFound(false); // false = gerçek oyuncu
          }, 1500);
        } else {
          console.log('❌ Anında eşleşme yok, real-time bekleniyor...');
          console.log('🎯 Current room after search:', currentRoom?.id);
        }
      } catch (error) {
        console.error('🚨 Matchmaking hatası:', error);
        console.log('🔄 Hata sonrası normal akış devam ediyor...');
      }
    };

    startSearch();

    // Cleanup function
    return () => {
      console.log('🧹 Matchmaking effect temizleniyor...');
      clearInterval(progressInterval);
      clearInterval(countdownInterval);
      clearTimeout(searchTimeout);
    };
  }, [findRandomMatch, gameType, addAIOpponent, playSound, toast, onMatchFound, currentRoom, searchStatus]);

  const handlePlayWithAI = () => {
    console.log('🎮 Manuel AI oyunu başlatılıyor...');
    playSound('buttonClick');
    onMatchFound(true);
  };

  const handleCancel = () => {
    console.log('❌ Matchmaking iptal ediliyor...');
    playSound('buttonClick');
    onClose();
  };

  const getStatusInfo = () => {
    switch (searchStatus) {
      case 'searching':
        return {
          icon: Zap,
          title: 'Oyuncu Aranıyor...',
          description: `${gameType === 'timed' ? 'Zamana karşı' : 'Puana karşı'} oyun için eşleşme bekleniyor`,
          color: 'text-primary',
          bgColor: 'bg-primary'
        };
      case 'ai-fallback':
        return {
          icon: Bot,
          title: 'AI ile Oyun Başlıyor',
          description: 'Yapay zekaya karşı mücadele edeceksiniz',
          color: 'text-secondary',
          bgColor: 'bg-secondary'
        };
      case 'found':
        return {
          icon: User,
          title: 'Oyuncu Bulundu!',
          description: 'Gerçek rakip ile eşleştiniz, oyun başlıyor...',
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
              searchStatus === 'searching' ? 'animate-pulse' : 
              searchStatus === 'found' ? 'animate-bounce' : ''
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

            {/* Success ring for found */}
            {searchStatus === 'found' && (
              <div className="absolute inset-0 rounded-full border-4 border-green-400/50 animate-pulse"></div>
            )}
          </div>

          {/* Status Text */}
          <div className="space-y-2">
            <h2 className={`text-2xl font-bold ${statusInfo.color}`}>
              {statusInfo.title}
            </h2>
            <p className="text-muted-foreground text-sm">
              {statusInfo.description}
            </p>
          </div>

          {/* Game Type Badge */}
          <div className="inline-flex items-center px-4 py-2 bg-muted rounded-full">
            <span className="text-sm font-medium">
              {gameType === 'timed' ? '⏱️ Zamana Karşı (2 dk)' : '🎯 500 Puana Kadar'}
            </span>
          </div>

          {/* Room ID Debug (Development only) */}
          {process.env.NODE_ENV === 'development' && currentRoom && (
            <div className="text-xs text-muted-foreground bg-muted/50 p-2 rounded">
              <p>🏠 Oda ID: {currentRoom.id.slice(-8)}</p>
              <p>👥 Katılımcı: {participants.length}</p>
            </div>
          )}

          {/* Progress Bar (only during search) */}
          {searchStatus === 'searching' && (
            <div className="space-y-3">
              <Progress value={searchProgress} className="h-2" />
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  Aranıyor...
                </span>
                <span className={`font-medium ${
                  countdown <= 5 ? 'text-orange-500 animate-pulse' : 'text-muted-foreground'
                }`}>
                  {countdown}s kaldı
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                {countdown} saniye sonra AI rakip ile oyun başlayacak
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
                <Bot className="w-4 h-4 mr-2" />
                Hemen Başla
              </Button>
            </div>
          )}

          {/* Found Match */}
          {searchStatus === 'found' && (
            <div className="space-y-3">
              <div className="flex items-center justify-center space-x-2 text-sm text-green-600">
                <Users className="w-4 h-4" />
                <span className="font-medium">Gerçek oyuncu bulundu!</span>
              </div>
              <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                <p className="text-sm text-green-700">
                  🎉 Eşleşme başarılı! Oyuna yönlendiriliyorsunuz...
                </p>
              </div>
            </div>
          )}

          {/* Cancel Button (only during search) */}
          {searchStatus === 'searching' && (
            <div className="space-y-2">
              <Button
                variant="outline"
                onClick={handleCancel}
                className="w-full"
              >
                ❌ İptal Et
              </Button>
              <p className="text-xs text-muted-foreground">
                İptal ederseniz ana menüye döneceksiniz
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default MatchmakingModal;