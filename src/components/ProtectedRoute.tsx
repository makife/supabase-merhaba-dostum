import { useAuth } from "@/contexts/AuthContext";
import { useUser } from "@/contexts/UserContext";
import { Navigate, useLocation } from "react-router-dom";
import { ReactNode, useEffect, useState, useRef } from "react";
import { getCachedSession } from "@/utils/persistentState";
import { ReconnectingOverlay } from "@/components/ReconnectingOverlay";

interface ProtectedRouteProps {
  children: ReactNode;
}

const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
  const { user, loading: authLoading } = useAuth();
  const { isSystemConnected } = useUser();
  const location = useLocation();

  // State'ler
  const [showLoadingLonger, setShowLoadingLonger] = useState(true);
  const [giveUpAndRedirect, setGiveUpAndRedirect] = useState(false);
  const [optimisticAuth, setOptimisticAuth] = useState(false);
  const [showReconnectOverlay, setShowReconnectOverlay] = useState(false);
  
  const hasCheckedCacheRef = useRef(false);

  useEffect(() => {
    let timeout: NodeJS.Timeout;
    let optimisticTimeout: NodeJS.Timeout;
    let giveUpTimeout: NodeJS.Timeout;

    if (!authLoading) {
      // Auth yüklemesi bittikten yarım saniye sonra normal akışa geç
      timeout = setTimeout(() => setShowLoadingLonger(false), 500);
    }

    // 🆕 OPTİMİSTİC AUTH: 3 saniye içinde user gelmezse ama Native bağlıysa
    // cached session'a bak ve geçici olarak izin ver
    optimisticTimeout = setTimeout(async () => {
      if (!user && isSystemConnected && !hasCheckedCacheRef.current) {
        hasCheckedCacheRef.current = true;
        console.log("⏰ [ProtectedRoute] 3sn doldu, optimistic auth kontrolü...");
        
        try {
          const cachedSession = await getCachedSession();
          if (cachedSession && cachedSession.expiresAt > Date.now()) {
            console.log("✅ [ProtectedRoute] Cached session bulundu, optimistic auth aktif");
            setOptimisticAuth(true);
            setShowReconnectOverlay(true);
            
            // 10 saniye sonra overlay'i kapat (session gelmiş olmalı)
            setTimeout(() => setShowReconnectOverlay(false), 10000);
          }
        } catch (e) {
          console.error("[ProtectedRoute] Cache kontrol hatası:", e);
        }
      }
    }, 3000);

    // KRİTİK: 8 saniye boyunca hiçbir şey olmazsa redirect
    giveUpTimeout = setTimeout(() => {
      if (!user && !optimisticAuth) {
        console.log("⏰ [ProtectedRoute] 8sn zaman aşımı, yönlendiriliyor...");
        setGiveUpAndRedirect(true);
      }
    }, 8000);

    return () => {
      clearTimeout(timeout);
      clearTimeout(optimisticTimeout);
      clearTimeout(giveUpTimeout);
    };
  }, [authLoading, user, isSystemConnected, optimisticAuth]);

  // User geldiğinde optimistic auth'u kapat ve overlay'i kaldır
  useEffect(() => {
    if (user && optimisticAuth) {
      console.log("✅ [ProtectedRoute] Gerçek user geldi, optimistic auth kapatılıyor");
      setOptimisticAuth(false);
      setShowReconnectOverlay(false);
    }
  }, [user, optimisticAuth]);

  // 1. İlk yükleme anı
  if (authLoading || showLoadingLonger) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-primary"></div>
        <p className="mt-4 text-muted-foreground">Kelimele yükleniyor...</p>
      </div>
    );
  }

  // 2. Zaman aşımı olduysa ve optimistic auth da yoksa
  if (giveUpAndRedirect && !optimisticAuth) {
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  // 3. Optimistic auth aktifse - sayfayı göster ama overlay ekle
  if (optimisticAuth && !user) {
    return (
      <>
        {children}
        <ReconnectingOverlay 
          isVisible={showReconnectOverlay} 
          status="restoring"
          message="Oturumunuz geri yükleniyor..."
        />
      </>
    );
  }

  // 4. Geçici kopma koruması: User yok ama Native bağlı - overlay ile bekle
  if (!user && isSystemConnected) {
    return (
      <>
        <div className="min-h-screen flex flex-col items-center justify-center bg-background">
          <div className="flex flex-col items-center space-y-4">
            <div className="relative">
              <div className="w-16 h-16 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
            </div>
            <p className="text-primary font-medium animate-pulse">Bağlantı tazeleniyor...</p>
            <p className="text-xs text-muted-foreground">Oturumunuz güvenli bir şekilde korunuyor</p>
          </div>
        </div>
      </>
    );
  }

  // 5. Her şey tamam
  return (
    <>
      {children}
      {/* Bağlantı koptuğunda overlay göster */}
      <ReconnectingOverlay 
        isVisible={showReconnectOverlay && !!user} 
        status="reconnecting"
      />
    </>
  );
};

export default ProtectedRoute;
