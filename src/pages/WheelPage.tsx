import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useUser } from '@/contexts/UserContext';
import { useUserPurchases } from '@/hooks/useUserPurchases';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { ArrowLeft, Gift, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface WheelReward {
  type: 'credits' | 'joker' | 'empty';
  value: number;
  item?: string;
  text: string;
  color: string;
}

const WheelPage = () => {
  const { user } = useAuth();
  const { profile, refreshProfile } = useUser();
  const { updateInventory } = useUserPurchases();
  const navigate = useNavigate();
  const [isSpinning, setIsSpinning] = useState(false);
  const [canSpin, setCanSpin] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [lastReward, setLastReward] = useState<WheelReward | null>(null);

  // Çark bölümleri - 15 bölmeli
  const wheelSegments: WheelReward[] = [
    { type: 'credits', value: 1, text: '1 Oyun Hakkı', color: 'bg-blue-500' },
    { type: 'joker', value: 1, item: 'degistir', text: '1 Değiştir Jokeri', color: 'bg-green-500' },
    { type: 'empty', value: 0, text: 'Boş', color: 'bg-gray-400' },
    { type: 'credits', value: 2, text: '2 Oyun Hakkı', color: 'bg-blue-600' },
    { type: 'joker', value: 1, item: 'fisilida', text: '1 Fısılda Jokeri', color: 'bg-yellow-500' },
    { type: 'empty', value: 0, text: 'Boş', color: 'bg-gray-400' },
    { type: 'credits', value: 3, text: '3 Oyun Hakkı', color: 'bg-blue-700' },
    { type: 'joker', value: 2, item: 'degistir', text: '2 Değiştir Jokeri', color: 'bg-green-600' },
    { type: 'empty', value: 0, text: 'Boş', color: 'bg-gray-400' },
    { type: 'credits', value: 5, text: '5 Oyun Hakkı', color: 'bg-blue-800' },
    { type: 'joker', value: 1, item: 'senyaz', text: '1 Sen Yaz Jokeri', color: 'bg-purple-500' },
    { type: 'empty', value: 0, text: 'Boş', color: 'bg-gray-400' },
    { type: 'joker', value: 2, item: 'fisilida', text: '2 Fısılda Jokeri', color: 'bg-yellow-600' },
    { type: 'joker', value: 2, item: 'senyaz', text: '2 Sen Yaz Jokeri', color: 'bg-purple-600' },
    { type: 'empty', value: 0, text: 'Boş', color: 'bg-gray-400' }
  ];

  // Günlük çark kontrolü
  useEffect(() => {
    checkDailySpinAvailability();
  }, [user]);

  const checkDailySpinAvailability = async () => {
    if (!user) return;

    const today = new Date().toISOString().split('T')[0];
    
    const { data } = await supabase
      .from('wheel_spins')
      .select('*')
      .eq('user_id', user.id)
      .eq('date', today)
      .single();

    setCanSpin(!data);
  };

  const spinWheel = async () => {
    if (!user || !canSpin || isSpinning) return;

    setIsSpinning(true);

    // Rastgele ödül seç
    const rewardIndex = Math.floor(Math.random() * wheelSegments.length);
    const reward = wheelSegments[rewardIndex];
    
    // Çarkı döndür (en az 3 tam tur + ödül pozisyonu)
    const baseRotation = 360 * 3;
    const segmentAngle = 360 / wheelSegments.length;
    const targetRotation = baseRotation + (rewardIndex * segmentAngle) + (segmentAngle / 2);
    const newRotation = rotation + targetRotation;
    
    setRotation(newRotation);

    // Animasyon bittikten sonra
    setTimeout(async () => {
      setLastReward(reward);
      
      // Ödülü veritabanına kaydet
      await saveWheelSpin(reward);
      
      // Ödülü kullanıcıya ver
      await giveReward(reward);
      
      setIsSpinning(false);
      setCanSpin(false);
      
      // Başarı mesajı
      showRewardToast(reward);
    }, 8000);
  };

  const saveWheelSpin = async (reward: WheelReward) => {
    if (!user) return;

    const today = new Date().toISOString().split('T')[0];
    
    await supabase
      .from('wheel_spins')
      .insert({
        user_id: user.id,
        date: today,
        reward_type: reward.type,
        reward_value: reward.value,
        reward_item: reward.item || null
      });
  };

  const giveReward = async (reward: WheelReward) => {
    if (!user || reward.type === 'empty') return;

    if (reward.type === 'credits') {
      // Oyun hakkı ver
      const currentCredits = profile?.game_credits || 0;
      const newCredits = currentCredits + reward.value;
      
      await supabase
        .from('profiles')
        .update({ game_credits: newCredits })
        .eq('id', user.id);
      
      await refreshProfile();
    } else if (reward.type === 'joker' && reward.item) {
      // Joker ver
      await updateInventory(reward.item, reward.value);
    }
  };

  const showRewardToast = (reward: WheelReward) => {
    if (reward.type === 'empty') {
      toast.info('😔 Maalesef bu sefer boş geldi!', {
        description: 'Yarın tekrar dene!'
      });
    } else {
      toast.success(`🎉 Tebrikler! ${reward.text} kazandın!`, {
        description: reward.type === 'credits' ? 'Oyun haklarına eklendi' : 'Envanterine eklendi'
      });
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted p-4">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <Button
            variant="outline"
            onClick={() => navigate('/')}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Ana Sayfa
          </Button>
          
          <h1 className="text-2xl font-bold text-center flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-yellow-500" />
            Şans Çarkı
            <Sparkles className="w-6 h-6 text-yellow-500" />
          </h1>
          
          <div className="w-20"></div>
        </div>

        {/* Ana İçerik */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Çark */}
          <Card className="relative overflow-hidden">
            <CardHeader className="text-center">
              <CardTitle className="flex items-center justify-center gap-2">
                <Gift className="w-6 h-6 text-primary" />
                Günlük Çark Çevirme
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Her gün bir kez ücretsiz çark çevirebilirsin!
              </p>
            </CardHeader>
            
            <CardContent className="flex flex-col items-center space-y-6">
              {/* Çark */}
              <div className="relative">
                {/* Çark Container */}
                <div className="relative w-80 h-80">
                  {/* Çark */}
                  <div 
                    className={`w-full h-full rounded-full border-8 border-yellow-400 shadow-2xl transition-transform duration-[8000ms] ease-out overflow-hidden`}
                    style={{ 
                      transform: `rotate(${rotation}deg)`,
                    }}
                  >
                    {/* Çark Bölümleri */}
                    {wheelSegments.map((segment, index) => {
                      const angle = (360 / wheelSegments.length) * index;
                      const nextAngle = (360 / wheelSegments.length) * (index + 1);
                      
                      return (
                        <div
                          key={index}
                          className="absolute inset-0"
                          style={{
                            clipPath: `polygon(50% 50%, ${50 + 45 * Math.cos((angle - 90) * Math.PI / 180)}% ${50 + 45 * Math.sin((angle - 90) * Math.PI / 180)}%, ${50 + 45 * Math.cos((nextAngle - 90) * Math.PI / 180)}% ${50 + 45 * Math.sin((nextAngle - 90) * Math.PI / 180)}%)`
                          }}
                        >
                          <div className={`w-full h-full ${segment.color}`}></div>
                          
                          {/* Text */}
                          <div
                            className="absolute text-white text-xs font-bold whitespace-nowrap"
                            style={{
                              top: '50%',
                              left: '50%',
                              transform: `translate(-50%, -50%) translate(${25 * Math.cos((angle + 12) * Math.PI / 180)}px, ${25 * Math.sin((angle + 12) * Math.PI / 180)}px) rotate(${angle + 12}deg)`,
                              transformOrigin: 'center'
                            }}
                          >
                            {segment.text}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Çark Merkezi */}
                  <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-16 h-16 bg-yellow-500 rounded-full border-4 border-yellow-600 shadow-lg flex items-center justify-center">
                    <Sparkles className="w-8 h-8 text-white" />
                  </div>

                  {/* Okçu (Pointer) */}
                  <div className="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-2">
                    <div className="w-0 h-0 border-l-4 border-r-4 border-b-8 border-l-transparent border-r-transparent border-b-red-500"></div>
                  </div>
                </div>
              </div>

              {/* Çark Butonu */}
              <div className="text-center space-y-4">
                <Button
                  onClick={spinWheel}
                  disabled={!canSpin || isSpinning}
                  size="lg"
                  className="px-8 py-3 text-lg font-bold bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600"
                >
                  {isSpinning ? 'Çark Dönüyor...' : canSpin ? 'Çarkı Çevir!' : 'Yarın Tekrar Dene'}
                </Button>
                
                {!canSpin && !isSpinning && (
                  <p className="text-sm text-muted-foreground">
                    Bu gün çarkını çevirmişsin! Yarın tekrar gel.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Ödüller ve Bilgiler */}
          <div className="space-y-4">
            {/* Son Kazanım */}
            {lastReward && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">🎉 Son Kazancın</CardTitle>
                </CardHeader>
                <CardContent>
                  <Badge className={`${lastReward.color} text-white`}>
                    {lastReward.text}
                  </Badge>
                </CardContent>
              </Card>
            )}

            {/* Çark Kuralları */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">📋 Çark Kuralları</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-muted-foreground">
                <p>• Her gün sadece bir kez çark çevirebilirsin</p>
                <p>• Kazandığın ödüller otomatik olarak hesabına eklenir</p>
                <p>• Jokerler envanterin de görünür</p>
                <p>• Çark her gece saat 00:00'da sıfırlanır</p>
                <p>• Boş bölümler şansını artırır! 😊</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WheelPage;