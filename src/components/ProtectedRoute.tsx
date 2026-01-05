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
  const redirectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // 🔧 User geldiğinde TÜM bekleme state'lerini temizle
  useEffect(() => {
    if (user) {
      console.log("✅ [ProtectedRoute] User geldi, tüm loading/redirect state'leri temizleniyor");
      setShowLoadingLonger(false);
      setGiveUpAndRedirect(false);
      setOptimisticAuth(false);
      setShowReconnectOverlay(false);
      
      // Bekleyen timeout'ları temizle
      if (redirectTimeoutRef.current) {
        clearTimeout(redirectTimeoutRef.current);
        redirectTimeoutRef.current = null;
      }
    }
  }, [user]);

  useEffect(() => {
    let timeout: NodeJS.Timeout;
    let optimisticTimeout: NodeJS.Timeout;

    if (!authLoading) {
      // Auth yüklemesi bittikten 300ms sonra loading'i kapat
      timeout = setTimeout(() => setShowLoadingLonger(false), 300);
    }

    // 🆕 AGRESİF OPTİMİSTİC AUTH: 800ms içinde user gelmezse cached session'a bak
    optimisticTimeout = setTimeout(async () => {
      if (!user && !hasCheckedCacheRef.current) {
        hasCheckedCacheRef.current = true;
        console.log("⏰ [ProtectedRoute] 800ms doldu, agresif optimistic auth kontrolü...");
        
        try {
          const cachedSession = await getCachedSession();
          if (cachedSession && cachedSession.expiresAt > Date.now()) {
            console.log("✅ [ProtectedRoute] Cached session bulundu, ANINDA optimistic auth aktif");
            setOptimisticAuth(true);
            setShowReconnectOverlay(true);
            
            // 5 saniye sonra overlay'i kapat (daha hızlı)
            setTimeout(() => setShowReconnectOverlay(false), 5000);
          }
        } catch (e) {
          console.error("[ProtectedRoute] Cache kontrol hatası:", e);
        }
      }
    }, 800); // 🔧 2000ms -> 800ms (daha agresif)

    // 🔧 3 saniye boyunca hiçbir şey olmazsa güvenli redirect (5s -> 3s)
    redirectTimeoutRef.current = setTimeout(() => {
      if (!user && !optimisticAuth) {
        console.log("⏰ [ProtectedRoute] 3sn zaman aşımı, /auth'a yönlendiriliyor...");
        setGiveUpAndRedirect(true);
      }
    }, 3000);

    return () => {
      clearTimeout(timeout);
      clearTimeout(optimisticTimeout);
      if (redirectTimeoutRef.current) {
        clearTimeout(redirectTimeoutRef.current);
      }
    };
  }, [authLoading, user, optimisticAuth]);

  // Optimistic auth aktifken user gelirse
  useEffect(() => {
    if (user && optimisticAuth) {
      console.log("✅ [ProtectedRoute] Gerçek user geldi, optimistic auth kapatılıyor");
      setOptimisticAuth(false);
      setShowReconnectOverlay(false);
    }
  }, [user, optimisticAuth]);

  // 🔧 1. USER VARSA - HEMEN children göster (en öncelikli)
  if (user) {
    return (
      <>
        {children}
        <ReconnectingOverlay 
          isVisible={showReconnectOverlay} 
          status="reconnecting"
        />
      </>
    );
  }

  // 2. İlk yükleme anı (user henüz gelmedi)
  if (authLoading || showLoadingLonger) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-primary"></div>
        <p className="mt-4 text-muted-foreground">Kelimele yükleniyor...</p>
      </div>
    );
  }

  // 3. Zaman aşımı olduysa ve optimistic auth da yoksa -> /auth'a git
  if (giveUpAndRedirect && !optimisticAuth) {
    console.log("🚪 [ProtectedRoute] Redirect to /auth");
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  // 4. Optimistic auth aktifse - sayfayı göster ama overlay ekle
  if (optimisticAuth) {
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

  // 5. User yok ama sistem bağlı - kısa süre bekle
  if (isSystemConnected) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background">
        <div className="flex flex-col items-center space-y-4">
          <div className="relative">
            <div className="w-16 h-16 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
          </div>
          <p className="text-primary font-medium animate-pulse">Bağlantı tazeleniyor...</p>
          <p className="text-xs text-muted-foreground">Oturumunuz güvenli bir şekilde korunuyor</p>
        </div>
      </div>
    );
  }

  // 6. Hiçbir koşul sağlanmadı - loading göster
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background">
      <div className="animate-spin rounded-full h-12 w-12 border-t-4 border-b-4 border-primary"></div>
    </div>
  );
};

export default ProtectedRoute;
