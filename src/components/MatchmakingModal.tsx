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
  const [countdown, setCountdown] = useState(20);
  const { findRandomMatch, addAIOpponent, currentRoom, participants } = useGame();
  const { playSound } = useSounds();
  const { toast } = useToast();
  const { user } = useAuth();

  // 🔧 YENİ: Real-time matchmaking listener
  useEffect(() => {
    if (!currentRoom || searchStatus !== 'searching' || !user) return;
    
    console.log('🎯 Real-time matchmaking dinleyicisi başlatılıyor...');
    console.log('🎯 Dinlenecek oda:', currentRoom.id.slice(-8));
    
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
          newUserId: payload.new.user_id?.slice(-8),
          currentUserId: user.id.slice(-8),
          isBot: payload.new.is_bot,
          roomId: payload.new.room_id?.slice(-8)
        });
        
        // SADECE gerçek oyuncu VE farklı kullanıcı ise (kendi katılımını ignore et)
        if (!payload.new.is_bot && 
            payload.new.user_id !== user.id && 
            payload.new.user_id !== null &&
            searchStatus === 'searching') {
          
          console.log('✅ GERÇEK OYUNCU EŞLEŞMESI BULUNDU!');
          setSearchStatus('found');
          
          playSound('correctWord');
          toast({
            title: '🎉 Oyuncu Bulundu!',
            description: 'Başka bir oyuncu ile eşleştiniz!',
            duration: 2000,
          });
          
          // 1.5 saniye sonra oyunu başlat
          setTimeout(() => {
            console.log('🎮 Oyun başlatılıyor...');
            onMatchFound(false); // false = gerçek oyuncu
          }, 1500);
        } else if (payload.new.is_bot && searchStatus === 'searching') {
          console.log('🤖 Bot eklendi - AI ile oyun başlayacak');
          setSearchStatus('ai-fallback');
          
          setTimeout(() => {
            console.log('🎮 Bot ile oyun başlatılıyor...');
            onMatchFound(true); // true = bot
          }, 1000);
        } else {
          console.log('🔄 Göz ardı edilen katılımcı:', {
            isBot: payload.new.is_bot,
            sameUser: payload.new.user_id === user.id,
            isNull: payload.new.user_id === null,
            searchStatus
          });
        }
      })
      .subscribe();

    // ⚠️ CLEANUP DEVRE DIŞI - Bağlantı koruması
    return () => {
      console.log("⚠️ [MatchmakingModal] Cleanup ATLANYOR (bağlantı koruması)");
      // ❌ DEVRE DIŞI: supabase.removeChannel(channel);
    };
  }, [currentRoom, searchStatus, user, playSound, toast, onMatchFound]);

  // 🔧 YENİ: Participants değişikliklerini izle - DAHA AKILLI
  useEffect(() => {
    if (!currentRoom || searchStatus !== 'searching' || !user) return;
    
    console.log('👥 Katılımcı listesi değişti:', participants.length);
    console.log('👥 Katılımcı detayları:');
    participants.forEach((p, index) => {
      console.log(`  ${index + 1}. ${p.is_bot ? '🤖 Bot' : '👤 Oyuncu'}: ${
        p.user_id?.slice(-8) || 'null'
      } - ${(p as any).profiles?.username || 'İsimsiz'}`);
    });
    
    // SADECE gerçek oyuncuları say (bot olmayan ve kendisi olmayan)
    const realOpponents = participants.filter(p => 
      !p.is_bot && 
      p.user_id !== null && 
      p.user_id !== user.id
    );
    
    console.log('👤 Gerçek rakip sayısı:', realOpponents.length);
    
    // Eğer gerçek rakip varsa ve hala arama durumundaysa
    if (realOpponents.length > 0 && searchStatus === 'searching') {
      console.log('✅ PARTICIPANTS ÜZERİNDEN GERÇEK EŞLEŞME TESPİT EDİLDİ!');
      const opponent = realOpponents[0];
      console.log('🎯 Rakip bilgileri:', {
        userId: opponent.user_id?.slice(-8),
        username: (opponent as any).profiles?.username,
        avatar: (opponent as any).profiles?.avatar_url
      });
      
      setSearchStatus('found');
      
      playSound('correctWord');
      toast({
        title: '🎉Oyuncu Bulundu!',
        description: `${(opponent as any).profiles?.username || 'Oyuncu'} ile eşleştiniz!`,
        duration: 2000,
      });
      
      setTimeout(() => {
        console.log('🎮 Participants üzerinden gerçek oyun başlatılıyor...');
        onMatchFound(false); // false = gerçek oyuncu
      }, 1500);
    }
    
    // Bot kontrolü
    const bots = participants.filter(p => p.is_bot);
    if (bots.length > 0 && searchStatus === 'searching') {
      console.log('🤖 Bot tespit edildi, AI moduna geçiliyor');
      setSearchStatus('ai-fallback');
      
      setTimeout(() => {
        console.log('🎮 Bot ile oyun başlatılıyor...');
        onMatchFound(true); // true = bot
      }, 1000);
    }
  }, [participants, currentRoom, searchStatus, user, playSound, toast, onMatchFound]);

  useEffect(() => {
    let progressInterval: NodeJS.Timeout;
    let countdownInterval: NodeJS.Timeout;
    let searchTimeout: NodeJS.Timeout;

    const startSearch = async () => {
      console.log('🔍 ===== MATCHMAKING MODAL START =====');
      console.log('🔍 Game Type:', gameType);
      console.log('🔍 User ID:', user?.id?.slice(-8));
      setSearchStatus('searching');
      
      // Progress animasyonu
      progressInterval = setInterval(() => {
        setSearchProgress(prev => {
          if (prev >= 100) return 0;
          return prev + 2; // Daha yavaş progress
        });
      }, 200);

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

      // 🔧 TIMEOUT: 20 saniye (daha uzun)
      searchTimeout = setTimeout(async () => {
        console.log('⏰ 20 saniye timeout - AI fallback başlatılıyor');
        
        // Sadece hala searching durumundaysa AI'ya geç
        if (searchStatus === 'searching') {
          console.log('🤖 Timeout nedeniyle AI ekleniyor...');
          setSearchStatus('ai-fallback');
          clearInterval(progressInterval);
          clearInterval(countdownInterval);
          
          try {
            await addAIOpponent();
            
            toast({
              title: '⏰ Zaman Aştı',
              description: 'AI rakip ile oyun başlıyor...',
              duration: 2000,
            });

            setTimeout(() => {
              console.log('🎮 Timeout AI ile oyun başlatılıyor...');
              onMatchFound(true); // true = AI
            }, 2000);
          } catch (error) {
            console.error('❌ AI ekleme hatası:', error);
            // Hata durumunda modal'ı kapat
            onClose();
          }
        } else {
          console.log('⏰ Timeout ama durum değişmiş:', searchStatus);
        }
      }, 20000); // 20 saniye

      // Ana matchmaking fonksiyonunu çağır
      try {
        console.log('🔍 findRandomMatch çağrılıyor...');
        
        const matchFound = await findRandomMatch(gameType);
        console.log('🔍 findRandomMatch result:', matchFound);
        
        if (matchFound) {
          // Anında eşleşme bulundu
          console.log('✅ ANINDA EŞLEŞME BULUNDU!');
          clearTimeout(searchTimeout);
          clearInterval(progressInterval);
          clearInterval(countdownInterval);
          setSearchStatus('found');
          playSound('correctWord');
          
          toast({
            title: '🎉 Anında Eşleşme!',
            description: 'Mevcut odaya katıldınız',
            duration: 2000,
          });
          
          setTimeout(() => {
            console.log('🎮 Anında eşleşme ile oyun başlatılıyor...');
            onMatchFound(false); // false = gerçek oyuncu
          }, 1500);
        } else {
          console.log('❌ Anında eşleşme yok, yeni oda açıldı');
          console.log('🎯 Açılan oda ID:', currentRoom?.id?.slice(-8));
          console.log('⏳ Real-time listener bekliyor...');
        }
      } catch (error) {
        console.error('🚨 Matchmaking hatası:', error);
        console.log('🔄 Hata durumunda da beklemeye devam...');
      }
      
      console.log('🔍 ===== MATCHMAKING MODAL INIT END =====');
    };

    startSearch();

    // Cleanup function
    return () => {
      console.log('🧹 Matchmaking effect cleanup...');
      clearInterval(progressInterval);
      clearInterval(countdownInterval);
      clearTimeout(searchTimeout);
    };
  }, [findRandomMatch, gameType]); // Dependency array'i minimize et

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
          description: `${gameType === 'timed' ? 'Zamana karşı' : 'Puanlı'} oyun için eşleşme bekleniyor`,
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
          description: 'Rakip ile eşleştiniz, oyun başlıyor...',
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
                  🔍 Rakip aranıyor...
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
              
              {/* Real-time status */}
              {currentRoom && (
                <div className="text-xs text-green-600 bg-green-50 p-2 rounded border">
                  🏠 Oda açıldı • 📡 Real-time aktif • 👥 {participants.length} kişi
                </div>
              )}
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
                <span className="font-medium">Oyuncu bulundu!</span>
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