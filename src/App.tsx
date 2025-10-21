import React, { useState, useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/components/ThemeProvider";
import { GameProvider, useGame } from "@/contexts/GameContext";
import { MusicProvider } from "@/contexts/MusicContext";
import { UserProvider } from "@/contexts/UserContext";
import { MatchmakingProvider } from "@/contexts/NewMatchmakingContext";
import { NotificationProvider } from "@/contexts/NotificationContext";
import { TournamentProvider } from "@/contexts/TournamentContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import LoadingScreen from "@/components/LoadingScreen";
import AuthPage from "@/pages/AuthPage";
import ResetPasswordPage from "@/pages/ResetPasswordPage";
import HomePage from "@/pages/HomePage";
import GamePage from "@/pages/GamePage";
import ProfilePage from "@/pages/ProfilePage";
import SettingsPage from "@/pages/SettingsPage";
import MarketPage from "@/pages/MarketPage";
import TestMatchmakingPage from "@/pages/TestMatchmakingPage";
import NakamaGamePage from "@/pages/NakamaGamePage";
import NotFound from "./pages/NotFound";
import LeaderboardPage from "@/pages/LeaderboardPage";
import ChatPage from "./pages/ChatPage";
import TournamentPage from "./pages/TournamentPage";
import TournamentWaitingPage from "./pages/TournamentWaitingPage";
import TournamentBracketPage from "./pages/TournamentBracketPage";
import WheelPage from "./pages/WheelPage";
import PrivateRoomWaitingPage from "./pages/PrivateRoomWaitingPage";
import { useLocalStorageClear } from "@/hooks/useLocalStorageClear";
import { useScreenOrientation } from "@/hooks/useScreenOrientation";
import MemoryGamePage from "@/pages/MemoryGamePage";
import PuzzleGamePage from "@/pages/PuzzleGame";
import GridSimonSaysPage from "@/pages/GridSimonSays";
import ReactorRunnerPage from "@/pages/DinoRunner";
import SnakeGamePage from "@/pages/SnakeGame";
import TetrisGamePage from "@/pages/TetrisGame";
import { Capacitor } from "@capacitor/core";
import { useImmersiveBars } from "@/hooks/useImmersiveBars";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import RoomAutoNavigator from "@/components/RoomAutoNavigator";
import { ToastAction } from "@/components/ui/toast";
import { useNavigate } from "react-router-dom";

const queryClient = new QueryClient();

const AppRoutes = () => {
  const { user, loading } = useAuth();
  const [customLoading, setCustomLoading] = useState(true);

  // LocalStorage temizleme hook'unu kullan
  useLocalStorageClear();

  // Ekran yönlendirmesini kilitle
  useScreenOrientation();

  // Immersive mode'u aktif et (navigasyon tuşlarını gizle)
  //useImmersiveMode();

  if (loading || customLoading) {
    return <LoadingScreen onLoadingComplete={() => setCustomLoading(false)} />;
  }

  return (
    <Routes>
      <Route path="/auth" element={user ? <Navigate to="/" replace /> : <AuthPage />} />
      <Route path="/auth/reset-password" element={<ResetPasswordPage />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <HomePage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/profile"
        element={
          <ProtectedRoute>
            <ProfilePage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/profile/:id"
        element={
          <ProtectedRoute>
            <ProfilePage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/game/vs-computer"
        element={
          <ProtectedRoute>
            <GamePage gameMode="vs-computer" />
          </ProtectedRoute>
        }
      />
      <Route
        path="/game/private-room"
        element={
          <ProtectedRoute>
            <GamePage gameMode="private-room" />
          </ProtectedRoute>
        }
      />
      <Route
        path="/game/random-match"
        element={
          <ProtectedRoute>
            <GamePage gameMode="random-match" />
          </ProtectedRoute>
        }
      />

      <Route
        path="/game/nakama"
        element={
          <ProtectedRoute>
            <NakamaGamePage />
          </ProtectedRoute>
        }
      />
      {/* Backward-compatible alias to prevent 404s from older links */}
      <Route
        path="/game/nakama-game"
        element={
          <ProtectedRoute>
            <NakamaGamePage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/nakama-game"
        element={
          <ProtectedRoute>
            <NakamaGamePage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/game"
        element={
          <ProtectedRoute>
            <GamePage gameMode="tournament" />
          </ProtectedRoute>
        }
      />

      <Route
        path="/tournament"
        element={
          <ProtectedRoute>
            <TournamentPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/private-room-waiting"
        element={
          <ProtectedRoute>
            <PrivateRoomWaitingPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/tournament-waiting/:tournamentId"
        element={
          <ProtectedRoute>
            <TournamentWaitingPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/tournament-bracket/:tournamentId"
        element={
          <ProtectedRoute>
            <TournamentBracketPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/game/tournament"
        element={
          <ProtectedRoute>
            <GamePage gameMode="tournament" />
          </ProtectedRoute>
        }
      />
      <Route
        path="/puzzle-game"
        element={
          <ProtectedRoute>
            <PuzzleGamePage />
          </ProtectedRoute>
        }
      />

      <Route path="/tournament-game/:matchId" element={<GamePage gameMode="tournament" />} />

      <Route
        path="/market"
        element={
          <ProtectedRoute>
            <MarketPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/settings"
        element={
          <ProtectedRoute>
            <SettingsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/leaderboard"
        element={
          <ProtectedRoute>
            <LeaderboardPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/chat"
        element={
          <ProtectedRoute>
            <ChatPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/test-matchmaking"
        element={
          <ProtectedRoute>
            <TestMatchmakingPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/wheel"
        element={
          <ProtectedRoute>
            <WheelPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/memory-game"
        element={
          <ProtectedRoute>
            <MemoryGamePage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/puzzle-game"
        element={
          <ProtectedRoute>
            <PuzzleGamePage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/grid-simon-says"
        element={
          <ProtectedRoute>
            <GridSimonSaysPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/reactor-runner"
        element={
          <ProtectedRoute>
            <ReactorRunnerPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/snake-game"
        element={
          <ProtectedRoute>
            <SnakeGamePage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/tetris-game"
        element={
          <ProtectedRoute>
            <TetrisGamePage />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};

// 🎮 Global Rematch Listener (uygulama seviyesinde, her yerde çalışır)
const GlobalRematchListener = () => {
  const { user } = useAuth();
  const { respondRematchRequest } = useGame();
  const navigate = useNavigate();

  useEffect(() => {
    if (!user?.id) return;

    console.log('🔔 Global rematch listener başlatıldı:', user.id.slice(-8));

    const acceptRematch = async (roomCode?: string | null) => {
      if (!roomCode) return;
      try {
        const { data: req } = await supabase
          .from('rematch_requests')
          .select('id, game_type, from_user_id')
          .eq('room_code', roomCode)
          .eq('to_user_id', user.id)
          .eq('status', 'pending')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!req) {
          toast({ title: 'İstek bulunamadı', duration: 2500, variant: 'destructive' as any });
          return;
        }

        console.log('✅ Rematch kabul ediliyor, respondRematchRequest çağrılıyor:', req.id);
        
        // GameContext'teki respondRematchRequest'i kullan - bu fonksiyon:
        // 1. Room'u oluşturur/bekler
        // 2. Participant olarak ekler
        // 3. setCurrentRoom çağırır ✅
        // 4. setParticipants çağırır ✅
        // 5. Navigate eder (RoomAutoNavigator otomatik devreye girer)
        await respondRematchRequest(req.id, true);
        
      } catch (e) {
        console.error('acceptRematch error:', e);
        toast({ title: 'Bir hata oluştu', variant: 'destructive' as any });
      }
    };

    const rejectRematch = async (roomCode?: string | null) => {
      if (!roomCode) return;
      try {
        const { data: req } = await supabase
          .from('rematch_requests')
          .select('id')
          .eq('room_code', roomCode)
          .eq('to_user_id', user.id)
          .eq('status', 'pending')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!req) return;

        await supabase
          .from('rematch_requests')
          .update({ status: 'rejected', responded_at: new Date().toISOString() })
          .eq('id', req.id);

        toast({ title: 'İstek reddedildi', duration: 2000 });
      } catch (e) {
        console.error('rejectRematch error:', e);
      }
    };

    const channel = supabase
      .channel('global-rematch-listener')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'rematch_requests',
          filter: `to_user_id=eq.${user.id}`
        },
        (payload) => {
          const req: any = payload.new;
          if (!req || req.status !== 'pending') return;
          console.log('🎮 Rematch isteği alındı (global):', req);
          try {
            toast({
              title: '🎮 Tekrar Oyun İsteği',
              description: 'Rakibiniz tekrar oyun istiyor!',
              duration: 10000,
              action: (
                <div className="flex gap-2">
                  <ToastAction altText="Kabul et" asChild>
                    <Button size="sm" onClick={() => acceptRematch(req.room_code)}>Kabul</Button>
                  </ToastAction>
                  <ToastAction altText="Reddet" asChild>
                    <Button size="sm" variant="outline" onClick={() => rejectRematch(req.room_code)}>Reddet</Button>
                  </ToastAction>
                </div>
              ) as any,
            });
          } catch (e) {
            console.warn('Toast gösterilemedi:', e);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'rematch_requests',
          filter: `from_user_id=eq.${user.id}`
        },
        async (payload) => {
          const req: any = payload.new;
          if (!req || req.status !== 'accepted' || !req.room_code) return;
          console.log('✅ Rematch kabul edildi (istek gönderen):', req);
          
          // Odanın modunu al ve doğru route'a yönlendir
          try {
            const { data: room } = await supabase
              .from('game_rooms')
              .select('game_mode')
              .eq('room_code', req.room_code)
              .maybeSingle();
            const isRandom = room?.game_mode?.includes('random-match');
            const basePath = isRandom ? '/game/random-match' : '/game/private-room';
            setTimeout(() => navigate(`${basePath}?room=${req.room_code}&type=${req.game_type}`), 0);
          } catch {
            // Fallback
            setTimeout(() => navigate(`/game/private-room?room=${req.room_code}&type=${req.game_type}`), 0);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'rematch_requests',
          filter: `to_user_id=eq.${user.id}`
        },
        async (payload) => {
          const req: any = payload.new;
          if (!req || req.status !== 'accepted' || !req.room_code) return;
          console.log('✅ Rematch kabul edildi (istek alan):', req);

          // Odanın modunu al ve doğru route'a yönlendir
          try {
            const { data: room } = await supabase
              .from('game_rooms')
              .select('game_mode')
              .eq('room_code', req.room_code)
              .maybeSingle();
            const isRandom = room?.game_mode?.includes('random-match');
            const basePath = isRandom ? '/game/random-match' : '/game/private-room';
            setTimeout(() => navigate(`${basePath}?room=${req.room_code}&type=${req.game_type}`), 0);
          } catch {
            // Fallback
            setTimeout(() => navigate(`/game/private-room?room=${req.room_code}&type=${req.game_type}`), 0);
          }
        }
      )
      // Notifications tablosu listener'ı kaldırıldı - sadece rematch_requests yeterli
      .subscribe();

    return () => {
      console.log('🔌 Global rematch listener kapatılıyor');
      supabase.removeChannel(channel);
    };
  }, [user?.id, navigate]);

  return null;
};

const App = () => {
  // Native immersive bars (Android): show on edge-swipe for 3s, then auto-hide
  useImmersiveBars();
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter
          future={{
            v7_startTransition: true,
            v7_relativeSplatPath: true,
          }}
        >
          <AuthProvider>
            <UserProvider>
              <ThemeProvider>
                <MusicProvider>
                  <MatchmakingProvider>
                    <GameProvider>
                      <GlobalRematchListener />
                      <RoomAutoNavigator />
                      <TournamentProvider>
                        <NotificationProvider>
                          <AppRoutes />
                        </NotificationProvider>
                      </TournamentProvider>
                    </GameProvider>
                  </MatchmakingProvider>
                </MusicProvider>
              </ThemeProvider>
            </UserProvider>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
