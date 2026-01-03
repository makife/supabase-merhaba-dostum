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
import { PushNotifications } from "@capacitor/push-notifications";
import { useImmersiveBars } from "@/hooks/useImmersiveBars";
import { supabase } from "@/integrations/supabase/client";
import RoomAutoNavigator from "@/components/RoomAutoNavigator";
import { RematchDialog } from "@/components/RematchDialog";
import { useAppState } from "@/hooks/useAppState";
import { useAppForegroundState } from "@/hooks/useAppForegroundState";
// realtimeManager import kaldırıldı - bağlantı yönetimi ConnectionContext'te
import { OnboardingPermissions } from "@/components/OnboardingPermissions";
import { WelcomeIntroDialog } from "@/components/WelcomeIntroDialog";
import { StatusBar, Style } from "@capacitor/status-bar";
// @ts-ignore - Third-party plugin
import { NavigationBar } from "@ethion/capacitor-navigation-bar";
import { BackButtonDialog } from "@/hooks/useBackButton";
import { initNativeAudio, isNativePlatform } from "@/services/nativeAudioService";

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
  const [showIntroDialog, setShowIntroDialog] = useState(false);

  // LocalStorage temizleme hook'unu kullan
  useLocalStorageClear();

  // Ekran yönlendirmesini kilitle
  useScreenOrientation();

  // Immersive mode'u aktif et (navigasyon tuşlarını gizle)
  //useImmersiveMode();

  useEffect(() => {
    const applyImmersiveMode = async () => {
      if (Capacitor.isNativePlatform()) {
        try {
          // 🔊 Native Audio'yu ÖNCE ve AWAIT ile başlat - kritik!
          if (isNativePlatform()) {
            console.log("🔊 App: Native Audio başlatılıyor...");
            await initNativeAudio();
            console.log("✅ App: Native Audio başlatıldı ve hazır!");
          }

          // Status Bar Rengi ve Stili
          await StatusBar.setStyle({ style: Style.Dark }); // Style.Dark = Yazılar BEYAZ (iOS/Android farkı kafa karıştırır, Android'de Dark stil light content demektir genelde)
          await StatusBar.setBackgroundColor({ color: "#000000" });
          await StatusBar.setOverlaysWebView({ overlay: true });

          // Nav Bar Rengi
          await NavigationBar.setColor({ color: "#000000", darkButtons: false }); // darkButtons: false = İkonlar BEYAZ

          // Gizle
          await StatusBar.hide();
          await NavigationBar.hide();
        } catch (e) {
          console.log("Status bar error:", e);
        }
      }
    };

    applyImmersiveMode();
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
    if (Capacitor.isNativePlatform()) {
      const initPush = async () => {
        try {
          let permStatus = await PushNotifications.checkPermissions();
          if (permStatus.receive === "prompt") {
            permStatus = await PushNotifications.requestPermissions();
          }
          if (permStatus.receive === "granted") {
            // 👇 KRİTİK NOKTA: SESLİ KANAL OLUŞTURMA
            await PushNotifications.createChannel({
              id: "kelimeci_alerts_v2",
              name: "Oyun Bildirimleri",
              description: "Oyun davetleri ve sıra bildirimleri",
              importance: 5,
              visibility: 1,
              sound: "default",
              vibration: true,
              lights: true,
            });
            await PushNotifications.register();
          }
        } catch (e) {
          console.error("Push başlatma hatası:", e);
        }
      };

      initPush();
    }
  }, []);

  if (loading || customLoading) {
    return <LoadingScreen onLoadingComplete={() => setCustomLoading(false)} />;
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
    // Kullanıcı varsa, yükleme bittiyse ve bu açılışta henüz çalışmadıysa
    if (isNative && user && !loading && !initialized.current) {
      console.log("🚀 [NativeRealtimeManager] İlk ateşleme yapılıyor...");
      connect();
      initialized.current = true; // Sadece bir kez çalıştır
    }
  }, [user, loading, isNative, connect]);

  return null;
};

