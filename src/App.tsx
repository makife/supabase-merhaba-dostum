// App.tsx - Main Application Component
import React, { useState, useEffect, useRef } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useParams } from "react-router-dom";
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
import NakamaGamePage from "@/pages/NakamaGamePage";
import NotFound from "./pages/NotFound";
import LeaderboardPage from "@/pages/LeaderboardPage";
import ChatPage from "./pages/ChatPage";
import FriendsPage from "./pages/FriendsPage";
import TournamentPage from "./pages/TournamentPage";
import TournamentWaitingPage from "./pages/TournamentWaitingPage";
import TournamentBracketPage from "./pages/TournamentBracketPage";
import PrivateRoomWaitingPage from "./pages/PrivateRoomWaitingPage";
import { useLocalStorageClear } from "@/hooks/useLocalStorageClear";
import { useScreenOrientation } from "@/hooks/useScreenOrientation";

// 🚀 Lazy load mini oyunlar - ana sayfa açılışını hızlandırır
const WheelPage = React.lazy(() => import("./pages/WheelPage"));
const MemoryGamePage = React.lazy(() => import("@/pages/MemoryGamePage"));
const PuzzleGamePage = React.lazy(() => import("@/pages/PuzzleGame"));
const GridSimonSaysPage = React.lazy(() => import("@/pages/GridSimonSays"));
const ReactorRunnerPage = React.lazy(() => import("@/pages/DinoRunner"));
const NeonBlitzPage = React.lazy(() => import("@/pages/NeonBlitz"));
const SnakeGamePage = React.lazy(() => import("@/pages/SnakeGame"));
const MiniGamesPage = React.lazy(() => import("@/pages/MiniGamesPage"));
const MorlesGamePage = React.lazy(() => import("@/pages/MorlesGame"));
const WordHuntPage = React.lazy(() => import("@/pages/WordHuntPage"));
const AnagramPage = React.lazy(() => import("@/pages/AnagramPage"));
const WordChainPage = React.lazy(() => import("@/pages/WordChainPage"));
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
// connectionHealthMonitor kaldırıldı — supabaseConnectionManager yeterli
import { startConnectionMonitor, stopConnectionMonitor } from "@/utils/supabaseConnectionManager";
import { useSessionRecovery } from "@/hooks/useSessionRecovery";
import { initEventHub } from "@/utils/foregroundEventHub";
import { useForceReloadOnResume } from "@/hooks/useForceReloadOnResume";
import { toast } from "sonner";
import { useAdMob } from "@/hooks/useAdMob";
import { useFriendOnlineToast } from "@/hooks/useFriendOnlineToast";
import { useActivityTracker } from "@/hooks/useActivityTracker";

const queryClient = new QueryClient();

// 🔥 Resume ve Loading flag'leri
const RESUME_FLAG_KEY = "app-resume-restart";
const APP_LOADED_KEY = "app-loaded";

