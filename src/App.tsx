import React, { useState, useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/components/ThemeProvider";
import { GameProvider } from "@/contexts/GameContext";
import { MusicProvider } from "@/contexts/MusicContext";
import { UserProvider, useUser } from "@/contexts/UserContext";
import { MatchmakingProvider } from "@/contexts/NewMatchmakingContext";
import { NotificationProvider } from "@/contexts/NotificationContext";
import { TournamentProvider } from "@/contexts/TournamentContext";
import { RematchProvider, useRematchContext } from "@/contexts/RematchContext";
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
import SyncTestPage from "@/pages/SyncTestPage";
import RandomMatchPage from "@/pages/RandomMatchPage";
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
import NeonBlitzPage from "@/pages/NeonBlitz";
import SnakeGamePage from "@/pages/SnakeGame";
import MorlesGamePage from "@/pages/MorlesGame";
import { Capacitor } from "@capacitor/core";
import { useImmersiveBars } from "@/hooks/useImmersiveBars";
import { supabase } from "@/integrations/supabase/client";
import RoomAutoNavigator from "@/components/RoomAutoNavigator";
import { RematchDialog } from "@/components/RematchDialog";
import { useAppState } from "@/hooks/useAppState";
import { realtimeManager } from "@/utils/realtimeManager";
import { OnboardingPermissions } from "@/components/OnboardingPermissions";

const queryClient = new QueryClient();

// Wrapper component to use useNavigate inside Router context
const MatchmakingWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const navigate = useNavigate();

  return (
    <MatchmakingProvider
      onMatchFound={(roomId) => {
        console.log("✅ Eşleşme bulundu, oyun sayfasına yönlendiriliyor:", roomId);
        const currentGameType = (window as any).__currentMatchmakingType || "timed";
        // Use React Router navigate for instant navigation
        navigate(`/game/random-match?room=${roomId}&type=${currentGameType}`);
      }}
    >
      {children}
    </MatchmakingProvider>
  );
};

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
          path="/game/:matchId"
          element={
            <ProtectedRoute>
              <GamePage gameMode="tournament" />
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
          path="/sync-test"
          element={
            <ProtectedRoute>
              <SyncTestPage />
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
          path="/neon-blitz"
          element={
            <ProtectedRoute>
              <NeonBlitzPage />
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

// Global Rematch Dialog - artık RematchContext kullanıyor
const GlobalRematchDialog = () => {
  const { incomingRequest, acceptRematch, rejectRematch } = useRematchContext();
  const { profile } = useUser();

  const hasEnoughCredits = (profile?.game_credits ?? 0) >= 1;

  return (
    <RematchDialog
      open={!!incomingRequest}
      onAccept={acceptRematch}
      onReject={rejectRematch}
      senderName={incomingRequest?.senderName || ""}
      senderAvatar={incomingRequest?.senderAvatar}
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
                  <MatchmakingWrapper>
                    <GameProvider>
                      <RematchProvider>
                        <GlobalRematchDialog />
                        <RoomAutoNavigator />
                        <TournamentProvider>
                          <NotificationProvider>
                            <AppRoutes />
                          </NotificationProvider>
                        </TournamentProvider>
                      </RematchProvider>
                    </GameProvider>
                  </MatchmakingWrapper>
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
