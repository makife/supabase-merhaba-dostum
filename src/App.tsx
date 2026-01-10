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
import { ServerTimeProvider, useServerTimeContext } from "@/contexts/ServerTimeContext";
import { RematchProvider, useRematchContext } from "@/contexts/RematchContext";
import NativeRealtime from "@/plugins/NativeRealtime";
import { useNativeRealtime } from "@/hooks/useNativeRealtime";
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
// realtimeManager import kaldırıldı - bağlantı yönetimi ConnectionContext'te
import { OnboardingPermissions } from "@/components/OnboardingPermissions";
import { WelcomeIntroDialog } from "@/components/WelcomeIntroDialog";
// StatusBar ve NavigationBar import'ları kaldırıldı - SafePluginWrapper kullanılıyor
import { BackButtonDialog } from "@/hooks/useBackButton";
import { initNativeAudio, isNativePlatform } from "@/services/nativeAudioService";
import { ReconnectingOverlay } from "@/components/ReconnectingOverlay";
import { useReconnectionState } from "@/hooks/useReconnectionState";
import { connectionHealthMonitor } from "@/utils/connectionHealthMonitor";
import { startConnectionMonitor, stopConnectionMonitor } from "@/utils/supabaseConnectionManager";
import { useSessionRecovery } from "@/hooks/useSessionRecovery";
import { 
  startForegroundOrchestration, 
  abortAllPendingForegroundTasks 
} from "@/utils/foregroundOrchestrator";
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
  // 🔧 İlk açılışta true, sonraki render'larda sessionStorage'dan kontrol et
  const [customLoading, setCustomLoading] = useState(() => {
    // Eğer daha önce loading tamamlandıysa, tekrar gösterme
    if (typeof window !== 'undefined' && sessionStorage.getItem('app-loaded')) {
      return false;
    }
    return true;
  });
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showIntroDialog, setShowIntroDialog] = useState(false);

  // LocalStorage temizleme hook'unu kullan
  useLocalStorageClear();

  // Ekran yönlendirmesini kilitle
  useScreenOrientation();

  // Immersive mode'u aktif et (navigasyon tuşlarını gizle)
  //useImmersiveMode();

  useEffect(() => {
    const initializeApp = async () => {
      if (!Capacitor.isNativePlatform()) return;
      
      // 🔥 FOREGROUND SERVICE - NON-BLOCKING! (App başlamasını bloke etmemeli)
      // Fire-and-forget pattern - hata olsa bile app çalışmaya devam etmeli
      import("@/utils/backgroundServiceManager")
        .then(({ BackgroundServiceManager }) => {
          console.log("🔔 App: Foreground Service başlatılıyor...");
          // Timeout ile sarmalayarak sonsuz beklemeyi önle
          const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error("FS init timeout")), 5000)
          );
          Promise.race([BackgroundServiceManager.init(), timeoutPromise])
            .then(() => console.log("✅ App: Foreground Service başlatıldı!"))
            .catch((e) => console.warn("[App] FS init timeout/hata (tolere edildi):", e));
        })
        .catch((e) => console.warn("[App] FS import hatası (tolere edildi):", e));
      
      try {
        // 🔊 Native Audio'yu başlat
        if (isNativePlatform()) {
          console.log("🔊 App: Native Audio başlatılıyor...");
          await initNativeAudio();
          console.log("✅ App: Native Audio başlatıldı ve hazır!");
        }
      } catch (e) {
        console.log("[App] Native Audio init hatası tolere edildi:", e);
      }

      // Status Bar ve Nav Bar - Safe wrapper kullanır
      try {
        await SafeStatusBar.setStyle({ style: "Dark" });
        await SafeStatusBar.setBackgroundColor({ color: "#000000" });
        await SafeStatusBar.setOverlaysWebView({ overlay: true });
        await SafeNavigationBar.setColor({ color: "#000000", darkButtons: false });
        await SafeStatusBar.hide();
        await SafeNavigationBar.hide();
      } catch (e) {
        console.log("[App] Immersive mode hatası tolere edildi:", e);
      }
    };

    initializeApp();
  }, []);

  // İlk açılış kontrolü
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
          // 👇 KRİTİK NOKTA: SESLİ KANAL OLUŞTURMA
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
        console.log("[App] Push başlatma hatası tolere edildi:", e);
      }
    };

    initPush();
  }, []);

  // Loading tamamlandığında sessionStorage'a kaydet
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

const NativeRealtimeManager = () => {
  const { user, loading } = useAuth();
  const { connect, isNative } = useNativeRealtime();
  const initialized = useRef(false);

  useEffect(() => {
    // Sadece bir kez ve kullanıcı varken ateşle
    if (isNative && user && !loading && !initialized.current) {
      console.log("🚀 [NativeRealtimeManager] Native WebSocket motoru ateşleniyor...");
      connect();
      initialized.current = true;
    }
  }, [user, loading, isNative, connect]);

  return null;
};

// 🆕 GLOBAL RECONNECTION OVERLAY
const GlobalReconnectionOverlay = () => {
  const { isOverlayVisible, status } = useReconnectionState();

  return (
    <ReconnectingOverlay
      isVisible={isOverlayVisible}
      status={status === "disconnected" ? "restoring" : status === "reconnecting" ? "reconnecting" : "connecting"}
      message={status === "disconnected" ? "Bağlantı geri yükleniyor..." : undefined}
    />
  );
};

