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

    // Ana sayfadaysak bile otomatik yönlendirmeye izin ver (rematch senaryolarında gerekli)
    // Önceden burası engelliyordu ve oyun sayfası açılmıyordu


    // Aynı odaya tekrar tekrar yönlendirme yapmayalım
    if (lastNavigatedRoomRef.current === roomId) return;

    const gameMode = currentRoom?.game_mode || '';
    const isRandom = gameMode.includes('random-match');
    const basePath = isRandom ? '/game/random-match' : '/game/private-room';

    // Tipi game_mode'dan veya max_score'dan çıkar
    let type = 'timed';
    if (gameMode.includes('-score') || (currentRoom?.max_score && currentRoom.max_score > 0)) {
      type = 'score';
    } else if (gameMode.includes('-timed')) {
      type = 'timed';
    }

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
