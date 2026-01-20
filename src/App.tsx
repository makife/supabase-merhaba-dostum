// App.tsx - Main Application Component
import React, { useState, useEffect, useRef } from "react";
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
import { ServerTimeProvider } from "@/contexts/ServerTimeContext";
import { RematchProvider, useRematchContext } from "@/contexts/RematchContext";
// NativeRealtime kaldırıldı - Supabase JS SDK yeterli
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
import { SafeStatusBar, SafeNavigationBar, SafePushNotifications } from "@/utils/safePluginWrapper";
import ErrorBoundary from "@/components/ErrorBoundary";
import { supabase } from "@/integrations/supabase/client";
import RoomAutoNavigator from "@/components/RoomAutoNavigator";
import { RematchDialog } from "@/components/RematchDialog";
import { useAppState } from "@/hooks/useAppState";
import { useAppForegroundState } from "@/hooks/useAppForegroundState";
import { OnboardingPermissions } from "@/components/OnboardingPermissions";
import { WelcomeIntroDialog } from "@/components/WelcomeIntroDialog";
import { BackButtonDialog } from "@/hooks/useBackButton";
import { initNativeAudio, isNativePlatform } from "@/services/nativeAudioService";
import { connectionHealthMonitor } from "@/utils/connectionHealthMonitor";
import { startConnectionMonitor, stopConnectionMonitor } from "@/utils/supabaseConnectionManager";
import { useSessionRecovery } from "@/hooks/useSessionRecovery";
import { initEventHub } from "@/utils/foregroundEventHub";
import { useForceReloadOnResume, performResumeRecoveryDirect } from "@/hooks/useForceReloadOnResume";
import { toast } from "sonner";

const queryClient = new QueryClient();

// 🔥🔥🔥 KRİTİK: App yüklenmeden ÖNCE resume flag'i kontrol et
// Bu SYNC olmalı - React render başlamadan önce karar verilmeli
const RESUME_FLAG_KEY = 'app-resume-restart';
const APP_LOADED_KEY = 'app-loaded';

function checkIsResumeRestart(): boolean {
  if (typeof window === 'undefined') return false;
  
  const nativeFlag = sessionStorage.getItem(RESUME_FLAG_KEY) === 'true';
  const urlFlag = window.location.search.includes('_resume=1');
  
  if (nativeFlag || urlFlag) {
    console.log("[App] 🔥 RESUME RESTART TESPİT EDİLDİ! Loading ATLANACAK");
    // Flag'i HEMEN temizle - bir kez kullanılır
    sessionStorage.removeItem(RESUME_FLAG_KEY);
    // URL'den de temizle
    if (urlFlag) {
      const url = new URL(window.location.href);
      url.searchParams.delete('_resume');
      window.history.replaceState({}, '', url.toString());
    }
    return true;
  }
  
  return false;
}

// 🔥 İLK RENDER ÖNCESI karar ver - bu global değişken React dışında
const IS_RESUME_RESTART = checkIsResumeRestart();
console.log("[App] 🚀 Initial check - IS_RESUME_RESTART:", IS_RESUME_RESTART);

// Onboarding/Welcome dialogs wrapper - kendi state'ini yönetir
const OnboardingWrapper = () => {
  const [showPermissions, setShowPermissions] = useState(() => {
    // İlk açılışta izin dialogunu göster
    const completed = localStorage.getItem('kelimeci-permissions-completed');
    return !completed;
  });
  const [showIntro, setShowIntro] = useState(false);
  
  const handlePermissionsComplete = () => {
    localStorage.setItem('kelimeci-permissions-completed', 'true');
    setShowPermissions(false);
    // İzinler tamamlandığında intro göster
    const introCompleted = localStorage.getItem('kelimeci-intro-completed');
    if (!introCompleted) {
      setShowIntro(true);
    }
  };
  
  const handleIntroClose = () => {
    localStorage.setItem('kelimeci-intro-completed', 'true');
    setShowIntro(false);
  };
  
  return (
    <>
      <OnboardingPermissions 
        open={showPermissions} 
        onComplete={handlePermissionsComplete}
        onShowIntro={() => setShowIntro(true)}
      />
      <WelcomeIntroDialog 
        open={showIntro} 
        onClose={handleIntroClose} 
      />
    </>
  );
};