// 🆕 Session Recovery Component - HybridStorage ile çalışan versiyon
// AuthContext + useSessionRecovery birlikte daha güçlü
const SessionRecoveryManager = () => {
  useSessionRecovery(); // 🔥 YENİDEN AKTİF - HybridStorage ile uyumlu
  return null;
};

const App = () => {
  // Initialize foreground state tracking globally
  useAppForegroundState();

  // 1. Hook'u sadece bir referans almak için kullanıyoruz
  const { manualHideBars } = useImmersiveBars();

  // 🆕 ConnectionHealthMonitor + SupabaseConnectionManager başlat
  useEffect(() => {
    console.log("[App] 🏥 Bağlantı yöneticileri başlatılıyor...");
    connectionHealthMonitor.start();
    startConnectionMonitor();

    return () => {
      connectionHealthMonitor.stop();
      stopConnectionMonitor();
    };
  }, []);

  // 2. Arka plan/ön plan yönetimi - KADEMELİ UYANIŞLA (STAGGERED)
  useAppState({
    onBackground: () => {
      console.log("📱 Uygulama arka plana gitti (UI)");
      // Zombi istek temizliği için abort controller'ı hazırla
      abortAllPendingForegroundTasks();
    },
    onForeground: () => {
      console.log("▶️ Uygulama ön plana geldi - KADEMELİ UYANIS başlıyor");
      
      // 🆕 Önce tüm zombi istekleri temizle
      abortAllPendingForegroundTasks();
      
      // 🆕 Kademeli orchestration başlat
      startForegroundOrchestration({
        onUIReady: () => {
          // T+0ms: UI hazırlığı (immersive bars)
          manualHideBars();
        },
        onAuthRecovery: () => {
          // T+400ms: Auth recovery (AuthContext kendi içinde yapıyor)
          window.dispatchEvent(new CustomEvent('app-auth-recovery'));
        },
        onTimeSync: () => {
          // T+1000ms: ServerTime sync
          window.dispatchEvent(new CustomEvent('app-time-sync'));
        },
        onDataRefresh: () => {
          // T+1800ms: Global veri tazeleme
          window.dispatchEvent(new CustomEvent('supabase-reconnected'));
        },
        onComplete: () => {
          console.log("[App] ✅ Kademeli uyanış tamamlandı");
        },
        onBridgeHealthFail: () => {
          // 🔧 Bridge Sağlık Kontrolü: 3 saniye sonra hala tıkalıysa
          console.log("[App] ⚠️ Bridge health fail - session restore from storage");
          window.dispatchEvent(new CustomEvent('app-force-restore'));
        }
      });
    },
  });

  // 👇 PUSH NOTIFICATION ENTEGRASYONU (SAFE WRAPPER İLE)
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const saveTokenToSupabase = async (userId: string, tokenValue: string) => {
      try {
        const { error } = await supabase
          .from("profiles")
          .update({ push_token: tokenValue } as any)
          .eq("id", userId as any);

        if (error) console.error("❌ Token kaydedilemedi:", error);
        else console.log("✅ Token veritabanına başarıyla kaydedildi!");
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
        console.log("[App] Push başlatma hatası tolere edildi:", e);
      }
    };

    initPush();

    // 🔧 KRİTİK: FIRE-AND-FORGET - ASLA await/.then() KULLANMA!
    // SafePushNotifications.addListener sync bir fake handle döndürüyor
    let registrationHandle: { remove: () => void } | null = null;
    let notificationHandle: { remove: () => void } | null = null;
    let actionHandle: { remove: () => void } | null = null;

    // 🆕 SYNC olarak listener'ları kur - await/.then() YOK!
    // 🔧 KRİTİK: Bridge çökmesini önlemek için tamamen senkron, ateşle-unut modda
    try {
      registrationHandle = SafePushNotifications.addListener("registration", (token: any) => {
        console.log("🔥🔥🔥 PUSH TOKEN GELDİ:", token.value);
        // 🆕 NATIVE STORAGE ZORUNLULUĞU: Preferences (native storage) öncelikli!
        // setTimeout ile bridge trafiği rahatladıktan sonra kaydet
        setTimeout(() => {
          import("@capacitor/preferences").then(({ Preferences }) => {
            Preferences.set({ key: 'temp_push_token', value: token.value }).catch(() => {});
          }).catch(() => {});
        }, 100);
        // Fallback olarak localStorage'a da kaydet (sync, hemen)
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

    // Cleanup - safe
    return () => {
      if (authListener?.subscription) {
        authListener.subscription.unsubscribe();
      }
      
      // Handle'ları temizle
      try {
        if (registrationHandle) registrationHandle.remove();
        if (notificationHandle) notificationHandle.remove();
        if (actionHandle) actionHandle.remove();
      } catch (e) {
        console.log("[App] Push cleanup hatası:", e);
      }
    };
  }, []);

  // App.tsx içindeki return kısmı
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
            {/* 1. KADEME: AuthProvider (En Dışta - Kimlik Yönetimi) */}
            <AuthProvider>
              {/* 🆕 Session Recovery - Native'de arka plandan gelince session'ı kurtarır */}
              <SessionRecoveryManager />
              {/* 2. KADEME: UserProvider (Profil Verisi) */}
              <UserProvider>
                {/* Native Realtime Manager - Android'de native WebSocket yönetir */}
                <NativeRealtimeManager />
                {/* 🆕 GLOBAL RECONNECTION OVERLAY */}
                <GlobalReconnectionOverlay />
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
