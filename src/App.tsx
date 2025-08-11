import React from "react";
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
import { NewMatchmakingProvider } from "@/contexts/NewMatchmakingContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import AuthPage from "@/pages/AuthPage";
import HomePage from "@/pages/HomePage";
import GamePage from "@/pages/GamePage";
import ProfilePage from "@/pages/ProfilePage";
import SettingsPage from "@/pages/SettingsPage";
import MarketPage from "@/pages/MarketPage";
import TournamentPage from "@/pages/TournamentPage";
import TestMatchmakingPage from "@/pages/TestMatchmakingPage";
import NotFound from "./pages/NotFound";
import LeaderboardPage from "@/pages/LeaderboardPage";

const queryClient = new QueryClient();

const AppRoutes = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center game-grid">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-primary mx-auto"></div>
          <p className="text-lg font-medium">Kelimeci yükleniyor...</p>
        </div>
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/auth" element={user ? <Navigate to="/" replace /> : <AuthPage />} />
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
      <Route path="/tournament" element={
        <ProtectedRoute>
          <TournamentPage />
        </ProtectedRoute>
      } />
      <Route path="/tournament/:id/match" element={
        <ProtectedRoute>
          <GamePage gameMode="tournament" />
        </ProtectedRoute>
      } />
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
      <Route path="/test-matchmaking" element={
        <ProtectedRoute>
          <TestMatchmakingPage />
        </ProtectedRoute>
      } />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};

const App = () => {
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
                  <GameProvider>
                    <NewMatchmakingProvider>
                      <AppRoutes />
                    </NewMatchmakingProvider>
                  </GameProvider>
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
