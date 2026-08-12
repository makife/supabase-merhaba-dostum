import { useEffect, useCallback, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Capacitor } from "@capacitor/core";
import { App } from "@capacitor/app";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

// Oyun sayfaları - bu sayfalarda geri tuşu ile çıkış onayı gösterilecek
const GAME_ROUTES = [
  "/game/vs-computer",
  "/game/private-room",
  "/game/random-match",
  "/game/nakama",
  "/game/nakama-game",
  "/nakama-game",
  "/game/tournament",
  "/tournament-game",
];

// Ana sayfa - burada uygulamadan çıkış onayı gösterilecek
const HOME_ROUTE = "/";

// Dialog gösterilmeyecek sayfalar (normal geri gitme)
const ALLOW_BACK_ROUTES = [
  "/profile",
  "/settings",
  "/market",
  "/leaderboard",
  "/chat",
  "/challenge",
  "/game-modes",
  "/wheel",
  "/memory-game",
  "/puzzle-game",
  "/grid-simon-says",
  "/reactor-runner",
  "/neon-blitz",
  "/snake-game",
  "/morles-game",
];

type DialogType = "game-exit" | "app-exit" | null;

export const useBackButton = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [dialogType, setDialogType] = useState<DialogType>(null);

  const isGamePage = useCallback((path: string) => {
    return GAME_ROUTES.some(route => path.startsWith(route)) || 
           path.match(/^\/game\/[a-zA-Z0-9-]+/);
  }, []);

  const isBotRematchWaitingPage = useCallback((path: string, search: string) => {
    return path.startsWith("/private-room/waiting") && new URLSearchParams(search).get("botRematch") === "1";
  }, []);

  const isHomePage = useCallback((path: string) => {
    return path === HOME_ROUTE;
  }, []);

  const canGoBack = useCallback((path: string) => {
    return ALLOW_BACK_ROUTES.some(route => path.startsWith(route));
  }, []);

  const handleBackButton = useCallback(() => {
    const currentPath = location.pathname;

    // Oyun sayfasındaysa - çıkış onayı göster
    if (isGamePage(currentPath) || isBotRematchWaitingPage(currentPath, location.search)) {
      setDialogType("game-exit");
      return;
    }

    // Ana sayfadaysa - uygulamadan çıkış onayı göster
    if (isHomePage(currentPath)) {
      setDialogType("app-exit");
      return;
    }

    // Diğer sayfalarda normal geri git
    if (canGoBack(currentPath)) {
      navigate(-1);
      return;
    }

    // Tanımsız sayfa - ana sayfaya git
    navigate("/");
  }, [location.pathname, location.search, isGamePage, isBotRematchWaitingPage, isHomePage, canGoBack, navigate]);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const listener = App.addListener("backButton", (event) => {
      // canGoBack false ise browser history yok demek
      // Ama biz kendi logic'imizi uyguluyoruz
      handleBackButton();
    });

    return () => {
      listener.then(l => l.remove());
    };
  }, [handleBackButton]);

  const handleGameExit = useCallback(() => {
    setDialogType(null);
    navigate("/");
  }, [navigate]);

  const handleAppExit = useCallback(() => {
    setDialogType(null);
    App.exitApp();
  }, []);

  const handleCancel = useCallback(() => {
    setDialogType(null);
  }, []);

  return {
    dialogType,
    handleGameExit,
    handleAppExit,
    handleCancel,
  };
};

// Dialog component
export const BackButtonDialog: React.FC = () => {
  const { dialogType, handleGameExit, handleAppExit, handleCancel } = useBackButton();

  if (!dialogType) return null;

  const isGameExit = dialogType === "game-exit";

  return (
    <AlertDialog open={!!dialogType} onOpenChange={(open) => !open && handleCancel()}>
      <AlertDialogContent className="max-w-[90%] sm:max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle>
            {isGameExit ? "Oyundan Çık" : "Uygulamadan Çık"}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {isGameExit 
              ? "Oyundan çıkmak istediğinize emin misiniz? Aktif maçtan çıkarsanız puan kaybedebilirsiniz."
              : "Uygulamadan çıkmak istediğinize emin misiniz?"
            }
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={handleCancel}>İptal</AlertDialogCancel>
          <AlertDialogAction 
            onClick={isGameExit ? handleGameExit : handleAppExit}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isGameExit ? "Oyundan Çık" : "Çık"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
