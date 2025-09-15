import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useUser } from '@/contexts/UserContext';
import { useUserPurchases } from '@/hooks/useUserPurchases';
import { useSounds } from '@/hooks/useSounds';
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
  const { playSpecialSound } = useSounds();
  const navigate = useNavigate();
  const [isSpinning, setIsSpinning] = useState(false);
  const [canSpin, setCanSpin] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [lastReward, setLastReward] = useState<WheelReward | null>(null);
  // Animasyon kontrolü (3sn lineer + 5sn yavaşlama)
  const [transitionMs, setTransitionMs] = useState(0);
  const [timingFn, setTimingFn] = useState<'linear' | 'ease-out'>('ease-out');

  // Çark bölümleri - 15 bölmeli
  const wheelSegments: WheelReward[] = [
    { type: 'credits', value: 1, text: '1 Oyun 🎮', color: '#3B82F6' },
    { type: 'joker', value: 1, item: 'degistir', text: '1 Değiştir 🔄', color: '#10B981' },
    { type: 'empty', value: 0, text: 'Boş 💨', color: '#9CA3AF' },
    { type: 'credits', value: 2, text: '2 Oyun 🎮', color: '#2563EB' },
    { type: 'joker', value: 1, item: 'fisilida', text: '1 Fısılda 🤫', color: '#EAB308' },
    { type: 'empty', value: 0, text: 'Boş 💨', color: '#9CA3AF' },
    { type: 'credits', value: 3, text: '3 Oyun 🎮', color: '#1D4ED8' },
    { type: 'joker', value: 2, item: 'degistir', text: '2 Değiştir 🔄', color: '#059669' },
    { type: 'empty', value: 0, text: 'Boş 💨', color: '#9CA3AF' },
    { type: 'credits', value: 5, text: '5 Oyun 🎮', color: '#1E40AF' },
    { type: 'joker', value: 1, item: 'senyaz', text: '1 Sen Yaz ✍️', color: '#7C3AED' },
    { type: 'empty', value: 0, text: 'Boş 💨', color: '#9CA3AF' },
    { type: 'joker', value: 2, item: 'fisilida', text: '2 Fısılda 🤫', color: '#D97706' },
    { type: 'joker', value: 2, item: 'senyaz', text: '2 Sen Yaz ✍️', color: '#6D28D9' },
    { type: 'empty', value: 0, text: 'Boş 💨', color: '#9CA3AF' }
  ];

  // Günlük çark kontrolü
  useEffect(() => {
    if (user) {
      checkDailySpinAvailability();
    }
  }, [user]);

  const checkDailySpinAvailability = async () => {
    if (!user) return;

    const today = new Date().toISOString().split('T')[0];
    
    const { data } = await supabase
      .from('wheel_spins')
      .select('*')
      .eq('user_id', user.id)
      .eq('date', today)
      .maybeSingle();

    setCanSpin(!data);
  };

  const spinWheel = async () => {
    if (!user || !canSpin || isSpinning) return;

    // Çark sesi çal
    playSpecialSound('/carkSesi.mp3', 0.7);
    
    setIsSpinning(true);

    // Rastgele ödül seç
    const rewardIndex = Math.floor(Math.random() * wheelSegments.length);
    const reward = wheelSegments[rewardIndex];

    const segmentAngle = 360 / wheelSegments.length;
    const offsetToCenter = segmentAngle / 2; // segment merkezine hizalama

    // 1. Aşama: 3 saniye lineer dönüş (mod 360 = 0 olacak şekilde normalize)
    const currentMod = ((rotation % 360) + 360) % 360;
    const firstTarget = rotation + (360 * 3 - currentMod);
    setTransitionMs(3000);
    setTimingFn('linear');
    setRotation(firstTarget);

    // 2. Aşama: 5 saniye yavaşlama + ödül hizalama
    setTimeout(() => {
      const extraSpins = 2; // yavaşlarken 2 tur daha dönsün
      // İbre üstte (0°) olduğunda seçili segmentin merkezi 0° altında kalmalı
      const landing = 360 - (rewardIndex * segmentAngle) - offsetToCenter;
      const finalTarget = firstTarget + extraSpins * 360 + landing;

      setTransitionMs(5000);
      setTimingFn('ease-out');
      setRotation(finalTarget);

      // Tamamlandıktan sonra ödülü ver
      setTimeout(async () => {
        setLastReward(reward);
        await saveWheelSpin(reward);
        await giveReward(reward);
        setIsSpinning(false);
        setCanSpin(false);
        showRewardToast(reward);
      }, 5000);
    }, 3000);
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
      toast('😔 Maalesef bu sefer boş geldi! Yarın tekrar dene!');
    } else {
      toast(`🎉 Tebrikler! ${reward.text} kazandın!`);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted p-4">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <Button
            onClick={() => navigate('/')}
            size="lg"
            className="px-8 py-3 text-lg font-bold bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Geri
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
                  {/* Çark SVG */}
                  <svg
                    width="320"
                    height="320"
                    viewBox="0 0 320 320"
                    style={{ transform: `rotate(${rotation}deg)`, transition: `transform ${transitionMs}ms ${timingFn}` }}
                  >
                    {wheelSegments.map((segment, index) => {
                      const angle = (360 / wheelSegments.length) * index;
                      const nextAngle = (360 / wheelSegments.length) * (index + 1);
                      const startAngle = (angle - 90) * (Math.PI / 180);
                      const endAngle = (nextAngle - 90) * (Math.PI / 180);
                      
                      const radius = 150;
                      const centerX = 160;
                      const centerY = 160;
                      
                      const x1 = centerX + radius * Math.cos(startAngle);
                      const y1 = centerY + radius * Math.sin(startAngle);
                      const x2 = centerX + radius * Math.cos(endAngle);
                      const y2 = centerY + radius * Math.sin(endAngle);
                      
                      const largeArcFlag = (nextAngle - angle) > 180 ? 1 : 0;
                      
                      const pathData = [
                        `M ${centerX} ${centerY}`,
                        `L ${x1} ${y1}`,
                        `A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2} ${y2}`,
                        'Z'
                      ].join(' ');

                      // Metin pozisyonu - merkezden başlayarak dışa doğru
                      const textAngle = angle + (360 / wheelSegments.length) / 2;
                      const textStartRadius = radius * 0.4; // Merkezden başlangıç mesafesi
                      const textX = centerX + textStartRadius * Math.cos((textAngle - 90) * Math.PI / 180);
                      const textY = centerY + textStartRadius * Math.sin((textAngle - 90) * Math.PI / 180);

                      // Yazının rotasyonu - merkezden dışa doğru yatay
                      const textRotation = textAngle;
                      
                      return (
                        <g key={index}>
                          <path
                            d={pathData}
                            fill={segment.color}
                            stroke="#ffffff"
                            strokeWidth="2"
                          />
                          <text
                            x={textX}
                            y={textY}
                            fill="white"
                            fontSize="12"
                            fontWeight="bold"
                            textAnchor="start"
                            dominantBaseline="middle"
                            transform={`rotate(${textRotation}, ${textX}, ${textY})`}
                            style={{ 
                              textShadow: '1px 1px 2px rgba(0,0,0,0.8)',
                              fontFamily: 'system-ui, -apple-system, sans-serif'
                            }}
                          >
                            {segment.text}
                          </text>
                        </g>
                      );
                    })}
                  </svg>

                  {/* Çark Merkezi */}
                  <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-16 h-16 bg-yellow-500 rounded-full border-4 border-yellow-600 shadow-lg flex items-center justify-center z-10">
                    <Sparkles className="w-8 h-8 text-white" />
                  </div>

                  {/* Okçu (Pointer) */}
                  <div className="absolute top-2 left-1/2 transform -translate-x-1/2 z-20">
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
                  <Badge style={{ backgroundColor: lastReward.color, color: 'white' }}>
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