const App = () => {
  // Initialize foreground state tracking globally
  useAppForegroundState();

  // 1. Hook'u sadece bir referans almak için kullanıyoruz
  const { manualHideBars } = useImmersiveBars();

  // 2. Arka plan/ön plan yönetimi (SADECE UI için - bağlantı yönetimi ConnectionContext'te)
  useAppState({
    onBackground: () => {
      console.log("📱 Uygulama arka plana gitti (UI)");
    },
    onForeground: () => {
      // ÖNEMLİ: Uygulama ön plana geldiğinde barları tekrar gizle
      console.log("▶️ Uygulama ön plana geldi - Immersive modu tazeleniyor");
      setTimeout(() => {
        manualHideBars();
      }, 300);
    },
    // NOT: backgroundTimeout ve forceCleanupAll kaldırıldı -
    // Bağlantı yönetimi artık tamamen ConnectionContext'te
  });

  // 👇 PUSH NOTIFICATION ENTEGRASYONU BURADA
  useEffect(() => {
    if (Capacitor.isNativePlatform()) {
      // Yardımcı Fonksiyon: Token'ı Veritabanına Yaz
      const saveTokenToSupabase = async (userId: string, tokenValue: string) => {
        const { error } = await supabase
          .from("profiles")
          .update({ push_token: tokenValue } as any)
          .eq("id", userId as any);

        if (error) console.error("❌ Token kaydedilemedi:", error);
        else console.log("✅ Token veritabanına başarıyla kaydedildi!");
      };

      const initPush = async () => {
        try {
          let permStatus = await PushNotifications.checkPermissions();
          if (permStatus.receive === "prompt") {
            permStatus = await PushNotifications.requestPermissions();
          }
          if (permStatus.receive === "granted") {
            await PushNotifications.register();
          }
        } catch (e) {
          console.error("Push başlatma hatası:", e);
        }
      };

      initPush();

      // 1. Token Gelince Çalışan Listener
      const registrationListener = PushNotifications.addListener("registration", async (token) => {
        console.log("🔥🔥🔥 PUSH TOKEN GELDİ:", token.value);

        // Token'ı her ihtimale karşı telefona kaydet (Kullanıcı yoksa bile elimizde olsun)
        localStorage.setItem("temp_push_token", token.value);

        // Eğer şu an açık bir oturum varsa hemen kaydet
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (user) {
          await saveTokenToSupabase(user.id, token.value);
        } else {
          console.log("⚠️ Kullanıcı henüz giriş yapmamış, token hafızaya alındı.");
        }
      });

      // 2. Kullanıcı Giriş Yapınca Çalışan Dinleyici (YENİ EKLENEN KISIM)
      const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
        if (event === "SIGNED_IN" && session?.user) {
          console.log("👤 Kullanıcı giriş yaptı, token kontrol ediliyor...");
          // Hafızada bekleyen token var mı?
          const storedToken = localStorage.getItem("temp_push_token");
          if (storedToken) {
            console.log("📦 Hafızadaki token bulundu, veritabanına yazılıyor...");
            await saveTokenToSupabase(session.user.id, storedToken);
          }
        }
      });

      const notificationListener = PushNotifications.addListener("pushNotificationReceived", (notification) => {
        console.log("🔔 Bildirim geldi:", notification);
      });

      const actionListener = PushNotifications.addListener("pushNotificationActionPerformed", (notification) => {
        const data = notification.notification.data;
        if (data?.roomCode) {
          window.location.href = `/game?room=${data.roomCode}`;
        }
      });


    // BURADAN İTİBAREN SİLİP YAPIŞTIRABİLİRSİN
    return () => {
      // Auth aboneliğini (Supabase) hemen kapat
      if (authListener?.subscription) {
        authListener.subscription.unsubscribe();
        console.log("🔐 Auth aboneliği temizlendi.");
      }

      // Capacitor Listener'larını temizle (Hatayı engelleyen asenkron yapı)
      const performCleanup = async () => {
        try {
          // Önce tüm listener handle'larının çözülmesini bekle
          const [reg, notify, action] = await Promise.all([
            registrationListener,
            notificationListener,
            actionListener
          ]);

          // Eğer handle varsa sil
          if (reg) await reg.remove();
          if (notify) await notify.remove();
          if (action) await action.remove();

          console.log("✅ Tüm Push listener'lar başarıyla kaldırıldı.");
        } catch (e) {
          // Uygulama kapanırken bazen listener bulunamaz, bu normaldir
          console.warn("⚠️ Temizlik sırasında ufak bir aksama:", e);
        }
      };

      performCleanup();
    };
    // Parantezlerin kapanış sırası: 
    // } = cleanup fonksiyonu sonu
    // ) = return sonu
    // } = useEffect fonksiyonu sonu
    // , [] = dependency array
    // ) = useEffect çağrısı sonu
  }, []);

  // App.tsx içindeki return kısmı
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
          {/* 1. KADEME: AuthProvider (En Dışta - Kimlik Yönetimi) */}
          <AuthProvider>
            {/* 2. KADEME: UserProvider (Profil Verisi) */}
            <UserProvider>
              {/* Native Realtime Manager - Android'de native WebSocket yönetir */}
              <NativeRealtimeManager />
              <ThemeProvider>
                <MusicProvider>
                  <MatchmakingWrapper>
                    <GameProvider>
                      <RematchProvider>
                        <GlobalRematchDialog />
                        <BackButtonDialog />
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