// Wrapper component to use useNavigate inside Router context
const MatchmakingWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const navigate = useNavigate();

  return (
    <MatchmakingProvider
      onMatchFound={(roomId) => {
        console.log("✅ Eşleşme bulundu, oyun sayfasına yönlendiriliyor:", roomId);
        const currentGameType = (window as any).__currentMatchmakingType || "timed";
        navigate(`/game/random-match?room=${roomId}&type=${currentGameType}`);
      }}
    >
      {children}
    </MatchmakingProvider>
  );
};

const AppRoutes = () => {
  const { user, loading } = useAuth();
  
  // 🔥 Global değişkenden al - React render döngüsünden ÖNCE hesaplandı
  const [isResumeReload] = useState(IS_RESUME_RESTART);
  
  // 🔥 Loading: Resume ise ASLA gösterme, değilse göster (app-loaded yoksa)
  const [customLoading, setCustomLoading] = useState(() => {
    if (IS_RESUME_RESTART) {
      console.log("[App] ✅ Resume restart - Loading ATLANDI");
      sessionStorage.setItem(APP_LOADED_KEY, 'true');
      return false;
    }
    // Cold start - daha önce yüklenmediyse loading göster
    const alreadyLoaded = sessionStorage.getItem(APP_LOADED_KEY) === 'true';
    if (alreadyLoaded) {
      console.log("[App] ✅ Zaten yüklenmişti - Loading atlanıyor");
      return false;
    }
    console.log("[App] 📱 Cold start - Loading gösterilecek");
    return true;
  });
  
  // 🔥 Resume reload'da session recovery ve kanalları HEMEN başlat
  useEffect(() => {
    if (!isResumeReload) return;
    
    console.log("[App] 🔄 Resume reload - session recovery BAŞLATIYOR...");
    
    // "Bağlanıyor" toast göster
    toast.loading("Bağlanıyor...", {
      id: "resume-connecting",
      duration: 15000, // 15 saniye timeout
    });
    
    // 🔥 Session recovery'yi DOĞRUDAN çağır
    performResumeRecoveryDirect()
      .then((success) => {
        if (success) {
          console.log("[App] ✅ Resume recovery BAŞARILI!");
          toast.dismiss("resume-connecting");
          toast.success("Bağlandı!", { duration: 1500 });
        } else {
          console.log("[App] ⚠️ Resume recovery başarısız");
          toast.dismiss("resume-connecting");
          toast.error("Bağlantı hatası", { duration: 2000 });
        }
      })
      .catch((e) => {
        console.error("[App] ❌ Resume recovery hatası:", e);
        toast.dismiss("resume-connecting");
        toast.error("Bağlantı hatası", { duration: 2000 });
      });
      
  }, [isResumeReload]);
  
  // App State & Connection Management
  useAppState();
  useAppForegroundState();
  useLocalStorageClear();
  useScreenOrientation();
  useImmersiveBars();
  useSessionRecovery();
  useForceReloadOnResume();

  // İlk yüklemede audio başlat
  useEffect(() => {
    if (isNativePlatform()) {
      initNativeAudio().catch(console.error);
    }
  }, []);

  // Connection monitor başlat
  useEffect(() => {
    startConnectionMonitor();
    initEventHub();
    
    return () => {
      stopConnectionMonitor();
    };
  }, []);

  const handleLoadingComplete = () => {
    console.log('[App] Loading completed');
    setCustomLoading(false);
    sessionStorage.setItem(APP_LOADED_KEY, 'true');
  };

  // 🔥 Resume'da loading ASLA gösterme
  if (customLoading && !isResumeReload) {
    return <LoadingScreen onLoadingComplete={handleLoadingComplete} />;
  }

  return (
    <>
      <Routes>
        <Route path="/" element={
          <ProtectedRoute>
            <HomePage />
          </ProtectedRoute>
        } />
        <Route path="/auth" element={<AuthPage />} />
        <Route path="/auth/callback" element={<AuthPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/game/:mode" element={
          <ProtectedRoute>
            <GamePage gameMode="random-match" />
          </ProtectedRoute>
        } />
        <Route path="/profile" element={
          <ProtectedRoute>
            <ProfilePage />
          </ProtectedRoute>
        } />
        <Route path="/settings" element={
          <ProtectedRoute>
            <SettingsPage />
          </ProtectedRoute>
        } />
        <Route path="/market" element={
          <ProtectedRoute>
            <MarketPage />
          </ProtectedRoute>
        } />
        <Route path="/test-matchmaking" element={
          <ProtectedRoute>
            <TestMatchmakingPage />
          </ProtectedRoute>
        } />
        <Route path="/sync-test" element={
          <ProtectedRoute>
            <SyncTestPage />
          </ProtectedRoute>
        } />
        <Route path="/random-match" element={
          <ProtectedRoute>
            <RandomMatchPage />
          </ProtectedRoute>
        } />
        <Route path="/nakama-game" element={
          <ProtectedRoute>
            <NakamaGamePage />
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
        <Route path="/tournament" element={
          <ProtectedRoute>
            <TournamentPage />
          </ProtectedRoute>
        } />
        <Route path="/tournament/waiting/:tournamentId" element={
          <ProtectedRoute>
            <TournamentWaitingPage />
          </ProtectedRoute>
        } />
        <Route path="/tournament/bracket/:tournamentId" element={
          <ProtectedRoute>
            <TournamentBracketPage />
          </ProtectedRoute>
        } />
        <Route path="/tournament/game/:matchId" element={
          <ProtectedRoute>
            <GamePage gameMode="tournament" />
          </ProtectedRoute>
        } />
        <Route path="/wheel" element={
          <ProtectedRoute>
            <WheelPage />
          </ProtectedRoute>
        } />
        <Route path="/private-room/waiting/:roomCode" element={
          <ProtectedRoute>
            <PrivateRoomWaitingPage />
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
        <Route path="/neon-blitz" element={
          <ProtectedRoute>
            <NeonBlitzPage />
          </ProtectedRoute>
        } />
        <Route path="/snake-game" element={
          <ProtectedRoute>
            <SnakeGamePage />
          </ProtectedRoute>
        } />
        <Route path="/morles" element={
          <ProtectedRoute>
            <MorlesGamePage />
          </ProtectedRoute>
        } />
        <Route path="/moderator" element={
          <ModeratorRoute>
            <ModeratorPage />
          </ModeratorRoute>
        } />
        <Route path="*" element={<NotFound />} />
      </Routes>
      <RoomAutoNavigator />
      <GlobalRematchDialogWrapper />
    </>
  );
};

// Global Rematch Dialog wrapper
const GlobalRematchDialogWrapper = () => {
  const { incomingRequest, acceptRematch, rejectRematch } = useRematchContext();
  
  const handleAccept = async () => {
    try {
      await acceptRematch();
    } catch (error) {
      console.error('Rematch kabul hatası:', error);
    }
  };
  
  const handleReject = async () => {
    try {
      await rejectRematch();
    } catch (error) {
      console.error('Rematch reddetme hatası:', error);
    }
  };
  
  return (
    <RematchDialog
      open={!!incomingRequest}
      onAccept={handleAccept}
      onReject={handleReject}
      senderName={incomingRequest?.senderName || 'Rakip'}
      senderAvatar={incomingRequest?.senderAvatar}
    />
  );
};

const App = () => {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <TooltipProvider>
            <BrowserRouter>
              <AuthProvider>
                <UserProvider>
                  <ServerTimeProvider>
                    <MusicProvider>
                      <GameProvider>
                        <TournamentProvider>
                          <NotificationProvider>
                            <MatchmakingWrapper>
                              <RematchProvider>
                                <Toaster />
                                <Sonner />
                                <OnboardingWrapper />
                                <BackButtonDialog />
                                <AppRoutes />
                              </RematchProvider>
                            </MatchmakingWrapper>
                          </NotificationProvider>
                        </TournamentProvider>
                      </GameProvider>
                    </MusicProvider>
                  </ServerTimeProvider>
                </UserProvider>
              </AuthProvider>
            </BrowserRouter>
          </TooltipProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
};

export default App;
