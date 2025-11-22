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
import { UserProvider, useUser } from "@/contexts/UserContext";
import { MatchmakingProvider } from "@/contexts/NewMatchmakingContext";
import { NotificationProvider } from "@/contexts/NotificationContext";
import { TournamentProvider } from "@/contexts/TournamentContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import ModeratorRoute from "@/components/ModeratorRoute";
import LoadingScreen from "@/components/LoadingScreen";
import AuthPage from "@/pages/AuthPage";
import ModeratorPage from "@/pages/ModeratorPage";
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
import MorlesGamePage from "@/pages/MorlesGame";
import { Capacitor } from "@capacitor/core";
import { useImmersiveBars } from "@/hooks/useImmersiveBars";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import RoomAutoNavigator from "@/components/RoomAutoNavigator";
import { ToastAction } from "@/components/ui/toast";
import { RematchDialog } from "@/components/RematchDialog";
import { useNavigate } from "react-router-dom";
import { useAppState } from "@/hooks/useAppState";
import { realtimeManager } from "@/utils/realtimeManager";
import { OnboardingPermissions } from "@/components/OnboardingPermissions";
import { useToast } from "@/hooks/use-toast";

const queryClient = new QueryClient();

const AppRoutes = () => {
  const { user, loading } = useAuth();
  const [customLoading, setCustomLoading] = useState(true);
  const [showOnboarding, setShowOnboarding] = useState(false);

  // LocalStorage temizleme hook'unu kullan
  useLocalStorageClear();

  // Ekran yönlendirmesini kilitle
  useScreenOrientation();

  // Immersive mode'u aktif et (navigasyon tuşlarını gizle)
  //useImmersiveMode();

  // İlk açılış kontrolü
  useEffect(() => {
    if (user && !loading) {
      const onboardingCompleted = localStorage.getItem("kelimeci-onboarding-completed");
      if (!onboardingCompleted) {
        setShowOnboarding(true);
      }
    }
  }, [user, loading]);

  if (loading || customLoading) {
    return <LoadingScreen onLoadingComplete={() => setCustomLoading(false)} />;
  }

  return (
    <>
      <OnboardingPermissions open={showOnboarding} onComplete={() => setShowOnboarding(false)} />
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
          path="/morles-game"
          element={
            <ProtectedRoute>
              <MorlesGamePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/moderator"
          element={
            <ModeratorRoute>
              <ModeratorPage />
            </ModeratorRoute>
          }
        />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </>
  );
};

const GlobalRematchListener = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { profile } = useUser();
  const { respondRematchRequest } = useGame();
  const { toast } = useToast();
  const [processedRequests, setProcessedRequests] = useState<Set<string>>(new Set());
  const [rematchRequest, setRematchRequest] = useState<{
    id: string;
    senderId: string;
    senderName: string;
    senderAvatar: string | null;
    roomId: string;
  } | null>(null);

  useEffect(() => {
    if (!user?.id) return;

    console.log("🎮 GlobalRematchListener: Initializing for user:", user.id);

    const channel = supabase
      .channel("global-rematch-listener")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "rematch_requests",
          filter: `to_user_id=eq.${user.id}`,
        },
        async (payload) => {
          const request = payload.new as any;
          console.log("🔔 GlobalRematchListener: New rematch request received:", request);

          // Duplicate guard
          if (processedRequests.has(request.id)) {
            console.log("⏭️ Already processed request:", request.id);
            return;
          }

          setProcessedRequests((prev) => new Set([...prev, request.id]));

          // Fetch sender profile
          const { data: senderProfile } = await supabase
            .from("profiles")
            .select("username, avatar_url")
            .eq("id", request.from_user_id)
            .single();

          const senderName = senderProfile?.username || "Bilinmeyen oyuncu";
          const senderAvatar = senderProfile?.avatar_url || null;

          // Dialog'u aç
          setRematchRequest({
            id: request.id,
            senderId: request.from_user_id,
            senderName,
            senderAvatar,
            roomId: request.room_code,
          });
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "rematch_requests",
          filter: `from_user_id=eq.${user.id}`,
        },
        async (payload) => {
          const request = payload.new as any;
          console.log("📬 GlobalRematchListener: Rematch response received:", request);

          const responseKey = `response-${request.id}`;
          if (processedRequests.has(responseKey)) {
            console.log("⏭️ Already processed response:", responseKey);
            return;
          }

          setProcessedRequests((prev) => new Set([...prev, responseKey]));

          if (request.status === "accepted") {
            console.log("✅ Rematch accepted, navigating to game:", request.room_code);
            toast({
              title: "✅ Rematch Kabul Edildi",
              description: "Oyun başlıyor...",
            });
            // Odayı bul ve yönlendir
            const { data: roomRow } = await supabase
              .from("game_rooms")
              .select("id, game_mode")
              .eq("room_code", request.room_code)
              .maybeSingle();

            if (roomRow) {
              const type = roomRow.game_mode?.includes("score") ? "score" : "timed";
              navigate(`/private-room-waiting?code=${request.room_code}&roomId=${roomRow.id}&gameType=${type}`);
            }
          } else if (request.status === "rejected") {
            console.log("❌ Rematch rejected");
            toast({
              title: "❌ Rematch Reddedildi",
              description: "Oyuncu rematch isteğini reddetti.",
              variant: "destructive",
            });
          }
        }
      )
      .subscribe();

    return () => {
      console.log("🧹 GlobalRematchListener: Cleaning up");
      supabase.removeChannel(channel);
    };
  }, [user?.id, navigate, respondRematchRequest, toast, processedRequests]);

  const handleAccept = async () => {
    if (!rematchRequest) return;
    
    console.log("✅ Accepting rematch:", rematchRequest.id);
    await respondRematchRequest(rematchRequest.id, true);
    setRematchRequest(null);
  };

  const handleReject = async () => {
    if (!rematchRequest) return;
    
    console.log("❌ Rejecting rematch:", rematchRequest.id);
    await respondRematchRequest(rematchRequest.id, false);
    setRematchRequest(null);
  };

  const hasEnoughCredits = (profile?.game_credits ?? 0) >= 1;

  return (
    <RematchDialog
      open={!!rematchRequest}
      onAccept={handleAccept}
      onReject={handleReject}
      senderName={rematchRequest?.senderName || ""}
      senderAvatar={rematchRequest?.senderAvatar}
      hasEnoughCredits={hasEnoughCredits}
    />
  );
};

const App = () => {
  // Native immersive bars (Android): show on edge-swipe for 3s, then auto-hide
  useImmersiveBars();

  // Arka plan/ön plan yönetimi - 30 saniye sonra durdur
  useAppState(
    () => {
      // Arka plana gitti - 30 saniye beklendi, hala arka plandaysa durdur
      console.log("⏹️ 30 saniye arka planda kaldı - realtime bağlantılar kapatılıyor");
      realtimeManager.forceCleanupAll();
    },
    () => {
      // Ön plana geldi
      console.log("▶️ Uygulama ön plana geldi");
    },
    30000, // 30 saniye gecikme
  );

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
                  <MatchmakingProvider
                    onMatchFound={(roomId) => {
                      console.log("✅ Eşleşme bulundu, oyun sayfasına yönlendiriliyor:", roomId);
                      // Get current matchmaking type from MatchmakingContext
                      const currentGameType = (window as any).__currentMatchmakingType || 'timed';
                      // Use window location to navigate (React Router navigation won't work here)
                      window.location.href = `/game/random-match?room=${roomId}&type=${currentGameType}`;
                    }}
                  >
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
