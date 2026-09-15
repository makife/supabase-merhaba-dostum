import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MatchmakingProvider } from '@/contexts/NewMatchmakingContext';
import { SlotMatchmaking } from '@/components/SlotMatchmaking';

const TestMatchmakingPage = () => {
  const navigate = useNavigate();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [gameType, setGameType] = useState<'timed' | 'score'>('timed');

  const handleMatchFound = (roomId: string) => {
    console.log('🎯 Match found, navigating to game:', roomId, 'gameType:', gameType);
    setIsModalOpen(false);
    
    // Navigate to game with proper game type
    if (roomId === 'ai-game') {
      navigate(`/game?mode=vs-computer&type=${gameType}`);
    } else {
      navigate(`/game?mode=random-match&roomId=${roomId}&type=${gameType}`);
    }
  };

  return (
    <MatchmakingProvider onMatchFound={handleMatchFound}>
      <div className="min-h-screen bg-background p-8">
        <div className="max-w-2xl mx-auto space-y-6">
          <h1 className="text-3xl font-bold text-center">Yeni Eşleşme Sistemi Test</h1>
          
          <Card>
            <CardHeader>
              <CardTitle>Eşleşme Testi</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-4">
                <Button
                  variant={gameType === 'timed' ? 'default' : 'outline'}
                  onClick={() => setGameType('timed')}
                >
                  Zamanlı Mod
                </Button>
                <Button
                  variant={gameType === 'score' ? 'default' : 'outline'}
                  onClick={() => setGameType('score')}
                >
                  Skor Modu
                </Button>
              </div>
              
              <Button 
                onClick={() => setIsModalOpen(true)}
                className="w-full"
                size="lg"
              >
                Eşleşme Ara - {gameType === 'timed' ? 'Zamanlı' : 'Skor'}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Sistem Özellikleri</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm">
                <li>✅ Real-time eşleşme sistemi</li>
                <li>✅ 30 saniye sonra AI rakip</li>
                <li>✅ Progress göstergesi</li>
                <li>✅ İptal edilebilir arama</li>
                <li>✅ Oda bazlı eşleşme</li>
                <li>✅ Geçici oda yönetimi</li>
              </ul>
            </CardContent>
          </Card>
        </div>

        {isModalOpen && (
          <div className="fixed inset-0 z-[9999] bg-background">
            <SlotMatchmaking 
              onCancel={() => setIsModalOpen(false)}
              searchProgress={0}
            />
          </div>
        )}
      </div>
    </MatchmakingProvider>
  );
};

export default TestMatchmakingPage;