// Onboarding/Welcome dialogs wrapper - SADECE GİRİŞ YAPMIS KULLANICILAR İÇİN
const OnboardingWrapper = () => {
  const { user, loading } = useAuth();
  const [showPermissions, setShowPermissions] = useState(false);
  const [showIntro, setShowIntro] = useState(false);
  const [isReady, setIsReady] = useState(false);

  // Kullanıcı giriş yaptığında ve henüz onboarding tamamlanmamışsa göster
  useEffect(() => {
    if (loading) return; // Auth loading bitene kadar bekle
    if (!user) {
      // User yoksa state'leri resetle
      setShowPermissions(false);
      setShowIntro(false);
      setIsReady(false);
      return;
    }

    // 🔥 User gelince 500ms bekle (auth context stabilize olsun)
    const timer = setTimeout(() => {
      const permissionsCompleted = localStorage.getItem("kelimeci-permissions-completed");
      const introCompleted = localStorage.getItem("kelimeci-intro-completed");

      setIsReady(true);

      if (!permissionsCompleted) {
        setShowPermissions(true);
      } else if (!introCompleted) {
        setShowIntro(true);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [user, loading]);

  const handlePermissionsComplete = () => {
    localStorage.setItem("kelimeci-permissions-completed", "true");
    setShowPermissions(false);
    // İzinler tamamlandığında intro göster
    const introCompleted = localStorage.getItem("kelimeci-intro-completed");
    if (!introCompleted) {
      setTimeout(() => setShowIntro(true), 300);
    }
  };

  const handleIntroClose = () => {
    localStorage.setItem("kelimeci-intro-completed", "true");
    setShowIntro(false);
  };

  // Kullanıcı giriş yapmamışsa veya henüz hazır değilse gösterme
  if (!user || !isReady) return null;

  return (
    <>
      <OnboardingPermissions
        open={showPermissions}
        onComplete={handlePermissionsComplete}
        onShowIntro={() => setShowIntro(true)}
      />
      <WelcomeIntroDialog open={showIntro} onClose={handleIntroClose} />
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

// 🎮 GamePage wrapper - URL'deki :mode parametresinden gameMode'u alır
const GamePageWrapper = () => {
  const { mode } = useParams<{ mode: string }>();

  // URL'deki mode'u gameMode'a çevir
  const gameMode = (() => {
    switch (mode) {
      case "vs-computer":
        return "vs-computer";
      case "private-room":
        return "private-room";
      case "random-match":
        return "random-match";
      case "tournament":
        return "tournament";
      default:
        return "vs-computer";
    }
  })() as "vs-computer" | "private-room" | "random-match" | "tournament";

  return <GamePage gameMode={gameMode} />;
};

const AppRoutes = () => {
  const { user, loading } = useAuth();

  // 🔥🔥🔥 Loading kontrolü: Her render'da CANLI kontrol et
  // sessionStorage.getItem HER RENDER'DA çağrılmalı!
  const checkShouldShowLoading = (): boolean => {
    // 1. Resume flag varsa ASLA loading gösterme
    const resumeFlag = sessionStorage.getItem(RESUME_FLAG_KEY) === "true";
    if (resumeFlag) {
      console.log("[App] ✅ Resume flag aktif - Loading ATLANDI");
      sessionStorage.setItem(APP_LOADED_KEY, "true");
      sessionStorage.removeItem(RESUME_FLAG_KEY); // Flag'i temizle
      return false;
    }

    // 2. Zaten yüklendiyse loading gösterme
    const alreadyLoaded = sessionStorage.getItem(APP_LOADED_KEY) === "true";
    if (alreadyLoaded) {
      console.log("[App] ✅ Zaten yüklenmişti - Loading atlanıyor");
      return false;
    }

    // 3. İlk açılış - loading göster
    console.log("[App] 📱 Cold start - Loading gösterilecek");
    return true;
  };

  const [customLoading, setCustomLoading] = useState(checkShouldShowLoading);

  // App State & Connection Management
  useAppState();
  useAppForegroundState();
  useLocalStorageClear();
  useScreenOrientation();
  useImmersiveBars();
  useSessionRecovery();
  useForceReloadOnResume();
  useFriendOnlineToast();
  useActivityTracker();

  // 🔥 AdMob'u uygulama başlangıcında initialize et
  const { initializeAdMob } = useAdMob();
  
  useEffect(() => {
    if (Capacitor.isNativePlatform()) {
      console.log("[App] 🎬 Initializing AdMob at app startup...");
      initializeAdMob().then((success) => {
        console.log("[App] AdMob init result:", success);
      });
    }
  }, [initializeAdMob]);

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
    console.log("[App] Loading completed");
    setCustomLoading(false);
    sessionStorage.setItem(APP_LOADED_KEY, "true");
  };

  // 🔥 Loading göster (sadece ilk cold start'ta)
  if (customLoading) {
    return <LoadingScreen onLoadingComplete={handleLoadingComplete} />;
  }

  return (
    <>
      <React.Suspense fallback={<div className="fixed inset-0 bg-slate-950 flex items-center justify-center"><div className="w-8 h-8 border-2 border-yellow-400 border-t-transparent rounded-full animate-spin" /></div>}>
      <Routes>
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <HomePage />
            </ProtectedRoute>
          }
        />
        <Route path="/auth" element={<AuthPage />} />
        <Route path="/auth/callback" element={<AuthPage />} />
        <Route path="/auth/reset-password" element={<ResetPasswordPage />} />
        <Route
          path="/game/:mode"
          element={
            <ProtectedRoute>
              <GamePageWrapper />
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
          path="/settings"
          element={
            <ProtectedRoute>
              <SettingsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/market"
          element={
            <ProtectedRoute>
              <MarketPage />
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
          path="/nakama-game"
          element={
            <ProtectedRoute>
              <NakamaGamePage />
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
          path="/friends"
          element={
            <ProtectedRoute>
              <FriendsPage />
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
          path="/tournament/waiting/:tournamentId"
          element={
            <ProtectedRoute>
              <TournamentWaitingPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/tournament/bracket/:tournamentId"
          element={
            <ProtectedRoute>
              <TournamentBracketPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/tournament/game/:matchId"
          element={
            <ProtectedRoute>
              <GamePage gameMode="tournament" />
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
          path="/mini-games"
          element={
            <ProtectedRoute>
              <MiniGamesPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/challenge/word-hunt"
          element={
            <ProtectedRoute>
              <WordHuntPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/challenge/puzzle"
          element={
            <ProtectedRoute>
              <PuzzleGamePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/challenge/anagram"
          element={
            <ProtectedRoute>
              <AnagramPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/challenge/word-chain"
          element={
            <ProtectedRoute>
              <WordChainPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/private-room/waiting/:roomCode"
          element={
            <ProtectedRoute>
              <PrivateRoomWaitingPage />
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
      </React.Suspense>
      <RoomAutoNavigator />
      <GlobalRematchDialogWrapper />
    </>
  );
};

// Global Rematch Dialog wrapper
const GlobalRematchDialogWrapper = () => {
  const { incomingRequest, acceptRematch, rejectRematch } = useRematchContext();
  const { profile } = useUser();

  // Kullanıcının yeterli hakkı var mı kontrol et
  const totalCredits = (profile?.game_credits || 0) + (profile?.bonus_credits || 0);
  const hasEnoughCredits = totalCredits >= 1;

  const handleAccept = async () => {
    try {
      await acceptRematch();
    } catch (error) {
      console.error("Rematch kabul hatası:", error);
    }
  };

  const handleReject = async () => {
    try {
      await rejectRematch();
    } catch (error) {
      console.error("Rematch reddetme hatası:", error);
    }
  };

  return (
    <RematchDialog
      open={!!incomingRequest}
      onAccept={handleAccept}
      onReject={handleReject}
      senderName={incomingRequest?.senderName || "Rakip"}
      senderAvatar={incomingRequest?.senderAvatar}
      hasEnoughCredits={hasEnoughCredits}
    />
  );
};

// 🔥🔥🔥 İÇ PROVIDER AĞACI - key ile kontrol edilir
// key değişince TÜM context'ler sıfırdan başlar = ilk açılış gibi!
const AppProviders = () => {
  return (
    <BrowserRouter>
      <AuthProvider>
        <UserProvider>
          <ThemeProvider>
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
          </ThemeProvider>
        </UserProvider>
      </AuthProvider>
    </BrowserRouter>
  );
};

const App = () => {
  // Native resume event dinle - uygulamayı sıfırdan başlat
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const handleNativeResumeReady = async () => {
      console.log("[App] 📱 native-resume-ready eventi alındı!");
      console.log("[App] 🔄🔄🔄 SESSION RECOVERY BAŞLIYOR (Sayfa korunuyor) 🔄🔄🔄");

      // 🔥🔥🔥 KRİTİK: Loading ekranı ATLANACAK flag'i set et
      // Yeni mount'ta bu flag kontrol edilecek
      sessionStorage.setItem(RESUME_FLAG_KEY, "true");
      sessionStorage.setItem(APP_LOADED_KEY, "true");

      // Toast göster
      toast.loading("Bağlanıyor...", { id: "resume-loading", duration: 15000 });

      // 🔥 Session recovery başlat (sayfa değişmeden kanalları canlandır)
      try {
        const { performResumeRecoveryDirect } = await import("@/hooks/useForceReloadOnResume");
        const success = await performResumeRecoveryDirect();

        toast.dismiss("resume-loading");

        if (success) {
          toast.success("Bağlandı!", { duration: 1500 });
        } else {
          toast.error("Bağlantı hatası", { duration: 2000 });
        }
      } catch (e) {
        console.error("[App] Resume recovery hatası:", e);
        toast.dismiss("resume-loading");
        toast.error("Bağlantı hatası", { duration: 2000 });
      }
    };

    window.addEventListener("native-resume-ready", handleNativeResumeReady);
    console.log("[App] ✅ native-resume-ready listener kaydedildi");

    return () => {
      window.removeEventListener("native-resume-ready", handleNativeResumeReady);
    };
  }, []);

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <AppProviders />
        </TooltipProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
};

export default App;
