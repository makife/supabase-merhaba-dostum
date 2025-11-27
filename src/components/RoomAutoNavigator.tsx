import { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useGame } from '@/contexts/GameContext';

// Oda state'i oluştuğunda kullanıcıyı doğru oyun sayfasına yönlendirir.
// Rematch kabul edilip oda gerçekten hazır olduğunda currentRoom set edildiği için
// herhangi bir realtime callback sorununda bile güvenli bir yedek navigasyon sağlar.
const RoomAutoNavigator = () => {
  const { currentRoom } = useGame();
  const navigate = useNavigate();
  const location = useLocation();
  const lastNavigatedRoomRef = useRef<string | null>(null);

  useEffect(() => {
    const roomId = currentRoom?.id;
    if (!roomId) return;

    // Tournament sayfalarındayken veya tournament query param varsa yönlendirme yapma
    const searchParams = new URLSearchParams(location.search);
    const isTournamentPage = location.pathname.includes('tournament') || searchParams.has('tournament');
    
    if (isTournamentPage) {
      console.log('🚫 RoomAutoNavigator: Tournament sayfasında, yönlendirme yapılmıyor');
      return;
    }

    const gameMode = currentRoom?.game_mode || '';
    
    // Tournament modundaki odalar için yönlendirme yapma
    if (gameMode === 'tournament' || gameMode.includes('tournament')) {
      console.log('🚫 RoomAutoNavigator: Tournament mode, yönlendirme yapılmıyor');
      return;
    }

    // Aynı odaya tekrar tekrar yönlendirme yapmayalım
    if (lastNavigatedRoomRef.current === roomId) return;

    const isRandom = gameMode.includes('random-match');
    const basePath = isRandom ? '/game/random-match' : '/game/private-room';

    // Tipi sadece game_mode'dan çıkar (tek otorite)
    const type = gameMode.includes('score') ? 'score' : 'timed';

    const target = `${basePath}?room=${roomId}&type=${type}`;

    // Zaten hedefteysek yönlendirme yapma
    const currentUrl = `${location.pathname}${location.search}`;
    if (currentUrl === target) return;

    console.log('🚀 RoomAutoNavigator: navigating to game page', { target, from: currentUrl, gameMode });
    lastNavigatedRoomRef.current = roomId;
    navigate(target, { replace: true });
  }, [currentRoom?.id, currentRoom?.game_mode, currentRoom?.max_score, location.pathname, location.search, navigate]);

  return null;
};

export default RoomAutoNavigator;
