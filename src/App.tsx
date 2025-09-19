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
import { Capacitor } from '@capacitor/core';


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
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};

const App = () => {
  // CSS-Only Immersive Mode
  useEffect(() => {
  if (Capacitor.isNativePlatform()) {
    document.body.classList.add('is-capacitor');
    document.body.classList.add('hide-bars'); // Başlangıçta gizli
    
    let hideTimer: NodeJS.Timeout;
    let touchStartY: number | null = null;
    let touchStartX: number | null = null;
    
    const scheduleHide = () => {
      clearTimeout(hideTimer);
      document.body.classList.remove('hide-bars');
      hideTimer = setTimeout(() => {
        document.body.classList.add('hide-bars');
      }, 3000);
    };
    
    const handleTouchStart = (e: TouchEvent) => {
      const touch = e.touches[0];
      touchStartY = touch.clientY;
      touchStartX = touch.clientX;
    };
    
    const handleTouchMove = (e: TouchEvent) => {
      if (touchStartY === null || touchStartX === null) return;
      
      const touch = e.touches[0];
      const deltaY = touch.clientY - touchStartY;
      const deltaX = Math.abs(touch.clientX - touchStartX);
      const windowHeight = window.innerHeight;
      
      // Dikey kaydırma mı kontrol et
      const isVerticalSwipe = Math.abs(deltaY) > deltaX;
      
      // Üst kenardan aşağı kaydırma (status bar için)
      const isTopEdgeSwipe = touchStartY < 50 && deltaY > 30;
      
      // Alt kenardan yukarı kaydırma (navigation bar için)
      const isBottomEdgeSwipe = touchStartY > windowHeight - 50 && deltaY < -30;
      
      if (isVerticalSwipe && (isTopEdgeSwipe || isBottomEdgeSwipe)) {
        scheduleHide();
      }
    };
    
    const handleTouchEnd = () => {
      touchStartY = null;
      touchStartX = null;
    };
    
    // Touch event listeners
    document.addEventListener('touchstart', handleTouchStart, { passive: true });
    document.addEventListener('touchmove', handleTouchMove, { passive: true });
    document.addEventListener('touchend', handleTouchEnd, { passive: true });
    
    return () => {
      clearTimeout(hideTimer);
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
      document.body.classList.remove('is-capacitor', 'hide-bars');
    };
  }
}, []);

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
