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
import { useForceReloadOnResume } from "@/hooks/useForceReloadOnResume";

const queryClient = new QueryClient();

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
  const [customLoading, setCustomLoading] = useState(() => {
    if (typeof window !== 'undefined' && sessionStorage.getItem('app-loaded')) {
      return false;
    }
    return true;
  });

  // Resume reload kontrolü - app başlangıcında çalışır
  useEffect(() => {
    const checkResume = async () => {
      const { checkResumeReload } = await import("@/hooks/useForceReloadOnResume");
      await checkResumeReload();
    };
    checkResume();
  }, []);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showIntroDialog, setShowIntroDialog] = useState(false);

  useLocalStorageClear();
  useScreenOrientation();

  useEffect(() => {
    const initializeApp = async () => {
      if (!Capacitor.isNativePlatform()) return;
      
      try {
        const { initAppStateListener, markListenerReady } = await import("@/hooks/useAppForegroundState");
        initAppStateListener();
        markListenerReady();
        console.log("✅ App: AppState Listener başlatıldı");
      } catch (e) {
        console.warn("[App] AppState listener hatası:", e);
      }
      
      try {
        if (isNativePlatform()) {
          console.log("🔊 App: Native Audio başlatılıyor...");
          await initNativeAudio();
        }
      } catch (e) {
        console.log("[App] Native Audio init hatası:", e);
      }

      try {
        await SafeStatusBar.setStyle({ style: "Dark" });
        await SafeStatusBar.setBackgroundColor({ color: "#000000" });
        await SafeStatusBar.setOverlaysWebView({ overlay: true });
        await SafeNavigationBar.setColor({ color: "#000000", darkButtons: false });
        await SafeStatusBar.hide();
        await SafeNavigationBar.hide();
      } catch (e) {
        console.log("[App] Immersive mode hatası:", e);
      }
    };

    initializeApp();
  }, []);

  useEffect(() => {
    if (user && !loading) {
      const onboardingCompleted = localStorage.getItem("kelimeci-onboarding-completed");
      if (!onboardingCompleted) {
        setShowOnboarding(true);
      }
    }
  }, [user, loading]);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    
    const initPush = async () => {
      try {
        const permStatus = await SafePushNotifications.checkPermissions();
        if (!permStatus) return;
        
        let finalStatus = permStatus;
        if (permStatus.receive === "prompt") {
          const reqResult = await SafePushNotifications.requestPermissions();
          if (reqResult) finalStatus = reqResult;
        }
        
        if (finalStatus.receive === "granted") {
          await SafePushNotifications.createChannel({
            id: "kelimeci_alerts_v2",
            name: "Oyun Bildirimleri",
            description: "Oyun davetleri ve sıra bildirimleri",
            importance: 5,
            visibility: 1,
            sound: "default",
            vibration: true,
            lights: true,
          });
          await SafePushNotifications.register();
        }
      } catch (e) {
        console.log("[App] Push başlatma hatası:", e);
      }
    };

    initPush();
  }, []);

  const handleLoadingComplete = () => {
    sessionStorage.setItem('app-loaded', 'true');
    setCustomLoading(false);
  };

  if (loading || customLoading) {
    return <LoadingScreen onLoadingComplete={handleLoadingComplete} />;
  }

  return (
    <>
      <OnboardingPermissions
        open={showOnboarding}
        onComplete={() => setShowOnboarding(false)}
        onShowIntro={() => setShowIntroDialog(true)}
      />
      <WelcomeIntroDialog open={showIntroDialog} onClose={() => setShowIntroDialog(false)} />
      <Routes>
        <Route path="/auth" element={user ? <Navigate to="/" replace /> : <AuthPage />} />
        <Route path="/auth/reset-password" element={<ResetPasswordPage />} />
        <Route path="/" element={<ProtectedRoute><HomePage /></ProtectedRoute>} />
        <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
        <Route path="/profile/:id" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
        <Route path="/game/vs-computer" element={<ProtectedRoute><GamePage gameMode="vs-computer" /></ProtectedRoute>} />
        <Route path="/game/private-room" element={<ProtectedRoute><GamePage gameMode="private-room" /></ProtectedRoute>} />
        <Route path="/game/random-match" element={<ProtectedRoute><GamePage gameMode="random-match" /></ProtectedRoute>} />
        <Route path="/game/nakama" element={<ProtectedRoute><NakamaGamePage /></ProtectedRoute>} />
        <Route path="/game/nakama-game" element={<ProtectedRoute><NakamaGamePage /></ProtectedRoute>} />
        <Route path="/nakama-game" element={<ProtectedRoute><NakamaGamePage /></ProtectedRoute>} />
        <Route path="/game/:matchId" element={<ProtectedRoute><GamePage gameMode="tournament" /></ProtectedRoute>} />
        <Route path="/game" element={<ProtectedRoute><GamePage gameMode="tournament" /></ProtectedRoute>} />
        <Route path="/tournament" element={<ProtectedRoute><TournamentPage /></ProtectedRoute>} />
        <Route path="/private-room-waiting" element={<ProtectedRoute><PrivateRoomWaitingPage /></ProtectedRoute>} />
        <Route path="/tournament-waiting/:tournamentId" element={<ProtectedRoute><TournamentWaitingPage /></ProtectedRoute>} />
        <Route path="/tournament-bracket/:tournamentId" element={<ProtectedRoute><TournamentBracketPage /></ProtectedRoute>} />
        <Route path="/game/tournament" element={<ProtectedRoute><GamePage gameMode="tournament" /></ProtectedRoute>} />
        <Route path="/puzzle-game" element={<ProtectedRoute><PuzzleGamePage /></ProtectedRoute>} />
        <Route path="/tournament-game/:matchId" element={<GamePage gameMode="tournament" />} />
        <Route path="/market" element={<ProtectedRoute><MarketPage /></ProtectedRoute>} />
        <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
        <Route path="/leaderboard" element={<ProtectedRoute><LeaderboardPage /></ProtectedRoute>} />
        <Route path="/chat" element={<ProtectedRoute><ChatPage /></ProtectedRoute>} />
        <Route path="/test-matchmaking" element={<ProtectedRoute><TestMatchmakingPage /></ProtectedRoute>} />
        <Route path="/sync-test" element={<ProtectedRoute><SyncTestPage /></ProtectedRoute>} />
        <Route path="/wheel" element={<ProtectedRoute><WheelPage /></ProtectedRoute>} />
        <Route path="/memory-game" element={<ProtectedRoute><MemoryGamePage /></ProtectedRoute>} />
        <Route path="/grid-simon-says" element={<ProtectedRoute><GridSimonSaysPage /></ProtectedRoute>} />
        <Route path="/reactor-runner" element={<ProtectedRoute><ReactorRunnerPage /></ProtectedRoute>} />
        <Route path="/neon-blitz" element={<ProtectedRoute><NeonBlitzPage /></ProtectedRoute>} />
        <Route path="/snake-game" element={<ProtectedRoute><SnakeGamePage /></ProtectedRoute>} />
        <Route path="/morles-game" element={<ProtectedRoute><MorlesGamePage /></ProtectedRoute>} />
        <Route path="/moderator" element={<ModeratorRoute><ModeratorPage /></ModeratorRoute>} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </>
  );
};

