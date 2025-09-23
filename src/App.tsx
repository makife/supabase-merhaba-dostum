import React, { useState, useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/components/ThemeProvider";
import { GameProvider } from "@/contexts/GameContext";
import { MusicProvider } from "@/contexts/MusicContext";
import { UserProvider } from "@/contexts/UserContext";
import { MatchmakingProvider } from "@/contexts/NewMatchmakingContext";
import { NotificationProvider } from '@/contexts/NotificationContext';
import { TournamentProvider } from '@/contexts/TournamentContext';
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
import NotFound from "./pages/NotFound";
import LeaderboardPage from "@/pages/LeaderboardPage";
import ChatPage from './pages/ChatPage';
import TournamentPage from './pages/TournamentPage';
import TournamentWaitingPage from './pages/TournamentWaitingPage';
import TournamentBracketPage from './pages/TournamentBracketPage';
import WheelPage from './pages/WheelPage';
import { useLocalStorageClear } from "@/hooks/useLocalStorageClear";
import { useScreenOrientation } from "@/hooks/useScreenOrientation";
import MemoryGamePage from "@/pages/MemoryGamePage";
import PuzzleGamePage from "@/pages/PuzzleGame";
import GridSimonSaysPage from "@/pages/GridSimonSays";
import ReactorRunnerPage from "@/pages/DinoRunner";
import SnakeGamePage from "@/pages/SnakeGame";
import { Capacitor } from '@capacitor/core';
import { useImmersiveBars } from '@/hooks/useImmersiveBars';



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
    return (
      <LoadingScreen 
        onLoadingComplete={() => setCustomLoading(false)} 
      />
    );
  }

  return (
    <Routes>
      <Route path="/auth" element={user ? <Navigate to="/" replace /> : <AuthPage />} />
      <Route path="/auth/reset-password" element={<ResetPasswordPage />} />
      <Route path="/" element={
        <ProtectedRoute>
          <HomePage />
        </ProtectedRoute>
      } />
      <Route path="/profile" element={
        <ProtectedRoute>
          <ProfilePage />
        </ProtectedRoute>
      } />
      <Route path="/profile/:id" element={
        <ProtectedRoute>
          <ProfilePage />
        </ProtectedRoute>
      } />
      <Route path="/game/vs-computer" element={
        <ProtectedRoute>
          <GamePage gameMode="vs-computer" />
        </ProtectedRoute>
      } />
      <Route path="/game/private-room" element={
        <ProtectedRoute>
          <GamePage gameMode="private-room" />
        </ProtectedRoute>
      } />
      <Route path="/game/random-match" element={
        <ProtectedRoute>
          <GamePage gameMode="random-match" />
        </ProtectedRoute>
      } />   
      
      <Route path="/game" element={
        <ProtectedRoute>
          <GamePage gameMode="tournament" />
        </ProtectedRoute>
      } />
      
      <Route path="/tournament" element={
        <ProtectedRoute>
          <TournamentPage />
        </ProtectedRoute>
      } />
      
      <Route path="/tournament-waiting/:tournamentId" element={
        <ProtectedRoute>
          <TournamentWaitingPage />
        </ProtectedRoute>
      } />
      <Route path="/tournament-bracket/:tournamentId" element={
        <ProtectedRoute>
          <TournamentBracketPage />
        </ProtectedRoute>
      } />

      <Route path="/game/tournament" element={
        <ProtectedRoute>
          <GamePage gameMode="tournament" />
       </ProtectedRoute>
      } />
      <Route path="/puzzle-game" element={
        <ProtectedRoute>
          <PuzzleGamePage />
        </ProtectedRoute>
      } />
      
      <Route path="/tournament-game/:matchId" element={<GamePage gameMode="tournament" />} />
      
      <Route path="/market" element={
        <ProtectedRoute>
          <MarketPage />
        </ProtectedRoute>
      } />
      <Route path="/settings" element={
        <ProtectedRoute>
          <SettingsPage />
        </ProtectedRoute>
      } />
      <Route path="/leaderboard" element={
        <ProtectedRoute>
          <LeaderboardPage />
        </ProtectedRoute>
      } />
      <Route path="/chat" element={
        <ProtectedRoute>
          <ChatPage />
        </ProtectedRoute>
      } />
      <Route path="/test-matchmaking" element={
        <ProtectedRoute>
          <TestMatchmakingPage />
        </ProtectedRoute>
      } />
      <Route path="/wheel" element={
        <ProtectedRoute>
          <WheelPage />
        </ProtectedRoute>
      } />
      <Route path="/memory-game" element={
        <ProtectedRoute>
          <MemoryGamePage />
        </ProtectedRoute>
      } />
      <Route path="/puzzle-game" element={
        <ProtectedRoute>
          <PuzzleGamePage />
        </ProtectedRoute>
      } />
      <Route path="/grid-simon-says" element={
        <ProtectedRoute>
          <GridSimonSaysPage />
        </ProtectedRoute>
      } />
      <Route path="/reactor-runner" element={
        <ProtectedRoute>
          <ReactorRunnerPage />
        </ProtectedRoute>
      } />
      <Route path="/snake-game" element={
        <ProtectedRoute>
          <SnakeGamePage />
        </ProtectedRoute>
      } />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};

const App = () => {
  // Native immersive bars (Android): show on edge-swipe for 3s, then auto-hide
  useImmersiveBars();
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter future={{ 
          v7_startTransition: true,
          v7_relativeSplatPath: true 
        }}>
          <AuthProvider>
            <UserProvider>
              <ThemeProvider>
                <MusicProvider>
                  <MatchmakingProvider>
                    <GameProvider>
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
