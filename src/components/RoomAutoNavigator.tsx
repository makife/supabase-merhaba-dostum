import { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useGame } from '@/contexts/GameContext';
import { matchBanlist } from '@/utils/matchBanlist';

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

    // ⚠️ KRİTİK: Bitmiş (finished/completed) veya aktif olmayan odalara yönlendirme yapma
    const roomStatus = currentRoom?.status || '';
    if (roomStatus === 'finished' || roomStatus === 'completed' || roomStatus === 'cancelled') {
      console.log('🚫 RoomAutoNavigator: Room status is', roomStatus, '- skipping navigation');
      return;
    }

    // Aynı odaya tekrar tekrar yönlendirme yapmayalım
    if (lastNavigatedRoomRef.current === roomId) return;

    // 🔒 KRİTİK: Game veya waiting sayfasındayken otomatik yönlendirme yapma.
    // Rematch akışında eski currentRoom kısa süre context'te kalabiliyor ve yeni waiting/game rotasını ezebiliyordu.
    const isAlreadyOnGamePage = location.pathname.includes('/game/');
    const isWaitingPage = location.pathname.startsWith('/private-room/waiting');
    if (isAlreadyOnGamePage || isWaitingPage) {
      console.log('🚫 RoomAutoNavigator: Active game/waiting route, skipping auto navigation');
      return;
    }

    if (isAlreadyOnGamePage && location.search.includes(`room=${roomId}`)) {
      console.log('🚫 RoomAutoNavigator: Already on game page with same room, skipping');
      return;
    }

    // 🔒 ASYNC: Banlist kontrolünü async olarak yap
    const checkBanlistAndNavigate = async () => {
      // 🔒 KRİTİK: Banlist'teki odalara yönlendirme yapma
      const isBanned = await matchBanlist.has(roomId);
      if (isBanned) {
        console.log('🚫 RoomAutoNavigator: Room is in banlist, skipping navigation:', roomId.slice(-8));
        return;
      }

      const isRandom = gameMode.includes('random-match');
      const basePath = isRandom ? '/game/random-match' : '/game/private-room';

      // Tipi sadece game_mode'dan çıkar (tek otorite)
      const type = gameMode.includes('score') ? 'score' : 'timed';

      const target = `${basePath}?room=${roomId}&type=${type}`;

      // Zaten hedefteysek yönlendirme yapma
      const currentUrl = `${location.pathname}${location.search}`;
      if (currentUrl === target) return;

      console.log('🚀 RoomAutoNavigator: navigating to game page', { target, from: currentUrl, gameMode, status: roomStatus });
      lastNavigatedRoomRef.current = roomId;
      navigate(target, { replace: true });
    };

    checkBanlistAndNavigate();
  }, [currentRoom?.id, currentRoom?.game_mode, currentRoom?.status, currentRoom?.max_score, location.pathname, location.search, navigate]);

  return null;
};

export default RoomAutoNavigator;