// Global Rematch Dialog
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

// NativeRealtimeManager kaldırıldı - Supabase JS SDK yeterli

// Session Recovery Component
const SessionRecoveryManager = () => {
  useSessionRecovery();
  return null;
};

const App = () => {
  useAppForegroundState();
  useForceReloadOnResume();

  const { manualHideBars } = useImmersiveBars();

  useEffect(() => {
    console.log("[App] 🏥 Bağlantı yöneticileri başlatılıyor...");
    connectionHealthMonitor.start();
    startConnectionMonitor();

    return () => {
      connectionHealthMonitor.stop();
      stopConnectionMonitor();
    };
  }, []);

  useEffect(() => {
    console.log("[App] 🎯 Merkezi Event Hub başlatılıyor...");
    const cleanup = initEventHub();
    return cleanup;
  }, []);

  useAppState({
    onBackground: () => {
      console.log("📱 Uygulama arka plana gitti");
      window.dispatchEvent(new Event('appBackground'));
    },
    onForeground: () => {
      console.log("▶️ Uygulama ön plana geldi");
      manualHideBars();
    },
  });

  // Push Notification
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const saveTokenToSupabase = async (userId: string, tokenValue: string) => {
      try {
        const { error } = await supabase
          .from("profiles")
          .update({ push_token: tokenValue } as any)
          .eq("id", userId as any);

        if (error) console.error("❌ Token kaydedilemedi:", error);
        else console.log("✅ Token kaydedildi");
      } catch (e) {
        console.log("[App] Token kaydetme hatası:", e);
      }
    };

    const initPush = async () => {
      try {
        const permStatus = await SafePushNotifications.checkPermissions();
        if (!permStatus) return;
        
        let finalStatus = permStatus;
        if (permStatus.receive === "prompt") {
          const reqResult = await SafePushNotifications.requestPermissions();
          if (reqResult) finalStatus = reqResult;
        }
        
        if (finalStatus.receive === "granted") {
          await SafePushNotifications.register();
        }
      } catch (e) {
        console.log("[App] Push başlatma hatası:", e);
      }
    };

    initPush();

    let registrationHandle: { remove: () => void } | null = null;
    let notificationHandle: { remove: () => void } | null = null;
    let actionHandle: { remove: () => void } | null = null;

    try {
      registrationHandle = SafePushNotifications.addListener("registration", (token: any) => {
        console.log("🔥 PUSH TOKEN GELDİ:", token.value);
        setTimeout(() => {
          import("@capacitor/preferences").then(({ Preferences }) => {
            Preferences.set({ key: 'temp_push_token', value: token.value }).catch(() => {});
          }).catch(() => {});
        }, 100);
        try { localStorage.setItem("temp_push_token", token.value); } catch {}
      });
    } catch {}

    try {
      notificationHandle = SafePushNotifications.addListener("pushNotificationReceived", (n: any) => {
        console.log("🔔 Bildirim geldi:", n);
      });
    } catch {}

    try {
      actionHandle = SafePushNotifications.addListener("pushNotificationActionPerformed", (n: any) => {
        const data = n.notification?.data;
        if (data?.roomCode) window.location.href = `/game?room=${data.roomCode}`;
      });
    } catch {}

    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === "SIGNED_IN" && session?.user) {
        const storedToken = localStorage.getItem("temp_push_token");
        if (storedToken) await saveTokenToSupabase(session.user.id, storedToken);
      }
    });

    return () => {
      if (authListener?.subscription) {
        authListener.subscription.unsubscribe();
      }
      
      try {
        if (registrationHandle) registrationHandle.remove();
        if (notificationHandle) notificationHandle.remove();
        if (actionHandle) actionHandle.remove();
      } catch (e) {
        console.log("[App] Push cleanup hatası:", e);
      }
    };
  }, []);

  return (
    <ErrorBoundary>
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
              <SessionRecoveryManager />
              <UserProvider>
                {/* NativeRealtimeManager kaldırıldı */}
                <ThemeProvider>
                  <MusicProvider>
                    <MatchmakingWrapper>
                      <GameProvider>
                        <RematchProvider>
                          <GlobalRematchDialog />
                          <BackButtonDialog />
                          <RoomAutoNavigator />
                          <ServerTimeProvider>
                            <TournamentProvider>
                              <NotificationProvider>
                                <AppRoutes />
                              </NotificationProvider>
                            </TournamentProvider>
                          </ServerTimeProvider>
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
    </ErrorBoundary>
  );
};

export default App;
